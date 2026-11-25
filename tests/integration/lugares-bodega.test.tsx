import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  Insumo,
  Lote,
  Lugar,
  MinimoLugar,
  Movimiento,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})
vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { LugaresSection } from '../../src/features/ajustes/components/LugaresSection'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { SECCIONES_AJUSTES } from '../../src/features/ajustes/lib/secciones'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'

/**
 * Spec 033 T024 (US1, ui-contracts §1, FR-004/FR-005): juntar dos lugares
 * desde Ajustes → Lugares, con la confirmación y su resultado en Inventario.
 * Box 1 = "Clínica" (2 jeringas, lote A, mínimo 5); Box 2 = "Box Las Condes"
 * (1 jeringa, lote B, mínimo 3).
 */
const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Ana',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

const jeringas: Insumo = {
  unidadCompra: 'jeringa',
  contenido: 1,
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Jeringas',
  categoria: 'Farmacia',
  unidadMedida: 'jeringa',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  marcaId: null,
  creadoPor: null,
}

const lote = (id: string, lugarId: string): Lote => ({
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'jeringa',
  precioCompra: null,
  id,
  tenantId: TENANT_1,
  lugarId,
  insumoId: 'i1',
  numeroLote: id,
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-01-01T00:00:00.000Z',
})

const ingreso = (loteId: string, lugarId: string, cantidad: number): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'jeringa',
  id: `ing-${loteId}`,
  tenantId: TENANT_1,
  lugarId,
  trasladoId: null,
  tipo: 'ingreso',
  loteId,
  cantidad,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
})

const minimo = (lugarId: string, stockMinimo: number): MinimoLugar => ({
  insumoId: 'i1',
  lugarId,
  tenantId: TENANT_1,
  stockMinimo,
  sincronizado: true,
})

const movimientosIniciales = [ingreso('A', LUGAR_1, 2), ingreso('B', LUGAR_2, 1)]

function reflejar() {
  useLugarStore.setState({ lugares: lugaresT.all() })
  useInventoryStore.setState({
    insumos: insumosT.all(),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    itemsCompra: [],
    minimosLugar: minimosT.all(),
    isReady: true,
  })
}

beforeEach(() => {
  useAuthStore.setState({ usuario: admin, isReady: true })
  useLugarStore.setState({ lugarActivoId: LUGAR_1, isReady: true })
  lugaresT.seed([lugar1, lugar2])
  insumosT.seed([jeringas])
  lotesT.seed([lote('A', LUGAR_1), lote('B', LUGAR_2)])
  movimientosT.seed(movimientosIniciales)
  minimosT.seed([minimo(LUGAR_1, 5), minimo(LUGAR_2, 3)])
  reflejar()
  onMemoryDbChange(reflejar)
})

afterEach(() => onMemoryDbChange(null))

async function abrirConfirmacion() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Compartir bodega de Box Las Condes con…' }),
  )
  const hoja = await screen.findByRole('dialog', {
    name: 'Compartir bodega de Box Las Condes con…',
  })
  fireEvent.click(within(hoja).getByRole('button', { name: /Clínica/ }))
  return screen.findByRole('dialog', { name: '¿Compartir bodega?' })
}

describe('compartir bodega en Ajustes → Lugares (spec 033 US1)', () => {
  it('la confirmación resume el efecto y propone el mínimo mayor', async () => {
    render(<LugaresSection />)

    const confirmacion = await abrirConfirmacion()
    expect(confirmacion).toHaveTextContent(
      'El stock de Box Las Condes y Clínica se sumará: 1 insumo con stock en ambos pasará a un solo total.',
    )
    const selector = within(confirmacion).getByLabelText('Jeringas')
    expect((selector as HTMLSelectElement).selectedOptions[0].textContent).toBe('Clínica: 5')
  })

  it('al confirmar, los dos lugares quedan en una bodega con el stock sumado', async () => {
    render(<LugaresSection />)

    const confirmacion = await abrirConfirmacion()
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Compartir bodega' }))

    expect(await screen.findByText('Comparte bodega con Clínica')).toBeInTheDocument()
    expect(screen.getByText('Comparte bodega con Box Las Condes')).toBeInTheDocument()
    expect(minimosT.all().map((m) => m.stockMinimo)).toEqual([5, 5])
    expect(movimientosT.all()).toEqual(movimientosIniciales)
  })

  it('el mínimo elegido a mano es el que queda', async () => {
    render(<LugaresSection />)

    const confirmacion = await abrirConfirmacion()
    fireEvent.change(within(confirmacion).getByLabelText('Jeringas'), { target: { value: '0' } })
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Compartir bodega' }))

    await waitFor(() => expect(minimosT.all().map((m) => m.stockMinimo)).toEqual([3, 3]))
  })

  it('después, el Inventario de los dos lugares muestra 3 jeringas (SC-001)', async () => {
    const { unmount } = render(<LugaresSection />)
    const confirmacion = await abrirConfirmacion()
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Compartir bodega' }))
    await screen.findByText('Comparte bodega con Clínica')
    unmount()

    for (const lugarId of [LUGAR_1, LUGAR_2]) {
      act(() => useLugarStore.setState({ lugarActivoId: lugarId }))
      const vista = render(<InventarioView />)
      expect(screen.getByText('3 jeringas')).toBeInTheDocument()
      vista.unmount()
    }
  })

  it('con un solo lugar activo no hay opción de compartir', () => {
    lugaresT.seed([lugar1])
    reflejar()
    render(<LugaresSection />)

    expect(screen.queryByRole('button', { name: /Compartir bodega/ })).not.toBeInTheDocument()
  })

  it('el personal no llega a Lugares (FR-005)', () => {
    expect(SECCIONES_AJUSTES.find((s) => s.id === 'lugares')?.soloAdministracion).toBe(true)
  })
})
