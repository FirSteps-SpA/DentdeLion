import { describe, expect, it } from 'vitest'
import {
  formatearPresentacion,
  normalizarPresentacion,
  validarPresentacion,
} from '../../../src/features/insumos/lib/presentacion'

describe('validarPresentacion (spec 015 FR-003/FR-004)', () => {
  it('acepta Caja × 50 cartuchos', () => {
    expect(
      validarPresentacion({ unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 50 }),
    ).toEqual({})
  })

  it('rechaza contenido cero, negativo o vacío', () => {
    for (const contenido of [0, -2, null]) {
      expect(
        validarPresentacion({ unidadMedida: 'cartucho', unidadCompra: 'caja', contenido }),
      ).toHaveProperty('contenido')
    }
  })

  it('rechaza contenido decimal en una unidad de consumo sin decimales', () => {
    expect(
      validarPresentacion({ unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 2.5 }),
    ).toHaveProperty('contenido')
    expect(
      validarPresentacion({ unidadMedida: 'mL', unidadCompra: 'jeringa', contenido: 2.5 }),
    ).toEqual({})
  })

  it('con la misma unidad exige contenido 1 y la normalización lo fuerza', () => {
    expect(
      validarPresentacion({ unidadMedida: 'kit', unidadCompra: 'kit', contenido: 3 }),
    ).toHaveProperty('contenido')
    expect(
      normalizarPresentacion({ unidadMedida: 'kit', unidadCompra: 'kit', contenido: null }),
    ).toEqual({ unidadMedida: 'kit', unidadCompra: 'kit', contenido: 1 })
  })

  it('rechaza unidades fuera del catálogo', () => {
    expect(
      validarPresentacion({ unidadMedida: 'pieza', unidadCompra: 'caja', contenido: 1 }),
    ).toHaveProperty('unidadMedida')
    expect(
      validarPresentacion({ unidadMedida: 'unidad', unidadCompra: 'bolsa', contenido: 1 }),
    ).toHaveProperty('unidadCompra')
  })
})

describe('formatearPresentacion (FR-005)', () => {
  it('muestra la presentación legible', () => {
    expect(
      formatearPresentacion({ unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 50 }),
    ).toBe('Caja × 50 cartuchos')
    expect(
      formatearPresentacion({ unidadMedida: 'mL', unidadCompra: 'frasco', contenido: 500 }),
    ).toBe('Frasco × 500 mL')
    expect(
      formatearPresentacion({ unidadMedida: 'unidad', unidadCompra: 'caja', contenido: 1 }),
    ).toBe('Caja × 1 unidad')
  })

  it('con la misma unidad muestra solo la unidad', () => {
    expect(
      formatearPresentacion({ unidadMedida: 'kit', unidadCompra: 'kit', contenido: 1 }),
    ).toBe('Kit')
  })
})
