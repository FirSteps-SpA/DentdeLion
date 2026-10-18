import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { restaurarMatchMedia, simularAncho } from '../helpers/matchMedia'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      categorias: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const lotesT = db.lotes as unknown as MemoryTable<Lote>

function insumo(
  id: string,
  nombre: string,
  extra: Partial<Insumo> = {},
): Insumo {
  return {
    id,
    nombre,
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
    ...extra,
  }
}
const insumos = [
  insumo('i1', 'Guantes nitrilo M'),
  insumo('i2', 'Eyectores', { categoria: 'Insumos', stockMinimo: null }),
]
const lotes: Lote[] = [
  {
    id: 'l1',
    insumoId: 'i1',
    numeroLote: 'G1',
    proveedor: 'P',
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: 'x',
  },
]
const movimientos: Movimiento[] = [
  {
    id: 'm1',
    tipo: 'ingreso',
    loteId: 'l1',
    cantidad: 2,
    usuarioId: 'u1',
    movimientoOrigenId: null,
    creadoEn: 'x',
    sincronizado: true,
  },
]

async function espejar() {
  useInventoryStore.setState({ movimientos: await db.movimientos.toArray() })
}

beforeEach(async () => {
  simularAncho(1440)
  movimientosT.seed(movimientos)
  lotesT.seed(lotes)
  useInventoryStore.setState({
    insumos,
    lotes,
    movimientos,
    categorias: [],
    itemsCompra: [],
    isReady: true,
  })
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'a@x.cl',
      nombre: 'Ana',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  onMemoryDbChange(() => void espejar())
})

afterEach(() => {
  restaurarMatchMedia()
  onMemoryDbChange(null)
})

const fila = (nombre: string) =>
  screen.getByRole('row', { name: new RegExp(nombre) })

describe('inventario en tabla (spec 013 US5)', () => {
  it('muestra una tabla con las columnas del DS y una fila por insumo', () => {
    render(<InventarioView />)

    const tabla = screen.getByRole('table')
    const encabezados = within(tabla)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
    expect(encabezados).toEqual([
      'Producto',
      'Categoría',
      'Stock',
      'Stock mínimo',
      'Vencimiento',
      'Estado',
      'Acciones',
    ])
    expect(within(tabla).getAllByRole('row')).toHaveLength(3)
    expect(within(fila('Guantes')).getByText('Bajo Stock')).toBeInTheDocument()
    expect(
      within(fila('Eyectores')).getByText('Stock crítico'),
    ).toBeInTheDocument()
  })

  it('la búsqueda filtra las filas', () => {
    render(<InventarioView />)

    fireEvent.change(screen.getByLabelText('Buscar insumo'), {
      target: { value: 'Eyec' },
    })

    expect(
      screen.queryByRole('row', { name: /Guantes/ }),
    ).not.toBeInTheDocument()
    expect(fila('Eyectores')).toBeInTheDocument()
  })

  it('"Consumir 1" registra el consumo y queda deshabilitado sin stock', async () => {
    render(<InventarioView />)

    fireEvent.click(
      within(fila('Guantes')).getByRole('button', {
        name: 'Consumir 1 caja de Guantes nitrilo M',
      }),
    )

    await waitFor(() =>
      expect(movimientosT.all().some((m) => m.tipo === 'consumo')).toBe(true),
    )
    expect(
      within(fila('Eyectores')).getByRole('button', {
        name: /Sin stock: Eyectores/,
      }),
    ).toBeDisabled()
  })

  it('"Más opciones" abre el menú y el nombre abre el detalle', () => {
    render(<InventarioView />)

    fireEvent.click(
      within(fila('Guantes')).getByRole('button', {
        name: 'Más opciones de Guantes nitrilo M',
      }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    fireEvent.click(
      within(fila('Guantes')).getByRole('button', {
        name: /^Guantes nitrilo M/,
      }),
    )
    expect(screen.getByLabelText('Cerrar detalle')).toBeInTheDocument()
  })

  it('con menos de 1200 px se ven tarjetas y no la tabla', () => {
    simularAncho(900)
    render(<InventarioView />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Consumir 1 caja de Guantes nitrilo M',
      }),
    ).toBeInTheDocument()
  })
})
