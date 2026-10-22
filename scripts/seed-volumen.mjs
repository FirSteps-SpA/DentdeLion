// Spec 017 T042 (research.md R9, quickstart §5): siembra en Supabase LOCAL un
// tenant nuevo con volumen suficiente para probar los pulls paginados (más de
// `max_rows` = 1.000 filas por tabla) y Reportes con 13 meses de historia.
// Crea una administradora con contraseña para iniciar sesión en la app.
//
// Uso: node scripts/seed-volumen.mjs [--movimientos 2600] [--tratamientos 1200]
//      node scripts/seed-volumen.mjs --contar <tenant_id>
// Requiere `supabase start`. Aborta si la URL no es local.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    movimientos: { type: 'string', default: '2600' },
    tratamientos: { type: 'string', default: '1200' },
    contar: { type: 'string' },
  },
})

function localEnv() {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
  const env = {}
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const { API_URL: API, SERVICE_ROLE_KEY: SVC } = localEnv()
if (!API || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) {
  console.error(`Abortado: API_URL no es local (${API}).`)
  process.exit(2)
}

async function http(method, path, body, prefer = 'return=minimal') {
  const res = await fetch(API + path, {
    method,
    headers: {
      apikey: SVC,
      Authorization: `Bearer ${SVC}`,
      'Content-Type': 'application/json',
      Prefer: prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  return res
}

/** Filas del tenant según Postgres (count exacto, sin el corte de max_rows). */
async function contar(tabla, tenantId) {
  const res = await http('HEAD', `/rest/v1/${tabla}?tenant_id=eq.${tenantId}`, undefined, 'count=exact')
  return Number(res.headers.get('content-range')?.split('/')[1])
}

if (values.contar) {
  const tenantId = values.contar
  const conteos = {}
  for (const tabla of ['movimientos', 'lotes', 'tratamientos_realizados']) {
    conteos[tabla] = await contar(tabla, tenantId)
  }
  console.log(JSON.stringify(conteos))
  process.exit(0)
}

async function insertar(tabla, filas) {
  for (let i = 0; i < filas.length; i += 500) {
    await http('POST', `/rest/v1/${tabla}`, filas.slice(i, i + 500))
  }
}

const run = randomUUID().slice(0, 8)
const tenantId = randomUUID()
const lugares = [randomUUID(), randomUUID()]
const email = `volumen-${run}@test.local`
const password = 'Volumen-1234!'

await http('POST', '/rest/v1/tenants', { id: tenantId, nombre: `Volumen ${run}` })
await insertar(
  'lugares',
  lugares.map((id, i) => ({ id, tenant_id: tenantId, nombre: i === 0 ? 'Sede Centro' : 'Box Norte' })),
)
const usuario = await (
  await http('POST', '/auth/v1/admin/users', { email, password, email_confirm: true }, 'return=representation')
).json()
await http('POST', '/rest/v1/perfiles', { id: usuario.id, nombre: 'Volumen', rol: 'administrador', tenant_id: tenantId })

const ahora = new Date()
const desde = new Date(ahora.getFullYear(), ahora.getMonth() - 12, 1).getTime()
const fecha = (i, n) => new Date(desde + ((ahora.getTime() - desde) * i) / n).toISOString()

const insumos = Array.from({ length: 40 }, (_, i) => ({
  id: randomUUID(),
  tenant_id: tenantId,
  nombre: `Insumo ${i + 1}`,
  categoria: ['Anestesia', 'Restauración', 'Protección', 'Curación', 'Periodoncia'][i % 5],
  unidad_medida: 'unidad',
  unidad_compra: 'unidad',
  contenido: 1,
  permite_decimales: false,
  caduca: false,
  creado_en: fecha(0, 1),
}))
await insertar('insumos', insumos)

const lotes = Array.from({ length: 120 }, (_, i) => ({
  id: randomUUID(),
  tenant_id: tenantId,
  lugar_id: lugares[i % 2],
  insumo_id: insumos[i % insumos.length].id,
  numero_lote: `V${i}`,
  proveedor: 'Proveedor Volumen',
  fecha_caducidad: null,
  estado: 'activo',
  creado_en: fecha(0, 1),
  cantidad_ingresada: 100,
  unidad_ingresada: 'unidad',
  contenido: 1,
  unidad_consumo: 'unidad',
  precio_compra: 300 + i * 10,
}))
await insertar('lotes', lotes)

const nMov = Number(values.movimientos)
const movimientos = Array.from({ length: nMov }, (_, i) => {
  const lote = lotes[i % lotes.length]
  const ingreso = i < lotes.length
  return {
    id: randomUUID(),
    tenant_id: tenantId,
    lugar_id: lote.lugar_id,
    tipo: ingreso ? 'ingreso' : 'consumo',
    lote_id: lote.id,
    cantidad: ingreso ? 100 : 1,
    unidad: 'unidad',
    usuario_id: usuario.id,
    creado_en: ingreso ? fecha(0, 1) : fecha(i, nMov),
  }
})
await insertar('movimientos', movimientos)

const tratamientoId = randomUUID()
await http('POST', '/rest/v1/tratamientos', {
  id: tratamientoId,
  tenant_id: tenantId,
  creado_por: usuario.id,
  creado_en: fecha(0, 1),
})
const nTrat = Number(values.tratamientos)
await insertar(
  'tratamientos_realizados',
  Array.from({ length: nTrat }, (_, i) => ({
    id: randomUUID(),
    tenant_id: tenantId,
    lugar_id: lugares[i % 2],
    tratamiento_id: tratamientoId,
    nombre: 'Restauración clase II',
    precio: 45000,
    porcentaje_profesional: 40,
    materiales: [],
    costo_materiales: 3480,
    costo_completo: true,
    ganancia_estimada: 14520,
    usuario_id: usuario.id,
    creado_en: fecha(i, nTrat),
  })),
)

console.log(
  JSON.stringify({
    tenantId,
    email,
    password,
    movimientos: await contar('movimientos', tenantId),
    lotes: await contar('lotes', tenantId),
    tratamientos_realizados: await contar('tratamientos_realizados', tenantId),
  }),
)
