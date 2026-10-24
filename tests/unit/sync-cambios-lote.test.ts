import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioLote, Lote } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { crearClienteFalso, crearEstado, reiniciar } from '../helpers/clienteFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})

const estado = crearEstado()
const client = crearClienteFalso(estado)

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 015 T056 (research.md R6, contracts/supabase-schema.md §7): las
 * correcciones de precio suben como `cambios_lote` (insert-only, abierto a todo
 * el tenant), solo las del usuario con sesión, después de los lotes.
 */
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const cambiosLoteT = db.cambiosLote as unknown as MemoryTable<CambioLote>

const lote: Lote = {
  id: 'l1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  insumoId: 'i1',
  numeroLote: 'A1',
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-10-01T00:00:00.000Z',
  cantidadIngresada: 2,
  unidadIngresada: 'caja',
  contenido: 50,
  unidadConsumo: 'cartucho',
  precioCompra: null,
}

function cambio(id: string, usuarioId: string, valorNuevo: number | null): CambioLote {
  return {
    id,
    tenantId: TENANT_1,
    loteId: 'l1',
    campo: 'precioCompra',
    valorAnterior: null,
    valorNuevo,
    usuarioId,
    creadoEn: '2026-10-19T10:00:00.000Z',
    sincronizado: false,
  }
}

beforeEach(() => {
  reiniciar(estado)
  lotesT.seed([lote])
  cambiosLoteT.seed([cambio('pB', 'B', 32500), cambio('pA', 'A', 30000)])
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'B',
      email: 'b@x.cl',
      nombre: 'Bea',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
})

describe('sync de cambios_lote (spec 015 US5)', () => {
  it('sube solo los del usuario con sesión, después de los lotes, y los marca subidos', async () => {
    await runSyncBatch()

    const tablas = estado.upserts.map((u) => u.tabla)
    expect(tablas.indexOf('lotes')).toBeLessThan(tablas.indexOf('cambios_lote'))
    const subidos = estado.upserts
      .filter((u) => u.tabla === 'cambios_lote')
      .flatMap((u) => u.filas)
    expect(subidos).toEqual([
      expect.objectContaining({
        id: 'pB',
        lote_id: 'l1',
        campo: 'precioCompra',
        valor_nuevo: 32500,
        usuario_id: 'B',
        tenant_id: TENANT_1,
      }),
    ])
    expect(cambiosLoteT.all().find((c) => c.id === 'pB')?.sincronizado).toBe(true)
    expect(cambiosLoteT.all().find((c) => c.id === 'pA')?.sincronizado).toBe(false)
  })

  it('un error deja las filas pendientes y es un error del ciclo', async () => {
    estado.errorUpsert.cambios_lote = { message: 'internal error', code: 'XX000' }
    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('error')
    expect(cambiosLoteT.all().find((c) => c.id === 'pB')?.sincronizado).toBe(false)
  })

  it('baja las correcciones de otros dispositivos', async () => {
    estado.remoto.cambios_lote = new Map([
      [
        'remoto',
        {
          id: 'remoto',
          tenant_id: TENANT_1,
          lote_id: 'l1',
          campo: 'precioCompra',
          valor_anterior: null,
          valor_nuevo: 31000,
          usuario_id: 'C',
          creado_en: '2026-10-19T11:00:00.000Z',
        },
      ],
    ])
    await runSyncBatch()

    expect(cambiosLoteT.all().find((c) => c.id === 'remoto')).toMatchObject({
      valorNuevo: 31000,
      usuarioId: 'C',
      sincronizado: true,
    })
  })
})
