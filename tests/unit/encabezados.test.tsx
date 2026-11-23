import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EncabezadoVista } from '../../src/components/ui/EncabezadoVista'
import { EncabezadoSeccion } from '../../src/components/ui/EncabezadoSeccion'
import { EstadoVacio } from '../../src/components/ui/EstadoVacio'
import { Bell, Boxes } from '../../src/components/icons'

/** Spec 027 T005 (FR-011..FR-013; UI §2). */
describe('EncabezadoVista', () => {
  it('h1 con subtítulo y acción; el ícono es decorativo', () => {
    const { container } = render(
      <EncabezadoVista
        titulo="Inventario"
        subtitulo="Clínica"
        Icono={Boxes}
        accion={<button type="button">+ Material</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Inventario' })).toBeInTheDocument()
    expect(screen.getByText('Clínica')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Material' })).toBeInTheDocument()
    expect(container.querySelector('[data-decorado="icono-fondo"]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('en Inicio usa el diente con destellos', () => {
    const { container } = render(<EncabezadoVista titulo="¡Hola, Paula!" ilustracion="diente" />)
    expect(container.querySelector('[data-decorado="diente"]')).toBeInTheDocument()
    expect(container.querySelector('[data-decorado="icono-fondo"]')).toBeNull()
  })
})

describe('EncabezadoSeccion', () => {
  it('título del nivel pedido, ícono con tinte del tono y acción', () => {
    const { container } = render(
      <EncabezadoSeccion
        Icono={Bell}
        titulo="Alertas"
        id="x"
        tono="peligro"
        accion={<button type="button">Ver todas</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Alertas' })).toHaveAttribute('id', 'x')
    expect(container.querySelector('[aria-hidden="true"]')?.className).toMatch(/bg-tinte-peligro/)
    expect(screen.getByRole('button', { name: 'Ver todas' })).toBeInTheDocument()
  })

  it('nivel 3', () => {
    render(<EncabezadoSeccion Icono={Bell} titulo="Stock bajo" nivel={3} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Stock bajo' })).toBeInTheDocument()
  })
})

describe('EstadoVacio', () => {
  it('muestra el texto y la acción; el ícono es decorativo', () => {
    const { container } = render(
      <EstadoVacio Icono={Boxes} texto="Todavía no hay marcas." accion={<button type="button">Agregar</button>} />,
    )
    expect(screen.getByText('Todavía no hay marcas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
    expect(container.querySelector('[data-decorado="vacio"]')).toHaveAttribute('aria-hidden', 'true')
  })
})
