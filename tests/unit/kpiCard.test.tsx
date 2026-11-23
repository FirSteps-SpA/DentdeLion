import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { KpiCard } from '../../src/components/ui/Card'
import { Clock, Wallet } from '../../src/components/icons'

/** Spec 027 T007 (FR-007, FR-008). */
describe('KpiCard (rediseño)', () => {
  it('navegable: pastilla "Ver detalle", ícono de fondo y tinte del tono', () => {
    const onClick = vi.fn()
    const { container } = render(
      <KpiCard titulo="Próximos a vencer" valor={2} Icono={Clock} tono="warning" ariaLabel="Próximos a vencer: 2. Ver Alertas" onClick={onClick} />,
    )
    const boton = screen.getByRole('button', { name: 'Próximos a vencer: 2. Ver Alertas' })
    expect(boton).toHaveTextContent('Ver detalle')
    expect(container.querySelector('[data-ver-detalle]')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('[data-decorado="icono-fondo"]')).toBeInTheDocument()
    expect(container.querySelector('.bg-tinte-aviso')).toBeInTheDocument()
    fireEvent.click(boton)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('informativa (sin onClick): sin pastilla', () => {
    render(<KpiCard titulo="Producción" valor="$40.000" Icono={Wallet} ariaLabel="Producción: $40.000" />)
    expect(screen.getByRole('group', { name: 'Producción: $40.000' })).not.toHaveTextContent('Ver detalle')
  })

  it('destacada: degradado y mini gráfico en vez del ícono de fondo', () => {
    const { container } = render(
      <KpiCard titulo="Valor de inventario" valor="$272.000" Icono={Wallet} variante="destacada" ariaLabel="Valor" onClick={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Valor' }).className).toMatch(/bg-gradient-to-br/)
    expect(container.querySelector('[data-decorado="mini-barras"]')).toBeInTheDocument()
    expect(container.querySelector('[data-decorado="icono-fondo"]')).toBeNull()
  })
})
