import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Borrador,
  CambioInsumo,
  Insumo,
  Marca,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb({
      ...Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
      borradores: new MemoryTable(),
    }),
  }
})

// ---- Supabase falso: tablas en memoria con las reglas de marcas del servidor ----
type Fila = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, Fila>> = {}
/** Orden de las escrituras: `tabla:metodo`. */
const llamadas: string[] = []
/** Filas tal como llegaron en cada upsert de insumos. */
const insumosSubidos: Fila[] = []

const tabla = (nombre: string) => (remoto[nombre] ??= new Map())
const clave = (nombre: unknown) =>
  String(nombre)
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')

/** `marcas` con la clave única por tenant y la regla de no eliminar con insumos. */
function escribirMarca(fila: Fila, insertar: boolean) {
  const existente = tabla('marcas').get(fila.id)
  if (insertar && existente) return { code: '23505', message: 'duplicate key (pkey)' }
  const repetida = [...tabla('marcas').values()].some(
    (otra) => otra.id !== fila.id && !otra.eliminado_en && otra.clave === clave(fila.nombre),
  )
  if (!fila.eliminado_en && repetida)
    return { code: '23505', message: 'duplicate key value violates marcas_clave_por_tenant' }
  const conInsumos = [...tabla('insumos').values()].some((i) => i.marca_id === fila.id)
  if (fila.eliminado_en && !existente?.eliminado_en && conInsumos)
    return { code: 'P0001', message: 'marca_con_insumos' }
  tabla('marcas').set(fila.id, { ...structuredClone(fila), clave: clave(fila.nombre) })
  return null
}

/** El trigger `aplicar_marca_desde_cambio`: gana el más reciente por (creado_en, id). */
function aplicarMarca(insumoId: string) {
  const [ultimo] = [...tabla('cambios_insumo').values()]
    .filter((c) => c.insumo_id === insumoId && c.campo === 'marcaId')
    .sort((a, b) =>
      a.creado_en === b.creado_en
        ? a.id < b.id ? 1 : -1
        : String(a.creado_en) < String(b.creado_en) ? 1 : -1,
    )
  const insumo = tabla('insumos').get(insumoId)
  if (insumo && ultimo) insumo.marca_id = ultimo.valor_nuevo ?? null
}

function seleccion(nombre: string) {
  const filtros: ((f: Fila) => boolean)[] = []
  let limite = Infinity
  const consulta = {
    order: () => consulta,
    gt(columna: string, valor: string) {
      filtros.push((f) => String(f[columna]) > valor)
      return consulta
    },
    eq(columna: string, valor: unknown) {
      filtros.push((f) => f[columna] === valor)
      return consulta
    },
    is(columna: string, valor: unknown) {
      filtros.push((f) => (f[columna] ?? null) === valor)
      return consulta
    },
    limit(n: number) {
      limite = n
      return consulta
    },
    then(resolver: (r: unknown) => unknown, rechazar?: (e: unknown) => unknown) {
      const data = [...tabla(nombre).values()]
        .filter((f) => filtros.every((pasa) => pasa(f)))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, limite)
        .map((f) => structuredClone(f))
      return Promise.resolve({ data, error: null, status: 200 }).then(resolver, rechazar)
    },
  }
  return consulta
}

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(filas: Fila | Fila[]) {
        llamadas.push(`${nombre}:upsert`)
        const lista = Array.isArray(filas) ? filas : [filas]
        if (nombre === 'insumos') insumosSubidos.push(...structuredClone(lista))
        for (const fila of lista) {
          if (nombre === 'marcas') {
            const error = escribirMarca(fila, false)
            if (error) return { error, status: 400 }
          } else if (nombre === 'insumos' && tabla('insumos').has(fila.id)) {
            // R3: en UPDATE el servidor conserva `marca_id`.
            const previo = tabla('insumos').get(fila.id)!
            tabla('insumos').set(fila.id, {
              ...structuredClone(fila),
              marca_id: previo.marca_id ?? null,
            })
          } else {
            tabla(nombre).set(
              String(fila.id ?? `${fila.insumo_id}|${fila.lugar_id}`),
              structuredClone(fila),
            )
            if (nombre === 'cambios_insumo' && fila.campo === 'marcaId')
              aplicarMarca(String(fila.insumo_id))
          }
        }
        return { error: null, status: 201 }
      },
      async insert(fila: Fila) {
        llamadas.push(`${nombre}:insert`)
        const error = escribirMarca(fila, true)
        return error ? { error, status: 409 } : { error: null, status: 201 }
      },
      select: () => seleccion(nombre),
    }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

vi.mock('../../src/lib/supabase/perfiles', () => ({
  fetchPerfilPropio: async () => null,
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { useAvisosStore } from '../../src/stores/avisosStore'
import { lugar1 } from '../helpers/lugarFalso'
import { TENANT_1 } from '../helpers/tenancy'

const marcasT = db.marcas as unknown as MemoryTable<Marca>
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>
const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', rol: 'personal' }

function marca(overrides: Partial<Marca> = {}): Marca {
  return {
    id: 'm1',
    tenantId: TENANT_1,
    nombre: '3M',
    creadoPor: 'admin-1',
    creadoEn: '2026-10-24T10:00:00.000Z',
    desactivadoEn: null,
    eliminadoEn: null,
    sincronizado: true,
    ...overrides,
  }
}

function insumo(overrides: Partial<Insumo> = {}): Insumo {
  return {
    id: 'i1',
    tenantId: TENANT_1,
    nombre: 'Composite Z350',
    categoria: 'Resinas',
    unidadMedida: 'unidad',
    unidadCompra: 'unidad',
    contenido: 1,
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-10-24T10:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: 'admin-1',
    marcaId: null,
    ...overrides,
  }
}

function cambioMarca(overrides: Partial<CambioInsumo> = {}): CambioInsumo {
  return {
    id: 'c1',
    tenantId: TENANT_1,
    insumoId: 'i1',
    campo: 'marcaId',
    valorAnterior: null,
    valorNuevo: 'm1',
    factor: null,
    usuarioId: 'admin-1',
    creadoEn: '2026-10-24T11:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
    ...overrides,
  }
}

function filaRemota(m: Marca): Fila {
  return {
    id: m.id,
    tenant_id: m.tenantId,
    nombre: m.nombre,
    clave: clave(m.nombre),
    creado_por: m.creadoPor,
    creado_en: m.creadoEn,
    desactivado_en: m.desactivadoEn,
    eliminado_en: m.eliminadoEn,
  }
}

beforeEach(() => {
  for (const nombre of Object.keys(remoto)) delete remoto[nombre]
  llamadas.length = 0
  insumosSubidos.length = 0
  for (const t of [marcasT, insumosT, cambiosT, borradoresT]) t.seed([])
  ;(db.lugares as unknown as MemoryTable<typeof lugar1>).seed([lugar1])
  useAvisosStore.setState({ avisos: [] })
  useAuthStore.setState({ usuario: admin, isReady: true })
})

/** Spec 023 T022 (research.md R3, R5; contracts/supabase-schema.md §4). */
describe('sincronización de marcas', () => {
  it('sube las marcas antes que los lugares y los insumos, con su marca_id', async () => {
    marcasT.seed([marca({ id: 'local-m', sincronizado: false })])
    insumosT.seed([insumo({ marcaId: 'local-m' })])
    ;(db.lugares as unknown as MemoryTable<typeof lugar1>).seed([
      { ...lugar1, sincronizado: false },
    ])

    await runSyncBatch()

    const indice = (llamada: string) => llamadas.indexOf(llamada)
    expect(indice('marcas:upsert')).toBeGreaterThanOrEqual(0)
    expect(indice('marcas:upsert')).toBeLessThan(indice('lugares:upsert'))
    expect(indice('marcas:upsert')).toBeLessThan(indice('insumos:upsert'))
    expect(tabla('insumos').get('i1')?.marca_id).toBe('local-m')
    expect(marcasT.all()[0].sincronizado).toBe(true)
  })

  it('personal sube con insert lo que creó; administración, con upsert', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    marcasT.seed([
      marca({ id: 'mia', nombre: 'Mía', creadoPor: 'personal-1', sincronizado: false }),
      marca({ id: 'ajena', nombre: 'Ajena', creadoPor: 'admin-1', sincronizado: false }),
    ])

    await runSyncBatch()

    expect(llamadas.filter((l) => l.startsWith('marcas'))).toEqual(['marcas:insert'])
    expect(tabla('marcas').has('mia')).toBe(true)
    expect(tabla('marcas').has('ajena')).toBe(false)
  })

  it('una duplicada por clave se reemplaza por la del servidor en insumos, cambios pendientes y borrador', async () => {
    tabla('marcas').set('srv-m', filaRemota(marca({ id: 'srv-m', nombre: '3M' })))
    marcasT.seed([marca({ id: 'local-m', nombre: ' 3m ', sincronizado: false })])
    insumosT.seed([insumo({ marcaId: 'local-m' }), insumo({ id: 'i2', marcaId: null })])
    cambiosT.seed([
      cambioMarca({ id: 'c-pend', insumoId: 'i2', valorNuevo: 'local-m' }),
    ])
    borradoresT.seed([
      {
        id: 'alta-material',
        datos: { nombre: 'Otro', marcaId: 'local-m' },
        actualizadoEn: '2026-10-24T10:00:00.000Z',
      },
    ])

    await runSyncBatch()

    expect(marcasT.all().map((m) => m.id)).toEqual(['srv-m'])
    expect(insumosT.all().find((i) => i.id === 'i1')?.marcaId).toBe('srv-m')
    const cambio = cambiosT.all().find((c) => c.id === 'c-pend')
    expect(cambio?.valorNuevo).toBe('srv-m')
    const borrador = borradoresT.all()[0]
    expect(borrador.id === 'alta-material' && borrador.datos.marcaId).toBe('srv-m')
    expect(tabla('marcas').size).toBe(1)
  })

  it('un renombrado que choca con otra marca del servidor se revierte con aviso', async () => {
    const tresM = marca({ id: 'tres', nombre: '3M' })
    tabla('marcas').set('tres', filaRemota(tresM))
    tabla('marcas').set('gc', filaRemota(marca({ id: 'gc', nombre: 'GC' })))
    marcasT.seed([{ ...tresM, nombre: 'gc', sincronizado: false }])

    await runSyncBatch()

    expect(marcasT.all().find((m) => m.id === 'tres')).toMatchObject({
      nombre: '3M',
      sincronizado: true,
    })
    expect(useAvisosStore.getState().avisos).toMatchObject([
      { tipo: 'marca-repetida', insumoNombre: 'gc' },
    ])
  })

  it('eliminar una con insumos en el servidor se revierte con un aviso', async () => {
    const tresM = marca({ id: 'tres', nombre: '3M' })
    tabla('marcas').set('tres', filaRemota(tresM))
    tabla('insumos').set('remoto', { id: 'remoto', marca_id: 'tres', tenant_id: TENANT_1 })
    marcasT.seed([{ ...tresM, eliminadoEn: '2026-10-24T12:00:00.000Z', sincronizado: false }])

    await runSyncBatch()

    expect(marcasT.all()[0]).toMatchObject({ eliminadoEn: null, sincronizado: true })
    expect(useAvisosStore.getState().avisos).toMatchObject([
      { tipo: 'marca-no-eliminada', insumoNombre: '3M' },
    ])
  })

  it('un cambio de marca espera a que su marca suba y sale en el ciclo siguiente', async () => {
    tabla('insumos').set('i1', { id: 'i1', tenant_id: TENANT_1, marca_id: null })
    insumosT.seed([insumo({ marcaId: 'nueva' })])
    cambiosT.seed([cambioMarca({ valorNuevo: 'nueva' })])
    // La marca no sube en este ciclo (el personal no puede subir una ajena).
    useAuthStore.setState({ usuario: { ...admin, rol: 'personal' }, isReady: true })
    marcasT.seed([marca({ id: 'nueva', nombre: 'Nueva', creadoPor: 'otro', sincronizado: false })])

    await runSyncBatch()

    expect(tabla('cambios_insumo').size).toBe(0)
    expect(cambiosT.all()[0].sincronizado).toBe(false)

    useAuthStore.setState({ usuario: admin, isReady: true })
    await runSyncBatch()

    expect(tabla('cambios_insumo').has('c1')).toBe(true)
    expect(tabla('insumos').get('i1')?.marca_id).toBe('nueva')
  })

  it('una fila desfasada con marca_id null no borra la marca del servidor (R3)', async () => {
    tabla('marcas').set('m1', filaRemota(marca()))
    tabla('insumos').set('i1', {
      id: 'i1',
      tenant_id: TENANT_1,
      nombre: 'Composite Z350',
      marca_id: 'm1',
    })
    insumosT.seed([insumo({ marcaId: null })])

    await runSyncBatch()

    expect(insumosSubidos[0]).toMatchObject({ id: 'i1', marca_id: null })
    expect(tabla('insumos').get('i1')?.marca_id).toBe('m1')
    expect(insumosT.all()[0].marcaId).toBe('m1')
  })

  it('fromInsumoRow lee una fila sin marca_id como sin marca', async () => {
    tabla('insumos').set('i9', {
      id: 'i9',
      tenant_id: TENANT_1,
      nombre: 'Guantes',
      categoria: 'Descartables',
      unidad_medida: 'unidad',
      permite_decimales: false,
      caduca: false,
      codigo_fabricante: null,
      creado_en: '2026-10-24T10:00:00.000Z',
      stock_minimo: null,
    })

    await runSyncBatch()

    expect(insumosT.all().find((i) => i.id === 'i9')?.marcaId).toBeNull()
  })
})
