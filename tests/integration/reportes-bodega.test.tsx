import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../src/lib/db', () => ({ db: {} }))

import { ReportesView } from '../../src/features/reportes/components/ReportesView'
import { consumosValorizados, indiceCostos } from '../../src/features/reportes/lib/gasto'
import { normalizarMovimientos } from '../../src/features/insumos/lib/stock'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import { LUGAR_1, LUGAR_2, insumo, iso, lote, lugar, mov } from '../unit/reportes/fixtures'

/**
 * Spec 033 T020 (US2, FR-015, SC-004): el valor del inventario de un lugar de
 * una bodega compartida es el del stock común, con "Stock compartido con …";
 * en "Todos", una fila por bodega y el total sin contar dos veces. El consumo
 * y el gasto siguen por el lugar de cada movimiento.
 */
const AHORA = new Date(2026, 9, 15, 10)
const LUGAR_3 = '00000000-0000-4000-8000-000000000013'

const lugares = [
  lugar(LUGAR_1, 'Box 1', { bodegaId: 'bodega-b' }),
  lugar(LUGAR_2, 'Box 2', { bodegaId: 'bodega-b' }),
  lugar(LUGAR_3, 'Las Condes', { creadoEn: '2026-03-01T00:00:00.000Z' }),
]

// Bodega: 10 entran en Box 1 y Box 2 consume 3 → 7 × $1.000. Las Condes: 2 × $1.000.
const lotes: Lote[] = [lote('l1', 'i1', 1000), lote('l3', 'i1', 1000)]
const movimientos: Movimiento[] = [
  mov('ingreso', 'l1', 10, iso(2026, 9, 1)),
  mov('consumo', 'l1', 3, iso(2026, 9, 2), { lugarId: LUGAR_2 }),
  mov('ingreso', 'l3', 2, iso(2026, 9, 1), { lugarId: LUGAR_3 }),
]

function cargar(lugarActivoId: string) {
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
  useTratamientosStore.setState({ realizados: [], isReady: true })
  useLugarStore.setState({ lugares, lugarActivoId, isReady: true })
}

const tarjeta = () => screen.getByRole('group', { name: /^Valor de inventario:/ })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
})

afterEach(() => vi.useRealTimers())

describe('Reportes con bodega compartida (spec 033 US2)', () => {
  it('en Box 2, el valor es el del stock común y dice con quién se comparte', () => {
    cargar(LUGAR_2)
    render(<ReportesView />)

    expect(tarjeta()).toHaveTextContent('$7.000')
    expect(tarjeta()).toHaveTextContent('Stock compartido con Box 1')
  })

  it('en "Todos", una fila por bodega y el total sin doble conteo (SC-004)', () => {
    cargar('todos')
    render(<ReportesView />)

    expect(tarjeta()).toHaveTextContent('$9.000')
    expect(tarjeta()).toHaveTextContent('Box 1 + Box 2: $7.000')
    expect(tarjeta()).toHaveTextContent('Las Condes: $2.000')
  })

  it('sin bodegas compartidas, "Todos" no agrega filas (FR-019)', () => {
    cargar('todos')
    useLugarStore.setState({
      lugares: lugares.map((l) => ({ ...l, bodegaId: null })),
    })
    render(<ReportesView />)

    expect(tarjeta()).toHaveTextContent('$9.000')
    expect(tarjeta()).not.toHaveTextContent('Las Condes:')
  })

  it('el consumo sigue en el lugar del movimiento', () => {
    const insumos = [insumo('i1')]
    const indice = indiceCostos(lotes, insumos, [], [])
    const normalizados = normalizarMovimientos(movimientos, lotes, insumos, [])

    expect(consumosValorizados(normalizados, indice, LUGAR_2)).toMatchObject([
      { lugarId: LUGAR_2, cantidad: 3, monto: 3000 },
    ])
    expect(consumosValorizados(normalizados, indice, LUGAR_1)).toEqual([])
  })
})
