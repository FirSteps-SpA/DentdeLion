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

// Spec 014: los datos actuales viven en el tenant 1 / lugar 1 (UUID fijos de
// la migración multi_tenant y de Dexie v10).
const TENANT_1 = '00000000-0000-4000-8000-000000000001'
const LUGAR_1 = '00000000-0000-4000-8000-000000000011'

const run = randomUUID().slice(0, 8)
const PASSWORD = 'Test-1234!'

async function crearUsuario(alias, rol, tenant_id = TENANT_1) {
  const email = `${alias}-${run}@test.local`
  const r = await http('POST', '/auth/v1/admin/users', {
    key: SVC,
    body: { email, password: PASSWORD, email_confirm: true },
  })
  if (r.status !== 200) throw new Error(`crear usuario ${alias}: ${r.status}`)
  const p = await http('POST', '/rest/v1/perfiles', {
    key: SVC,
    body: { id: r.data.id, nombre: alias, rol, tenant_id },
  })
  if (p.status !== 201) throw new Error(`perfil ${alias}: ${p.status}`)
  const t = await http('POST', '/auth/v1/token?grant_type=password', {
    body: { email, password: PASSWORD },
  })
  if (t.status !== 200) throw new Error(`login ${alias}: ${t.status}`)
  return { id: r.data.id, email, token: t.data.access_token }
}

// Fila singleton de configuración (la base local no tiene seed).
await http('POST', '/rest/v1/configuracion_clinica?on_conflict=id', {
  key: SVC,
  body: { id: 'global', nombre: 'Clínica de prueba', tenant_id: TENANT_1 },
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
// Sin `on_conflict`, como el cliente: PostgREST usa la PK (tenant_id desde la
// spec 014), que completa el default tenant_actual().
const upsertAlertas = (token, body) =>
  http('POST', '/rest/v1/configuracion_alertas', {
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

// ---------------------------------------------------------------------------
// Spec 014: aislamiento entre tenants, lugares, traslados e invitaciones
// (contracts/supabase-schema.md, "test:rls: casos nuevos").
// ---------------------------------------------------------------------------

const TENANT_B = randomUUID()
const LUGAR_A2 = randomUUID()
const LUGAR_B1 = randomUUID()
await http('POST', '/rest/v1/tenants', {
  key: SVC,
  body: { id: TENANT_B, nombre: `Tenant B ${run}` },
})
await http('POST', '/rest/v1/lugares', {
  key: SVC,
  body: [
    { id: LUGAR_A2, tenant_id: TENANT_1, nombre: `Box A2 ${run}` },
    { id: LUGAR_B1, tenant_id: TENANT_B, nombre: 'Clínica B' },
  ],
})
const admB = await crearUsuario('admin-b', 'administrador', TENANT_B)
const perB = await crearUsuario('personal-b', 'personal', TENANT_B)

// Datos propios de B, creados por B con la forma 2.2.0 (sin tenant ni lugar).
const insumoB = randomUUID()
const loteB = randomUUID()
r = await http('POST', '/rest/v1/insumos', {
  token: admB.token,
  body: {
    id: insumoB,
    nombre: 'Guantes B',
    categoria: 'Protección',
    unidad_medida: 'caja',
    permite_decimales: false,
  },
})
check('B da de alta un insumo en su tenant', r.status === 201, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/lotes', {
  token: perB.token,
  body: { id: loteB, insumo_id: insumoB, numero_lote: 'LB', proveedor: 'P' },
})
check('B crea un lote en su tenant', r.status === 201, `HTTP ${r.status}`)
const [filaLoteB] = await leer(`lotes?select=tenant_id,lugar_id&id=eq.${loteB}`)
check(
  'una fila sin tenant_id ni lugar_id (forma 2.2.0) cae en su tenant y su lugar principal',
  filaLoteB?.tenant_id === TENANT_B && filaLoteB?.lugar_id === LUGAR_B1,
  JSON.stringify(filaLoteB),
)

for (const tabla of [
  'insumos',
  'lotes',
  'movimientos',
  'items_compra',
  'categorias',
  'cambios_insumo',
  'lugares',
  'configuracion_alertas',
  'minimos_lugar',
]) {
  r = await http('GET', `/rest/v1/${tabla}?select=tenant_id`, { token: perB.token })
  const ajenas = Array.isArray(r.data) ? r.data.filter((f) => f.tenant_id !== TENANT_B) : null
  check(`B no lee ${tabla} de otro tenant`, ajenas?.length === 0, `HTTP ${r.status}`)
}
r = await http('GET', '/rest/v1/perfiles?select=id,tenant_id', { token: admB.token })
check(
  'la administradora de B solo ve perfiles de B',
  Array.isArray(r.data) && r.data.length === 2 && r.data.every((f) => f.tenant_id === TENANT_B),
  `${r.data?.length} filas`,
)
r = await http('GET', '/rest/v1/tenants?select=id', { token: perB.token })
check(
  'B solo ve su propio tenant',
  Array.isArray(r.data) && r.data.length === 1 && r.data[0].id === TENANT_B,
  `${r.data?.length} filas`,
)

r = await http('POST', '/rest/v1/insumos', {
  token: admB.token,
  body: {
    id: randomUUID(),
    tenant_id: TENANT_1,
    nombre: 'Intruso',
    categoria: 'X',
    unidad_medida: 'caja',
    permite_decimales: false,
  },
})
check('B no inserta filas con el tenant_id de A', r.status === 403, `HTTP ${r.status}`)
r = await http('PATCH', `/rest/v1/insumos?id=eq.${insumo}`, {
  token: admB.token,
  body: { nombre: 'Pisado por B' },
})
;[fila] = await leer(`insumos?select=nombre&id=eq.${insumo}`)
check(
  'B no actualiza filas de A',
  Array.isArray(r.data) && r.data.length === 0 && fila.nombre !== 'Pisado por B',
  `HTTP ${r.status}`,
)

r = await http('POST', '/rest/v1/lotes', {
  token: per.token,
  body: {
    id: randomUUID(),
    insumo_id: insumo,
    lugar_id: LUGAR_B1,
    numero_lote: 'X',
    proveedor: 'P',
  },
})
check('A no crea un lote en un lugar de B (FK compuesta)', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/lotes', {
  token: per.token,
  body: { id: randomUUID(), insumo_id: insumoB, numero_lote: 'X', proveedor: 'P' },
})
check('A no crea un lote de un insumo de B (FK compuesta)', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: { ...movimiento(per.id), lote_id: loteB },
})
check(
  'A no registra un movimiento sobre un lote de B (FK compuesta)',
  r.status >= 400,
  `HTTP ${r.status}`,
)

r = await http('POST', '/rest/v1/lugares', {
  token: per.token,
  body: { tenant_id: TENANT_1, nombre: `Intento ${run}` },
})
check('personal no crea lugares', r.status === 403, `HTTP ${r.status}`)
r = await http('PATCH', `/rest/v1/lugares?id=eq.${LUGAR_B1}`, {
  token: admB.token,
  body: { desactivado_en: new Date().toISOString() },
})
check(
  'no se puede desactivar el último lugar activo',
  r.status >= 400 && /ultimo_lugar_activo/.test(JSON.stringify(r.data)),
  `HTTP ${r.status}`,
)
r = await http('PATCH', `/rest/v1/perfiles?id=eq.${admB.id}`, {
  token: admB.token,
  body: { rol: 'personal' },
})
check(
  'no se puede degradar a la última administradora',
  r.status >= 400 && /ultimo_administrador/.test(JSON.stringify(r.data)),
  `HTTP ${r.status}`,
)

r = await http('POST', '/rest/v1/rpc/equipo_tenant', { token: admB.token, body: {} })
check(
  'equipo_tenant da los perfiles de B con correo a su administradora',
  Array.isArray(r.data) &&
    r.data.length === 2 &&
    r.data.some((f) => f.correo === perB.email),
  `HTTP ${r.status}`,
)
r = await http('POST', '/rest/v1/rpc/equipo_tenant', { token: perB.token, body: {} })
check(
  'equipo_tenant no da nada al personal',
  Array.isArray(r.data) && r.data.length === 0,
  `HTTP ${r.status}`,
)

// Usuario desactivado: sin acceso, salvo su perfil y sus pendientes previos.
const perA2 = await crearUsuario('personal-a2', 'personal')
const antesDeDesactivar = new Date(Date.now() - 60_000).toISOString()
r = await http('PATCH', `/rest/v1/perfiles?id=eq.${perA2.id}`, {
  token: adm.token,
  body: { desactivado_en: new Date().toISOString() },
})
check('la administradora desactiva a un usuario de su tenant', r.status === 200, `HTTP ${r.status}`)
r = await http('GET', '/rest/v1/insumos?select=id', { token: perA2.token })
check(
  'un usuario desactivado no lee nada',
  Array.isArray(r.data) && r.data.length === 0,
  `${r.data?.length} filas`,
)
r = await http('GET', '/rest/v1/perfiles?select=id,desactivado_en', { token: perA2.token })
check(
  'un usuario desactivado lee su propio perfil (con desactivado_en)',
  Array.isArray(r.data) && r.data.length === 1 && r.data[0].desactivado_en !== null,
  `${r.data?.length} filas`,
)
// El último envío de un desactivado es un INSERT simple: `ON CONFLICT` exige
// además la política SELECT, que un desactivado no pasa.
r = await http('POST', '/rest/v1/movimientos', {
  token: perA2.token,
  body: { ...movimiento(perA2.id), tenant_id: TENANT_1, lugar_id: LUGAR_1, creado_en: antesDeDesactivar },
  prefer: 'return=minimal',
})
check(
  'un pendiente registrado antes de la desactivación se acepta',
  r.status === 201,
  `HTTP ${r.status}`,
)
r = await http('POST', '/rest/v1/movimientos', {
  token: perA2.token,
  body: {
    ...movimiento(perA2.id),
    tenant_id: TENANT_1,
    lugar_id: LUGAR_1,
    creado_en: new Date(Date.now() + 60_000).toISOString(),
  },
  prefer: 'return=minimal',
})
check(
  'un movimiento posterior a la desactivación se rechaza',
  r.status === 403,
  `HTTP ${r.status}`,
)

// Traslados: el par es atómico (constraint trigger diferido).
const loteT = randomUUID()
await http('POST', '/rest/v1/lotes', {
  token: per.token,
  body: { id: loteT, insumo_id: insumo, numero_lote: 'LT', proveedor: 'P' },
})
await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: { ...movimiento(per.id), tipo: 'ingreso', lote_id: loteT, cantidad: 10 },
})
const mitad = (tipo, lugar_id, traslado_id, cantidad = 4) => ({
  id: randomUUID(),
  tipo,
  lote_id: loteT,
  cantidad,
  usuario_id: per.id,
  creado_en: ahora,
  lugar_id,
  traslado_id,
})
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: mitad('traslado_salida', LUGAR_1, randomUUID()),
})
check('una salida de traslado sin su entrada se rechaza', r.status >= 400, `HTTP ${r.status}`)
const t1 = randomUUID()
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: [mitad('traslado_salida', LUGAR_1, t1), mitad('traslado_entrada', LUGAR_A2, t1)],
})
const movsT = await leer(`movimientos?select=tipo,cantidad,lugar_id&lote_id=eq.${loteT}`)
const stockEn = (lugar) =>
  movsT
    .filter((m) => m.lugar_id === lugar)
    .reduce(
      (t, m) =>
        ['ingreso', 'traslado_entrada'].includes(m.tipo) ? t + m.cantidad : t - m.cantidad,
      0,
    )
check(
  'un traslado completo mueve el stock entre los lugares de A',
  r.status === 201 && stockEn(LUGAR_1) === 6 && stockEn(LUGAR_A2) === 4,
  `HTTP ${r.status} ${stockEn(LUGAR_1)}/${stockEn(LUGAR_A2)}`,
)
const t2 = randomUUID()
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: [mitad('traslado_salida', LUGAR_1, t2), mitad('traslado_entrada', LUGAR_1, t2)],
})
check('un traslado al mismo lugar se rechaza', r.status >= 400, `HTTP ${r.status}`)
const t3 = randomUUID()
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: [mitad('traslado_salida', LUGAR_1, t3, 4), mitad('traslado_entrada', LUGAR_A2, t3, 3)],
})
check('un traslado con cantidades distintas se rechaza', r.status >= 400, `HTTP ${r.status}`)
const t4 = randomUUID()
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: [mitad('traslado_salida', LUGAR_1, t4), mitad('traslado_entrada', LUGAR_B1, t4)],
})
check('un traslado hacia un lugar de otro tenant se rechaza', r.status >= 400, `HTTP ${r.status}`)

// Invitaciones (RPC + Edge Function `aceptar-invitacion`).
const crearInvitacion = (token, correo, rol = 'personal') =>
  http('POST', '/rest/v1/rpc/crear_invitacion', {
    token,
    body: { p_correo: correo, p_rol: rol },
  })
const aceptar = (body) =>
  http('POST', '/functions/v1/aceptar-invitacion', { body })
const NUEVA_CLAVE = 'Clave12345'

r = await crearInvitacion(per.token, `x-${run}@test.local`)
check('personal no crea invitaciones', r.status >= 400, `HTTP ${r.status}`)

const correoInvitada = `invitada-${run}@test.local`
r = await crearInvitacion(adm.token, correoInvitada)
const invitacion = r.data?.[0]
check(
  'la administradora crea una invitación y recibe el token',
  r.status === 200 && typeof invitacion?.token === 'string',
  `HTTP ${r.status}`,
)
const [guardada] = await leer(`invitaciones?select=token_hash&id=eq.${invitacion.id}`)
check(
  'la tabla guarda solo el hash del token',
  guardada.token_hash !== invitacion.token && guardada.token_hash.length === 64,
)
r = await http('POST', '/rest/v1/rpc/ver_invitacion', { body: { p_token: invitacion.token } })
check(
  'ver_invitacion sin sesión da correo y tenant de una invitación vigente',
  r.data?.[0]?.correo === correoInvitada,
  `HTTP ${r.status}`,
)
r = await http('POST', '/rest/v1/rpc/ver_invitacion', { body: { p_token: 'inventado-' + run } })
check('ver_invitacion con un token inventado no da nada', Array.isArray(r.data) && r.data.length === 0)

r = await aceptar({ token: invitacion.token, nombre: 'Invitada', password: 'corta' })
check(
  'una contraseña débil da password_debil',
  r.status === 422 && r.data?.codigo === 'password_debil',
  `HTTP ${r.status} ${r.data?.codigo}`,
)
r = await aceptar({ token: invitacion.token, nombre: 'Invitada', password: NUEVA_CLAVE })
check('aceptar una invitación vigente funciona', r.status === 200, `HTTP ${r.status} ${r.data?.codigo ?? ''}`)
const login = await http('POST', '/auth/v1/token?grant_type=password', {
  body: { email: correoInvitada, password: NUEVA_CLAVE },
})
r = await http('GET', '/rest/v1/insumos?select=tenant_id', { token: login.data?.access_token })
check(
  'la invitada entra al tenant que la invitó y solo ve sus datos',
  login.status === 200 &&
    Array.isArray(r.data) &&
    r.data.length > 0 &&
    r.data.every((f) => f.tenant_id === TENANT_1),
  `login ${login.status}, ${r.data?.length} filas`,
)
r = await aceptar({ token: invitacion.token, nombre: 'Otra vez', password: NUEVA_CLAVE })
check(
  'una invitación ya aceptada no se reutiliza',
  r.status === 404 && r.data?.codigo === 'invitacion_invalida',
  `HTTP ${r.status}`,
)

const vencida = (await crearInvitacion(adm.token, `vencida-${run}@test.local`)).data[0]
await http('PATCH', `/rest/v1/invitaciones?id=eq.${vencida.id}`, {
  key: SVC,
  body: { vence_en: new Date(Date.now() - 1000).toISOString() },
})
r = await aceptar({ token: vencida.token, nombre: 'V', password: NUEVA_CLAVE })
check(
  'una invitación vencida da invitacion_vencida',
  r.status === 410 && r.data?.codigo === 'invitacion_vencida',
  `HTTP ${r.status}`,
)

const revocada = (await crearInvitacion(adm.token, `revocada-${run}@test.local`)).data[0]
r = await http('POST', '/rest/v1/rpc/revocar_invitacion', {
  token: per.token,
  body: { p_id: revocada.id },
})
check('personal no revoca invitaciones', r.status >= 400, `HTTP ${r.status}`)
await http('POST', '/rest/v1/rpc/revocar_invitacion', {
  token: adm.token,
  body: { p_id: revocada.id },
})
r = await aceptar({ token: revocada.token, nombre: 'R', password: NUEVA_CLAVE })
check(
  'una invitación revocada da invitacion_invalida',
  r.status === 404 && r.data?.codigo === 'invitacion_invalida',
  `HTTP ${r.status}`,
)

const deOtro = (await crearInvitacion(adm.token, admB.email)).data[0]
r = await aceptar({ token: deOtro.token, nombre: 'B', password: NUEVA_CLAVE })
check(
  'un correo de otro tenant da correo_en_otro_tenant',
  r.status === 409 && r.data?.codigo === 'correo_en_otro_tenant',
  `HTTP ${r.status}`,
)

// ---------------------------------------------------------------------------
// Spec 015 — unidades y costo unitario (contracts/supabase-schema.md §8)
// ---------------------------------------------------------------------------

const [loteSinColumnas] = await leer(`lotes?id=eq.${lote}&select=unidad_consumo,contenido,precio_compra`)
check(
  'un lote de un cliente 2.3.0 recibe la unidad de consumo del insumo',
  loteSinColumnas?.unidad_consumo === 'cartucho' &&
    Number(loteSinColumnas?.contenido) === 1 &&
    loteSinColumnas?.precio_compra === null,
)

const loteConPrecio = randomUUID()
r = await http('POST', '/rest/v1/lotes', {
  token: per.token,
  body: {
    id: loteConPrecio,
    insumo_id: insumo,
    numero_lote: 'P1',
    proveedor: 'P',
    cantidad_ingresada: 2,
    unidad_ingresada: 'caja',
    contenido: 50,
    unidad_consumo: 'cartucho',
    precio_compra: 32500,
  },
})
check('personal crea un lote con precio', r.status === 201, `HTTP ${r.status}`)

const cambioLote = (usuario_id, valor_nuevo = 30000) => ({
  id: randomUUID(),
  lote_id: loteConPrecio,
  campo: 'precioCompra',
  valor_anterior: 32500,
  valor_nuevo,
  usuario_id,
  creado_en: new Date().toISOString(),
})

// 2. Cualquier miembro corrige precios, como sí mismo (Q3).
r = await http('POST', '/rest/v1/cambios_lote', { token: per.token, body: cambioLote(per.id) })
check('personal inserta una corrección de precio como sí mismo', r.status === 201, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_lote', { token: per.token, body: cambioLote(adm.id) })
check('personal no inserta una corrección a nombre de otro', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_lote', {
  token: per.token,
  body: cambioLote(per.id, -5),
})
check('un precio negativo se rechaza', r.status >= 400, `HTTP ${r.status}`)

// 1. Aislamiento entre tenants.
r = await http('GET', `/rest/v1/cambios_lote?lote_id=eq.${loteConPrecio}`, { token: admB.token })
check(
  'otro tenant no lee las correcciones de precio',
  Array.isArray(r.data) && r.data.length === 0,
  `HTTP ${r.status}`,
)
r = await http('POST', '/rest/v1/cambios_lote', { token: admB.token, body: cambioLote(admB.id) })
check('otro tenant no corrige precios de lotes ajenos', r.status >= 400, `HTTP ${r.status}`)

// 3. El precio y el snapshot del lote son inmutables.
r = await http('PATCH', `/rest/v1/lotes?id=eq.${loteConPrecio}`, {
  token: adm.token,
  body: { precio_compra: 1, contenido: 10, cantidad_ingresada: 9 },
})
const [loteTrasPatch] = await leer(
  `lotes?id=eq.${loteConPrecio}&select=precio_compra,contenido,cantidad_ingresada`,
)
check(
  'ni administración cambia el precio ni el snapshot de un lote',
  Number(loteTrasPatch?.precio_compra) === 32500 &&
    Number(loteTrasPatch?.contenido) === 50 &&
    Number(loteTrasPatch?.cantidad_ingresada) === 2,
  `HTTP ${r.status}`,
)

// 4. Presentación: solo administración.
await http('PATCH', `/rest/v1/insumos?id=eq.${insumo}`, {
  token: per.token,
  body: { unidad_compra: 'caja', contenido: 50 },
})
let [presentacion] = await leer(`insumos?id=eq.${insumo}&select=unidad_compra,contenido`)
check(
  'personal no cambia la presentación de un insumo',
  presentacion?.unidad_compra === 'cartucho' && Number(presentacion?.contenido) === 1,
)
await http('PATCH', `/rest/v1/insumos?id=eq.${insumo}`, {
  token: adm.token,
  body: { unidad_compra: 'caja', contenido: 50 },
})
;[presentacion] = await leer(`insumos?id=eq.${insumo}&select=unidad_compra,contenido`)
check(
  'administración cambia la presentación de un insumo',
  presentacion?.unidad_compra === 'caja' && Number(presentacion?.contenido) === 50,
)

// 5. Un movimiento sin unidad (cliente 2.3.0) toma la del insumo.
const movSinUnidad = randomUUID()
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: {
    id: movSinUnidad,
    tipo: 'ingreso',
    lote_id: loteConPrecio,
    cantidad: 100,
    usuario_id: per.id,
    creado_en: new Date().toISOString(),
  },
})
const [movLeido] = await leer(`movimientos?id=eq.${movSinUnidad}&select=unidad`)
check(
  'un movimiento sin unidad recibe la del insumo',
  r.status === 201 && movLeido?.unidad === 'cartucho',
  `HTTP ${r.status}`,
)

// 6. Un traslado con unidades distintas en sus mitades se rechaza.
const trasladoId015 = randomUUID()
const mitadConUnidad = (tipo, lugar_id, unidad) => ({
  id: randomUUID(),
  tipo,
  lote_id: loteConPrecio,
  cantidad: 1,
  unidad,
  lugar_id,
  traslado_id: trasladoId015,
  usuario_id: per.id,
  creado_en: new Date().toISOString(),
})
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: [
    mitadConUnidad('traslado_salida', LUGAR_1, 'cartucho'),
    mitadConUnidad('traslado_entrada', LUGAR_A2, 'caja'),
  ],
})
check('un traslado con unidades distintas se rechaza', r.status >= 400, `HTTP ${r.status}`)

// 7. `pieza` se normaliza a `unidad` (clientes 2.3.0).
const insumoPieza = randomUUID()
await http('POST', '/rest/v1/insumos', {
  token: adm.token,
  body: {
    id: insumoPieza,
    nombre: `Fresa ${run}`,
    categoria: 'Fresas',
    unidad_medida: 'pieza',
    permite_decimales: false,
  },
})
const [pieza] = await leer(`insumos?id=eq.${insumoPieza}&select=unidad_medida,unidad_compra`)
check(
  'un insumo en pieza queda en unidad, también como unidad de compra',
  pieza?.unidad_medida === 'unidad' && pieza?.unidad_compra === 'unidad',
)

// 8. El factor solo va en un cambio de unidad de consumo.
r = await http('POST', '/rest/v1/cambios_insumo', {
  token: adm.token,
  body: {
    id: randomUUID(),
    insumo_id: insumo,
    campo: 'nombre',
    valor_anterior: 'Anestesia',
    valor_nuevo: 'Anestesia B',
    factor: 2,
    usuario_id: adm.id,
    creado_en: new Date().toISOString(),
  },
})
check('un factor fuera de un cambio de unidad se rechaza', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_insumo', {
  token: adm.token,
  body: {
    id: randomUUID(),
    insumo_id: insumo,
    campo: 'unidadMedida',
    valor_anterior: 'cartucho',
    valor_nuevo: 'mL',
    factor: 1.8,
    usuario_id: adm.id,
    creado_en: new Date().toISOString(),
  },
})
check('administración registra una conversión con factor', r.status === 201, `HTTP ${r.status}`)

// ---------------------------------------------------------------------------
// Spec 016 — tratamientos y costo por tratamiento (contracts/supabase-schema.md §6)
// ---------------------------------------------------------------------------

const tratamiento016 = randomUUID()
const cambioTratamiento = (usuario_id, extra) => ({
  id: randomUUID(),
  tratamiento_id: tratamiento016,
  lugar_id: null,
  campo: 'nombre',
  valor_anterior: null,
  valor_nuevo: `Restauración ${run}`,
  usuario_id,
  creado_en: new Date().toISOString(),
  ...extra,
})

// 2. Solo administración define tratamientos.
r = await http('POST', '/rest/v1/tratamientos', {
  token: per.token,
  body: { id: randomUUID(), creado_por: per.id, creado_en: new Date().toISOString() },
})
check('personal no crea tratamientos', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/tratamientos', {
  token: adm.token,
  body: { id: tratamiento016, creado_por: adm.id, creado_en: new Date().toISOString() },
})
check('administración crea un tratamiento', r.status === 201, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_tratamiento', {
  token: per.token,
  body: cambioTratamiento(per.id),
})
check('personal no cambia la definición de un tratamiento', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_tratamiento', {
  token: adm.token,
  body: cambioTratamiento(adm.id),
})
check('administración nombra el tratamiento', r.status === 201, `HTTP ${r.status}`)

// 7. Forma de los cambios: precio con lugar; % entre 0 y 100.
r = await http('POST', '/rest/v1/cambios_tratamiento', {
  token: adm.token,
  body: cambioTratamiento(adm.id, { campo: 'precio', valor_nuevo: 45000 }),
})
check('un precio sin lugar se rechaza', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_tratamiento', {
  token: adm.token,
  body: cambioTratamiento(adm.id, { campo: 'precio', lugar_id: LUGAR_1, valor_nuevo: 45000 }),
})
check('administración fija un precio por lugar', r.status === 201, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_tratamiento', {
  token: adm.token,
  body: cambioTratamiento(adm.id, {
    tratamiento_id: null,
    campo: 'porcentajeProfesional',
    lugar_id: LUGAR_1,
    valor_nuevo: 120,
  }),
})
check('un % profesional de 120 se rechaza', r.status >= 400, `HTTP ${r.status}`)

// 3. Registro como sí mismo.
const realizado = (usuario_id, extra) => ({
  id: randomUUID(),
  lugar_id: LUGAR_1,
  tratamiento_id: tratamiento016,
  nombre: `Restauración ${run}`,
  precio: 45000,
  porcentaje_profesional: 40,
  materiales: [{ insumoId: insumo, nombre: 'Anestesia', cantidad: 1, unidad: 'cartucho', costoUnitario: 650 }],
  costo_materiales: 650,
  costo_completo: true,
  ganancia_estimada: 17350,
  usuario_id,
  creado_en: new Date().toISOString(),
  ...extra,
})
const registro016 = realizado(per.id)
r = await http('POST', '/rest/v1/tratamientos_realizados', { token: per.token, body: registro016 })
check('personal registra un tratamiento como sí mismo', r.status === 201, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/tratamientos_realizados', {
  token: per.token,
  body: realizado(adm.id),
})
check('personal no registra un tratamiento a nombre de otro', r.status >= 400, `HTTP ${r.status}`)

// 1. Aislamiento entre tenants en las tres tablas.
for (const tabla of ['tratamientos', 'cambios_tratamiento', 'tratamientos_realizados']) {
  r = await http('GET', `/rest/v1/${tabla}?select=id`, { token: admB.token })
  const ajenas = Array.isArray(r.data) ? r.data.filter((f) => [tratamiento016, registro016.id].includes(f.id)) : null
  check(`otro tenant no lee ${tabla}`, ajenas?.length === 0, `HTTP ${r.status}`)
}
r = await http('POST', '/rest/v1/tratamientos_realizados', {
  token: perB.token,
  body: realizado(perB.id),
})
check('otro tenant no registra con un tratamiento ajeno', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/cambios_tratamiento', {
  token: admB.token,
  body: cambioTratamiento(admB.id),
})
check('otro tenant no cambia un tratamiento ajeno', r.status >= 400, `HTTP ${r.status}`)

// 6. Un consumo no se vincula a un registro de otro tenant (FK compuesta).
r = await http('POST', '/rest/v1/movimientos', {
  token: perB.token,
  body: {
    id: randomUUID(),
    tipo: 'consumo',
    lote_id: loteB,
    cantidad: 1,
    tratamiento_realizado_id: registro016.id,
    usuario_id: perB.id,
    creado_en: new Date().toISOString(),
  },
})
check('un consumo vinculado a un registro de otro tenant se rechaza', r.status >= 400, `HTTP ${r.status}`)
r = await http('POST', '/rest/v1/movimientos', {
  token: per.token,
  body: {
    id: randomUUID(),
    tipo: 'consumo',
    lote_id: lote,
    cantidad: 1,
    tratamiento_realizado_id: registro016.id,
    usuario_id: per.id,
    creado_en: new Date().toISOString(),
  },
})
check('un consumo se vincula a su registro', r.status === 201, `HTTP ${r.status}`)

// 4. El snapshot del registro es inmutable.
await http('PATCH', `/rest/v1/tratamientos_realizados?id=eq.${registro016.id}`, {
  token: adm.token,
  body: { precio: 1, materiales: [], costo_materiales: 1 },
})
const [snapshot] = await leer(
  `tratamientos_realizados?id=eq.${registro016.id}&select=precio,materiales,costo_materiales`,
)
check(
  'ni administración cambia el precio, los materiales ni el costo de un registro',
  Number(snapshot?.precio) === 45000 &&
    snapshot?.materiales?.length === 1 &&
    Number(snapshot?.costo_materiales) === 650,
  JSON.stringify(snapshot),
)

// 5. La primera anulación se conserva.
const primeraAnulacion = new Date(Date.now() - 1000).toISOString()
r = await http('PATCH', `/rest/v1/tratamientos_realizados?id=eq.${registro016.id}`, {
  token: per.token,
  body: { anulado_en: primeraAnulacion, anulado_por: per.id },
})
check('personal anula un registro como sí mismo', r.status < 300, `HTTP ${r.status}`)
await http('PATCH', `/rest/v1/tratamientos_realizados?id=eq.${registro016.id}`, {
  token: adm.token,
  body: { anulado_en: new Date().toISOString(), anulado_por: adm.id },
})
const [anulado] = await leer(
  `tratamientos_realizados?id=eq.${registro016.id}&select=anulado_en,anulado_por`,
)
check(
  'una segunda anulación no reemplaza la primera',
  anulado?.anulado_por === per.id &&
    new Date(anulado?.anulado_en).getTime() === new Date(primeraAnulacion).getTime(),
  JSON.stringify(anulado),
)
const otroRegistro = realizado(per.id)
await http('POST', '/rest/v1/tratamientos_realizados', { token: per.token, body: otroRegistro })
r = await http('PATCH', `/rest/v1/tratamientos_realizados?id=eq.${otroRegistro.id}`, {
  token: per.token,
  body: { anulado_en: new Date().toISOString(), anulado_por: adm.id },
})
check('nadie anula a nombre de otra persona', r.status >= 400, `HTTP ${r.status}`)

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
