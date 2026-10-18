import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Lote } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      configuracionClinica: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      categorias: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      estadoSync: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
    }),
  }
})

const upserts: Record<string, unknown[]> = {}

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(rows: unknown | unknown[]) {
        upserts[nombre] = Array.isArray(rows) ? rows : [rows]
        return { error: null }
      },
      select() {
        const resultado = Promise.resolve({ data: [], error: null })
        return Object.assign(resultado, {
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        })
      },
    }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>

const insumoA: Insumo = {
  id: 'a',
  nombre: 'Guantes',
  categoria: 'Cirugía',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}
const insumoB: Insumo = { ...insumoA, id: 'b', nombre: 'Bisturí' }

const loteA: Lote = {
  id: 'lote-a',
  insumoId: 'a',
  numeroLote: 'A-1',
  proveedor: 'P',
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  for (const key of Object.keys(upserts)) delete upserts[key]
  insumosT.seed([insumoA, insumoB])
  lotesT.seed([loteA])
})

/**
 * Regression coverage for spec 010's RLS closure (research.md R1, FR-012):
 * `pushInsumos`/`pushLotes` must keep re-uploading the *entire* local table
 * via `upsert` every cycle, regardless of the locally-authenticated user's
 * role — a restrictive server-side policy would reject a non-admin's
 * routine resync, but that's enforced by a trigger now, not by the client
 * withholding rows. This test only guards the client-side invariant.
 */
describe('full-table resync invariant (spec 010 FR-012)', () => {
  it('re-uploads every local insumo and lote for a personal (non-administrador) user', async () => {
    useAuthStore.setState({
      usuario: {
        id: 'personal-1',
        email: 'p@x.cl',
        nombre: 'Personal',
        rol: 'personal',
        autenticadoEn: 'x',
      },
      isReady: true,
    })

    await runSyncBatch()

    expect(upserts.insumos).toHaveLength(2)
    expect(upserts.lotes).toHaveLength(1)
  })

  it('re-uploads every local insumo and lote for an administrador user too', async () => {
    useAuthStore.setState({
      usuario: {
        id: 'admin-1',
        email: 'a@x.cl',
        nombre: 'Admin',
        rol: 'administrador',
        autenticadoEn: 'x',
      },
      isReady: true,
    })

    await runSyncBatch()

    expect(upserts.insumos).toHaveLength(2)
    expect(upserts.lotes).toHaveLength(1)
  })
})
