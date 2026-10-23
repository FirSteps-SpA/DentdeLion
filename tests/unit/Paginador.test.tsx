import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Paginador } from '../../src/components/ui/Paginador'

function montar(pagina: number, total = 200, onIrAPagina = vi.fn()) {
  const paginas = Math.ceil(total / 25)
  render(
    <Paginador
      pagina={pagina}
      paginas={paginas}
      total={total}
      etiqueta="Páginas del inventario"
      onIrAPagina={onIrAPagina}
    />,
  )
  return onIrAPagina
}

describe('Paginador (spec 020 contracts/ui-contracts.md)', () => {
  it('no se muestra con una sola página', () => {
    const { container } = render(
      <Paginador
        pagina={1}
        paginas={1}
        total={20}
        etiqueta="x"
        onIrAPagina={() => {}}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('es un nav con anterior, números, siguiente y el rango', () => {
    montar(1)
    const nav = screen.getByRole('navigation', {
      name: 'Páginas del inventario',
    })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText('1–25 de 200')).toBeInTheDocument()
  })

  it('"…" no es un botón', () => {
    montar(5)
    expect(screen.getAllByText('…')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '…' })).not.toBeInTheDocument()
    expect(screen.getByText('101–125 de 200')).toBeInTheDocument()
  })

  it('"Siguiente" deshabilitado en la última página', () => {
    montar(8)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByText('176–200 de 200')).toBeInTheDocument()
  })

  it('cada control lleva a su página', () => {
    const onIrAPagina = montar(3)
    fireEvent.click(screen.getByRole('button', { name: 'Página 8' }))
    expect(onIrAPagina).toHaveBeenLastCalledWith(8)
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(onIrAPagina).toHaveBeenLastCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(onIrAPagina).toHaveBeenLastCalledWith(4)
  })
})
