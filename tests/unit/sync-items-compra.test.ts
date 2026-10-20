import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      configuracionClinica: new MemoryTable(),
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
        for (const row of lista) tabla(nombre).set(row.id, structuredClone(row))
        return { error: null }
      },
      select() {
        const resultado = Promise.resolve({
          data: redCaida
            ? null
            : [...tabla(nombre).values()].map((r) => structuredClone(r)),
          error: redCaida ? { message: 'fetch failed' } : null,
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
