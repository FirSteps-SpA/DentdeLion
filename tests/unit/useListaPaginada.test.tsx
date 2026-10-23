import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useListaPaginada, type ModoPaginacion } from '../../src/lib/paginacion'

const lista = (n: number) => Array.from({ length: n }, (_, i) => i)

interface Props {
  items: number[]
  clave: string
  modo: ModoPaginacion
}

function montar(inicial: Props) {
  return renderHook(
    (p: Props) => useListaPaginada(p.items, { clave: p.clave, modo: p.modo }),
    {
      initialProps: inicial,
    },
  )
}

describe('useListaPaginada (spec 020 R1–R3)', () => {
  it('"Ver más" agrega de a 25', () => {
    const { result } = montar({ items: lista(60), clave: '', modo: 'ver-mas' })
    expect(result.current.visibles).toHaveLength(25)
    expect(result.current.quedan).toBe(35)
    expect(result.current.hayControles).toBe(true)
    expect(result.current.indicePrimerNuevo).toBeNull()

    act(() => result.current.verMas())
    expect(result.current.visibles).toHaveLength(50)
    expect(result.current.indicePrimerNuevo).toBe(25)

    act(() => result.current.verMas())
    expect(result.current.visibles).toHaveLength(60)
    expect(result.current.quedan).toBe(0)
  })

  it('sin controles con 25 o menos (FR-002)', () => {
    const { result } = montar({ items: lista(25), clave: '', modo: 'ver-mas' })
    expect(result.current.hayControles).toBe(false)
    expect(result.current.visibles).toHaveLength(25)
  })

  it('páginas numeradas', () => {
    const { result } = montar({ items: lista(60), clave: '', modo: 'paginas' })
    expect(result.current.pagina).toBe(1)
    expect(result.current.paginas).toBe(3)
    act(() => result.current.irAPagina(3))
    expect(result.current.pagina).toBe(3)
    expect(result.current.visibles).toEqual(lista(60).slice(50))
  })

  it('cambiar la clave vuelve al comienzo (R2)', () => {
    const { result, rerender } = montar({
      items: lista(60),
      clave: 'a',
      modo: 'ver-mas',
    })
    act(() => result.current.verMas())
    rerender({ items: lista(60), clave: 'b', modo: 'ver-mas' })
    expect(result.current.visibles).toHaveLength(25)
    expect(result.current.indicePrimerNuevo).toBeNull()

    rerender({ items: lista(60), clave: 'b', modo: 'paginas' })
    act(() => result.current.irAPagina(2))
    rerender({ items: lista(60), clave: 'c', modo: 'paginas' })
    expect(result.current.pagina).toBe(1)
  })

  it('una lista que se achica no deja una página vacía (R3)', () => {
    const { result, rerender } = montar({
      items: lista(60),
      clave: '',
      modo: 'paginas',
    })
    act(() => result.current.irAPagina(3))
    rerender({ items: lista(30), clave: '', modo: 'paginas' })
    expect(result.current.pagina).toBe(2)
    expect(result.current.visibles).toEqual(lista(30).slice(25))
    rerender({ items: lista(60), clave: '', modo: 'paginas' })
    expect(result.current.pagina).toBe(3)
  })

  it('cambiar de modo conserva la posición (R1)', () => {
    const { result, rerender } = montar({
      items: lista(200),
      clave: '',
      modo: 'ver-mas',
    })
    act(() => result.current.verMas())
    act(() => result.current.verMas())
    rerender({ items: lista(200), clave: '', modo: 'paginas' })
    expect(result.current.pagina).toBe(3)

    act(() => result.current.irAPagina(5))
    rerender({ items: lista(200), clave: '', modo: 'ver-mas' })
    expect(result.current.visibles).toHaveLength(125)
  })
})
