import { describe, expect, it } from 'vitest'
import {
  convertirIngreso,
  snapshotIngreso,
  textoEquivalenciaIngreso,
} from '../../../src/features/insumos/lib/ingreso'

const articaina = { unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 50 }

describe('convertirIngreso (spec 015 FR-009)', () => {
  it('2 cajas × 50 = 100 cartuchos', () => {
    expect(convertirIngreso(articaina, { cantidad: 2, unidad: 'caja' })).toEqual({
      cantidadConsumo: 100,
      presentaciones: 2,
    })
  })

  it('en unidad de consumo suma tal cual (US2-2)', () => {
    expect(convertirIngreso(articaina, { cantidad: 30, unidad: 'cartucho' })).toEqual({
      cantidadConsumo: 30,
      presentaciones: 0.6,
    })
  })

  it('rechaza una conversión no entera en una unidad sin decimales (US2-4)', () => {
    const resultado = convertirIngreso(
      { unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 25 },
      { cantidad: 0.5, unidad: 'caja' },
    )
    expect(resultado.cantidadConsumo).toBe(12.5)
    expect(resultado.error).toMatch(/0,5 cajas son 12,5 cartuchos/)
  })

  it('admite decimales cuando la unidad de consumo los admite', () => {
    expect(
      convertirIngreso(
        { unidadMedida: 'mL', unidadCompra: 'frasco', contenido: 2.5 },
        { cantidad: 3, unidad: 'frasco' },
      ),
    ).toEqual({ cantidadConsumo: 7.5, presentaciones: 3 })
  })

  it('rechaza cero o negativos', () => {
    expect(convertirIngreso(articaina, { cantidad: 0, unidad: 'caja' }).error).toBeDefined()
  })

  it('sin presentación distinta, la unidad de compra es la de consumo', () => {
    expect(
      convertirIngreso(
        { unidadMedida: 'kit', unidadCompra: 'kit', contenido: 1 },
        { cantidad: 4, unidad: 'kit' },
      ),
    ).toEqual({ cantidadConsumo: 4, presentaciones: 4 })
  })
})

describe('textoEquivalenciaIngreso y snapshotIngreso', () => {
  it('muestra la equivalencia antes de guardar (US2-1)', () => {
    expect(textoEquivalenciaIngreso(articaina, { cantidad: 2, unidad: 'caja' })).toBe(
      '2 cajas = 100 cartuchos',
    )
    expect(textoEquivalenciaIngreso(articaina, { cantidad: 2, unidad: 'cartucho' })).toBeNull()
  })

  it('guarda lo ingresado y la presentación vigente (FR-010)', () => {
    expect(snapshotIngreso(articaina, { cantidad: 2, unidad: 'caja' })).toEqual({
      cantidadIngresada: 2,
      unidadIngresada: 'caja',
      contenido: 50,
      unidadConsumo: 'cartucho',
    })
  })
})
