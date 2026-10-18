// Pruebas de RLS y triggers contra Supabase LOCAL (`supabase start`).
// Crea un administrador y un usuario de personal y verifica, vía la API real
// (PostgREST) con la sesión de cada uno, qué pueden leer y modificar.
//
// Uso: `npm run test:rls` (requiere `supabase start`). Aborta si la URL no es
// local. Cada ejecución usa emails e ids nuevos: se puede repetir sin reset.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

function localEnv() {
  if (
    process.env.API_URL &&
    process.env.ANON_KEY &&
    process.env.SERVICE_ROLE_KEY
  ) {
    return process.env
  }
  const out = execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8',
  })
  const env = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const { API_URL: API, ANON_KEY: ANON, SERVICE_ROLE_KEY: SVC } = localEnv()
if (!API || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) {
  console.error(`Abortado: API_URL no es local (${API}).`)
  process.exit(2)
}

async function http(
  method,
  path,
  { token, key = ANON, body, prefer = 'return=representation' } = {},
) {
  const res = await fetch(API + path, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // respuesta no JSON
  }
  return { status: res.status, data }
}

// Lectura como service_role (bypassa RLS) para comprobar el estado real.
async function leer(path) {
  const r = await http('GET', `/rest/v1/${path}`, { key: SVC })
  return r.data
}

const run = randomUUID().slice(0, 8)
const PASSWORD = 'Test-1234!'

async function crearUsuario(alias, rol) {
  const email = `${alias}-${run}@test.local`
  const r = await http('POST', '/auth/v1/admin/users', {
    key: SVC,
    body: { email, password: PASSWORD, email_confirm: true },
  })
  if (r.status !== 200) throw new Error(`crear usuario ${alias}: ${r.status}`)
  const p = await http('POST', '/rest/v1/perfiles', {
    key: SVC,
    body: { id: r.data.id, nombre: alias, rol },
  })
  if (p.status !== 201) throw new Error(`perfil ${alias}: ${p.status}`)
  const t = await http('POST', '/auth/v1/token?grant_type=password', {
    body: { email, password: PASSWORD },
  })
  if (t.status !== 200) throw new Error(`login ${alias}: ${t.status}`)
  return { id: r.data.id, token: t.data.access_token }
}

// Fila singleton de configuración (la base local no tiene seed).
await http('POST', '/rest/v1/configuracion_clinica?on_conflict=id', {
  key: SVC,
  body: { id: 'global', nombre: 'Clínica de prueba' },
  prefer: 'resolution=merge-duplicates',
})

const adm = await crearUsuario('admin', 'administrador')
const per = await crearUsuario('personal', 'personal')
const insumo = randomUUID()
const lote = randomUUID()
const ahora = new Date().toISOString()

let fallas = 0
function check(nombre, ok, detalle = '') {
  if (!ok) fallas++
  console.log(
    `${ok ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? `  [${detalle}]` : ''}`,
  )
}

let r = await http('POST', '/rest/v1/insumos', {
  token: adm.token,
  body: {
    id: insumo,
    nombre: 'Anestesia',
    categoria: 'Cirugía',
    unidad_medida: 'cartucho',
    permite_decimales: false,
    stock_minimo: 5,
  },
})
check(
  'administrador da de alta un insumo',
  r.status === 201,
  `HTTP ${r.status}`,
)

r = await http('POST', '/rest/v1/lotes', {
  token: per.token,
  body: { id: lote, insumo_id: insumo, numero_lote: 'L1', proveedor: 'P' },
})
check('personal crea un lote', r.status === 201, `HTTP ${r.status}`)

const movimiento = (usuario_id) => ({
  id: randomUUID(),
  tipo: 'consumo',
  lote_id: lote,
  cantidad: 1,
  usuario_id,
  creado_en: ahora,
})
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: movimiento(per.id),
})
check(
  'personal registra un consumo propio',
  r.status === 201,
  `HTTP ${r.status}`,
)
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: movimiento(adm.id),
})
check(
  'personal no registra movimientos a nombre de otro',
  r.status === 403,
  `HTTP ${r.status}`,
)

// Reenvío de un movimiento que ya llegó (p. ej. se perdió la respuesta): el
// sync usa ON CONFLICT DO NOTHING porque la tabla es solo-INSERT.
const yaSubido = movimiento(per.id)
await http('POST', '/rest/v1/movimientos', { token: per.token, body: yaSubido })
r = await http('POST', '/rest/v1/movimientos?on_conflict=id', {
  token: per.token,
  body: yaSubido,
  prefer: 'resolution=ignore-duplicates,return=minimal',
})
check(
  'reenviar un movimiento existente con DO NOTHING no falla',
  r.status === 201 || r.status === 200,
  `HTTP ${r.status}`,
)
r = await http('POST', '/rest/v1/movimientos?on_conflict=id', {
  token: per.token,
  body: yaSubido,
  prefer: 'resolution=merge-duplicates,return=minimal',
})
check(
  'reenviarlo con DO UPDATE sí falla (por eso el sync usa DO NOTHING)',
  r.status === 403,
  `HTTP ${r.status}`,
)

r = await http('PATCH', `/rest/v1/movimientos?lote_id=eq.${lote}`, {
  token: adm.token,
  body: { cantidad: 99 },
})
check(
  'movimientos no editables, ni por administrador',
  Array.isArray(r.data) && r.data.length === 0,
  `HTTP ${r.status}`,
)
const antes = (await leer(`movimientos?select=id&lote_id=eq.${lote}`)).length
r = await http('DELETE', `/rest/v1/movimientos?lote_id=eq.${lote}`, {
  token: adm.token,
})
const quedan = await leer(`movimientos?select=id&lote_id=eq.${lote}`)
check(
  'movimientos no borrables, ni por administrador',
  antes > 0 && quedan.length === antes,
  `${quedan.length}/${antes} filas`,
)

await http('PATCH', `/rest/v1/insumos?id=eq.${insumo}`, {
  token: per.token,
  body: { nombre: 'Cambiado', stock_minimo: 0 },
})
let [fila] = await leer(`insumos?select=nombre,stock_minimo&id=eq.${insumo}`)
check(
  'personal no cambia datos de catálogo (trigger)',
  fila.nombre === 'Anestesia' && fila.stock_minimo === 5,
  `${fila.nombre}/${fila.stock_minimo}`,
)
await http('PATCH', `/rest/v1/insumos?id=eq.${insumo}`, {
  token: adm.token,
  body: { stock_minimo: 3 },
})
;[fila] = await leer(`insumos?select=stock_minimo&id=eq.${insumo}`)
check(
  'administrador sí cambia datos de catálogo',
  fila.stock_minimo === 3,
  `${fila.stock_minimo}`,
)

await http('DELETE', `/rest/v1/insumos?id=eq.${insumo}`, { token: adm.token })
const insumos = await leer(`insumos?select=id&id=eq.${insumo}`)
check('insumos no se borran físicamente', insumos.length === 1)

await http('PATCH', `/rest/v1/perfiles?id=eq.${per.id}`, {
  token: per.token,
  body: { rol: 'administrador' },
})
const [perfil] = await leer(`perfiles?select=rol&id=eq.${per.id}`)
check(
  'personal no puede hacerse administrador',
  perfil.rol === 'personal',
  perfil.rol,
)

r = await http('GET', '/rest/v1/perfiles?select=id', { token: per.token })
check(
  'personal ve solo su perfil',
  r.data.length === 1 && r.data[0].id === per.id,
  `${r.data.length} filas`,
)

await http('PATCH', '/rest/v1/configuracion_clinica?id=eq.global', {
  token: per.token,
  body: { nombre: 'x' },
})
const [config] = await leer('configuracion_clinica?select=nombre&id=eq.global')
check(
  'personal no modifica la configuración de la clínica',
  config.nombre !== 'x',
  config.nombre,
)

// Spec 012 FR-011: umbral de pendientes antiguos en configuracion_alertas.
const upsertAlertas = (token, body) =>
  http('POST', '/rest/v1/configuracion_alertas?on_conflict=id', {
    token,
    body: { id: 'global', ...body },
    prefer: 'resolution=merge-duplicates,return=minimal',
  })
const horasAviso = async () =>
  (await leer('configuracion_alertas?select=horas_aviso_pendientes&id=eq.global'))[0]
    ?.horas_aviso_pendientes

r = await upsertAlertas(adm.token, {
  niveles_aviso_dias: [30, 7, 1],
  horas_aviso_pendientes: 12,
})
check(
  'administrador fija el umbral de pendientes',
  r.status < 300 && (await horasAviso()) === 12,
  `HTTP ${r.status}`,
)
r = await upsertAlertas(per.token, {
  niveles_aviso_dias: [30, 7, 1],
  horas_aviso_pendientes: 48,
})
check(
  'personal no modifica el umbral de pendientes',
  r.status === 403 && (await horasAviso()) === 12,
  `HTTP ${r.status}`,
)
for (const horas of [0, 169]) {
  r = await upsertAlertas(adm.token, {
    niveles_aviso_dias: [30, 7, 1],
    horas_aviso_pendientes: horas,
  })
  check(
    `el umbral ${horas} h viola el check (1 a 168)`,
    r.status === 400 && r.data?.code === '23514' && (await horasAviso()) === 12,
    `HTTP ${r.status} ${r.data?.code ?? ''}`,
  )
}
r = await upsertAlertas(adm.token, { niveles_aviso_dias: [15] })
check(
  'un upsert sin la columna (cliente 2.1.0) conserva el umbral',
  r.status < 300 && (await horasAviso()) === 12,
  `HTTP ${r.status}`,
)

r = await http('GET', '/rest/v1/insumos?select=id')
check(
  'sin sesión no se lee el inventario',
  Array.isArray(r.data) && r.data.length === 0,
  `HTTP ${r.status}`,
)

console.log(
  `\n${fallas === 0 ? 'Todos los controles OK' : `${fallas} control(es) fallaron`}`,
)
process.exit(fallas === 0 ? 0 : 1)
