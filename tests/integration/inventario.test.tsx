import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const HOY = new Date()

function fechaEnDias(dias: number): string {
  const fecha = new Date(HOY)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function makeInsumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'pieza',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
    categoria: 'Cirugía',
    unidadMedida: 'pieza',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: new Date().toISOString(),
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function makeLote(overrides: Partial<Lote>): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'insumo-1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    fechaCaducidad: fechaEnDias(90),
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeIngreso(loteId: string, cantidad: number): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'usuario-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
  }
}

const insumoCaducado = makeInsumo({ id: 'caducado', nombre: 'Insumo Caducado' })
const loteCaducado = makeLote({
  id: 'lote-caducado',
  insumoId: 'caducado',
  fechaCaducidad: fechaEnDias(-2),
})

const insumoProximo = makeInsumo({ id: 'proximo', nombre: 'Insumo Próximo' })
const loteProximo = makeLote({
  id: 'lote-proximo',
  insumoId: 'proximo',
  fechaCaducidad: fechaEnDias(5),
})

const insumoBajoStock = makeInsumo({
  id: 'bajo-stock',
  nombre: 'Insumo Bajo Stock',
  stockMinimo: 20,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
})
const loteBajoStock = makeLote({ id: 'lote-bajo-stock', insumoId: 'bajo-stock' })

const insumoOk = makeInsumo({ id: 'ok', nombre: 'Insumo Ok' })
const loteOk = makeLote({ id: 'lote-ok', insumoId: 'ok' })

function seed() {
  useInventoryStore.setState({
    insumos: [insumoCaducado, insumoProximo, insumoBajoStock, insumoOk],
    lotes: [loteCaducado, loteProximo, loteBajoStock, loteOk],
    movimientos: [
      makeIngreso('lote-caducado', 10),
      makeIngreso('lote-proximo', 10),
      makeIngreso('lote-bajo-stock', 5),
      makeIngreso('lote-ok', 10),
    ],
    isReady: true,
  })
}

afterEach(() => {
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [], isReady: true })
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
})

describe('InventarioView (User Story 1 — resumen y tap-to-filter)', () => {
  it('shows the correct summary counts without navigating away (FR-003, SC-001)', () => {
    seed()

    render(<InventarioView />)

    const caducidadCard = screen.getByText('Caducados/Próximos').closest('button')
    expect(caducidadCard).not.toBeNull()
    const resumen = caducidadCard!.parentElement!
    const stockBajoCard = within(resumen).getByText('Bajo Stock').closest('button')
    expect(stockBajoCard).not.toBeNull()

    // insumoCaducado (caducado) + insumoProximo (nivel 7) = 2
    expect(within(caducidadCard!).getByText('2')).toBeInTheDocument()
    // insumoBajoStock = 1
    expect(within(stockBajoCard!).getByText('1')).toBeInTheDocument()
  })

  it('filters the list to caducado/próximo insumos when the summary indicator is tapped (FR-004)', () => {
    seed()

    render(<InventarioView />)

    fireEvent.click(screen.getByText('Caducados/Próximos'))

    expect(screen.getByText('Insumo Caducado')).toBeInTheDocument()
    expect(screen.getByText('Insumo Próximo')).toBeInTheDocument()
    expect(screen.queryByText('Insumo Bajo Stock')).not.toBeInTheDocument()
    expect(screen.queryByText('Insumo Ok')).not.toBeInTheDocument()
  })

  it('filters by name in real time as the user types (FR-005, SC-002)', () => {
    seed()

    render(<InventarioView />)

    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Próximo' },
    })

    expect(screen.getByText('Insumo Próximo')).toBeInTheDocument()
    expect(screen.queryByText('Insumo Caducado')).not.toBeInTheDocument()
    expect(screen.queryByText('Insumo Ok')).not.toBeInTheDocument()
  })

  it('filters by categoría via the category chips (FR-007)', () => {
    seed()
    useInventoryStore.setState((state) => ({
      insumos: state.insumos.map((insumo) =>
        insumo.id === 'ok' ? { ...insumo, categoria: 'Restauración' } : insumo,
      ),
    }))

    render(<InventarioView />)

    fireEvent.click(screen.getByRole('button', { name: 'Restauración' }))

    expect(screen.getByText('Insumo Ok')).toBeInTheDocument()
    expect(screen.queryByText('Insumo Caducado')).not.toBeInTheDocument()
  })

  it('combines texto + categoría + estado filters (FR-008)', () => {
    seed()

    render(<InventarioView />)

    fireEvent.click(screen.getAllByText('Bajo Stock')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Cirugía' }))
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Insumo Bajo' },
    })

    expect(screen.getByText('Insumo Bajo Stock')).toBeInTheDocument()
    expect(screen.queryByText('Insumo Caducado')).not.toBeInTheDocument()
    expect(screen.queryByText('Insumo Ok')).not.toBeInTheDocument()
  })

  it('shows an empty state with "Limpiar filtros" when nothing matches (FR-012)', () => {
    seed()

    render(<InventarioView />)

    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'no existe' },
    })

    expect(
      screen.getByText('Ningún insumo coincide con la búsqueda o los filtros.'),
    ).toBeInTheDocument()
    const limpiar = screen.getByText('Limpiar filtros')
    expect(limpiar).toBeInTheDocument()

    fireEvent.click(limpiar)

    expect(screen.getByText('Insumo Caducado')).toBeInTheDocument()
  })

  it('opens the read-only detail of an insumo with multiple lotes and preserves filters on close (FR-010, FR-011)', () => {
    const insumoMultiLote = makeInsumo({ id: 'multi', nombre: 'Insumo Multi Lote' })
    const loteA = makeLote({
      id: 'multi-a',
      insumoId: 'multi',
      numeroLote: 'A-1',
      fechaCaducidad: fechaEnDias(200),
    })
    const loteB = makeLote({
      id: 'multi-b',
      insumoId: 'multi',
      numeroLote: 'B-2',
      fechaCaducidad: fechaEnDias(300),
    })

    useInventoryStore.setState({
      insumos: [insumoMultiLote],
      lotes: [loteA, loteB],
      movimientos: [makeIngreso('multi-a', 4), makeIngreso('multi-b', 6)],
      isReady: true,
    })

    render(<InventarioView />)

    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Multi' },
    })
    fireEvent.click(screen.getByText('Insumo Multi Lote'))

    // Spec 020 R5: el detalle se abre en una hoja encima de la lista.
    const detalle = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    expect(
      within(detalle).getByText(`Stock total: 10 ${insumoMultiLote.unidadMedida}`),
    ).toBeInTheDocument()
    expect(within(detalle).getByText(/Lote A-1/)).toBeInTheDocument()
    expect(within(detalle).getByText(/Lote B-2/)).toBeInTheDocument()

    fireEvent.click(within(detalle).getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByText(/Stock total: 10/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nombre del insumo')).toHaveValue('Multi')
    expect(screen.getByText('Insumo Multi Lote')).toBeInTheDocument()
  })

  it('shows the "en buen estado" state when there are no active alerts', () => {
    useInventoryStore.setState({
      insumos: [insumoOk],
      lotes: [loteOk],
      movimientos: [makeIngreso('lote-ok', 10)],
      isReady: true,
    })

    render(<InventarioView />)

    expect(
      screen.getByText('El inventario está en buen estado'),
    ).toBeInTheDocument()
  })
})
