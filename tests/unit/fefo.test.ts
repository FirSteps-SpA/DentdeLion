import { describe, expect, it } from 'vitest'
import {
  selectFefoLot,
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
