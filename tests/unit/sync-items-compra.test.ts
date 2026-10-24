import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consultaFalsa } from '../helpers/consultaFalsa'
import type { Categoria, ItemCompra, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      proveedores: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      categorias: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      estadoSync: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
    }),
  }
})

// ---- fake Supabase: in-memory tables, sin RLS (research.md R2: items_compra
// nunca rechaza por rol) ----
type RemoteRow = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, RemoteRow>> = {}
let redCaida = false
/**
 * Spec 022 R6: emula la política "items_compra: insertar como uno mismo", que
 * Postgres aplica a todas las filas de un upsert (también a las que terminan
 * en UPDATE): uno con cualquier fila de otra persona falla entero (42501). El
 * UPDATE pasa la política del tenant y no crea filas.
 */
let conRls = false
let fallaEnPropios = false
const llamadasUpsert: string[][] = []
const llamadasUpdate: string[] = []

function tabla(nombre: string) {
  remoto[nombre] ??= new Map()
  return remoto[nombre]
}

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(rows: RemoteRow | RemoteRow[]) {
        if (redCaida) return { error: { code: 'NETWORK', message: 'fetch failed' } }
        const lista = Array.isArray(rows) ? rows : [rows]
        if (nombre === 'items_compra') {
          llamadasUpsert.push(lista.map((row) => row.id))
          if (fallaEnPropios && lista.some((row) => row.creado_por === 'user-1')) {
            return { error: { code: '500', message: 'error del servidor' } }
          }
          if (conRls && lista.some((row) => row.creado_por !== 'user-1')) {
            return {
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "items_compra"',
              },
            }
          }
        }
        for (const row of lista) tabla(nombre).set(row.id, structuredClone(row))
        return { error: null }
      },
      update(cambios: Record<string, unknown>) {
        return {
          eq: (_columna: string, id: string) => ({
            select: async () => {
              llamadasUpdate.push(id)
              if (redCaida) return { data: null, error: { code: 'NETWORK', message: 'fetch failed' } }
              const fila = tabla(nombre).get(id)
              if (!fila) return { data: [], error: null }
              tabla(nombre).set(id, { ...fila, ...structuredClone(cambios) })
              return { data: [{ id }], error: null }
            },
          }),
        }
      },
      select() {
        const resultado = consultaFalsa({
          filas: () => [...tabla(nombre).values()],
          error: () => (redCaida ? { message: 'fetch failed' } : null),
        })
        return Object.assign(resultado, {
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        })
      },
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
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const itemsCompraT = db.itemsCompra as unknown as MemoryTable<ItemCompra>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>

function itemCompra(overrides: Partial<ItemCompra>): ItemCompra {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    nombre: 'Guantes M',
    cantidad: null,
    nota: null,
    insumoId: null,
    estado: 'pendiente',
    creadoPor: 'user-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    compradoPor: null,
    compradoEn: null,
    ...overrides,
  }
}

const usuario: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'user-1',
  email: 'u@x.cl',
  nombre: 'Usuario',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  for (const key of Object.keys(remoto)) delete remoto[key]
  redCaida = false
  conRls = false
  fallaEnPropios = false
  llamadasUpsert.length = 0
  llamadasUpdate.length = 0
  itemsCompraT.seed([])
  categoriasT.seed([])
  useAuthStore.setState({ usuario, isReady: true })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('pushItemsCompra / pullItemsCompra (research.md R2)', () => {
  it('pushes a new local row and it lands on the remote table', async () => {
    itemsCompraT.seed([itemCompra({ id: 'item-1' })])

    await runSyncBatch()

    expect(tabla('items_compra').get('item-1')).toMatchObject({
      nombre: 'Guantes M',
      estado: 'pendiente',
    })
  })

  it('a remote-only row is pulled in via bulkPut', async () => {
    tabla('items_compra').set('item-remoto', {
      id: 'item-remoto',
      nombre: 'Torundas',
      cantidad: 3,
      nota: null,
      insumo_id: null,
      estado: 'pendiente',
      creado_por: 'user-2',
      creado_en: '2026-01-01T00:00:00.000Z',
      comprado_por: null,
      comprado_en: null,
    })

    await runSyncBatch()

    const local = await db.itemsCompra.get('item-remoto')
    expect(local).toMatchObject({ nombre: 'Torundas', cantidad: 3, insumoId: null })
  })

  it('re-uploads a row whose estado changed locally, without any sincronizado flag blocking it', async () => {
    itemsCompraT.seed([itemCompra({ id: 'item-1', estado: 'pendiente' })])
    await runSyncBatch()
    expect(tabla('items_compra').get('item-1')).toMatchObject({ estado: 'pendiente' })

    await itemsCompraT.update('item-1', {
      estado: 'comprado',
      compradoPor: 'user-1',
      compradoEn: '2026-01-02T00:00:00.000Z',
    })
    await runSyncBatch()

    expect(tabla('items_compra').get('item-1')).toMatchObject({
      estado: 'comprado',
      comprado_por: 'user-1',
    })
  })

  it('without a backend, the cycle does not throw and leaves rows unchanged', async () => {
    itemsCompraT.seed([itemCompra({ id: 'item-1' })])
    redCaida = true

    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'sin-red' })

    expect(itemsCompraT.all()[0]).toMatchObject({ estado: 'pendiente' })
  })
})

describe('pushItemsCompra con ítems de otra persona (spec 022 R6, FR-020)', () => {
  beforeEach(() => {
    conRls = true
  })

  it('los propios suben por upsert; los ajenos sin cambios locales no suben', async () => {
    tabla('items_compra').set('ajeno', { id: 'ajeno', creado_por: 'user-2', estado: 'pendiente' })
    itemsCompraT.seed([
      itemCompra({ id: 'propio' }),
      itemCompra({ id: 'ajeno', creadoPor: 'user-2' }),
    ])

    const resultado = await runSyncBatch()

    expect(llamadasUpsert).toEqual([['propio']])
    expect(llamadasUpdate).toEqual([])
    expect(resultado.estado).toBe('ok')
  })

  it('un ajeno que marqué comprado sube por UPDATE y deja de estar pendiente de subir', async () => {
    tabla('items_compra').set('ajeno', { id: 'ajeno', creado_por: 'user-2', estado: 'pendiente' })
    itemsCompraT.seed([
      itemCompra({ id: 'propio' }),
      itemCompra({
        id: 'ajeno',
        creadoPor: 'user-2',
        estado: 'comprado',
        compradoPor: 'user-1',
        compradoEn: '2026-01-02T00:00:00.000Z',
        cambioLocal: true,
      }),
    ])

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('ok')
    expect(tabla('items_compra').get('propio')).toBeTruthy()
    expect(tabla('items_compra').get('ajeno')).toMatchObject({
      estado: 'comprado',
      comprado_por: 'user-1',
      creado_por: 'user-2',
    })
    expect(itemsCompraT.all().find((item) => item.id === 'ajeno')?.cambioLocal).toBeFalsy()
  })

  it('un ajeno que aún no está en el servidor espera, sin error ni pisarse en el pull', async () => {
    itemsCompraT.seed([
      itemCompra({ id: 'propio' }),
      itemCompra({ id: 'ajeno-nuevo', creadoPor: 'user-2', estado: 'eliminado', cambioLocal: true }),
    ])

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('ok')
    expect(resultado.etapasConError).toEqual([])
    expect(tabla('items_compra').has('propio')).toBe(true)
    expect(tabla('items_compra').has('ajeno-nuevo')).toBe(false)
    expect(itemsCompraT.all().find((item) => item.id === 'ajeno-nuevo')).toMatchObject({
      estado: 'eliminado',
      cambioLocal: true,
    })
  })

  it('el pull no pisa un cambio local sin subir', async () => {
    tabla('items_compra').set('ajeno', {
      id: 'ajeno',
      tenant_id: TENANT_1,
      lugar_id: LUGAR_1,
      nombre: 'Guantes M',
      cantidad: null,
      nota: null,
      insumo_id: null,
      estado: 'pendiente',
      creado_por: 'user-2',
      creado_en: '2026-01-01T00:00:00.000Z',
      comprado_por: null,
      comprado_en: null,
    })
    itemsCompraT.seed([
      itemCompra({ id: 'ajeno', creadoPor: 'user-2', estado: 'eliminado', cambioLocal: true }),
    ])
    redCaida = false
    // El UPDATE falla por red a mitad del ciclo: el pull no debe revertirlo.
    const original = client.from
    client.from = (nombre: string) => {
      const tablaFalsa = original(nombre)
      return {
        ...tablaFalsa,
        update: () => ({
          eq: () => ({
            select: async () => ({ data: null, error: { code: '500', message: 'error' } }),
          }),
        }),
      }
    }
    try {
      await runSyncBatch()
    } finally {
      client.from = original
    }

    expect(itemsCompraT.all()[0]).toMatchObject({ estado: 'eliminado', cambioLocal: true })
  })

  it('un error que no es de permisos en los propios sí queda en el ciclo', async () => {
    fallaEnPropios = true
    itemsCompraT.seed([itemCompra({ id: 'propio' })])

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('error')
    expect(resultado.etapasConError).toContain('push items_compra')
  })

  it('sin usuario con sesión no sube nada', async () => {
    useAuthStore.setState({ usuario: null, isReady: true })
    itemsCompraT.seed([itemCompra({ id: 'propio' })])

    await runSyncBatch()

    expect(llamadasUpsert).toEqual([])
  })
})
