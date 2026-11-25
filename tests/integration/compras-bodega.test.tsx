import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Borrador, Insumo, ItemCompra, Lote, Lugar, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(
        [...tablasMemoria, 'borradores'].map((nombre) => [nombre, new MemoryTable()]),
      ),
    ),
  }
})

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { itemManual, sugeridoConPrecio } from '../helpers/compras'
import { elegirProveedor } from '../helpers/proveedor'

/**
 * Spec 033 T020 (US2, FR-013, research.md R8): en una bodega compartida la
 * lista de compras es común. Lo agregado en un lugar se ve y se recibe en el
 * otro, con "Agregado en …", y lo marcado sigue marcado al cambiar de lugar.
 */
const box1: Lugar = { ...lugar1, bodegaId: 'bodega-b' }
const box2: Lugar = { ...lugar2, bodegaId: 'bodega-b' }

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const itemsT = db.itemsCompra as unknown as MemoryTable<ItemCompra>
const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all(),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    itemsCompra: itemsT.all(),
    cambiosLote: [],
    cambiosInsumo: [],
    minimosLugar: [],
    proveedores: [],
    isReady: true,
  })
}

function usar(activo: string | 'todos', lugares: Lugar[] = [box1, box2]) {
  useLugarStore.setState({ lugares, lugarActivoId: activo, isReady: true })
}

beforeEach(async () => {
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'usuario-1',
      email: 'a@x.cl',
      nombre: 'Ana',
      rol: 'administrador',
      autenticadoEn: '2026-01-01T00:00:00.000Z',
    },
    isReady: true,
  })
  await db.lugares.bulkPut([box1, box2])
  // Articaína: 10 en Clínica, mínimo 12 → sugerida para la bodega.
  const articaina = sugeridoConPrecio('i1', 'Articaína', 2, 15000)
  insumosT.seed([articaina.insumo])
  lotesT.seed([articaina.lote])
  movimientosT.seed([articaina.ingreso])
  // Torundas: agregadas a mano en Clínica.
  itemsT.seed([itemManual({ lugarId: LUGAR_1 })])
  borradoresT.seed([])
  reflejarStore()
  onMemoryDbChange(reflejarStore)
  return () => onMemoryDbChange(null)
})

describe('Compras en una bodega compartida (spec 033 US2)', () => {
  it('en Box Las Condes se ven el sugerido y el manual agregado en Clínica', () => {
    usar(LUGAR_2)
    render(<ComprasView />)

    expect(screen.getByText('Articaína')).toBeInTheDocument()
    expect(screen.getByText('Torundas')).toBeInTheDocument()
    expect(screen.getByText('Agregado en Clínica')).toBeInTheDocument()
  })

  it('sin bodega compartida, Box Las Condes no ve lo de Clínica (FR-019)', () => {
    usar(LUGAR_2, [lugar1, lugar2])
    render(<ComprasView />)

    expect(screen.queryByText('Torundas')).not.toBeInTheDocument()
    expect(screen.queryByText(/Agregado en/)).not.toBeInTheDocument()
  })

  it('lo marcado en un lugar sigue marcado en el otro', async () => {
    usar(LUGAR_2)
    render(<ComprasView />)

    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    expect(screen.getByLabelText('Seleccionar Articaína')).toBeChecked()

    act(() => usar(LUGAR_1))
    await waitFor(() => expect(screen.getByLabelText('Seleccionar Articaína')).toBeChecked())
  })

  it('en "Todos", la bodega es una sola fila con su rótulo', () => {
    usar('todos')
    render(<ComprasView />)

    expect(screen.getAllByText('Articaína')).toHaveLength(1)
    expect(screen.getAllByText('Clínica + Box Las Condes')).toHaveLength(2)
    expect(screen.getByLabelText('Seleccionar Articaína en Clínica + Box Las Condes')).toBeInTheDocument()
  })

  it('el sugerido se recibe en Box Las Condes, el lugar activo', async () => {
    usar(LUGAR_2)
    render(<ComprasView />)

    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Articaína como comprado o recibido/ }),
    )
    await screen.findByRole('heading', { name: 'Recibir Articaína' })
    fireEvent.change(screen.getByLabelText(/^Cantidad/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Número de lote'), { target: { value: 'L-2' } })
    await elegirProveedor('Proveedor X')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await waitFor(() =>
      expect(movimientosT.all().filter((m) => m.tipo === 'ingreso')).toHaveLength(2),
    )
    const nuevo = movimientosT.all().find((m) => m.tipo === 'ingreso' && m.loteId !== 'l-i1')
    expect(nuevo?.lugarId).toBe(LUGAR_2)
    // El stock común (12) ya alcanza el mínimo: deja de ser sugerido en los dos.
    await waitFor(() => expect(screen.queryByText('Articaína')).not.toBeInTheDocument())
    act(() => usar(LUGAR_1))
    expect(screen.queryByText('Articaína')).not.toBeInTheDocument()
  })
})
