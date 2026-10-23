import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  formatearFechaCaducidad,
  textoTiempoCaducidad,
} from '../../../src/features/alertas/lib/textoCaducidad'

describe('textoTiempoCaducidad (spec 018 FR-007, contracts/ui-contracts.md §2)', () => {
  it.each([
    [0, 'vence hoy'],
    [1, 'vence en 1 día'],
    [12, 'vence en 12 días'],
    [59, 'vence en 59 días'],
    [60, 'vence en 2 meses'],
    [89, 'vence en 2 meses'],
    [90, 'vence en 3 meses'],
    [170, 'vence en 5 meses'],
    [-1, 'caducado hace 1 día'],
    [-5, 'caducado hace 5 días'],
    [-59, 'caducado hace 59 días'],
    [-60, 'caducado hace 2 meses'],
    [-95, 'caducado hace 3 meses'],
  ])('%i días → "%s"', (dias, texto) => {
    expect(textoTiempoCaducidad(dias)).toBe(texto)
  })
})

describe('formatearFechaCaducidad (spec 018 FR-006, research.md R4)', () => {
  const tzOriginal = process.env.TZ

  beforeAll(() => {
    // UTC−3: con `new Date('2026-11-03')` (medianoche UTC) saldría el 2 de noviembre.
    process.env.TZ = 'America/Santiago'
  })

  afterAll(() => {
    process.env.TZ = tzOriginal
  })

  it('muestra día, mes abreviado y año sin correrse un día', () => {
    expect(formatearFechaCaducidad('2026-11-03')).toBe('3 nov 2026')
    expect(formatearFechaCaducidad('2027-01-01')).toBe('1 ene 2027')
  })

  it('devuelve vacío para una fecha vacía o inválida', () => {
    expect(formatearFechaCaducidad('')).toBe('')
    expect(formatearFechaCaducidad('no-es-fecha')).toBe('')
  })
})
