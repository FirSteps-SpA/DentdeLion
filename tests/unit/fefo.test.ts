import { describe, expect, it } from 'vitest'
import {
  selectFefoLot,
  selectLoteConsumo,
  type LoteConStock,
} from '../../src/features/insumos/lib/fefo'
import type { Lote } from '../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

function makeLote(overrides: Partial<Lote>): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'insumo-1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    proveedorId: null,
    fechaCaducidad: '2027-01-01',
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

describe('selectFefoLot', () => {
  it('selects the single available lot', () => {
    const lote = makeLote({ fechaCaducidad: '2027-06-01' })
    const entries: LoteConStock[] = [{ lote, stockDisponible: 10 }]

    const result = selectFefoLot(entries, 5)

    expect(result?.lote.id).toBe(lote.id)
  })

  it('prefers the lot closest to expiry among several with enough stock', () => {
    const loteLejano = makeLote({ fechaCaducidad: '2028-01-01' })
    const loteCercano = makeLote({ fechaCaducidad: '2026-12-01' })
    const entries: LoteConStock[] = [
      { lote: loteLejano, stockDisponible: 20 },
      { lote: loteCercano, stockDisponible: 20 },
    ]

    const result = selectFefoLot(entries, 5)

    expect(result?.lote.id).toBe(loteCercano.id)
  })

  it('falls back to the earliest-expiring lot when none has enough total stock', () => {
    const loteLejano = makeLote({ fechaCaducidad: '2028-01-01' })
    const loteCercano = makeLote({ fechaCaducidad: '2026-12-01' })
    const entries: LoteConStock[] = [
      { lote: loteLejano, stockDisponible: 2 },
      { lote: loteCercano, stockDisponible: 1 },
    ]

    const result = selectFefoLot(entries, 100)

    expect(result?.lote.id).toBe(loteCercano.id)
  })

  it('returns null when no lot has any available stock', () => {
    const entries: LoteConStock[] = [
      { lote: makeLote({}), stockDisponible: 0 },
      { lote: makeLote({}), stockDisponible: -3 },
    ]

    expect(selectFefoLot(entries, 1)).toBeNull()
  })

  it('sorts a lote with no fecha de caducidad after every dated lote (FR-002b)', () => {
    const loteSinFecha = makeLote({ fechaCaducidad: null })
    const loteConFecha = makeLote({ fechaCaducidad: '2030-01-01' })
    const entries: LoteConStock[] = [
      { lote: loteSinFecha, stockDisponible: 20 },
      { lote: loteConFecha, stockDisponible: 20 },
    ]

    const result = selectFefoLot(entries, 5)

    expect(result?.lote.id).toBe(loteConFecha.id)
  })

  it('picks a lote with no fecha de caducidad only once dated lotes are exhausted', () => {
    const loteSinFecha = makeLote({ fechaCaducidad: null })
    const loteConFecha = makeLote({ fechaCaducidad: '2030-01-01' })
    const entries: LoteConStock[] = [
      { lote: loteSinFecha, stockDisponible: 10 },
      { lote: loteConFecha, stockDisponible: 0 },
    ]

    const result = selectFefoLot(entries, 1)

    expect(result?.lote.id).toBe(loteSinFecha.id)
  })
})

// Spec 025 (research.md R1): lote por defecto de la hoja de consumo.
describe('selectLoteConsumo', () => {
  const HOY = new Date(2026, 10, 23)
  const entry = (
    numeroLote: string,
    fechaCaducidad: string | null,
    stockDisponible: number,
  ): LoteConStock => ({ lote: makeLote({ numeroLote, fechaCaducidad }), stockDisponible })

  it('propone el vigente aunque un vencido venza antes', () => {
    const result = selectLoteConsumo(
      [entry('VEN', '2026-11-01', 3), entry('VIG', '2027-06-01', 10)],
      1,
      HOY,
    )
    expect(result?.lote.numeroLote).toBe('VIG')
  })

  it('un lote que vence hoy sigue vigente', () => {
    const result = selectLoteConsumo(
      [entry('HOY', '2026-11-23', 2), entry('DESPUES', '2027-01-01', 2)],
      1,
      HOY,
    )
    expect(result?.lote.numeroLote).toBe('HOY')
  })

  it('usa los lotes sin fecha después de los fechados', () => {
    const result = selectLoteConsumo(
      [entry('SIN', null, 5), entry('FECHA', '2027-01-01', 5)],
      1,
      HOY,
    )
    expect(result?.lote.numeroLote).toBe('FECHA')
  })

  it('salta un vigente que no cubre la cantidad por el siguiente que sí', () => {
    const result = selectLoteConsumo(
      [entry('CHICO', '2027-01-01', 1), entry('GRANDE', '2027-06-01', 10)],
      4,
      HOY,
    )
    expect(result?.lote.numeroLote).toBe('GRANDE')
  })

  it('si ningún vigente cubre, propone el primer vigente (no un vencido que sí cubre)', () => {
    const result = selectLoteConsumo(
      [entry('VEN', '2026-01-01', 50), entry('VIG', '2027-01-01', 2)],
      10,
      HOY,
    )
    expect(result?.lote.numeroLote).toBe('VIG')
  })

  it('solo con stock vencido propone el vencido más próximo', () => {
    const result = selectLoteConsumo(
      [entry('VEN2', '2026-10-01', 1), entry('VEN1', '2026-09-01', 1), entry('VIG0', '2027-01-01', 0)],
      1,
      HOY,
    )
    expect(result?.lote.numeroLote).toBe('VEN1')
  })

  it('sin stock devuelve null', () => {
    expect(selectLoteConsumo([entry('A', '2027-01-01', 0)], 1, HOY)).toBeNull()
  })
})
