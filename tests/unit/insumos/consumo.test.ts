import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      insumos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
    }),
  }
})

vi.mock('../../../src/stores/authStore', () => ({
  getUsuarioActualId: () => 'user-1',  // Spec 014: tenant de la clínica original (literal: el factory se iza).
  tenantActualOFallar: () => '00000000-0000-4000-8000-000000000001',
}))

import { db } from '../../../src/lib/db'
import {
  deshacerConsumo,
  disponibilidadConsumo,
  registrarConsumo,
  StockInsuficienteConsumoError,
} from '../../../src/features/insumos/lib/consumo'
import { computeStockLote } from '../../../src/features/insumos/lib/stock'
import { useAvisosStore } from '../../../src/stores/avisosStore'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'
import { usarLugar1 } from '../../helpers/lugarFalso'

const lotesTable = db.lotes as unknown as MemoryTable<Lote & { id: string }>
const movimientosTable = db.movimientos as unknown as MemoryTable<
  Movimiento & { id: string }
>

const HOY = new Date(2026, 8, 23)

function fecha(dias: number, desde: Date = new Date()): string {
  const d = new Date(
    Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate()),
  )
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function lote(
  id: string,
  fechaCaducidad: string | null,
  insumoId = 'insumo-1',
): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id,
    insumoId,
    numeroLote: id,
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
  }
}

function ingreso(loteId: string, cantidad: number): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'user-1',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

const insumo: Insumo = {
  unidadCompra: 'caja',
  contenido: 1,
  tenantId: TENANT_1,
  id: 'insumo-1',
  nombre: 'Anestesia',
  categoria: 'Cirugía',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: true,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  marcaId: null,
  creadoPor: null,
}

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

// Spec 025 (research.md R2): el botón "Consumir" se habilita con cualquier
// stock > 0, incluso fraccionario o solo vencido (Clarifications).
describe('disponibilidadConsumo (FR-008, FR-009)', () => {
  it('habilita con stock fraccionario menor que 1', () => {
    expect(
      disponibilidadConsumo([{ lote: lote('a', fecha(10, HOY)), stockDisponible: 0.5 }]),
    ).toEqual({ ok: true })
  })

  it('habilita con solo stock vencido', () => {
    expect(
      disponibilidadConsumo([{ lote: lote('a', fecha(-3, HOY)), stockDisponible: 2 }]),
    ).toEqual({ ok: true })
  })

  it("'sin-stock' cuando ningún lote tiene stock", () => {
    expect(
      disponibilidadConsumo([{ lote: lote('a', fecha(10, HOY)), stockDisponible: 0 }]),
    ).toEqual({ ok: false, motivo: 'sin-stock' })
    expect(disponibilidadConsumo([])).toEqual({ ok: false, motivo: 'sin-stock' })
  })
})

describe('registrarConsumo / deshacerConsumo (FR-007)', () => {
  beforeEach(() => {
    lotesTable.seed([])
    movimientosTable.seed([])
    useAvisosStore.setState({ avisos: [] })
  })

  afterEach(() => {
    for (const aviso of useAvisosStore.getState().avisos) {
      useAvisosStore.getState().descartar(aviso.id)
    }
  })

  function stock(loteId: string): number {
    return computeStockLote(
      movimientosTable.all().filter((m) => m.loteId === loteId),
    )
  }

  it('escribe un consumo por la cantidad, vibra y agrega un aviso con la cantidad real', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
    lotesTable.seed([lote('a', fecha(10)), lote('b', fecha(60))])
    movimientosTable.seed([ingreso('a', 5), ingreso('b', 5)])

    const movimiento = await registrarConsumo({ insumo, loteId: 'a', cantidad: 4 })

    expect(movimiento).toMatchObject({
      tipo: 'consumo',
      loteId: 'a',
      cantidad: 4,
      unidad: 'caja',
      lugarId: LUGAR_1,
      usuarioId: 'user-1',
    })
    expect(stock('a')).toBe(1)
    expect(vibrate).toHaveBeenCalledOnce()
    const avisos = useAvisosStore.getState().avisos
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toMatchObject({
      tipo: 'consumo',
      movimientoId: movimiento.id,
      detalle: 'Consumido 4 cajas de Anestesia',
    })
  })

  it('rechaza sin escribir si el stock del lote no alcanza', async () => {
    lotesTable.seed([lote('a', fecha(10))])
    movimientosTable.seed([ingreso('a', 2)])

    await expect(
      registrarConsumo({ insumo, loteId: 'a', cantidad: 3 }),
    ).rejects.toBeInstanceOf(StockInsuficienteConsumoError)
    expect(movimientosTable.all()).toHaveLength(1)
    expect(useAvisosStore.getState().avisos).toHaveLength(0)
  })

  it('permite consumir un lote vencido elegido explícitamente', async () => {
    lotesTable.seed([lote('viejo', fecha(-5))])
    movimientosTable.seed([ingreso('viejo', 3)])

    await registrarConsumo({ insumo, loteId: 'viejo', cantidad: 1 })

    expect(stock('viejo')).toBe(2)
  })

  it('dos registros simultáneos no sobregiran un lote de 1 (spec Edge Cases)', async () => {
    lotesTable.seed([lote('a', fecha(10))])
    movimientosTable.seed([ingreso('a', 1)])

    const resultados = await Promise.allSettled([
      registrarConsumo({ insumo, loteId: 'a', cantidad: 1 }),
      registrarConsumo({ insumo, loteId: 'a', cantidad: 1 }),
    ])

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(stock('a')).toBe(0)
  })

  it('deshacer escribe un ajuste vinculado y restaura el stock; un segundo deshacer no hace nada', async () => {
    lotesTable.seed([lote('a', fecha(10))])
    movimientosTable.seed([ingreso('a', 4)])
    const consumo = await registrarConsumo({ insumo, loteId: 'a', cantidad: 3 })

    const reversion = await deshacerConsumo(consumo.id)
    const otra = await deshacerConsumo(consumo.id)

    expect(reversion).toMatchObject({
      tipo: 'ajuste',
      cantidad: 3,
      loteId: 'a',
      movimientoOrigenId: consumo.id,
    })
    expect(otra).toBeNull()
    expect(stock('a')).toBe(4)
  })
})
