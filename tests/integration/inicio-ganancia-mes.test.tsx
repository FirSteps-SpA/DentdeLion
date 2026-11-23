import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../src/lib/db', () => ({
  db: {
    configuracionAlertas: { get: async () => undefined, put: async () => undefined },
  },
}))

import { InicioView } from '../../src/features/inicio/components/InicioView'
import type { TratamientoRealizado } from '../../src/lib/db'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import { LUGAR_1, LUGAR_2, TENANT_1, iso, lugar, realizado } from '../unit/reportes/fixtures'

/**
 * Pedido 2026-11-23: la tarjeta destacada de Inicio muestra la ganancia del
 * profesional del mes en curso (la misma cifra de Reportes con "Este mes"),
 * con su variación, el neto tras materiales y acceso a Reportes. El valor de
 * inventario pasó a Reportes.
 */
const AHORA = new Date(2026, 9, 15, 10)

function cargar(realizados: TratamientoRealizado[], lugarActivoId: string = LUGAR_1) {
  useInventoryStore.setState({
    insumos: [],
    insumosDadosDeBaja: [],
    lotes: [],
    cambiosLote: [],
    cambiosInsumo: [],
    itemsCompra: [],
    minimosLugar: [],
    movimientos: [],
    isReady: true,
  })
  useTratamientosStore.setState({ realizados, isReady: true })
  useLugarStore.setState({
    lugares: [lugar(LUGAR_1, 'Clínica Providencia'), lugar(LUGAR_2, 'Box Las Condes')],
    lugarActivoId,
    isReady: true,
  })
}

const tarjeta = () => screen.getByRole('button', { name: /^Ganancia del profesional este mes:/ })

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
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], preferenciaStockBajo: true, preferenciaCaducidad: true })
})

afterEach(() => vi.useRealTimers())

describe('ganancia del mes en Inicio', () => {
  it('es la primera tarjeta: ganancia del mes, variación, neto y acceso a Reportes', () => {
    cargar([
      // Octubre (mes en curso): 2 × $100.000 al 40 %.
      realizado(100000, 30000, iso(2026, 9, 3)),
      realizado(100000, 30000, iso(2026, 9, 14)),
      // Septiembre hasta el 15 (mismos días): $100.000 al 40 %; el del 20 no compara.
      realizado(100000, 30000, iso(2026, 8, 10)),
      realizado(100000, 30000, iso(2026, 8, 20)),
    ])
    const onNavegar = vi.fn()
    render(<InicioView onNavegar={onNavegar} />)

    const resumen = screen.getByRole('region', { name: 'Resumen' })
    expect(resumen.querySelector('button')).toBe(tarjeta())
    expect(tarjeta()).toHaveTextContent('$80.000')
    expect(tarjeta()).toHaveTextContent('Este mes · Neto tras materiales: $60.000')
    expect(screen.getByText(/↑ 100 %/)).toHaveClass('text-success-text')
    expect(screen.queryByText('Valor de inventario')).not.toBeInTheDocument()

    fireEvent.click(tarjeta())
    expect(onNavegar).toHaveBeenCalledWith('reportes')
  })

  it('un tratamiento deshecho no suma', () => {
    cargar([
      realizado(100000, 30000, iso(2026, 9, 3)),
      realizado(100000, 30000, iso(2026, 9, 4), { anuladoEn: iso(2026, 9, 4, 13), anuladoPor: 'A' }),
    ])
    render(<InicioView onNavegar={vi.fn()} />)
    expect(tarjeta()).toHaveTextContent('$40.000')
  })

  it('respeta el lugar activo y "Todos" suma los lugares', () => {
    const registros = [
      realizado(100000, 30000, iso(2026, 9, 3)),
      realizado(50000, 10000, iso(2026, 9, 3), { lugarId: LUGAR_2 }),
    ]
    cargar(registros)
    const { unmount } = render(<InicioView onNavegar={vi.fn()} />)
    expect(tarjeta()).toHaveTextContent('$40.000')
    unmount()

    cargar(registros, 'todos')
    render(<InicioView onNavegar={vi.fn()} />)
    expect(tarjeta()).toHaveTextContent('$60.000')
  })

  it('sin tratamientos en el mes muestra $0', () => {
    cargar([])
    render(<InicioView onNavegar={vi.fn()} />)
    expect(tarjeta()).toHaveTextContent('$0')
  })
})
