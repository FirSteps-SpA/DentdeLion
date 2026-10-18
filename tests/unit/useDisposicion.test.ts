import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDisposicion } from '../../src/app/useDisposicion'
import { restaurarMatchMedia, simularAncho } from '../helpers/matchMedia'

afterEach(() => restaurarMatchMedia())

describe('useDisposicion (spec 013 FR-011)', () => {
  it.each([
    [375, 'movil'],
    [767, 'movil'],
    [768, 'tablet'],
    [1199, 'tablet'],
    [1200, 'desktop'],
    [1920, 'desktop'],
  ])('%i px → %s', (px, esperado) => {
    simularAncho(px)
    const { result } = renderHook(() => useDisposicion())
    expect(result.current).toBe(esperado)
  })

  it('sin matchMedia (jsdom) es móvil', () => {
    restaurarMatchMedia()
    const { result } = renderHook(() => useDisposicion())
    expect(result.current).toBe('movil')
  })

  it('re-renderiza al cambiar de ancho', () => {
    simularAncho(375)
    const { result } = renderHook(() => useDisposicion())
    act(() => simularAncho(1440))
    expect(result.current).toBe('desktop')
    act(() => simularAncho(900))
    expect(result.current).toBe('tablet')
  })
})
