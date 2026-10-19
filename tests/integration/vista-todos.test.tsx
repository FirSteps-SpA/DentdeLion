import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { InicioView } from '../../src/features/inicio/components/InicioView'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { usarDosLugares } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 014 T044 (US3, FR-013/FR-014): "Todos" suma los lugares, cada fila
 * dice de qué lugar es, y para modificar stock primero se elige el lugar,
 * sin salir de "Todos".
 */
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const insumo: Insumo = {
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
  // Lugar 1: 2 cartuchos (bajo el mínimo 5). Lugar 2: 3 (también bajo).
  insumosT.seed([insumo])
  lotesT.seed([lote('l1', LUGAR_1), lote('l2', LUGAR_2)])
  movimientosT.seed([ingreso('l1', LUGAR_1, 2), ingreso('l2', LUGAR_2, 3)])
  reflejarStore()
  onMemoryDbChange(reflejarStore)
  usarDosLugares('todos')
})

afterEach(() => {
  onMemoryDbChange(null)
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [] })
})

describe('vista "Todos" (spec 014 US3)', () => {
  it('Inicio suma los KPIs de cada lugar', () => {
    render(<InicioView onNavegar={() => {}} />)

    // Un insumo bajo mínimo en cada lugar: 2.
    expect(screen.getByRole('button', { name: /Productos bajo mínimo: 2/ })).toBeInTheDocument()
  })

  it('Alertas muestra el lugar de cada alerta', () => {
    render(<AlertasView />)

    const filas = screen.getAllByText(/disponibles \(mínimo/)
    expect(filas).toHaveLength(2)
    expect(screen.getByText('Clínica')).toBeInTheDocument()
    expect(screen.getByText('Box Las Condes')).toBeInTheDocument()
  })

  it('Inventario muestra el stock por lugar', () => {
    render(<InventarioView />)

    expect(screen.getByText('5 cartucho')).toBeInTheDocument()
    expect(screen.getByText('Clínica 2 · Box Las Condes 3')).toBeInTheDocument()
  })

  it('"Consumir 1" pide el lugar y registra en el elegido, sin salir de "Todos"', async () => {
    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: /Consumir 1 cartucho de Anestesia/ }))
    const sheet = screen.getByRole('dialog', { name: '¿En qué lugar?' })
    fireEvent.click(within(sheet).getByRole('button', { name: /Box Las Condes/ }))

    await waitFor(() =>
      expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(1),
    )
    const consumo = movimientosT.all().find((m) => m.tipo === 'consumo')!
    expect(consumo).toMatchObject({ lugarId: LUGAR_2, loteId: 'l2' })
    expect(useLugarStore.getState().lugarActivoId).toBe('todos')
  })
})
