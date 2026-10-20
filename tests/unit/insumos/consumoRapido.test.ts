import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
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
  consumirUno,
  deshacerConsumo,
  selectLoteConsumoRapido,
} from '../../../src/features/insumos/lib/consumoRapido'
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
  creadoPor: null,
}

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('selectLoteConsumoRapido (FR-002/FR-003)', () => {
  it('picks the earliest-expiring vigente lot', () => {
    const r = selectLoteConsumoRapido(
      [
        { lote: lote('tarde', fecha(90, HOY)), stockDisponible: 5 },
        { lote: lote('pronto', fecha(10, HOY)), stockDisponible: 3 },
      ],
      HOY,
    )
    expect(r).toEqual({
      ok: true,
      lote: expect.objectContaining({ id: 'pronto' }),
    })
  })

  it('skips an expired lot even though it expires first (Clarification Q1)', () => {
    const r = selectLoteConsumoRapido(
      [
        { lote: lote('caducado', fecha(-3, HOY)), stockDisponible: 2 },
        { lote: lote('vigente', fecha(30, HOY)), stockDisponible: 4 },
      ],
      HOY,
    )
    expect(r.ok && r.lote.id).toBe('vigente')
  })

  it('treats a lot expiring today as vigente', () => {
    const r = selectLoteConsumoRapido(
      [{ lote: lote('hoy', fecha(0, HOY)), stockDisponible: 1 }],
      HOY,
    )
    expect(r.ok && r.lote.id).toBe('hoy')
  })

  it('uses undated lots only after dated ones', () => {
    const r = selectLoteConsumoRapido(
      [
        { lote: lote('sin-fecha', null), stockDisponible: 9 },
        { lote: lote('con-fecha', fecha(200, HOY)), stockDisponible: 1 },
      ],
      HOY,
    )
    expect(r.ok && r.lote.id).toBe('con-fecha')
  })

  it('skips a lot with less than one unit for the next one that covers it', () => {
    const r = selectLoteConsumoRapido(
      [
        { lote: lote('medio', fecha(5, HOY)), stockDisponible: 0.5 },
        { lote: lote('entero', fecha(50, HOY)), stockDisponible: 2 },
      ],
      HOY,
    )
    expect(r.ok && r.lote.id).toBe('entero')
  })

  it("returns 'solo-caducado' when only expired lots have stock", () => {
    const r = selectLoteConsumoRapido(
      [{ lote: lote('caducado', fecha(-1, HOY)), stockDisponible: 4 }],
      HOY,
    )
    expect(r).toEqual({ ok: false, motivo: 'solo-caducado' })
  })

  it("returns 'sin-stock' when no lot has at least one unit", () => {
    expect(selectLoteConsumoRapido([], HOY)).toEqual({
      ok: false,
      motivo: 'sin-stock',
    })
    expect(
      selectLoteConsumoRapido(
        [{ lote: lote('medio', fecha(5, HOY)), stockDisponible: 0.4 }],
        HOY,
      ),
    ).toEqual({ ok: false, motivo: 'sin-stock' })
  })
})

describe('consumirUno / deshacerConsumo (FR-004, FR-008)', () => {
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

  it('writes one consumo of 1 on the right lot, vibrates and adds a notice', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
    lotesTable.seed([lote('a', fecha(10)), lote('b', fecha(60))])
    movimientosTable.seed([ingreso('a', 3), ingreso('b', 5)])

    const movimiento = await consumirUno(insumo)

    expect(movimiento).toMatchObject({
      tipo: 'consumo',
      loteId: 'a',
      cantidad: 1,
      usuarioId: 'user-1',
    })
    expect(stock('a')).toBe(2)
    expect(vibrate).toHaveBeenCalledOnce()
    expect(useAvisosStore.getState().avisos).toHaveLength(1)
  })

  it('never overdraws a 1-unit lot on two concurrent taps (spec Edge Cases)', async () => {
    lotesTable.seed([lote('a', fecha(10))])
    movimientosTable.seed([ingreso('a', 1)])

    const [primero, segundo] = await Promise.all([
      consumirUno(insumo),
      consumirUno(insumo),
    ])

    expect([primero, segundo].filter(Boolean)).toHaveLength(1)
    expect(stock('a')).toBe(0)
  })

  it('returns null and writes nothing when only expired stock remains', async () => {
    lotesTable.seed([lote('viejo', fecha(-5))])
    movimientosTable.seed([ingreso('viejo', 3)])

    expect(await consumirUno(insumo)).toBeNull()
    expect(movimientosTable.all()).toHaveLength(1)
  })

  it('undo writes one linked ajuste and restores the stock; a second undo does nothing', async () => {
    lotesTable.seed([lote('a', fecha(10))])
    movimientosTable.seed([ingreso('a', 4)])
    const consumo = (await consumirUno(insumo))!

    const reversion = await deshacerConsumo(consumo.id)
    const otra = await deshacerConsumo(consumo.id)

    expect(reversion).toMatchObject({
      tipo: 'ajuste',
      cantidad: 1,
      loteId: 'a',
      movimientoOrigenId: consumo.id,
    })
    expect(otra).toBeNull()
    expect(stock('a')).toBe(4)
    expect(
      movimientosTable.all().filter((m) => m.tipo === 'consumo'),
    ).toHaveLength(1)
  })
})
