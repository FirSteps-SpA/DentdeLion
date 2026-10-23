import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consultaFalsa } from '../helpers/consultaFalsa'
import type { Insumo, Lote } from '../../src/lib/db'
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
        const resultado = consultaFalsa({ filas: () => [], error: () => null })
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
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>

const insumoA: Insumo = {
  unidadCompra: 'caja',
  contenido: 1,
  tenantId: TENANT_1,
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
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'lote-a',
  insumoId: 'a',
  numeroLote: 'A-1',
  proveedor: 'P',
  proveedorId: null,
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
// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('full-table resync invariant (spec 010 FR-012)', () => {
  it('re-uploads every local insumo and lote for a personal (non-administrador) user', async () => {
    useAuthStore.setState({
      usuario: {
        tenantId: TENANT_1,
        desactivadoEn: null,
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
        tenantId: TENANT_1,
        desactivadoEn: null,
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
