import { describe, expect, it } from 'vitest'
import {
  CLAVES_UNIDAD,
  esUnidad,
  etiquetaUnidad,
  formatearCantidad,
  normalizarUnidad,
  unidadAdmiteDecimales,
} from '../../src/lib/unidades'

describe('catálogo de unidades (spec 015 R1)', () => {
  it('tiene las 15 unidades del DS §25 en su orden', () => {
    expect(CLAVES_UNIDAD).toEqual([
      'caja',
      'frasco',
      'botella',
      'jeringa',
      'cartucho',
      'paquete',
      'kit',
      'unidad',
      'rollo',
      'mL',
      'L',
      'g',
      'mg',
      'm',
      'cm',
    ])
  })

  it('solo las métricas admiten decimales (FR-002)', () => {
    const conDecimales = CLAVES_UNIDAD.filter(unidadAdmiteDecimales)
    expect(conDecimales).toEqual(['mL', 'L', 'g', 'mg', 'm', 'cm'])
  })

  it('normaliza pieza a unidad', () => {
    expect(normalizarUnidad('pieza')).toBe('unidad')
    expect(normalizarUnidad('caja')).toBe('caja')
    expect(esUnidad('pieza')).toBe(false)
    expect(unidadAdmiteDecimales('pieza')).toBe(false)
  })

  it('usa singular y plural', () => {
    expect(etiquetaUnidad('caja')).toBe('Caja')
    expect(etiquetaUnidad('caja', 1)).toBe('caja')
    expect(etiquetaUnidad('caja', 2)).toBe('cajas')
    expect(etiquetaUnidad('unidad', 0)).toBe('unidades')
    expect(etiquetaUnidad('mL', 2)).toBe('mL')
  })

  it('formatea con separadores es-CL', () => {
    expect(formatearCantidad(1250, 'mL')).toBe('1.250 mL')
    expect(formatearCantidad(2, 'caja')).toBe('2 cajas')
    expect(formatearCantidad(1, 'cartucho')).toBe('1 cartucho')
    expect(formatearCantidad(2.5, 'L')).toBe('2,5 L')
  })
})
