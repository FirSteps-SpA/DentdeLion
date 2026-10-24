import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { restaurarMatchMedia, simularAncho } from '../helpers/matchMedia'

vi.mock('../../src/lib/db', () => ({
  db: {
    insumos: { add: vi.fn() },
    lotes: { add: vi.fn() },
    movimientos: { add: vi.fn() },
    configuracionAlertas: {
      get: async () => undefined,
      put: async () => undefined,
    },
    // Spec 022: la selección de Compras vive en borradores.
    borradores: { get: async () => undefined, put: async () => undefined },
  },
}))

vi.mock('../../src/stores/authStore', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/stores/authStore')>()
  return { ...actual, getUsuarioActualId: () => 'user-1' }
})

import { AppShell } from '../../src/app/AppShell'
import { useVista } from '../../src/app/useVista'
import type { Vista } from '../../src/app/navegacion'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1 } from '../helpers/lugarFalso'
import { useLayoutStore } from '../../src/stores/layoutStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const insumoBajo: Insumo = {
  unidadCompra: 'caja',
  contenido: 1,
  tenantId: TENANT_1,
  id: 'i1',
  nombre: 'Guantes nitrilo M',
  categoria: 'Protección',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: 'x',
  stockMinimo: 5,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}
const lote: Lote = {
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'l1',
  insumoId: 'i1',
  numeroLote: 'G1',
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: 'x',
}
const ingreso: Movimiento = {
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  id: 'm1',
  tipo: 'ingreso',
  loteId: 'l1',
  cantidad: 2,
  usuarioId: 'user-1',
  movimientoOrigenId: null,
  creadoEn: 'x',
  sincronizado: true,
}

/** El switch de vistas de `App.tsx`, dentro del armazón nuevo (spec 013 R8). */
function Harness({ inicial = 'inventario' as Vista }) {
  const [vista, setVista] = useState<Vista>(inicial)
  return (
    <AppShell vista={vista} onCambiarVista={setVista} alertasBadge={1}>
      {vista === 'inventario' && <InventarioView />}
      {vista === 'compras' && <ComprasView />}
      {vista === 'alertas' && <AlertasView />}
      {vista === 'mas' && <AjustesView />}
    </AppShell>
  )
}

const nav = () => screen.getByRole('navigation', { name: 'Secciones' })

beforeEach(() => {
  useInventoryStore.setState({
    insumos: [insumoBajo],
    lotes: [lote],
    movimientos: [ingreso],
    itemsCompra: [],
    isReady: true,
  })
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'user-1',
      email: 'a@x.cl',
      nombre: 'Sofía León',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  // Spec 014: la barra muestra el lugar activo (con uno solo, su nombre).
  useLugarStore.setState({
    lugares: [{ ...lugar1, nombre: 'Clínica Providencia' }],
    lugarActivoId: lugar1.id,
    isReady: true,
  })
  useLayoutStore.setState({ sidebarExpandida: false })
  try {
    localStorage.removeItem('dentdelion.sidebar')
  } catch {
    // sin almacenamiento
  }
})

afterEach(() => restaurarMatchMedia())

describe('desktop ≥ 1200 px: sidebar (US2)', () => {
  beforeEach(() => simularAncho(1440))

  it('muestra la sidebar con las secciones y no la barra inferior', () => {
    const { container } = render(<Harness />)

    expect(
      screen.getAllByRole('navigation', { name: 'Secciones' }),
    ).toHaveLength(1)
    expect(container.querySelector('aside')).not.toBeNull()
    for (const etiqueta of ['Inventario', 'Compras', 'Alertas', 'Ajustes']) {
      expect(
        within(nav()).getByRole('button', { name: new RegExp(etiqueta) }),
      ).toBeInTheDocument()
    }
    expect(
      within(nav()).queryByRole('button', { name: /^Más$/ }),
    ).not.toBeInTheDocument()
  })

  it('marca el ítem activo y cambia de sección', () => {
    render(<Harness />)

    expect(
      within(nav()).getByRole('button', { name: /Inventario/ }),
    ).toHaveAttribute('aria-current', 'page')
    fireEvent.click(within(nav()).getByRole('button', { name: /Compras/ }))

    expect(
      within(nav()).getByRole('button', { name: /Compras/ }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument()
  })

  it('muestra la burbuja de alertas en la sidebar', () => {
    render(<Harness />)

    expect(
      within(nav()).getByLabelText('1 alertas pendientes'),
    ).toBeInTheDocument()
  })

  it('la barra superior muestra el lugar de trabajo y el indicador de sincronización', () => {
    render(<Harness />)

    const barra = screen.getByRole('banner')
    expect(within(barra).getByText('Clínica Providencia')).toBeInTheDocument()
    expect(
      within(barra).getByRole('button', { name: /Estado de sincronización/ }),
    ).toBeInTheDocument()
  })

  it('(d) en desktop no hay botón para contraer la sidebar', () => {
    render(<Harness />)

    expect(
      screen.queryByRole('button', { name: /menú/ }),
    ).not.toBeInTheDocument()
  })
})

describe('móvil < 768 px (US4)', () => {
  it('(a) barra inferior y sin sidebar', () => {
    simularAncho(375)
    const { container } = render(<Harness />)

    expect(container.querySelector('aside')).toBeNull()
    expect(
      within(nav()).getByRole('button', { name: /Más/ }),
    ).toBeInTheDocument()
  })

  it('sin matchMedia (jsdom) se comporta como móvil', () => {
    restaurarMatchMedia()
    const { container } = render(<Harness />)

    expect(container.querySelector('aside')).toBeNull()
  })
})

describe('tablet 768–1199 px (US4)', () => {
  beforeEach(() => simularAncho(900))

  it('(b) arranca contraída, se expande y recuerda la preferencia', () => {
    const { unmount } = render(<Harness />)

    // Contraída: solo íconos, con nombre accesible.
    expect(
      within(nav()).getByRole('button', { name: 'Compras' }),
    ).toHaveAttribute('title', 'Compras')
    expect(within(nav()).queryByText('Compras')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expandir menú' }))

    expect(within(nav()).getByText('Compras')).toBeInTheDocument()
    expect(localStorage.getItem('dentdelion.sidebar')).toBe('1')
    unmount()

    render(<Harness />)
    expect(
      screen.getByRole('button', { name: 'Contraer menú' }),
    ).toBeInTheDocument()
  })
})

describe('cambio de ancho en vivo (FR-015)', () => {
  it('(c) de 375 a 1440 px conserva la sección y lo escrito en la búsqueda', () => {
    simularAncho(375)
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Buscar insumo'), {
      target: { value: 'Guan' },
    })

    act(() => simularAncho(1440))

    expect(document.querySelector('aside')).not.toBeNull()
    expect(screen.getByLabelText('Buscar insumo')).toHaveValue('Guan')
    expect(
      within(nav()).getByRole('button', { name: /Inventario/ }),
    ).toHaveAttribute('aria-current', 'page')
  })
})

/** Spec 019 T009 (FR-006, research.md R1): la vista de `App` con la URL. */
function HarnessConUrl() {
  const [vista, setVista] = useVista()
  return (
    <AppShell vista={vista} onCambiarVista={setVista} alertasBadge={0}>
      {vista === 'inicio' && <p>Inicio</p>}
      {vista === 'inventario' && <InventarioView />}
      {vista === 'mas' && <AjustesView />}
    </AppShell>
  )
}

describe('sección de Ajustes en la URL (spec 019)', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('con #ajustes/<sección> al cargar, arranca en Ajustes con esa sección abierta', () => {
    simularAncho(375)
    window.history.replaceState(null, '', '/#ajustes/categorias')
    render(<HarnessConUrl />)

    expect(screen.getByRole('heading', { level: 1, name: 'Categorías' })).toBeInTheDocument()
  })

  it('cambiar de vista quita la sección de la URL y Ajustes vuelve a abrir en el índice', () => {
    simularAncho(375)
    window.history.replaceState(null, '', '/#ajustes/categorias')
    render(<HarnessConUrl />)

    fireEvent.click(within(nav()).getByRole('button', { name: /Inventario/ }))
    expect(window.location.hash).toBe('')
    fireEvent.click(within(nav()).getByRole('button', { name: /Más/ }))
    expect(screen.getByRole('list', { name: 'Secciones de Ajustes' })).toBeInTheDocument()
  })

  it('sin hash arranca en Inicio', () => {
    simularAncho(375)
    render(<HarnessConUrl />)
    expect(screen.getByText('Inicio', { selector: 'p' })).toBeInTheDocument()
  })
})
