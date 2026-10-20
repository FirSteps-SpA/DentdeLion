import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lote, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((nombre) => [nombre, new MemoryTable()])),
    ),
  }
})

/**
 * Spec 014 T056 (FR-021, Edge Case "usuario desactivado con pendientes"): el
 * ciclo lee el perfil; si está desactivado, sube con INSERT simple los
 * pendientes previos a la desactivación, deja los posteriores y se detiene.
 */
const DESACTIVADO_EN = '2026-10-18T12:00:00.000Z'
const estado = {
  desactivadoEn: DESACTIVADO_EN as string | null,
  inserts: [] as { tabla: string; ids: string[] }[],
  upserts: [] as string[],
}

const client = {
  auth: authFalso,
  from(tabla: string) {
    return {
      select() {
        const resultado = Promise.resolve({ data: [], error: null })
        return Object.assign(resultado, {
          eq: () => ({
            single: async () => ({
              data: {
                id: 'u1',
                nombre: 'U1',
                rol: 'personal',
                tenant_id: '00000000-0000-4000-8000-000000000001',
                desactivado_en: tabla === 'perfiles' ? estado.desactivadoEn : null,
              },
              error: null,
            }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        })
      },
      async insert(filas: unknown) {
        const lista = (Array.isArray(filas) ? filas : [filas]) as { id: string }[]
        estado.inserts.push({ tabla, ids: lista.map((f) => f.id) })
        return { error: null }
      },
      async upsert() {
        estado.upserts.push(tabla)
        return { error: null }
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
import { usarLugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const movimiento = (id: string, creadoEn: string): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  id,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  tipo: 'consumo',
  loteId: 'l1',
  cantidad: 1,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn,
  sincronizado: false,
})

const lote: Lote = {
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  id: 'l1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  insumoId: 'i1',
  numeroLote: 'L1',
  proveedor: 'P',
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-10-18T09:00:00.000Z',
}

beforeEach(async () => {
  usarLugar1()
  estado.desactivadoEn = DESACTIVADO_EN
  estado.inserts = []
  estado.upserts = []
  await db.movimientos.clear()
  await db.lotes.clear()
  await db.lotes.put(lote)
  await db.movimientos.bulkPut([
    movimiento('antes', '2026-10-18T10:00:00.000Z'),
    movimiento('despues', '2026-10-18T13:00:00.000Z'),
  ])
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'u1@x.cl',
      nombre: 'U1',
      rol: 'personal',
      autenticadoEn: 'x',
      tenantId: TENANT_1,
      desactivadoEn: null,
    },
    isReady: true,
  })
})

describe('usuario desactivado (spec 014 FR-021)', () => {
  it('marca el acceso desactivado, sube lo previo y detiene el ciclo', async () => {
    const resultado = await runSyncBatch()

    expect(useAuthStore.getState().usuario?.desactivadoEn).toBe(DESACTIVADO_EN)
    expect(estado.inserts).toEqual([
      { tabla: 'lotes', ids: ['l1'] },
      { tabla: 'movimientos', ids: ['antes'] },
    ])
    expect(estado.upserts).toEqual([])
    const porId = Object.fromEntries(movimientosT.all().map((m) => [m.id, m.sincronizado]))
    expect(porId).toEqual({ antes: true, despues: false })
    expect(resultado.estado).toBe('sesion')
  })

  it('al reactivarlo vuelve a sincronizar normalmente', async () => {
    await useAuthStore.getState().marcarDesactivado(DESACTIVADO_EN)
    estado.desactivadoEn = null

    await runSyncBatch()

    expect(useAuthStore.getState().usuario?.desactivadoEn).toBeNull()
    expect(estado.upserts).toContain('lotes')
  })
})
