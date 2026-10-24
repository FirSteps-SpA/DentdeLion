import { describe, expect, it } from 'vitest'
import type { CambioLote, Lote } from '../../../src/lib/db'
import {
  costoLote,
  costoUnitarioInsumo,
  formatearCLP,
  precioDesdeTotal,
  precioPorUnidadCompra,
  precioVigenteLote,
  validarPrecio,
} from '../../../src/features/insumos/lib/precio'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

function lote(overrides: Partial<Lote>): Lote {
  return {
    id: 'l1',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId: 'art',
    numeroLote: 'A1',
    proveedor: 'Septodont',
    proveedorId: null,
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: 2,
    unidadIngresada: 'caja',
    contenido: 50,
    unidadConsumo: 'cartucho',
    precioCompra: 32500,
    ...overrides,
  }
}

function cambio(overrides: Partial<CambioLote>): CambioLote {
  return {
    id: 'c1',
    tenantId: TENANT_1,
    loteId: 'l1',
    campo: 'precioCompra',
    valorAnterior: null,
    valorNuevo: 30000,
    usuarioId: 'u1',
    creadoEn: '2026-01-05T00:00:00.000Z',
    sincronizado: true,
    ...overrides,
  }
}

describe('precio del ingreso (spec 015 FR-013/FR-014)', () => {
  it('total ÷ presentaciones, sin redondear', () => {
    expect(precioDesdeTotal(65000, 2)).toBe(32500)
    expect(precioDesdeTotal(10000, 3)).toBeCloseTo(3333.3333, 3)
  })

  it('con ingreso en unidad de consumo, las presentaciones salen del contenido', () => {
    // 30 cartuchos de una caja de 50 = 0,6 cajas; $21.000 → $35.000 por caja.
    expect(precioPorUnidadCompra({ modo: 'total', valor: 21000 }, 0.6)).toBeCloseTo(35000)
    expect(precioPorUnidadCompra({ modo: 'unidad', valor: 32500 }, 2)).toBe(32500)
    expect(precioPorUnidadCompra(null, 2)).toBeNull()
  })

  it('acepta vacío y 0, rechaza negativos', () => {
    expect(validarPrecio(null)).toBeNull()
    expect(validarPrecio({ modo: 'unidad', valor: 0 })).toBeNull()
    expect(validarPrecio({ modo: 'total', valor: -1 })).not.toBeNull()
  })
})

describe('precio vigente y costo de lote (R6)', () => {
  it('sin cambios vale el del ingreso; con cambios, el último por (creadoEn, id)', () => {
    expect(precioVigenteLote(lote({}), [])).toBe(32500)
    const a = cambio({ id: 'a', valorNuevo: 30000, creadoEn: '2026-01-05T00:00:00.000Z' })
    const b = cambio({ id: 'b', valorNuevo: 31000, creadoEn: '2026-01-06T00:00:00.000Z' })
    expect(precioVigenteLote(lote({}), [a, b])).toBe(31000)
    expect(precioVigenteLote(lote({}), [b, a])).toBe(31000)
    expect(precioVigenteLote(lote({}), [cambio({ valorNuevo: null })])).toBeNull()
  })

  it('$32.500 la caja de 50 = $650 por cartucho', () => {
    expect(costoLote(lote({}), [])).toBe(650)
  })

  it('tras convertir cartucho → mL ×1,8, el costo va por mL', () => {
    const factores = new Map([
      ['cartucho', 1.8],
      ['mL', 1],
    ])
    expect(costoLote(lote({}), [], factores)).toBeCloseTo(361.11, 2)
  })
})

describe('costoUnitarioInsumo (FR-012, Q2)', () => {
  it('usa el último ingreso con precio, en cualquier lugar del tenant', () => {
    const lotes = [
      lote({ id: 'l1', creadoEn: '2026-01-01T00:00:00.000Z', precioCompra: 32500 }),
      lote({
        id: 'l2',
        lugarId: LUGAR_2,
        creadoEn: '2026-02-01T00:00:00.000Z',
        cantidadIngresada: 30,
        unidadIngresada: 'cartucho',
        precioCompra: 35000,
      }),
    ]
    expect(costoUnitarioInsumo({ id: 'art' }, lotes, [])).toEqual({
      costo: 700,
      loteId: 'l2',
      fecha: '2026-02-01T00:00:00.000Z',
    })
  })

  it('un ingreso posterior sin precio no lo reemplaza; precio 0 sí cuenta', () => {
    const conPrecio = lote({ id: 'l1', creadoEn: '2026-01-01T00:00:00.000Z' })
    const sinPrecio = lote({ id: 'l2', creadoEn: '2026-02-01T00:00:00.000Z', precioCompra: null })
    expect(costoUnitarioInsumo({ id: 'art' }, [conPrecio, sinPrecio], [])?.costo).toBe(650)

    const gratis = lote({ id: 'l3', creadoEn: '2026-03-01T00:00:00.000Z', precioCompra: 0 })
    expect(costoUnitarioInsumo({ id: 'art' }, [conPrecio, sinPrecio, gratis], [])?.costo).toBe(0)
  })

  it('una corrección da precio a un lote que no tenía', () => {
    const sinPrecio = lote({ id: 'l2', creadoEn: '2026-02-01T00:00:00.000Z', precioCompra: null })
    expect(costoUnitarioInsumo({ id: 'art' }, [sinPrecio], [])).toBeNull()
    expect(
      costoUnitarioInsumo({ id: 'art' }, [sinPrecio], [cambio({ loteId: 'l2', valorNuevo: 30000 })])
        ?.costo,
    ).toBe(600)
  })
})

describe('formatearCLP (FR-017)', () => {
  it('pesos con separador de miles y sin decimales', () => {
    expect(formatearCLP(659.8)).toBe('$660')
    expect(formatearCLP(1284500)).toBe('$1.284.500')
  })
})
