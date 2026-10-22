import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/lib/db', () => ({
  db: {
    configuracionAlertas: { get: async () => undefined, put: async () => undefined },
  },
}))

import { InicioView } from '../../src/features/inicio/components/InicioView'
import { normalizarMovimientos } from '../../src/features/insumos/lib/stock'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { LUGAR_1, LUGAR_2, TENANT_1, insumo, iso, lote, lugar, mov } from '../unit/reportes/fixtures'

/**
 * Spec 017 T035 (US4, FR-015, UI §4): primera tarjeta de Inicio con el valor
 * del inventario, su variación neutra frente al mes anterior y acceso a
 * Reportes.
 */
const AHORA = new Date(2026, 9, 15, 10)

function cargar(lotes: Lote[], movimientos: Movimiento[], lugarActivoId: string = LUGAR_1) {
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
  useLugarStore.setState({
    lugares: [lugar(LUGAR_1, 'Clínica Providencia'), lugar(LUGAR_2, 'Box Las Condes')],
    lugarActivoId,
    isReady: true,
  })
}

const tarjeta = () => screen.getByRole('button', { name: /^Valor de inventario:/ })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'u1',
      email: 'a@x.cl',
      nombre: 'Sofía',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], preferenciaStockBajo: true, preferenciaCaducidad: true })
})

afterEach(() => vi.useRealTimers())

describe('Valor de inventario en Inicio (US4)', () => {
  it('es la primera tarjeta, con monto, variación neutra y acceso a Reportes', () => {
    cargar([lote('l1', 'i1', 1000)], [mov('ingreso', 'l1', 10, iso(2026, 8, 1)), mov('ingreso', 'l1', 2, iso(2026, 9, 3))])
    const onNavegar = vi.fn()
    render(<InicioView onNavegar={onNavegar} />)

    const resumen = screen.getByRole('region', { name: 'Resumen' })
    expect(resumen.querySelector('button')).toBe(tarjeta())
    expect(tarjeta()).toHaveTextContent('$12.000')
    const variacion = screen.getByText('↑ 20 % vs. mes anterior')
    expect(variacion).toHaveClass('text-text-muted')
    expect(tarjeta()).toHaveAccessibleName(
      'Valor de inventario: $12.000. ↑ 20 % vs. mes anterior. Ver Reportes',
    )
    fireEvent.click(tarjeta())
    expect(onNavegar).toHaveBeenCalledWith('reportes')
  })

  it('con lotes sin precio muestra "desde" y cuántos son', () => {
    cargar(
      [lote('l1', 'i1', 1000), lote('l2', 'i1', null)],
      [mov('ingreso', 'l1', 1, iso(2026, 9, 1)), mov('ingreso', 'l2', 5, iso(2026, 9, 1))],
    )
    render(<InicioView onNavegar={vi.fn()} />)
    expect(tarjeta()).toHaveTextContent('desde $1.000')
    expect(tarjeta()).toHaveTextContent('1 lote sin precio')
  })

  it('sin ningún lote con precio dice "Sin precios"', () => {
    cargar([lote('l2', 'i1', null)], [mov('ingreso', 'l2', 5, iso(2026, 9, 1))])
    render(<InicioView onNavegar={vi.fn()} />)
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
    render(<InicioView onNavegar={vi.fn()} />)
    expect(tarjeta()).toHaveTextContent('$7.000')
  })
})
