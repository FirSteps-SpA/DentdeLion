import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  abrirSeccion,
  cerrarSeccion,
  leerSeccionDeUrl,
  limpiarSeccionDeUrl,
  useSeccionAjustes,
} from '../../../src/features/ajustes/lib/seccionUrl'

/** Spec 019 T003 (FR-005, FR-006, research.md R1, UI §4). */
describe('seccionUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('lee la sección del hash y descarta lo desconocido', () => {
    expect(leerSeccionDeUrl('#ajustes/categorias')).toBe('categorias')
    expect(leerSeccionDeUrl('#ajustes/nada')).toBeNull()
    expect(leerSeccionDeUrl('#otra')).toBeNull()
    expect(leerSeccionDeUrl('')).toBeNull()
  })

  it('sin argumento lee location.hash', () => {
    window.history.replaceState(null, '', '/#ajustes/baja')
    expect(leerSeccionDeUrl()).toBe('baja')
  })

  it('abrir suma una entrada con el hash y el estado propio', () => {
    const antes = window.history.length
    abrirSeccion('lugares')
    expect(window.location.hash).toBe('#ajustes/lugares')
    expect(window.history.state).toEqual({ ajustes: 'lugares' })
    expect(window.history.length).toBe(antes + 1)
  })

  it('cerrar tras abrir vuelve atrás en el historial', () => {
    abrirSeccion('lugares')
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    cerrarSeccion()
    expect(back).toHaveBeenCalledOnce()
  })

  it('cerrar sin entrada propia (llegada recargando) reemplaza la URL sin el hash', () => {
    window.history.replaceState(null, '', '/app?x=1#ajustes/avisos')
    const back = vi.spyOn(window.history, 'back')
    cerrarSeccion()
    expect(back).not.toHaveBeenCalled()
    expect(window.location.pathname).toBe('/app')
    expect(window.location.search).toBe('?x=1')
    expect(window.location.hash).toBe('')
  })

  it('cerrar con reemplazar nunca vuelve atrás', () => {
    abrirSeccion('categorias')
    const back = vi.spyOn(window.history, 'back')
    cerrarSeccion({ reemplazar: true })
    expect(back).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('')
  })

  it('limpiar solo toca una URL con sección de Ajustes', () => {
    window.history.replaceState(null, '', '/?invitacion=abc#otra')
    const replace = vi.spyOn(window.history, 'replaceState')
    limpiarSeccionDeUrl()
    expect(replace).not.toHaveBeenCalled()
    replace.mockRestore()

    window.history.replaceState(null, '', '/?invitacion=abc#ajustes/perfil')
    limpiarSeccionDeUrl()
    expect(window.location.search).toBe('?invitacion=abc')
    expect(window.location.hash).toBe('')
  })

  it('useSeccionAjustes parte del hash y sigue popstate y hashchange', () => {
    window.history.replaceState(null, '', '/#ajustes/avisos')
    const { result } = renderHook(() => useSeccionAjustes())
    expect(result.current[0]).toBe('avisos')

    act(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current[0]).toBeNull()

    act(() => {
      window.history.replaceState(null, '', '/#ajustes/baja')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current[0]).toBe('baja')
  })

  it('useSeccionAjustes abre y cierra', () => {
    const { result } = renderHook(() => useSeccionAjustes())
    act(() => result.current[1]('categorias'))
    expect(result.current[0]).toBe('categorias')
    expect(window.location.hash).toBe('#ajustes/categorias')
    vi.spyOn(window.history, 'back').mockImplementation(() => {
      window.history.replaceState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    act(() => result.current[2]())
    expect(result.current[0]).toBeNull()
  })
})
