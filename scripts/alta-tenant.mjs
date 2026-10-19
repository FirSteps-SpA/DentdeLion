// Alta manual de un cliente nuevo (spec 014 FR-003, contracts/supabase-schema.md,
// "Script"): crea el tenant, su primer lugar de trabajo y la invitación de su
// administradora, e imprime el enlace para enviárselo. Solo para First Steps:
// usa la service role.
//
// Uso:
//   npm run alta-tenant -- --nombre "Clínica X" --lugar "Sede Centro" --admin correo@x.cl
//
// Local: toma la URL y la service role de `supabase status`. Producción: de
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, con APP_URL para el enlace, y pide
// confirmar antes de escribir.

import { execFileSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    nombre: { type: 'string' },
    lugar: { type: 'string' },
    admin: { type: 'string' },
  },
})

const nombre = values.nombre?.trim()
const lugar = values.lugar?.trim()
const admin = values.admin?.trim().toLowerCase()
if (!nombre || !lugar || !admin || !admin.includes('@')) {
  console.error(
    'Uso: npm run alta-tenant -- --nombre "Clínica X" --lugar "Sede Centro" --admin correo@x.cl',
  )
  process.exit(2)
}

function entorno() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      api: process.env.SUPABASE_URL,
      svc: process.env.SUPABASE_SERVICE_ROLE_KEY,
      app: process.env.APP_URL ?? 'https://dentdelion.netlify.app',
    }
  }
  const salida = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' })
  const env = {}
  for (const linea of salida.split('\n')) {
    const m = linea.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return { api: env.API_URL, svc: env.SERVICE_ROLE_KEY, app: process.env.APP_URL ?? 'http://localhost:5173' }
}

const { api, svc, app } = entorno()
if (!api || !svc) {
  console.error('No se encontró la URL o la service role de Supabase.')
  process.exit(2)
}
const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(api)

if (!esLocal) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const respuesta = await rl.question(
    `Vas a crear el tenant "${nombre}" (lugar "${lugar}", administradora ${admin}) en ${api}. Escribe "si" para continuar: `,
  )
  rl.close()
  if (respuesta.trim().toLowerCase() !== 'si') {
    console.log('Cancelado.')
    process.exit(1)
  }
}

async function insertar(tabla, fila) {
  const res = await fetch(`${api}/rest/v1/${tabla}`, {
    method: 'POST',
    headers: {
      apikey: svc,
      Authorization: `Bearer ${svc}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fila),
  })
  if (!res.ok) {
    console.error(`Error al crear ${tabla}: HTTP ${res.status} ${await res.text()}`)
    process.exit(1)
  }
}

const tenantId = randomUUID()
const token = randomBytes(32).toString('base64url')
const tokenHash = createHash('sha256').update(token).digest('hex')

await insertar('tenants', { id: tenantId, nombre })
await insertar('lugares', { tenant_id: tenantId, nombre: lugar })
await insertar('invitaciones', {
  tenant_id: tenantId,
  correo: admin,
  rol: 'administrador',
  token_hash: tokenHash,
})

console.log(`Tenant creado: ${nombre} (${tenantId})`)
console.log(`Primer lugar: ${lugar}`)
console.log(`Invitación de administradora para ${admin} (vence en 7 días):`)
console.log(`${app.replace(/\/$/, '')}/?invitacion=${token}`)
