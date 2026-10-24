// Proveedores (spec 021, research.md R5): herramientas de servicio para la
// migración de los proveedores escritos como texto. Solo para First Steps: usa
// la service role.
//
// Uso:
//   npm run proveedores -- listar [--json]
//     Antes de migrar: por tenant, cada proveedor escrito en `lotes`, agrupado
//     por clave (sin mayúsculas, tildes ni espacios sobrantes) con su cantidad
//     de lotes. Es la lista que se le envía a la clienta para decidir fusiones.
//
//   npm run proveedores -- fusionar --tenant <uuid> --a "Nombre final" --de "Otro" [--de …] [--ensayo]
//     Después de migrar: mueve los lotes y los predeterminados de cada `--de`
//     al `--a`, y elimina (baja lógica) los `--de`. Si `--a` no existe,
//     renombra el primer `--de`. Idempotente; `--ensayo` solo muestra.
//
// Local: toma la URL y la service role de `supabase status`. Producción: de
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY, y `fusionar` pide confirmar.

import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean', default: false },
    tenant: { type: 'string' },
    a: { type: 'string' },
    de: { type: 'string', multiple: true },
    ensayo: { type: 'boolean', default: false },
  },
})

const USO = `Uso:
  npm run proveedores -- listar [--json]
  npm run proveedores -- fusionar --tenant <uuid> --a "Nombre final" --de "Otro" [--de …] [--ensayo]`

function entorno() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      api: process.env.SUPABASE_URL,
      svc: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  }
  const salida = execFileSync('supabase', ['status', '-o', 'env'], {
    encoding: 'utf8',
  })
  const env = {}
  for (const linea of salida.split('\n')) {
    const m = linea.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m) env[m[1]] = m[2]
  }
  return { api: env.API_URL, svc: env.SERVICE_ROLE_KEY }
}

const { api, svc } = entorno()
if (!api || !svc) {
  console.error('No se encontró la URL o la service role de Supabase.')
  process.exit(2)
}
const esLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(api)

/** Misma regla que `claveCategoria` (cliente) y `clave_nombre` (servidor). */
export function claveNombre(nombre) {
  return nombre
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
}

async function pedir(method, ruta, body) {
  const res = await fetch(`${api}/rest/v1/${ruta}`, {
    method,
    headers: {
      apikey: svc,
      Authorization: `Bearer ${svc}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const texto = await res.text()
  if (!res.ok) throw new Error(`${method} ${ruta}: HTTP ${res.status} ${texto}`)
  return texto ? JSON.parse(texto) : null
}

/** Todas las filas, paginando por `id` (PostgREST corta en `max_rows`). */
async function leerTodo(tabla, columnas, filtro = '') {
  const filas = []
  let ultimo = null
  for (;;) {
    const cursor = ultimo ? `&id=gt.${ultimo}` : ''
    const pagina = await pedir(
      'GET',
      `${tabla}?select=${columnas}&order=id&limit=1000${filtro}${cursor}`,
    )
    filas.push(...pagina)
    if (pagina.length < 1000) return filas
    ultimo = pagina[pagina.length - 1].id
  }
}

async function listar() {
  const lotes = await leerTodo('lotes', 'id,tenant_id,proveedor')
  const tenants = await pedir('GET', 'tenants?select=id,nombre&order=nombre')
  const nombreTenant = new Map(tenants.map((t) => [t.id, t.nombre]))

  const porTenant = new Map()
  for (const lote of lotes) {
    const grupos = porTenant.get(lote.tenant_id) ?? new Map()
    porTenant.set(lote.tenant_id, grupos)
    const clave = claveNombre(lote.proveedor ?? '')
    const grupo = grupos.get(clave) ?? { clave, lotes: 0, textos: new Map() }
    grupos.set(clave, grupo)
    grupo.lotes += 1
    const texto = (lote.proveedor ?? '').trim()
    grupo.textos.set(texto, (grupo.textos.get(texto) ?? 0) + 1)
  }

  const resultado = [...porTenant].map(([tenantId, grupos]) => ({
    tenantId,
    tenant: nombreTenant.get(tenantId) ?? tenantId,
    proveedores: [...grupos.values()]
      .sort((x, y) => x.clave.localeCompare(y.clave, 'es'))
      .map((g) => ({
        clave: g.clave,
        lotes: g.lotes,
        textos: [...g.textos]
          .sort((x, y) => y[1] - x[1])
          .map(([texto, n]) => ({ texto, lotes: n })),
      })),
  }))

  if (values.json) {
    console.log(JSON.stringify(resultado, null, 2))
    return
  }
  for (const t of resultado) {
    console.log(
      `\n${t.tenant} (${t.tenantId}) — ${t.proveedores.length} proveedores distintos`,
    )
    for (const p of t.proveedores) {
      const variantes = p.textos
        .map((x) => `"${x.texto}" (${x.lotes})`)
        .join(', ')
      console.log(
        `  • ${p.textos[0]?.texto || 'Sin proveedor'} — ${p.lotes} lotes: ${variantes}`,
      )
    }
  }
}

async function fusionar() {
  const tenant = values.tenant?.trim()
  const destino = values.a?.trim()
  const origenes = (values.de ?? []).map((d) => d.trim()).filter(Boolean)
  if (!tenant || !destino || origenes.length === 0) {
    console.error(USO)
    process.exit(2)
  }

  const proveedores = await leerTodo(
    'proveedores',
    'id,nombre,clave,eliminado_en',
    `&tenant_id=eq.${tenant}&eliminado_en=is.null`,
  )
  const porClave = new Map(proveedores.map((p) => [p.clave, p]))
  const deFilas = origenes
    .map((nombre) => porClave.get(claveNombre(nombre)))
    .filter((p) => p !== undefined)
  let aFila = porClave.get(claveNombre(destino))

  const faltan = origenes.filter((nombre) => !porClave.has(claveNombre(nombre)))
  if (faltan.length > 0)
    console.log(
      `Sin cambios (no existen o ya se fusionaron): ${faltan.join(', ')}`,
    )

  const plan = []
  if (!aFila) {
    if (deFilas.length === 0) {
      console.log('Nada que fusionar.')
      return
    }
    aFila = deFilas.shift()
    plan.push(`renombrar «${aFila.nombre}» → «${destino}»`)
  } else if (aFila.nombre !== destino) {
    plan.push(`renombrar «${aFila.nombre}» → «${destino}»`)
  }
  const mover = deFilas.filter((p) => p.id !== aFila.id)
  for (const p of mover)
    plan.push(
      `mover lotes y predeterminados de «${p.nombre}» a «${destino}» y eliminar «${p.nombre}»`,
    )

  if (plan.length === 0) {
    console.log('Nada que fusionar.')
    return
  }
  console.log(plan.map((linea) => `  • ${linea}`).join('\n'))
  if (values.ensayo) {
    console.log('(ensayo: no se escribió nada)')
    return
  }
  if (!esLocal) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const respuesta = await rl.question(
      `Aplicar en ${api}? Escribe "si" para continuar: `,
    )
    rl.close()
    if (respuesta.trim().toLowerCase() !== 'si') {
      console.log('Cancelado.')
      process.exit(1)
    }
  }

  // Primero se libera la clave de los que se eliminan, para que el renombrado
  // del destino no choque con el índice único.
  const ahora = new Date().toISOString()
  for (const p of mover) {
    await pedir('PATCH', `lotes?proveedor_id=eq.${p.id}`, {
      proveedor_id: aFila.id,
    })
    await pedir('PATCH', `lugares?proveedor_predeterminado_id=eq.${p.id}`, {
      proveedor_predeterminado_id: aFila.id,
    })
    await pedir('PATCH', `proveedores?id=eq.${p.id}`, { eliminado_en: ahora })
  }
  if (aFila.nombre !== destino) {
    await pedir('PATCH', `proveedores?id=eq.${aFila.id}`, { nombre: destino })
  }
  console.log('Listo.')
}

const comando = positionals[0]
if (comando === 'listar') await listar()
else if (comando === 'fusionar') await fusionar()
else {
  console.error(USO)
  process.exit(2)
}
