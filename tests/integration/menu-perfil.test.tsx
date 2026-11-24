import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { restaurarMatchMedia, simularAncho } from '../helpers/matchMedia'

vi.mock('../../src/lib/db', () => ({
  db: {
    configuracionAlertas: {
      get: async () => undefined,
      put: async () => undefined,
    },
    borradores: { get: async () => undefined, put: async () => undefined },
  },
}))

const signOut = vi.fn(async () => undefined)
vi.mock('../../src/features/auth/useLogout', () => ({
  useLogout: () => ({ signOut, isPending: false }),
}))

import { AppShell } from '../../src/app/AppShell'
import { useVista } from '../../src/app/useVista'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1 } from '../helpers/lugarFalso'
import { TENANT_1 } from '../helpers/tenancy'

/** El switch de vistas de `App.tsx` con el `useVista` real (hash de Ajustes). */
function Harness() {
  const [vista, setVista] = useVista()
  return (
    <AppShell vista={vista} onCambiarVista={setVista}>
      {vista === 'inicio' && <p>Vista inicio</p>}
      {vista === 'inventario' && <InventarioView />}
      {vista === 'mas' && <AjustesView onNavegar={setVista} />}
    </AppShell>
  )
}

const avatar = () => screen.getByRole('button', { name: 'Menú de Dra. Ana Pérez' })
const menu = () => screen.getByRole('menu', { name: 'Menú de Dra. Ana Pérez' })

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  signOut.mockClear()
  useInventoryStore.setState({
    insumos: [],
    lotes: [],
    movimientos: [],
    itemsCompra: [],
    isReady: true,
  })
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'user-1',
      email: 'ana@x.cl',
      nombre: 'Dra. Ana Pérez',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  useLugarStore.setState({ lugares: [lugar1], lugarActivoId: lugar1.id, isReady: true })
})

afterEach(() => restaurarMatchMedia())

describe.each([
  ['desktop', 1440],
  ['móvil', 390],
])('menú del avatar en %s (spec 032 US2)', (_nombre, ancho) => {
  beforeEach(() => simularAncho(ancho))

  it('el avatar muestra las iniciales sin el título y abre el menú con nombre y correo', () => {
    render(<Harness />)

    expect(avatar()).toHaveTextContent('AP')
    expect(avatar()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(avatar())

    expect(avatar()).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu()).getByText('Dra. Ana Pérez')).toBeInTheDocument()
    expect(within(menu()).getByText('ana@x.cl')).toBeInTheDocument()
    expect(within(menu()).getAllByRole('menuitem').map((b) => b.textContent)).toEqual([
      'Ver perfil',
      'Cerrar sesión',
    ])
    expect(within(menu()).getByRole('menuitem', { name: 'Ver perfil' })).toHaveFocus()
  })

  it('Escape cierra y devuelve el foco al avatar; ↓/↑ recorren las opciones', () => {
    render(<Harness />)
    fireEvent.click(avatar())

    fireEvent.keyDown(menu(), { key: 'ArrowDown' })
    expect(within(menu()).getByRole('menuitem', { name: 'Cerrar sesión' })).toHaveFocus()
    fireEvent.keyDown(menu(), { key: 'ArrowDown' })
    expect(within(menu()).getByRole('menuitem', { name: 'Ver perfil' })).toHaveFocus()
    fireEvent.keyDown(menu(), { key: 'ArrowUp' })
    expect(within(menu()).getByRole('menuitem', { name: 'Cerrar sesión' })).toHaveFocus()

    fireEvent.keyDown(menu(), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(avatar()).toHaveFocus()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('tocar fuera cierra sin hacer nada', () => {
    render(<Harness />)
    fireEvent.click(avatar())

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('"Ver perfil" abre Ajustes → Perfil desde otra vista', async () => {
    render(<Harness />)
    expect(screen.getByText('Vista inicio')).toBeInTheDocument()
    fireEvent.click(avatar())
    fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Ver perfil' }))

    expect(await screen.findByRole('button', { name: /Editar nombre/ })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#ajustes/perfil')
  })

  it('"Cerrar sesión" hace lo mismo que en Ajustes → Perfil', () => {
    render(<Harness />)
    fireEvent.click(avatar())
    fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Cerrar sesión' }))

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('"Ver perfil" con Ajustes ya abierto (spec 032 research R6)', () => {
  beforeEach(() => simularAncho(1440))

  it('abre Perfil aunque Ajustes ya esté montado en el índice', async () => {
    render(<Harness />)
    const nav = screen.getByRole('navigation', { name: 'Secciones' })
    fireEvent.click(within(nav).getByRole('button', { name: /Ajustes/ }))
    expect(screen.queryByRole('button', { name: /Editar nombre/ })).not.toBeInTheDocument()

    fireEvent.click(avatar())
    fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Ver perfil' }))

    expect(await screen.findByRole('button', { name: /Editar nombre/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#ajustes/perfil')
  })
})
