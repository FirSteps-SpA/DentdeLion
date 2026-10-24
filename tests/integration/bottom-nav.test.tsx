import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { BottomNav, type Vista } from '../../src/app/BottomNav'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useAuthStore } from '../../src/stores/authStore'
import { contarAlertasPendientes } from '../../src/features/alertas/lib/resumen'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

vi.mock('../../src/lib/db', () => ({
  db: {
    insumos: { add: vi.fn() },
    lotes: { add: vi.fn() },
    movimientos: { add: vi.fn() },
    configuracionAlertas: { get: async () => undefined, put: async () => undefined },
    // Spec 022: la selección de Compras vive en borradores.
    borradores: { get: async () => undefined, put: async () => undefined },
  },
}))

vi.mock('../../src/stores/authStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/stores/authStore')>()
  return { ...actual, getUsuarioActualId: () => 'user-1' }
})

/**
 * Reproduce el switch de 4 secciones que `App.tsx` monta tras el arranque de
 * autenticación (spec 006 FR-001/FR-002) — se prueba aquí sin el envoltorio
 * de auth/hidratación de `App.tsx` (ya cubierto por `tests/unit/App.test.tsx`
 * y las pruebas de `authStore`), para aislar la navegación en sí.
 */
function NavHarness() {
  const [vista, setVista] = useState<Vista>('inventario')
  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const preferenciaStockBajo = useAlertasStore((s) => s.preferenciaStockBajo)
  const preferenciaCaducidad = useAlertasStore((s) => s.preferenciaCaducidad)
  const alertasBadge = contarAlertasPendientes(
    insumos,
    lotes,
    movimientos,
    nivelesAvisoDias,
    { stockBajo: preferenciaStockBajo, caducidad: preferenciaCaducidad },
  )
  return (
    <div>
      <BottomNav active={vista} onChange={setVista} alertasBadge={alertasBadge} />
      {vista === 'inventario' && <InventarioView />}
      {vista === 'compras' && <ComprasView />}
      {vista === 'alertas' && <AlertasView />}
      {vista === 'mas' && <AjustesView onNavegar={setVista} />}
    </div>
  )
}

afterEach(() => {
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [], isReady: true })
  useAlertasStore.setState({
    nivelesAvisoDias: [30, 7, 1],
    preferenciaStockBajo: true,
    preferenciaCaducidad: true,
  })
  useAuthStore.setState({ usuario: null, isReady: true })
})

describe('4-tab navigation (User Story 4)', () => {
  it('defaults to Inventario and highlights the active tab', () => {
    render(<NavHarness />)

    expect(screen.getByRole('button', { name: /Inventario/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('El inventario está en buen estado')).toBeInTheDocument()
  })

  it('navigates to each tab and marks it active (FR-001, FR-002)', () => {
    render(<NavHarness />)

    fireEvent.click(screen.getByRole('button', { name: /Alertas/ }))
    expect(screen.getByRole('button', { name: /Alertas/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Stock bajo')).toBeInTheDocument()

    // Spec 016 (R7): la barra móvil tiene Tratamientos; Compras está en "Más".
    expect(
      screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent),
    ).toEqual(['Inicio', 'Inventario', 'Tratamientos', 'Más'])

    fireEvent.click(screen.getByRole('button', { name: /Más/ }))
    expect(screen.getByRole('button', { name: /Más/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows the full Compras view instead of an error or blank screen (spec 009 FR-001/FR-002)', () => {
    render(<NavHarness />)

    // Spec 016 (R7): en móvil, Compras se abre desde "Más".
    fireEvent.click(screen.getByRole('button', { name: /Más/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Compras' }))

    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument()
    expect(screen.getByText('Sugeridos por el Sistema')).toBeInTheDocument()
    expect(screen.getByText('Agregados Manualmente')).toBeInTheDocument()
  })

  it('no longer shows the retired "Consumir insumo" bridge in Más — Ajustes replaces it (spec 010 FR-001)', () => {
    render(<NavHarness />)

    fireEvent.click(screen.getByRole('button', { name: /Más/ }))

    expect(screen.queryByText('Registrar insumo')).not.toBeInTheDocument()
    expect(screen.queryByText('Consumir insumo')).not.toBeInTheDocument()
  })
})

const insumoBajo = {
  tenantId: TENANT_1,
  id: 'bajo',
  nombre: 'Guantes',
  categoria: 'Cirugía',
  unidadMedida: 'caja',
  unidadCompra: 'caja',
  contenido: 1,
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 100,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}
const loteBajo = {
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'l-bajo',
  insumoId: 'bajo',
  numeroLote: 'L1',
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo' as const,
  creadoEn: '2026-01-01T00:00:00.000Z',
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'caja',
  precioCompra: null,
}
const ingresoBajo = {
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  id: 'm1',
  tipo: 'ingreso' as const,
  loteId: 'l-bajo',
  cantidad: 1,
  unidad: 'caja',
  tratamientoRealizadoId: null,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
}

describe('Alertas badge (User Story 7, FR-025/026/028)', () => {
  it('shows the pending-alert count on the Alertas icon by default', () => {
    useInventoryStore.setState({
      insumos: [insumoBajo],
      lotes: [loteBajo],
      movimientos: [ingresoBajo],
      isReady: true,
    })

    render(<NavHarness />)

    expect(screen.getByLabelText('1 alertas pendientes')).toBeInTheDocument()
  })

  it('hides the badge when stock bajo is disabled and it was the only alert', () => {
    useInventoryStore.setState({
      insumos: [insumoBajo],
      lotes: [loteBajo],
      movimientos: [ingresoBajo],
      isReady: true,
    })
    useAlertasStore.setState({ preferenciaStockBajo: false })

    render(<NavHarness />)

    expect(screen.queryByLabelText(/alertas pendientes/)).not.toBeInTheDocument()
  })

  it('hides the badge entirely when both preferences are off, without affecting Alertas itself', () => {
    useInventoryStore.setState({
      insumos: [insumoBajo],
      lotes: [loteBajo],
      movimientos: [ingresoBajo],
      isReady: true,
    })
    useAlertasStore.setState({
      preferenciaStockBajo: false,
      preferenciaCaducidad: false,
    })

    render(<NavHarness />)

    expect(screen.queryByLabelText(/alertas pendientes/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Alertas/ }))
    expect(screen.getByText(/Guantes/)).toBeInTheDocument()
  })
})
