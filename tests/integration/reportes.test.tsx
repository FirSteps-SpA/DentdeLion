import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../src/lib/db', () => ({ db: {} }))

import { ReportesView } from '../../src/features/reportes/components/ReportesView'
import { normalizarMovimientos } from '../../src/features/insumos/lib/stock'
import type { Insumo, Lote, Movimiento, TratamientoRealizado } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useSyncStore } from '../../src/stores/syncStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import {
  LUGAR_1,
  LUGAR_2,
  deshacer,
  insumo,
  iso,
  lote,
  lugar,
  mov,
  realizado,
} from '../unit/reportes/fixtures'

/**
 * Spec 017 T013 / T023 / T028 (US1–US3, quickstart §2–§4): la sección
 * Reportes con los KPIs, el selector de período, "Todos" y los gráficos,
 * calculados desde los stores (sin red).
 */
const AHORA = new Date(2026, 9, 15, 10)
const lugares = [lugar(LUGAR_1, 'Clínica Providencia'), lugar(LUGAR_2, 'Box Las Condes')]

function cargar({
  realizados = [] as TratamientoRealizado[],
  movimientos = [] as Movimiento[],
  lotes = [] as Lote[],
  insumos = [] as Insumo[],
  lugarActivoId = LUGAR_1 as string,
} = {}) {
  useInventoryStore.setState({
    insumos,
    insumosDadosDeBaja: [],
    lotes,
    cambiosLote: [],
    cambiosInsumo: [],
    movimientos: normalizarMovimientos(movimientos, lotes, insumos, []),
    isReady: true,
  })
  useTratamientosStore.setState({ realizados, isReady: true })
  useLugarStore.setState({ lugares, lugarActivoId, isReady: true })
}

const insumos = [
  insumo('a', { nombre: 'Anestesia', categoria: 'Anestesia' }),
  insumo('b', { nombre: 'Resina', categoria: 'Restauración', unidadMedida: 'g' }),
  insumo('s', { nombre: 'Gasa', categoria: 'Curación' }),
]
const lotes = [lote('la', 'a', 650), lote('lb', 'b', 1200), lote('ls', 's', null)]

function escenarioBase() {
  const guante = mov('consumo', 'la', 1, iso(2026, 9, 5))
  cargar({
    realizados: [
      realizado(45000, 14520, iso(2026, 9, 3)),
      realizado(45000, 14520, iso(2026, 9, 5)),
      realizado(30000, 9000, iso(2026, 9, 7)),
      realizado(45000, 14520, iso(2026, 8, 7)),
    ],
    movimientos: [
      mov('consumo', 'la', 2, iso(2026, 9, 3)),
      mov('consumo', 'lb', 2, iso(2026, 9, 3), { unidad: 'g' }),
      guante,
      deshacer(guante, iso(2026, 9, 5)),
      mov('consumo', 'la', 1, iso(2026, 7, 3)),
    ],
    lotes,
    insumos,
  })
}

const tarjeta = (titulo: string) => screen.getByRole('group', { name: new RegExp(`^${titulo}:`) })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  useSyncStore.setState({ ultimaExitosaEn: AHORA.toISOString(), fase: 'inactivo' })
})

afterEach(() => vi.useRealTimers())

describe('KPIs del período (US1)', () => {
  it('muestra producción, gasto y ganancia estimada del mes con su comparación', () => {
    escenarioBase()
    render(<ReportesView />)
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument()
    expect(screen.getByText('Clínica Providencia')).toBeInTheDocument()
    expect(within(tarjeta('Producción')).getByText('$120.000')).toBeInTheDocument()
    expect(within(tarjeta('Producción')).getByText('↑ 167 % vs. mes anterior completo')).toBeInTheDocument()
    // 2 × $650 + 2 g × $1.200; el consumo deshecho no suma.
    expect(within(tarjeta('Gasto en materiales')).getByText('$3.700')).toBeInTheDocument()
    expect(within(tarjeta('Ganancia estimada')).getByText('$38.040')).toBeInTheDocument()
    expect(within(tarjeta('Ganancia estimada')).getByText('No es utilidad contable')).toBeInTheDocument()
    const textos = document.body.textContent ?? ''
    expect(textos.replace('No es utilidad contable', '')).not.toMatch(/utilidad/i)
  })

  it('el selector cambia de período: mes anterior, este año y un mes elegido', () => {
    escenarioBase()
    render(<ReportesView />)
    fireEvent.click(screen.getByRole('button', { name: /Período: Este mes/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Mes anterior' }))
    expect(within(tarjeta('Producción')).getByText('$45.000')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Período: Mes anterior/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Este año' }))
    expect(within(tarjeta('Producción')).getByText('$165.000')).toBeInTheDocument()
    expect(within(tarjeta('Producción')).getByText('Sin datos del período anterior')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Período: Este año/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Elegir mes…' }))
    expect(screen.getAllByRole('button', { name: /\d{4}$/ })).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Agosto 2026' }))
    expect(screen.getByRole('button', { name: /Período: Agosto 2026/ })).toBeInTheDocument()
    expect(within(tarjeta('Gasto en materiales')).getByText('$650')).toBeInTheDocument()
  })

  it('advierte los tratamientos y materiales sin precio, con "desde"', () => {
    cargar({
      realizados: [realizado(null, null, iso(2026, 9, 3)), realizado(10000, 4000, iso(2026, 9, 4))],
      movimientos: [mov('consumo', 'la', 1, iso(2026, 9, 3)), mov('consumo', 'ls', 3, iso(2026, 9, 3))],
      lotes,
      insumos,
    })
    render(<ReportesView />)
    expect(within(tarjeta('Producción')).getByText('desde $10.000')).toBeInTheDocument()
    expect(within(tarjeta('Producción')).getByText('1 tratamiento sin precio')).toBeInTheDocument()
    expect(within(tarjeta('Gasto en materiales')).getByText('desde $650')).toBeInTheDocument()
    expect(within(tarjeta('Gasto en materiales')).getByText('1 material sin precio')).toBeInTheDocument()
  })

  it('una ganancia negativa se muestra con signo y en rojo', () => {
    cargar({ realizados: [realizado(1000, -500, iso(2026, 9, 3))] })
    render(<ReportesView />)
    const valor = within(tarjeta('Ganancia estimada')).getByText('−$500')
    expect(valor).toHaveClass('text-danger')
  })

  it('sin datos muestra el estado vacío con accesos', () => {
    cargar()
    const onNavegar = vi.fn()
    render(<ReportesView onNavegar={onNavegar} />)
    expect(screen.getByText(/Registra tratamientos y precios de compra/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /^Producción:/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Tratamientos/ }))
    expect(onNavegar).toHaveBeenCalledWith('tratamientos')
  })

  it('avisa que puede faltar información si el dispositivo nunca sincronizó', () => {
    useSyncStore.setState({ ultimaExitosaEn: null })
    cargar()
    render(<ReportesView />)
    expect(screen.getByRole('status')).toHaveTextContent('Puede faltar información')
  })
})

describe('lugar y "Todos" (US2)', () => {
  const datos = () => ({
    realizados: [
      realizado(45000, 14000, iso(2026, 9, 3)),
      realizado(50000, 9000, iso(2026, 9, 4), { lugarId: LUGAR_2 }),
    ],
  })

  it('en "Todos" suma los lugares y muestra Ganancia por lugar con su tabla', () => {
    cargar({ ...datos(), lugarActivoId: 'todos' })
    render(<ReportesView />)
    expect(screen.getByText('Todos los lugares')).toBeInTheDocument()
    expect(within(tarjeta('Producción')).getByText('$95.000')).toBeInTheDocument()
    const grafico = screen.getByRole('figure', { name: 'Ganancia por lugar' })
    const botones = within(grafico).getAllByRole('button', { pressed: false })
    expect(botones[0]).toHaveTextContent('Clínica Providencia')
    expect(botones[1]).toHaveTextContent('Box Las Condes')
    const tabla = within(grafico).getByRole('table', { hidden: true })
    expect(within(tabla).getAllByRole('row', { hidden: true })).toHaveLength(3)
  })

  it('en un lugar solo cuenta ese lugar y no muestra Ganancia por lugar', () => {
    cargar({ ...datos(), lugarActivoId: LUGAR_2 })
    render(<ReportesView />)
    expect(within(tarjeta('Producción')).getByText('$50.000')).toBeInTheDocument()
    expect(screen.queryByRole('figure', { name: 'Ganancia por lugar' })).not.toBeInTheDocument()
  })
})

describe('gráficos de gasto (US3)', () => {
  it('muestra los 3 gráficos; tocar la leyenda muestra el monto exacto', () => {
    escenarioBase()
    render(<ReportesView />)
    for (const titulo of ['Consumo por categoría', 'Gastos mensuales', 'Materiales más utilizados']) {
      expect(screen.getByRole('figure', { name: titulo })).toBeInTheDocument()
    }
    const donut = screen.getByRole('figure', { name: 'Consumo por categoría' })
    fireEvent.click(within(donut).getByRole('button', { name: /Restauración/ }))
    expect(within(donut).getByText('Restauración: $2.400 (65 %)')).toBeInTheDocument()

    const lineas = screen.getByRole('figure', { name: 'Gastos mensuales' })
    fireEvent.click(within(lineas).getByRole('button', { name: /^agosto 2026/ }))
    expect(within(lineas).getByText('agosto 2026: $650')).toBeInTheDocument()

    const barras = screen.getByRole('figure', { name: 'Materiales más utilizados' })
    fireEvent.click(within(barras).getByRole('button', { name: /Resina/ }))
    expect(within(barras).getByText('Resina: $2.400 · 2 g')).toBeInTheDocument()
  })

  it('cada objetivo táctil de los gráficos tiene la clase de 48 px', () => {
    escenarioBase()
    render(<ReportesView />)
    for (const figura of screen.getAllByRole('figure')) {
      for (const boton of within(figura).getAllByRole('button')) {
        expect(boton).toHaveClass('touch-target')
      }
    }
  })

  it('"Ver como tabla" muestra los datos del gráfico', () => {
    escenarioBase()
    render(<ReportesView />)
    const donut = screen.getByRole('figure', { name: 'Consumo por categoría' })
    const tabla = within(donut).getByRole('table', { hidden: true })
    expect(tabla).toHaveClass('sr-only')
    fireEvent.click(within(donut).getByRole('button', { name: 'Ver como tabla' }))
    expect(tabla).not.toHaveClass('sr-only')
    expect(within(tabla).getByText('$1.300')).toBeInTheDocument()
  })

  it('un gráfico sin datos lo dice y avisa los materiales sin precio', () => {
    cargar({ movimientos: [mov('consumo', 'ls', 1, iso(2026, 9, 3))], lotes, insumos })
    render(<ReportesView />)
    const donut = screen.getByRole('figure', { name: 'Consumo por categoría' })
    expect(within(donut).getByText('Sin datos en este período')).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Materiales más utilizados' })).toHaveTextContent(
      'Sin datos en este período',
    )
  })

  it('con datos valorizados avisa los materiales sin precio bajo el gráfico', () => {
    cargar({
      movimientos: [mov('consumo', 'la', 1, iso(2026, 9, 3)), mov('consumo', 'ls', 1, iso(2026, 9, 3))],
      lotes,
      insumos,
    })
    render(<ReportesView />)
    expect(screen.getByRole('figure', { name: 'Consumo por categoría' })).toHaveTextContent(
      'Incluye 1 material sin precio, no valorizado.',
    )
  })
})
