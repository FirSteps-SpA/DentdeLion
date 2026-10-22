import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
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
import { AvisosConsumo } from '../../src/app/AvisosConsumo'
import { useAvisosStore } from '../../src/stores/avisosStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1, lugar2, usarDosLugares, usarLugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 014 T064 (US6): trasladar desde el menú del insumo, con aviso y
 * "Deshacer", y el traslado en el detalle de ambos lugares. Sin "Trasladar"
 * con un solo lugar.
 */
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

beforeEach(() => {
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
  // Lugar 1: 10 cartuchos del lote l1.
  insumosT.seed([insumo])
  lotesT.seed([lote('l1', LUGAR_1)])
  movimientosT.seed([ingreso('l1', LUGAR_1, 10)])
  void db.lugares.bulkPut([lugar1, lugar2])
  reflejarStore()
  onMemoryDbChange(reflejarStore)
  usarDosLugares(LUGAR_1)
  useAvisosStore.setState({ avisos: [] })
})

afterEach(() => {
  onMemoryDbChange(null)
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [] })
})

const stockEn = (lugarId: string) =>
  movimientosT
    .all()
    .filter((m) => m.lugarId === lugarId)
    .reduce(
      (t, m) => (['ingreso', 'traslado_entrada'].includes(m.tipo) ? t + m.cantidad : t - m.cantidad),
      0,
    )

describe('traslados (spec 014 US6)', () => {
  it('trasladar 4 de 10 deja 6 y 4, con aviso, y se puede deshacer', async () => {
    render(
      <>
        <InventarioView />
        <AvisosConsumo />
      </>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar' }))
    const form = screen.getByRole('dialog', { name: 'Trasladar Anestesia' })
    fireEvent.change(within(form).getByLabelText(/Cantidad/), { target: { value: '4' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Trasladar' }))

    expect(await screen.findByText('Trasladado 4 cartucho a Box Las Condes')).toBeInTheDocument()
    expect(stockEn(LUGAR_1)).toBe(6)
    expect(stockEn(LUGAR_2)).toBe(4)

    fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }))
    await waitFor(() => expect(stockEn(LUGAR_2)).toBe(0))
    expect(stockEn(LUGAR_1)).toBe(10)
  })

  it('no deja trasladar más que el stock del lote en el origen (US6-2)', async () => {
    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar' }))
    const form = screen.getByRole('dialog', { name: 'Trasladar Anestesia' })
    fireEvent.change(within(form).getByLabelText(/Cantidad/), { target: { value: '25' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Trasladar' }))

    // La cantidad se limita al stock del lote en el origen: pasan las 10, no 25.
    await waitFor(() => expect(stockEn(LUGAR_2)).toBe(10))
    expect(stockEn(LUGAR_1)).toBe(0)
  })

  it('el detalle muestra el traslado en el destino', async () => {
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trasladar' }))
    const form = screen.getByRole('dialog', { name: 'Trasladar Anestesia' })
    fireEvent.change(within(form).getByLabelText(/Cantidad/), { target: { value: '4' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Trasladar' }))
    await waitFor(() => expect(stockEn(LUGAR_2)).toBe(4))

    act(() => useLugarStore.setState({ lugarActivoId: LUGAR_2 }))
    fireEvent.click(screen.getByText('Anestesia'))

    expect(await screen.findByText(/Traslado ← Clínica: 4 cartucho/)).toBeInTheDocument()
  })

  it('con un solo lugar no hay "Trasladar" (US6-5)', () => {
    usarLugar1()
    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    expect(screen.queryByRole('button', { name: 'Trasladar' })).not.toBeInTheDocument()
  })
})
