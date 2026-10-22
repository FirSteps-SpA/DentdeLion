import { describe, expect, it } from 'vitest'
import { normalizarMovimientos } from '../../../src/features/insumos/lib/stock'
import { indiceCostos } from '../../../src/features/reportes/lib/gasto'
import {
  valorInventario,
  valorInventarioConVariacion,
} from '../../../src/features/reportes/lib/valorInventario'
import { LUGAR_1, LUGAR_2, conversion, insumo, iso, lote, mov } from './fixtures'

/**
 * Spec 017 T034 (FR-015, research.md R8): Σ stock × costo de lotes no
 * caducados con stock, hoy y al cierre del mes anterior.
 */
const AHORA = new Date(2026, 9, 15, 10)
const insumos = [insumo('i1'), insumo('i2')]

describe('valorInventario', () => {
  const lotes = [
    lote('l1', 'i1', 650),
    lote('l2', 'i2', null),
    lote('l3', 'i1', 1000, { fechaCaducidad: '2026-10-01' }),
  ]
  const indice = indiceCostos(lotes, insumos, [], [])
  const movimientos = [
    mov('ingreso', 'l1', 10, iso(2026, 8, 1)),
    mov('consumo', 'l1', 4, iso(2026, 9, 2)),
    mov('ingreso', 'l2', 5, iso(2026, 8, 1)),
    mov('ingreso', 'l3', 3, iso(2026, 8, 1)),
  ]

  it('suma stock × costo, excluye caducados y cuenta los lotes con stock sin precio', () => {
    expect(valorInventario(movimientos, lotes, indice, LUGAR_1, AHORA)).toEqual({
      valor: 6 * 650,
      lotesSinPrecio: 1,
    })
  })

  it('al cierre del mes anterior ignora movimientos posteriores y evalúa la caducidad a esa fecha', () => {
    expect(valorInventario(movimientos, lotes, indice, LUGAR_1, new Date(2026, 9, 1))).toEqual({
      valor: 10 * 650 + 3 * 1000,
      lotesSinPrecio: 1,
    })
  })

  it('un traslado baja en el origen y sube en el destino sin cambiar "Todos"', () => {
    const conTraslado = [
      ...movimientos,
      mov('traslado_salida', 'l1', 2, iso(2026, 9, 5)),
      mov('traslado_entrada', 'l1', 2, iso(2026, 9, 5), { lugarId: LUGAR_2 }),
    ]
    expect(valorInventario(conTraslado, lotes, indice, LUGAR_1, AHORA).valor).toBe(4 * 650)
    expect(valorInventario(conTraslado, lotes, indice, LUGAR_2, AHORA).valor).toBe(2 * 650)
    expect(valorInventario(conTraslado, lotes, indice, 'todos', AHORA).valor).toBe(6 * 650)
  })

  it('valoriza en la unidad actual tras una conversión', () => {
    const guantes = insumo('g', { unidadMedida: 'unidad' })
    const caja = lote('lg', 'g', 5000, { unidadConsumo: 'caja' })
    const cambios = [conversion('g', 'caja', 'unidad', 50, iso(2026, 8, 20))]
    const crudos = [mov('ingreso', 'lg', 2, iso(2026, 8, 1), { unidad: 'caja' })]
    const normalizados = normalizarMovimientos(crudos, [caja], [guantes], cambios)
    const valor = valorInventario(normalizados, [caja], indiceCostos([caja], [guantes], [], cambios), 'todos', AHORA)
    expect(valor.valor).toBe(10000)
  })
})

describe('valorInventarioConVariacion', () => {
  it('compara con el valor al cierre del mes anterior', () => {
    const lotes = [lote('l1', 'i1', 1000)]
    const r = valorInventarioConVariacion(
      [mov('ingreso', 'l1', 10, iso(2026, 8, 1)), mov('ingreso', 'l1', 2, iso(2026, 9, 3))],
      lotes,
      indiceCostos(lotes, insumos, [], []),
      LUGAR_1,
      AHORA,
    )
    expect(r.valor).toBe(12000)
    expect(r.variacion).toMatchObject({ tipo: 'porcentaje' })
    expect((r.variacion as { valor: number }).valor).toBeCloseTo(0.2)
  })

  it('sin inventario al cierre anterior la variación es "nuevo"', () => {
    const lotes = [lote('l1', 'i1', 1000)]
    const r = valorInventarioConVariacion(
      [mov('ingreso', 'l1', 1, iso(2026, 9, 3))],
      lotes,
      indiceCostos(lotes, insumos, [], []),
      LUGAR_1,
      AHORA,
    )
    expect(r.variacion).toEqual({ tipo: 'nuevo' })
  })
})
