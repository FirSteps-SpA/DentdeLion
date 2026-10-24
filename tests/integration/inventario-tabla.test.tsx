import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
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
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
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
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const lotesT = db.lotes as unknown as MemoryTable<Lote>

function insumo(
  id: string,
  nombre: string,
  extra: Partial<Insumo> = {},
): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
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
    marcaId: null,
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
  },
]
const movimientos: Movimiento[] = [
  {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
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
      tenantId: TENANT_1,
      desactivadoEn: null,
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

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

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
      'Presentación',
      'Stock',
      'Stock mínimo',
      'Costo unitario',
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
    expect(
      screen.getByRole('dialog', { name: 'Detalle del insumo' }),
    ).toBeInTheDocument()
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

describe('rendimiento de las conversiones y costos (spec 015 T070)', () => {
  it('300 insumos, 3.000 movimientos y conversiones: menos de 100 ms', async () => {
    const { normalizarMovimientos } = await import('../../src/features/insumos/lib/stock')
    const { costosUnitariosPorInsumo } = await import('../../src/features/insumos/lib/precio')
    const muchos = Array.from({ length: 300 }, (_, i) =>
      insumo(`i${i}`, `Insumo ${i}`, { unidadMedida: 'unidad', unidadCompra: 'caja', contenido: 10 }),
    )
    const susLotes: Lote[] = muchos.flatMap((uno, i) => [
      { ...lotes[0], id: `l${i}a`, insumoId: uno.id, precioCompra: 1000 + i, unidadConsumo: 'caja', creadoEn: '2026-01-01' },
      { ...lotes[0], id: `l${i}b`, insumoId: uno.id, precioCompra: null, unidadConsumo: 'unidad', creadoEn: '2026-01-02' },
    ])
    const susMovimientos: Movimiento[] = susLotes.flatMap((lote, i) =>
      Array.from({ length: 5 }, (_, j) => ({
        ...movimientos[0],
        id: `m${i}-${j}`,
        loteId: lote.id,
        cantidad: 1 + j,
        unidad: lote.unidadConsumo,
      })),
    )
    const cambios = muchos.map((uno, i) => ({
      id: `c${i}`,
      tenantId: TENANT_1,
      insumoId: uno.id,
      campo: 'unidadMedida' as const,
      valorAnterior: 'caja',
      valorNuevo: 'unidad',
      factor: 10,
      usuarioId: 'admin',
      creadoEn: '2026-01-02T00:00:00.000Z',
      sincronizado: true,
      rechazadoEn: null,
    }))

    const inicio = performance.now()
    const normalizados = normalizarMovimientos(susMovimientos, susLotes, muchos, cambios)
    const costos = costosUnitariosPorInsumo(muchos, susLotes, [], cambios)
    const duracion = performance.now() - inicio

    expect(normalizados).toHaveLength(3000)
    expect(normalizados.find((m) => m.id === 'm0-0')?.cantidad).toBe(10)
    expect(costos.size).toBe(300)
    expect(costos.get('i0')?.costo).toBe(100) // $1.000 por caja ÷ 10 unidades
    expect(duracion).toBeLessThan(100)
  })
})

describe('tabla por páginas (spec 020 US3)', () => {
  const muchos = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      insumo(`p${n - i}`, `Insumo ${String(n - i).padStart(3, '0')}`, {
        stockMinimo: null,
      }),
    )
  const filasVisibles = () =>
    screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => /Insumo \d{3}/.exec(row.textContent ?? '')?.[0])

  it('muestra 25 filas y el paginador con el rango (FR-007)', () => {
    useInventoryStore.setState({ insumos: muchos(60) })
    render(<InventarioView />)
    expect(filasVisibles()).toHaveLength(25)
    expect(filasVisibles()[0]).toBe('Insumo 001')
    const nav = screen.getByRole('navigation', {
      name: 'Páginas del inventario',
    })
    expect(within(nav).getByText('1–25 de 60')).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /^Ver más/ }),
    ).not.toBeInTheDocument()
  })

  it('cambiar de página muestra sus filas y enfoca el título con el rango (R6)', () => {
    useInventoryStore.setState({ insumos: muchos(60) })
    render(<InventarioView />)
    const nav = screen.getByRole('navigation', {
      name: 'Páginas del inventario',
    })
    fireEvent.click(within(nav).getByRole('button', { name: 'Siguiente' }))
    expect(filasVisibles()[0]).toBe('Insumo 026')
    expect(within(nav).getByText('26–50 de 60')).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: 'Página 3' }))
    expect(filasVisibles()).toHaveLength(10)
    expect(
      within(nav).getByRole('button', { name: 'Siguiente' }),
    ).toBeDisabled()
    const titulo = screen.getByText('Insumos 51–60 de 60')
    expect(titulo.tagName).toBe('CAPTION')
    expect(document.activeElement).toBe(titulo)
  })

  it('la página se conserva al abrir y cerrar el detalle (FR-010)', () => {
    useInventoryStore.setState({ insumos: muchos(60) })
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    fireEvent.click(
      within(fila('Insumo 055')).getByRole('button', { name: /^Insumo 055/ }),
    )
    const hoja = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }))
    expect(filasVisibles()[0]).toBe('Insumo 051')
  })

  it('si la página queda vacía, muestra la última con insumos (FR-011)', () => {
    useInventoryStore.setState({ insumos: muchos(60) })
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    act(() => useInventoryStore.setState({ insumos: muchos(45) }))
    expect(filasVisibles()[0]).toBe('Insumo 026')
    expect(screen.getByText('26–45 de 45')).toBeInTheDocument()
  })

  it('con 25 insumos no hay paginador (FR-002)', () => {
    useInventoryStore.setState({ insumos: muchos(25) })
    render(<InventarioView />)
    expect(
      screen.queryByRole('navigation', { name: 'Páginas del inventario' }),
    ).not.toBeInTheDocument()
  })

  it('al pasar a tarjetas conserva la posición (FR-012)', () => {
    useInventoryStore.setState({ insumos: muchos(100) })
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }))
    act(() => simularAncho(800))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Insumo \d{3}$/)).toHaveLength(75)
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 25)' }),
    ).toBeInTheDocument()
  })
})

/** Spec 023 T039 (FR-012). */
describe('inventario en tabla — marca (spec 023)', () => {
  it('la fila muestra "Nombre · Marca" y se encuentra buscando la marca', () => {
    const conMarca = insumos.map((i) => (i.nombre.startsWith('Guantes') ? { ...i, marcaId: 'tres' } : i))
    useInventoryStore.setState({
      insumos: conMarca,
      marcas: [
        {
          id: 'tres',
          tenantId: TENANT_1,
          nombre: '3M',
          creadoPor: null,
          creadoEn: '2026-10-24T10:00:00.000Z',
          desactivadoEn: null,
          eliminadoEn: null,
          sincronizado: true,
        },
      ],
    })
    render(<InventarioView />)

    expect(within(fila('Guantes')).getByText(/· 3M/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar insumo'), { target: { value: '3m' } })
    expect(fila('Guantes')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Eyectores/ })).not.toBeInTheDocument()
    useInventoryStore.setState({ marcas: [] })
  })
})

