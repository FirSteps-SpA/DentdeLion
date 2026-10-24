import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Borrador,
  Lote,
  Lugar,
  Proveedor,
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

// ---- Supabase falso: tablas en memoria con las reglas de proveedores del servidor ----
type Fila = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, Fila>> = {}
/** Orden de las escrituras: `tabla:metodo`. */
const llamadas: string[] = []
/** Filas tal como llegaron en cada upsert de lotes. */
const lotesSubidos: Fila[] = []
/** Simula que las escrituras de proveedores no llegan (sin red). */
let llamadasFallan = false

const tabla = (nombre: string) => (remoto[nombre] ??= new Map())
const clave = (nombre: unknown) =>
  String(nombre)
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')

/** `proveedores` con la clave única por tenant y la regla de no eliminar con lotes. */
function escribirProveedor(fila: Fila, insertar: boolean) {
  const existente = tabla('proveedores').get(fila.id)
  if (insertar && existente)
    return { code: '23505', message: 'duplicate key (pkey)' }
  const repetido = [...tabla('proveedores').values()].some(
    (otro) =>
      otro.id !== fila.id &&
      !otro.eliminado_en &&
      otro.clave === clave(fila.nombre),
  )
  if (!fila.eliminado_en && repetido)
    return {
      code: '23505',
      message: 'duplicate key value violates proveedores_clave_por_tenant',
    }
  const conLotes = [...tabla('lotes').values()].some(
    (lote) => lote.proveedor_id === fila.id,
  )
  if (fila.eliminado_en && !existente?.eliminado_en && conLotes)
    return { code: 'P0001', message: 'proveedor_con_lotes' }
  tabla('proveedores').set(fila.id, {
    ...structuredClone(fila),
    clave: clave(fila.nombre),
  })
  return null
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
    then(
      resolver: (r: unknown) => unknown,
      rechazar?: (e: unknown) => unknown,
    ) {
      const data = [...tabla(nombre).values()]
        .filter((f) => filtros.every((pasa) => pasa(f)))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, limite)
        .map((f) => structuredClone(f))
      return Promise.resolve({ data, error: null, status: 200 }).then(
        resolver,
        rechazar,
      )
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
        if (llamadasFallan && nombre === 'proveedores')
          return { error: { code: '', message: 'fetch failed' }, status: 0 }
        const lista = Array.isArray(filas) ? filas : [filas]
        if (nombre === 'lotes') lotesSubidos.push(...structuredClone(lista))
        for (const fila of lista) {
          if (nombre === 'proveedores') {
            const error = escribirProveedor(fila, false)
            if (error) return { error, status: 400 }
          } else if (nombre === 'lotes' && tabla('lotes').has(fila.id)) {
            // El servidor no deja cambiar el proveedor de un lote (R3).
            const previo = tabla('lotes').get(fila.id)!
            tabla('lotes').set(fila.id, {
              ...structuredClone(fila),
              proveedor_id: previo.proveedor_id,
            })
          } else {
            tabla(nombre).set(
              String(fila.id ?? `${fila.insumo_id}|${fila.lugar_id}`),
              structuredClone(fila),
            )
          }
        }
        return { error: null, status: 201 }
      },
      async insert(fila: Fila) {
        llamadas.push(`${nombre}:insert`)
        const error = escribirProveedor(fila, true)
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
import { proveedorFalso } from '../helpers/proveedor'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const proveedoresT = db.proveedores as unknown as MemoryTable<Proveedor>
const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
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

function lote(overrides: Partial<Lote> = {}): Lote {
  return {
    id: 'l1',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId: 'i1',
    numeroLote: 'A1',
    proveedor: 'Proveedor X',
    proveedorId: 'local-p',
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    ...overrides,
  }
}

function filaRemota(p: Proveedor): Fila {
  return {
    id: p.id,
    tenant_id: p.tenantId,
    nombre: p.nombre,
    clave: clave(p.nombre),
    whatsapp: p.whatsapp,
    contacto: p.contacto,
    creado_por: p.creadoPor,
    creado_en: p.creadoEn,
    desactivado_en: p.desactivadoEn,
    eliminado_en: p.eliminadoEn,
  }
}

beforeEach(() => {
  for (const nombre of Object.keys(remoto)) delete remoto[nombre]
  llamadas.length = 0
  lotesSubidos.length = 0
  llamadasFallan = false
  for (const t of [proveedoresT, lugaresT, lotesT, borradoresT]) t.seed([])
  lugaresT.seed([lugar1])
  useAvisosStore.setState({ avisos: [] })
  useAuthStore.setState({ usuario: admin, isReady: true })
})

/** Spec 021 T016 (research.md R6, contracts/supabase-schema.md §8). */
describe('sincronización de proveedores', () => {
  it('sube los proveedores antes que los lugares y los lotes', async () => {
    proveedoresT.seed([proveedorFalso({ id: 'local-p', sincronizado: false })])
    lugaresT.seed([
      { ...lugar1, proveedorPredeterminadoId: 'local-p', sincronizado: false },
    ])
    lotesT.seed([lote()])

    await runSyncBatch()

    const indice = (llamada: string) => llamadas.indexOf(llamada)
    expect(indice('proveedores:upsert')).toBeGreaterThanOrEqual(0)
    expect(indice('proveedores:upsert')).toBeLessThan(indice('lugares:upsert'))
    expect(indice('lugares:upsert')).toBeLessThan(indice('lotes:upsert'))
    expect(tabla('lugares').get(LUGAR_1)?.proveedor_predeterminado_id).toBe(
      'local-p',
    )
    expect(tabla('lotes').get('l1')?.proveedor_id).toBe('local-p')
    expect(proveedoresT.all()[0].sincronizado).toBe(true)
  })

  it('personal sube con insert lo que creó; administración, con upsert', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    proveedoresT.seed([
      proveedorFalso({
        id: 'mio',
        nombre: 'Mío',
        creadoPor: 'personal-1',
        sincronizado: false,
      }),
      proveedorFalso({
        id: 'ajeno',
        nombre: 'Ajeno',
        creadoPor: 'admin-1',
        sincronizado: false,
      }),
    ])

    await runSyncBatch()

    expect(llamadas.filter((l) => l.startsWith('proveedores'))).toEqual([
      'proveedores:insert',
    ])
    expect(tabla('proveedores').has('mio')).toBe(true)
    expect(tabla('proveedores').has('ajeno')).toBe(false)
  })

  it('un duplicado por clave se reemplaza por el del servidor en lotes, lugares y borrador', async () => {
    const delServidor = proveedorFalso({ id: 'srv-p', nombre: 'Proveedor X' })
    tabla('proveedores').set('srv-p', filaRemota(delServidor))
    proveedoresT.seed([
      proveedorFalso({
        id: 'local-p',
        nombre: ' proveedor  x',
        sincronizado: false,
      }),
    ])
    lugaresT.seed([
      { ...lugar1, proveedorPredeterminadoId: 'local-p', sincronizado: false },
    ])
    lotesT.seed([lote({ proveedor: ' proveedor  x' })])
    borradoresT.seed([
      {
        id: 'alta-material',
        datos: {
          lote: { numeroLote: '', proveedorId: 'local-p', fechaCaducidad: '' },
        },
        actualizadoEn: '2026-01-01T00:00:00.000Z',
      },
    ])

    await runSyncBatch()

    expect(proveedoresT.all().map((p) => p.id)).toEqual(['srv-p'])
    expect(lotesT.all()[0]).toMatchObject({
      proveedorId: 'srv-p',
      proveedor: 'Proveedor X',
    })
    expect(lugaresT.all()[0].proveedorPredeterminadoId).toBe('srv-p')
    const borrador = borradoresT.all()[0]
    expect(borrador.id === 'alta-material' && borrador.datos.lote?.proveedorId).toBe('srv-p')
    expect(tabla('lotes').get('l1')?.proveedor_id).toBe('srv-p')
    expect(tabla('lugares').get(LUGAR_1)?.proveedor_predeterminado_id).toBe(
      'srv-p',
    )
    expect(tabla('proveedores').size).toBe(1)
  })

  it('un insert repetido de la misma fila (ya había subido) solo la marca como subida', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    const mio = proveedorFalso({
      id: 'mio',
      nombre: 'Mío',
      creadoPor: 'personal-1',
    })
    tabla('proveedores').set('mio', filaRemota(mio))
    proveedoresT.seed([{ ...mio, sincronizado: false }])

    await runSyncBatch()

    expect(proveedoresT.all()).toEqual([{ ...mio, sincronizado: true }])
  })

  it('eliminar uno con lotes en el servidor se revierte con un aviso', async () => {
    const sur = proveedorFalso({ id: 'sur', nombre: 'Dental Sur' })
    tabla('proveedores').set('sur', filaRemota(sur))
    tabla('lotes').set('remoto', {
      id: 'remoto',
      proveedor_id: 'sur',
      tenant_id: TENANT_1,
    })
    proveedoresT.seed([
      { ...sur, eliminadoEn: '2026-06-01T00:00:00.000Z', sincronizado: false },
    ])

    await runSyncBatch()

    expect(proveedoresT.all()[0]).toMatchObject({
      eliminadoEn: null,
      sincronizado: true,
    })
    expect(useAvisosStore.getState().avisos).toMatchObject([
      { tipo: 'proveedor-no-eliminado', insumoNombre: 'Dental Sur' },
    ])
  })

  it('un lote sin proveedorId (antes del primer pull) no manda la columna y el pull la trae', async () => {
    lotesT.seed([lote({ proveedorId: null })])
    tabla('lotes').set('l1', {
      ...structuredClone({ id: 'l1' }),
      proveedor_id: 'srv-p',
    })
    tabla('proveedores').set(
      'srv-p',
      filaRemota(proveedorFalso({ id: 'srv-p' })),
    )

    await runSyncBatch()

    expect(lotesSubidos).toHaveLength(1)
    expect(lotesSubidos[0]).not.toHaveProperty('proveedor_id')
    expect(lotesT.all()[0].proveedorId).toBe('srv-p')
  })

  it('un cambio de nombre que choca con otro proveedor del servidor se revierte con aviso', async () => {
    const sur = proveedorFalso({ id: 'sur', nombre: 'Dental Sur' })
    tabla('proveedores').set('sur', filaRemota(sur))
    tabla('proveedores').set(
      'norte',
      filaRemota(proveedorFalso({ id: 'norte', nombre: 'Casa Norte' })),
    )
    proveedoresT.seed([{ ...sur, nombre: 'casa norte', sincronizado: false }])
    lotesT.seed([lote({ proveedorId: 'sur' })])

    await runSyncBatch()

    expect(proveedoresT.all().find((p) => p.id === 'sur')).toMatchObject({
      nombre: 'Dental Sur',
      sincronizado: true,
    })
    expect(lotesT.all()[0].proveedorId).toBe('sur')
    expect(useAvisosStore.getState().avisos).toMatchObject([
      { tipo: 'proveedor-repetido', insumoNombre: 'casa norte' },
    ])
  })

  it('el pull no pisa un cambio pendiente de administración, pero sí uno de personal', async () => {
    const sur = proveedorFalso({ id: 'sur', nombre: 'Dental Sur' })
    tabla('proveedores').set('sur', filaRemota(sur))
    useAuthStore.setState({ usuario: personal, isReady: true })
    proveedoresT.seed([
      { ...sur, nombre: 'Cambiado aquí', sincronizado: false },
    ])

    await runSyncBatch()

    // Personal no puede editar: gana el servidor.
    expect(proveedoresT.all()[0]).toMatchObject({
      nombre: 'Dental Sur',
      sincronizado: true,
    })

    // Administración: un cambio pendiente que el servidor todavía no recibió
    // (sin red) no se pisa con el pull.
    useAuthStore.setState({ usuario: admin, isReady: true })
    proveedoresT.seed([{ ...sur, contacto: 'Paula', sincronizado: false }])
    tabla('proveedores').set('sur', filaRemota(sur))
    llamadasFallan = true

    await runSyncBatch()

    expect(proveedoresT.all()[0]).toMatchObject({
      contacto: 'Paula',
      sincronizado: false,
    })
  })
})
