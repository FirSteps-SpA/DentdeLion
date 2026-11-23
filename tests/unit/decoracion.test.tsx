import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  DienteLinea,
  IconoFondo,
  MiniBarras,
  OndaSidebar,
  OndasFondo,
} from '../../src/components/decoracion'
import { Bell } from '../../src/components/icons'

/** Spec 027 T003 (FR-017, FR-020; research.md R3). */
describe('decorados del rediseño', () => {
  it.each([
    ['diente', <DienteLinea destellos />],
    ['ondas', <OndasFondo />],
    ['onda-sidebar', <OndaSidebar />],
    ['mini-barras', <MiniBarras />],
    ['icono-fondo', <IconoFondo Icono={Bell} />],
  ])('%s: oculto a lectores, sin texto, sin toques y sin imprimir', (nombre, elemento) => {
    const { container } = render(<div>{elemento}</div>)
    const raiz = container.querySelector(`[data-decorado="${nombre}"]`)!
    expect(raiz).toBeInTheDocument()
    expect(raiz).toHaveAttribute('aria-hidden', 'true')
    expect(raiz.textContent).toBe('')
    expect(raiz.getAttribute('class')).toMatch(/pointer-events-none/)
    expect(raiz.getAttribute('class')).toMatch(/print:hidden/)
  })

  it('dos dientes en la misma pantalla no comparten ids de degradado', () => {
    const { container } = render(
      <div>
        <DienteLinea />
        <DienteLinea />
      </div>,
    )
    const ids = [...container.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
