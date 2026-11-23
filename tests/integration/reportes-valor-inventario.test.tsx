import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../src/lib/db', () => ({ db: {} }))

import { ReportesView } from '../../src/features/reportes/components/ReportesView'
import { normalizarMovimientos } from '../../src/features/insumos/lib/stock'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import { LUGAR_1, LUGAR_2, insumo, iso, lote, lugar, mov, realizado } from '../unit/reportes/fixtures'

/**
 * Spec 017 T035 (US4, FR-015): valor del inventario con su variación neutra
 * frente al mes anterior. Desde 2026-11-23 está en Reportes (en Inicio quedó
 * la ganancia del mes): es el valor de hoy, no depende del período.
 */
const AHORA = new Date(2026, 9, 15, 10)

function cargar(
  lotes: Lote[],
  movimientos: Movimiento[],
  lugarActivoId: string = LUGAR_1,
  realizados = [realizado(10000, 3000, iso(2026, 9, 12))],
) {
  const insumos: Insumo[] = [insumo('i1')]
  useInventoryStore.setState({
    insumos,
    insumosDadosDeBaja: [],
    lotes,
    cambiosLote: [],
    cambiosInsumo: [],
    itemsCompra: [],
    minimosLugar: [],
    movimientos: normalizarMovimientos(movimientos, lotes, insumos, []),
    isReady: true,
  })
  useTratamientosStore.setState({ realizados, isReady: true })
  useLugarStore.setState({
    lugares: [lugar(LUGAR_1, 'Clínica Providencia'), lugar(LUGAR_2, 'Box Las Condes')],
    lugarActivoId,
    isReady: true,
  })
}

const tarjeta = () => screen.getByRole('group', { name: /^Valor de inventario:/ })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
})

afterEach(() => vi.useRealTimers())

describe('Valor de inventario en Reportes (spec 017 US4)', () => {
  it('muestra monto, variación neutra y que es el valor de hoy', () => {
    cargar([lote('l1', 'i1', 1000)], [mov('ingreso', 'l1', 10, iso(2026, 8, 1)), mov('ingreso', 'l1', 2, iso(2026, 9, 3))])
    render(<ReportesView />)

    const indicadores = screen.getByRole('region', { name: 'Indicadores' })
    expect(indicadores).toContainElement(tarjeta())
    expect(tarjeta()).toHaveTextContent('$12.000')
    expect(screen.getByText('↑ 20 % vs. mes anterior')).toHaveClass('text-text-muted')
    expect(tarjeta()).toHaveAccessibleName(
      'Valor de inventario: $12.000. ↑ 20 % vs. mes anterior. Hoy (no depende del período)',
    )
  })

  it('también se ve sin tratamientos ni consumos en el período', () => {
    cargar([lote('l1', 'i1', 1000)], [mov('ingreso', 'l1', 3, iso(2026, 9, 1))], LUGAR_1, [])
    render(<ReportesView />)
    expect(tarjeta()).toHaveTextContent('$3.000')
  })

  it('con lotes sin precio muestra "desde" y cuántos son', () => {
    cargar(
      [lote('l1', 'i1', 1000), lote('l2', 'i1', null)],
      [mov('ingreso', 'l1', 1, iso(2026, 9, 1)), mov('ingreso', 'l2', 5, iso(2026, 9, 1))],
    )
    render(<ReportesView />)
    expect(tarjeta()).toHaveTextContent('desde $1.000')
    expect(tarjeta()).toHaveTextContent('1 lote sin precio')
  })

  it('sin ningún lote con precio dice "Sin precios"', () => {
    cargar([lote('l2', 'i1', null)], [mov('ingreso', 'l2', 5, iso(2026, 9, 1))])
    render(<ReportesView />)
    expect(tarjeta()).toHaveTextContent('Sin precios')
    expect(tarjeta()).toHaveTextContent('Ingresa el precio al recibir compras')
  })

  it('en "Todos" suma los lugares', () => {
    cargar(
      [lote('l1', 'i1', 1000)],
      [
        mov('ingreso', 'l1', 3, iso(2026, 9, 1)),
        mov('ingreso', 'l1', 4, iso(2026, 9, 1), { lugarId: LUGAR_2 }),
      ],
      'todos',
    )
    render(<ReportesView />)
    expect(tarjeta()).toHaveTextContent('$7.000')
  })
})
