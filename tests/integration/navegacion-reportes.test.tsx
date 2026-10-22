import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { restaurarMatchMedia, simularAncho } from '../helpers/matchMedia'

vi.mock('../../src/lib/db', () => ({
  db: {
    configuracionAlertas: { get: async () => undefined, put: async () => undefined },
  },
}))

import { AppShell } from '../../src/app/AppShell'
import type { Vista } from '../../src/app/navegacion'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { ReportesView } from '../../src/features/reportes/components/ReportesView'
import { useAuthStore } from '../../src/stores/authStore'
import { useLayoutStore } from '../../src/stores/layoutStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1 } from '../helpers/lugarFalso'
import { TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 017 T014 (FR-001, research.md R11): Reportes en la sidebar entre
 * Compras y Alertas; en móvil no está en la barra inferior y se abre desde "Más".
 */
function Harness({ inicial = 'inicio' as Vista }) {
  const [vista, setVista] = useState<Vista>(inicial)
  return (
    <AppShell vista={vista} onCambiarVista={setVista} alertasBadge={0}>
      {vista === 'reportes' && <ReportesView onNavegar={setVista} />}
      {vista === 'mas' && <AjustesView onNavegar={setVista} />}
    </AppShell>
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Secciones' })

beforeEach(() => {
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'u1',
      email: 'a@x.cl',
      nombre: 'Sofía',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  useLugarStore.setState({ lugares: [lugar1], lugarActivoId: lugar1.id, isReady: true })
  useLayoutStore.setState({ sidebarExpandida: false })
})

afterEach(() => restaurarMatchMedia())

describe('navegación a Reportes', () => {
  it('desktop: Reportes está en la sidebar entre Compras y Alertas y abre la sección', () => {
    simularAncho(1440)
    render(<Harness />)
    const etiquetas = within(nav())
      .getAllByRole('button')
      .map((boton) => boton.textContent ?? '')
    const indice = (texto: string) => etiquetas.findIndex((e) => e.includes(texto))
    expect(indice('Reportes')).toBeGreaterThan(indice('Compras'))
    expect(indice('Reportes')).toBeLessThan(indice('Alertas'))

    fireEvent.click(within(nav()).getByRole('button', { name: /Reportes/ }))
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument()
  })

  it('móvil: no está en la barra inferior y se abre desde "Más"', () => {
    render(<Harness />)
    expect(within(nav()).queryByRole('button', { name: /Reportes/ })).not.toBeInTheDocument()

    fireEvent.click(within(nav()).getByRole('button', { name: /Más/ }))
    fireEvent.click(screen.getByRole('button', { name: /Reportes/ }))
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument()
  })
})
