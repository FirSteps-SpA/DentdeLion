import { describe, expect, it } from 'vitest'
import {
  enRango,
  inicioVentana,
  mesesSeleccionables,
  rangoPeriodo,
} from '../../../src/features/reportes/lib/periodos'

/**
 * Spec 017 T006 (research.md R4, FR-005, FR-007, FR-018a): períodos en hora
 * local, su período de comparación y la ventana de 13 meses.
 */
const local = (anio: number, mes: number, dia = 1) => new Date(anio, mes, dia)
// 15 de octubre de 2026, 10:30 local.
const AHORA = new Date(2026, 9, 15, 10, 30)

describe('inicioVentana', () => {
  it('es el día 1 del mes actual menos 12 meses', () => {
    expect(inicioVentana(AHORA)).toEqual(local(2025, 9))
    expect(inicioVentana(new Date(2026, 0, 31))).toEqual(local(2025, 0))
  })
})

describe('rangoPeriodo', () => {
  it('"Este mes" va del día 1 al mes siguiente y se compara con el mes anterior completo', () => {
    const r = rangoPeriodo({ tipo: 'esteMes' }, AHORA)
    expect(r.desde).toEqual(local(2026, 9))
    expect(r.hasta).toEqual(local(2026, 10))
    expect(r.anterior).toEqual({ desde: local(2026, 8), hasta: local(2026, 9) })
    expect(r.etiqueta).toBe('Este mes')
    expect(r.etiquetaComparacion).toBe('vs. mes anterior completo')
  })

  it('"Mes anterior" es el mes completo y se compara con el que lo precede', () => {
    const r = rangoPeriodo({ tipo: 'mesAnterior' }, AHORA)
    expect(r.desde).toEqual(local(2026, 8))
    expect(r.hasta).toEqual(local(2026, 9))
    expect(r.anterior).toEqual({ desde: local(2026, 7), hasta: local(2026, 8) })
    expect(r.etiquetaComparacion).toBe('vs. mes anterior')
  })

  it('un mes elegido se compara con el mes que lo precede', () => {
    const r = rangoPeriodo({ tipo: 'mes', anio: 2026, mes: 2 }, AHORA)
    expect(r.desde).toEqual(local(2026, 2))
    expect(r.hasta).toEqual(local(2026, 3))
    expect(r.anterior).toEqual({ desde: local(2026, 1), hasta: local(2026, 2) })
    expect(r.etiqueta).toBe('Marzo 2026')
  })

  it('el mes más antiguo de la ventana no tiene período de comparación', () => {
    const r = rangoPeriodo({ tipo: 'mes', anio: 2025, mes: 9 }, AHORA)
    expect(r.anterior).toBeNull()
  })

  it('cruza el año: enero se compara con diciembre', () => {
    const r = rangoPeriodo({ tipo: 'mesAnterior' }, new Date(2026, 1, 10))
    expect(r.desde).toEqual(local(2026, 0))
    expect(r.anterior).toEqual({ desde: local(2025, 11), hasta: local(2026, 0) })
  })

  it('"Últimos 3 meses" son 3 meses calendario terminando en el actual, contra los 3 previos', () => {
    const r = rangoPeriodo({ tipo: 'ultimos3' }, AHORA)
    expect(r.desde).toEqual(local(2026, 7))
    expect(r.hasta).toEqual(local(2026, 10))
    expect(r.anterior).toEqual({ desde: local(2026, 4), hasta: local(2026, 7) })
    expect(r.etiquetaComparacion).toBe('vs. 3 meses anteriores')
  })

  it('"Este año" en octubre no tiene comparación (sale de la ventana de 13 meses)', () => {
    const r = rangoPeriodo({ tipo: 'esteAnio' }, AHORA)
    expect(r.desde).toEqual(local(2026, 0))
    expect(r.hasta).toEqual(local(2026, 10))
    expect(r.anterior).toBeNull()
  })

  it('"Este año" en enero sí se compara con enero del año anterior', () => {
    const r = rangoPeriodo({ tipo: 'esteAnio' }, new Date(2026, 0, 20))
    expect(r.anterior).toEqual({ desde: local(2025, 0), hasta: local(2025, 1) })
    expect(r.etiquetaComparacion).toBe('vs. mismo período del año anterior')
  })

  it('la serie de Gastos mensuales son los 6 meses que terminan en el último mes del período', () => {
    expect(rangoPeriodo({ tipo: 'esteMes' }, AHORA).meses).toEqual([
      { anio: 2026, mes: 4 },
      { anio: 2026, mes: 5 },
      { anio: 2026, mes: 6 },
      { anio: 2026, mes: 7 },
      { anio: 2026, mes: 8 },
      { anio: 2026, mes: 9 },
    ])
    expect(rangoPeriodo({ tipo: 'mesAnterior' }, AHORA).meses.at(-1)).toEqual({
      anio: 2026,
      mes: 8,
    })
  })

  it('"Este año" usa 12 meses y la serie se recorta a la ventana', () => {
    const anio = rangoPeriodo({ tipo: 'esteAnio' }, AHORA).meses
    expect(anio).toHaveLength(12)
    expect(anio[0]).toEqual({ anio: 2025, mes: 10 })
    const antiguo = rangoPeriodo({ tipo: 'mes', anio: 2025, mes: 11 }, AHORA).meses
    expect(antiguo[0]).toEqual({ anio: 2025, mes: 9 })
    expect(antiguo).toHaveLength(3)
  })
})

describe('mesesSeleccionables', () => {
  it('son los 12 meses completos de la ventana, del más reciente al más antiguo', () => {
    const meses = mesesSeleccionables(AHORA)
    expect(meses).toHaveLength(12)
    expect(meses[0]).toEqual({ anio: 2026, mes: 8, etiqueta: 'Septiembre 2026' })
    expect(meses.at(-1)).toEqual({ anio: 2025, mes: 9, etiqueta: 'Octubre 2025' })
  })
})

describe('enRango', () => {
  it('incluye el borde inferior y excluye el superior', () => {
    const desde = local(2026, 9)
    const hasta = local(2026, 10)
    expect(enRango(local(2026, 9).toISOString(), desde, hasta)).toBe(true)
    expect(enRango(new Date(2026, 9, 31, 23, 59).toISOString(), desde, hasta)).toBe(true)
    expect(enRango(local(2026, 10).toISOString(), desde, hasta)).toBe(false)
    expect(enRango(new Date(2026, 8, 30, 23, 59).toISOString(), desde, hasta)).toBe(false)
  })
})
