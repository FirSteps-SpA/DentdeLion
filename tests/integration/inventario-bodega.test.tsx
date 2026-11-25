import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Insumo, Lote, Lugar, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((nombre) => [nombre, new MemoryTable()])),
    ),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { InicioView } from '../../src/features/inicio/components/InicioView'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 033 T019 (US2, FR-012/FR-014/FR-016): "Clínica" y "Box Las Condes"
 * comparten bodega; "Las Condes" es independiente. Los dos lugares de la
 * bodega ven el mismo stock y los mismos lotes, consumen del común, las
 * alertas salen una vez y "Todos" no duplica.
 */
const LUGAR_3 = '00000000-0000-4000-8000-000000000013'
const box1: Lugar = { ...lugar1, bodegaId: 'bodega-b' }
const box2: Lugar = { ...lugar2, bodegaId: 'bodega-b' }
const independiente: Lugar = {
  ...lugar2,
  id: LUGAR_3,
  nombre: 'Las Condes',
  creadoEn: '2026-03-01T00:00:00.000Z',
}

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const insumo: Insumo = {
  unidadCompra: 'cartucho',
  contenido: 1,
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Anestesia',
  categoria: 'Farmacia',
  unidadMedida: 'cartucho',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 5,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  marcaId: null,
  creadoPor: null,
}

const lote = (id: string, lugarId: string): Lote => ({
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
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
  unidad: 'unidad',
  id: crypto.randomUUID(),
  tenantId: TENANT_1,
  lugarId,
  trasladoId: null,
  tipo: 'ingreso',
  loteId,
  cantidad,
  usuarioId: 'seed',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
})

function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all(),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    itemsCompra: [],
    minimosLugar: [],
    isReady: true,
  })
}

function usar(activo: string | 'todos', lugares: Lugar[] = [box1, box2, independiente]) {
  useLugarStore.setState({ lugares, lugarActivoId: activo, isReady: true })
}

beforeEach(async () => {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      tenantId: TENANT_1,
      desactivadoEn: null,
      email: 'u@x.cl',
      nombre: 'Ana',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  // Bodega (Clínica + Box Las Condes): 2 cartuchos, todos ingresados en
  // Clínica. Las Condes: 3. Las dos bajo el mínimo 5.
  await db.lugares.bulkPut([box1, box2, independiente])
  insumosT.seed([insumo])
  lotesT.seed([lote('l1', LUGAR_1), lote('l3', LUGAR_3)])
  movimientosT.seed([ingreso('l1', LUGAR_1, 2), ingreso('l3', LUGAR_3, 3)])
  reflejarStore()
  onMemoryDbChange(reflejarStore)
})

afterEach(() => {
  onMemoryDbChange(null)
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [] })
})

describe('bodega compartida en Inventario, Alertas e Inicio (spec 033 US2)', () => {
  it('los dos lugares de la bodega ven el mismo stock y el mismo lote', () => {
    for (const lugarId of [LUGAR_1, LUGAR_2]) {
      usar(lugarId)
      const { unmount } = render(<InventarioView />)
      expect(screen.getByText('2 cartuchos')).toBeInTheDocument()
      unmount()
    }
  })

  it('consume en Box Las Condes un lote ingresado en Clínica', async () => {
    usar(LUGAR_2)
    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: 'Consumir Anestesia' }))
    const panel = screen.getByRole('dialog', { name: 'Consumir Anestesia' })
    await within(panel).findByLabelText(/Lote/)
    fireEvent.click(within(panel).getByRole('button', { name: 'Confirmar consumo' }))

    await waitFor(() =>
      expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(1),
    )
    expect(movimientosT.all().find((m) => m.tipo === 'consumo')).toMatchObject({
      lugarId: LUGAR_2,
      loteId: 'l1',
    })
    act(() => usar(LUGAR_1))
    expect(await screen.findByText('1 cartucho')).toBeInTheDocument()
  })

  it('en un lugar de la bodega, la alerta de stock bajo sale una sola vez', () => {
    usar(LUGAR_2)
    render(<AlertasView />)

    expect(screen.getAllByText(/disponibles? \(mínimo/)).toHaveLength(1)
  })

  it('"Todos" muestra una parte por bodega, sin duplicar', () => {
    usar('todos')
    render(<InventarioView />)

    expect(screen.getByText('5 cartuchos')).toBeInTheDocument()
    expect(screen.getByText('Clínica + Box Las Condes: 2 · Las Condes: 3')).toBeInTheDocument()
  })

  it('"Todos" en Alertas e Inicio: una alerta por bodega, con su rótulo', () => {
    usar('todos')
    const { unmount } = render(<AlertasView />)
    expect(screen.getAllByText(/disponibles? \(mínimo/)).toHaveLength(2)
    expect(screen.getByText('Clínica + Box Las Condes')).toBeInTheDocument()
    expect(screen.getByText('Las Condes')).toBeInTheDocument()
    unmount()

    render(<InicioView onNavegar={() => {}} />)
    expect(screen.getByRole('button', { name: /Productos bajo mínimo: 2/ })).toBeInTheDocument()
  })

  it('el traslado no ofrece destinos de la misma bodega (FR-016)', () => {
    usar(LUGAR_2)
    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar' }))
    const form = screen.getByRole('dialog', { name: 'Trasladar Anestesia' })
    const destinos = within(within(form).getByLabelText('Destino')).getAllByRole('option')
    expect(destinos.map((opcion) => opcion.textContent)).toEqual(['Las Condes'])
  })

  it('si todos los lugares están en la bodega, no hay "Trasladar"', () => {
    usar(LUGAR_2, [box1, box2])
    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    expect(screen.queryByRole('button', { name: 'Trasladar' })).not.toBeInTheDocument()
  })
})
