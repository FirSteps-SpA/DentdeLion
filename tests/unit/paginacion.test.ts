import { describe, expect, it } from 'vitest'
import {
  TAMANO_PAGINA,
  paginaDe,
  paginasVisibles,
  rangoPagina,
  textoQuedan,
  totalPaginas,
} from '../../src/lib/paginacion'

describe('paginación: funciones puras (spec 020 data-model.md)', () => {
  it('páginas de 25', () => {
    expect(TAMANO_PAGINA).toBe(25)
  })

  it('totalPaginas', () => {
    expect(totalPaginas(0)).toBe(1)
    expect(totalPaginas(25)).toBe(1)
    expect(totalPaginas(26)).toBe(2)
    expect(totalPaginas(50)).toBe(2)
    expect(totalPaginas(200)).toBe(8)
    expect(totalPaginas(1000)).toBe(40)
  })

  it('paginaDe acota a la última página con elementos (R3)', () => {
    expect(paginaDe(25, 200)).toBe(1)
    expect(paginaDe(75, 200)).toBe(3)
    expect(paginaDe(200, 60)).toBe(3)
    expect(paginaDe(75, 0)).toBe(1)
  })

  it('rangoPagina, 1-based', () => {
    expect(rangoPagina(1, 200)).toEqual({ desde: 1, hasta: 25 })
    expect(rangoPagina(2, 200)).toEqual({ desde: 26, hasta: 50 })
    expect(rangoPagina(3, 60)).toEqual({ desde: 51, hasta: 60 })
    expect(rangoPagina(1, 0)).toEqual({ desde: 0, hasta: 0 })
  })

  it('paginasVisibles: todas si caben', () => {
    expect(paginasVisibles(1, 1)).toEqual([1])
    expect(paginasVisibles(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(paginasVisibles(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('paginasVisibles: primera, actual ± 1, última y "…"', () => {
    expect(paginasVisibles(1, 8)).toEqual([1, 2, '…', 8])
    expect(paginasVisibles(5, 8)).toEqual([1, '…', 4, 5, 6, 7, 8]) // un hueco de una página se muestra, no "…"
    expect(paginasVisibles(8, 8)).toEqual([1, '…', 7, 8])
    expect(paginasVisibles(3, 8)).toEqual([1, 2, 3, 4, '…', 8])
    expect(paginasVisibles(20, 40)).toEqual([1, '…', 19, 20, 21, '…', 40])
  })

  it('paginasVisibles: nunca más de 7 posiciones ni "…" seguidos', () => {
    for (let total = 1; total <= 40; total++) {
      for (let actual = 1; actual <= total; actual++) {
        const pos = paginasVisibles(actual, total)
        expect(pos.length).toBeLessThanOrEqual(7)
        expect(pos).toContain(actual)
        expect(pos[0]).toBe(1)
        expect(pos[pos.length - 1]).toBe(total)
        for (let i = 1; i < pos.length; i++) {
          expect(pos[i] === '…' && pos[i - 1] === '…').toBe(false)
        }
      }
    }
  })

  it('textoQuedan con singular y plural', () => {
    expect(textoQuedan(1)).toBe('queda 1')
    expect(textoQuedan(3)).toBe('quedan 3')
  })
})
