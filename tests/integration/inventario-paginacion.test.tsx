import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { usarDosLugares, usarLugar1 } from '../helpers/lugarFalso'
import { restaurarMatchMedia, simularAncho } from '../helpers/matchMedia'

/**
 * Spec 020 US1 y US2: Inventario en tarjetas por grupos de 25 con "Ver más";
 * búsqueda, filtros y alertas sobre todo el inventario; detalle en hoja.
 */

function makeInsumo(n: number, overrides: Partial<Insumo> = {}): Insumo {
  return {
    unidadCompra: 'pieza',
    contenido: 1,
    tenantId: TENANT_1,
    id: `insumo-${n}`,
    nombre: `Insumo ${String(n).padStart(3, '0')}`,
    categoria: n % 2 === 0 ? 'Cirugía' : 'Anestesia',
    unidadMedida: 'pieza',
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: new Date().toISOString(),
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function makeLote(insumoId: string, lugarId = LUGAR_1): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId,
    id: `lote-${insumoId}-${lugarId}`,
    insumoId,
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    proveedorId: null,
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
  }
}

function makeIngreso(
  loteId: string,
  cantidad: number,
  lugarId = LUGAR_1,
): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId,
    trasladoId: null,
    id: `mov-${loteId}-${cantidad}`,
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'usuario-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
  }
}

/** Números 1..n en un orden revuelto pero fijo, para probar el orden alfabético. */
function revueltos(n: number): number[] {
  return Array.from({ length: n }, (_, i) => ((i * 37) % n) + 1)
}

function seed(
  n: number,
  overrides: (i: number) => Partial<Insumo> = () => ({}),
) {
  const insumos = revueltos(n).map((i) => makeInsumo(i, overrides(i)))
  const lotes = insumos.map((insumo) => makeLote(insumo.id))
  useInventoryStore.setState({
    insumos,
    lotes,
    movimientos: lotes.map((lote) => makeIngreso(lote.id, 10)),
    isReady: true,
  })
}

/** Nombres de las tarjetas visibles, en orden. */
function nombresVisibles(): string[] {
  return screen.getAllByText(/^Insumo \d{3}$/).map((el) => el.textContent ?? '')
}

beforeEach(() => {
  usarLugar1()
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
})

afterEach(() => {
  restaurarMatchMedia()
  useInventoryStore.setState({
    insumos: [],
    lotes: [],
    movimientos: [],
    isReady: true,
  })
})

describe('Inventario por grupos en tarjetas (spec 020 US1)', () => {
  it('muestra 25 en orden alfabético y "Ver más" con lo que queda (FR-003a, FR-006)', () => {
    seed(60)
    render(<InventarioView />)
    const nombres = nombresVisibles()
    expect(nombres).toHaveLength(25)
    expect(nombres[0]).toBe('Insumo 001')
    expect(nombres[24]).toBe('Insumo 025')
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 35)' }),
    ).toBeInTheDocument()
  })

  it('"Ver más" agrega 25 y deja el foco en la primera agregada (R6)', () => {
    seed(60)
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    expect(nombresVisibles()).toHaveLength(50)
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 10)' }),
    ).toBeInTheDocument()
    expect(document.activeElement).toBe(
      screen.getByText('Insumo 026').closest('li'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 10)' }))
    expect(nombresVisibles()).toHaveLength(60)
    expect(
      screen.queryByRole('button', { name: /^Ver más/ }),
    ).not.toBeInTheDocument()
  })

  it('con 25 insumos no hay "Ver más" (FR-002)', () => {
    seed(25)
    render(<InventarioView />)
    expect(nombresVisibles()).toHaveLength(25)
    expect(
      screen.queryByRole('button', { name: /^Ver más/ }),
    ).not.toBeInTheDocument()
  })

  it('el detalle se abre en una hoja y al cerrarla siguen los grupos cargados (FR-010)', () => {
    seed(60)
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    fireEvent.click(screen.getByText('Insumo 040'))

    const hoja = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    expect(within(hoja).getByText(/Stock total: 10/)).toBeInTheDocument()
    expect(nombresVisibles()).toContain('Insumo 040')

    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Insumo \d{3}$/)).toHaveLength(50)
  })

  it('un cambio de stock (consumo o sincronización) no cambia los grupos cargados', () => {
    seed(60)
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    act(() => {
      const { movimientos } = useInventoryStore.getState()
      useInventoryStore.setState({
        movimientos: [
          ...movimientos,
          {
            ...makeIngreso('lote-insumo-30-' + LUGAR_1, 1),
            tipo: 'consumo',
            id: 'consumo-1',
          },
        ],
      })
    })
    expect(nombresVisibles()).toHaveLength(50)
  })

  it('si el insumo del detalle se da de baja, la hoja se cierra', () => {
    seed(30)
    render(<InventarioView />)
    fireEvent.click(screen.getByText('Insumo 010'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => {
      useInventoryStore.setState({
        insumos: useInventoryStore
          .getState()
          .insumos.filter((i) => i.id !== 'insumo-10'),
      })
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('en tablet también son tarjetas con "Ver más"', () => {
    simularAncho(800)
    seed(60)
    render(<InventarioView />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 35)' }),
    ).toBeInTheDocument()
  })
})

describe('Búsqueda, filtros y alertas sobre todo el inventario (spec 020 US2)', () => {
  it('la búsqueda encuentra un insumo de cualquier grupo y vuelve al comienzo (FR-008, FR-009)', () => {
    seed(60)
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Insumo 060' },
    })
    expect(nombresVisibles()).toEqual(['Insumo 060'])

    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Insumo' },
    })
    expect(nombresVisibles()).toHaveLength(25)
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 35)' }),
    ).toBeInTheDocument()
  })

  it('elegir una categoría vuelve al comienzo y pagina los resultados', () => {
    seed(60)
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cirugía' }))
    expect(nombresVisibles()).toHaveLength(25)
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 5)' }),
    ).toBeInTheDocument()
  })

  it('el resumen de alertas cuenta todo y su acceso vuelve al comienzo', () => {
    // 30 insumos bajo mínimo (los impares hasta 59), repartidos en todos los grupos.
    seed(60, (i) => (i % 2 === 1 ? { stockMinimo: 20 } : {}))
    render(<InventarioView />)
    const stockBajo = screen.getAllByText('Bajo Stock')[0].closest('button')!
    expect(within(stockBajo).getByText('30')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    fireEvent.click(stockBajo)
    expect(nombresVisibles()).toHaveLength(25)
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 5)' }),
    ).toBeInTheDocument()
  })

  it('sin resultados: mensaje y sin "Ver más"', () => {
    seed(60)
    render(<InventarioView />)
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'no existe' },
    })
    expect(
      screen.getByText('Ningún insumo coincide con la búsqueda o los filtros.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Ver más/ }),
    ).not.toBeInTheDocument()
  })

  it('cambiar de lugar vuelve al comienzo', () => {
    usarDosLugares(LUGAR_1)
    const insumos = revueltos(60).map((i) => makeInsumo(i))
    const lotes = insumos.flatMap((insumo) => [
      makeLote(insumo.id, LUGAR_1),
      makeLote(insumo.id, LUGAR_2),
    ])
    useInventoryStore.setState({
      insumos,
      lotes,
      movimientos: lotes.map((lote) => makeIngreso(lote.id, 10, lote.lugarId)),
      isReady: true,
    })
    render(<InventarioView />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    expect(nombresVisibles()).toHaveLength(50)
    act(() => useLugarStore.setState({ lugarActivoId: LUGAR_2 }))
    expect(nombresVisibles()).toHaveLength(25)
  })

  it('en "Todos" se pagina igual y cada tarjeta mantiene su desglose', () => {
    usarDosLugares('todos')
    const insumos = revueltos(30).map((i) => makeInsumo(i))
    const lotes = insumos.flatMap((insumo) => [
      makeLote(insumo.id, LUGAR_1),
      makeLote(insumo.id, LUGAR_2),
    ])
    useInventoryStore.setState({
      insumos,
      lotes,
      movimientos: lotes.map((lote) => makeIngreso(lote.id, 10, lote.lugarId)),
      isReady: true,
    })
    render(<InventarioView />)
    expect(nombresVisibles()).toHaveLength(25)
    expect(
      screen.getByRole('button', { name: 'Ver más (quedan 5)' }),
    ).toBeInTheDocument()
    const tarjeta = screen.getByText('Insumo 001').closest('li')!
    expect(within(tarjeta).getByText(/Box Las Condes/)).toBeInTheDocument()
  })
})
