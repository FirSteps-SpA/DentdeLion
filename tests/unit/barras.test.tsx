import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '../../src/app/Sidebar'
import { SyncIndicator } from '../../src/app/SyncIndicator'
import type { Indicador } from '../../src/lib/sync/indicador'

/** Spec 027 T009 (FR-001, FR-002, FR-004; research.md R4). */
describe('Sidebar (rediseño)', () => {
  it('el activo es una pastilla turquesa llena; los demás no', () => {
    render(<Sidebar vista="inicio" onCambiarVista={vi.fn()} contraida={false} alertasBadge={3} />)
    const activo = screen.getByRole('button', { name: /Inicio/, pressed: true })
    expect(activo.className).toMatch(/bg-primary\b/)
    expect(activo.className).toMatch(/text-white/)
    const otro = screen.getByRole('button', { name: /Inventario/, pressed: false })
    expect(otro.className).not.toMatch(/bg-primary\b/)
    expect(screen.getByLabelText('3 alertas pendientes')).toBeInTheDocument()
  })

  it('expandida muestra el diente sobre la onda; contraída no', () => {
    const { container, rerender } = render(
      <Sidebar vista="inicio" onCambiarVista={vi.fn()} contraida={false} />,
    )
    expect(container.querySelector('[data-decorado="onda-sidebar"]')).toBeInTheDocument()
    rerender(<Sidebar vista="inicio" onCambiarVista={vi.fn()} contraida onAlternar={vi.fn()} />)
    expect(container.querySelector('[data-decorado="onda-sidebar"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Inicio' }).className).toMatch(/bg-primary\b/)
  })
})

function indicador(extra: Partial<Indicador>): Indicador {
  return {
    estado: 'sincronizado',
    propios: 0,
    etiqueta: '0',
    motivoError: null,
    desglosePropio: { movimientos: 0, cambiosInsumo: 0, categorias: 0, preciosLote: 0, tratamientos: 0 },
    ajenos: [],
    antiguos: 0,
    masAntiguoEn: null,
    alerta: false,
    ...extra,
  }
}

describe('SyncIndicator (rediseño)', () => {
  it.each([
    ['sincronizado', 'bg-success-bg'],
    ['pendientes', 'bg-primary-soft'],
    ['sin-conexion', 'bg-bg-secondary'],
    ['error', 'bg-warning-30-bg'],
  ] as const)('%s es una pastilla con fondo propio', (estado, fondo) => {
    render(<SyncIndicator indicador={indicador({ estado })} onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Estado de sincronización/ }).className).toContain(fondo)
  })

  it('con pendientes antiguos, pastilla de aviso', () => {
    render(<SyncIndicator indicador={indicador({ estado: 'pendientes', alerta: true })} onClick={vi.fn()} />)
    expect(screen.getByRole('button', { name: /cambios antiguos/ }).className).toContain('bg-warning-30-bg')
  })
})

/**
 * Spec 028 (regresión de la 027): el `<main>` y el encabezado del teléfono no
 * pueden crear un contexto de apilamiento (z-index): las hojas (fixed, z-50)
 * que se abren desde dentro quedarían bajo la barra inferior (z-20).
 */
describe('AppShell sin contexto de apilamiento', () => {
  it('ni el main ni el encabezado móvil llevan z-index', async () => {
    const { AppShell } = await import('../../src/app/AppShell')
    const { container } = render(
      <AppShell vista="inicio" onCambiarVista={vi.fn()}>
        <p>contenido</p>
      </AppShell>,
    )
    const main = container.querySelector('main')!
    expect(main.className).not.toMatch(/(^|\s)z-/)
    for (const nodo of container.querySelectorAll('main ~ *, main, div')) {
      if (nodo.contains(main) || nodo === main) continue
    }
    const encabezado = screen.getByText('contenido').closest('main')!.previousElementSibling
    expect(encabezado?.className ?? '').not.toMatch(/(^|\s)z-/)
  })
})
