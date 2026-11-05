import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consultaFalsa } from '../helpers/consultaFalsa'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
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
      marcas: new MemoryTable(),
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

// Spec 024 (R6): filas remotas de `movimientos` que trae el pull.
let filasMovimientosRemotas: Record<string, unknown>[] = []

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert() {
        return { error: null }
      },
      select() {
        const resultado = consultaFalsa({
          filas: () => (nombre === 'movimientos' ? filasMovimientosRemotas : []),
          error: () => null,
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

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'
import { ingresoCompra, insumoCompra, loteCompra } from '../helpers/compras'

const lotesT = db.lotes as unknown as MemoryTable<Lote>

const insumo: Insumo = insumoCompra({ id: 'i1' })
const lote: Lote = loteCompra({ id: 'l1', insumoId: 'i1' })

function movimiento(overrides: Partial<Movimiento>): Movimiento {
  return { ...ingresoCompra('l1', 1), sincronizado: false, usuarioId: 'u1', ...overrides }
}

function filaRemota(m: Movimiento): Record<string, unknown> {
  return {
    id: m.id,
    tenant_id: m.tenantId,
    lugar_id: m.lugarId,
    traslado_id: null,
    tipo: m.tipo,
    lote_id: m.loteId,
    cantidad: m.cantidad,
    unidad: m.unidad,
    tratamiento_realizado_id: null,
    usuario_id: m.usuarioId,
    movimiento_origen_id: null,
    creado_en: m.creadoEn,
  }
}

beforeEach(async () => {
  usarLugar1()
  filasMovimientosRemotas = []
  await db.movimientos.clear()
  await db.lotes.clear()
  await db.insumos.clear()
  await db.insumos.put(insumo)
  await db.lotes.put({ ...lote })
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'u1',
      email: 'u1@x.cl',
      nombre: 'Usuario 1',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
})

describe('sobregiro por un ajuste negativo (spec 024 R6)', () => {
  it('un ajuste negativo que sube y deja el lote negativo lo marca en revisión', async () => {
    // El consumo de otro dispositivo ya llegó; el descarte local se calculó antes.
    await db.movimientos.put(movimiento({ id: 'ing', tipo: 'ingreso', cantidad: 4, sincronizado: true }))
    await db.movimientos.put(movimiento({ id: 'con', tipo: 'consumo', cantidad: 1, sincronizado: true }))
    await db.movimientos.put(movimiento({ id: 'aj', tipo: 'ajuste', cantidad: -4 }))

    await runSyncBatch()

    expect(lotesT.all()[0].estado).toBe('revision')
  })

  it('un ajuste negativo que llega por pull también se verifica', async () => {
    await db.movimientos.put(movimiento({ id: 'ing', tipo: 'ingreso', cantidad: 4, sincronizado: true }))
    await db.movimientos.put(movimiento({ id: 'con', tipo: 'consumo', cantidad: 1, sincronizado: true }))
    filasMovimientosRemotas = [
      filaRemota(movimiento({ id: 'aj', tipo: 'ajuste', cantidad: -4, lugarId: LUGAR_1 })),
    ]

    await runSyncBatch()

    expect(lotesT.all()[0].estado).toBe('revision')
  })

  it('un ajuste positivo no dispara la verificación', async () => {
    // Lote ya negativo por un dato viejo: solo se revisa si algo lo toca bajando stock.
    await db.movimientos.put(movimiento({ id: 'con', tipo: 'consumo', cantidad: 3, sincronizado: true }))
    await db.movimientos.put(movimiento({ id: 'aj', tipo: 'ajuste', cantidad: 1 }))

    await runSyncBatch()

    expect(lotesT.all()[0].estado).toBe('activo')
  })
})
