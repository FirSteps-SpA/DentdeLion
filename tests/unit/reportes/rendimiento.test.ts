import { describe, expect, it } from 'vitest'
import { consumosValorizados, indiceCostos } from '../../../src/features/reportes/lib/gasto'
import { resumenReportes } from '../../../src/features/reportes/lib/kpis'
import { valorInventarioConVariacion } from '../../../src/features/reportes/lib/valorInventario'
import type { Movimiento, TratamientoRealizado } from '../../../src/lib/db'
import { LUGAR_1, LUGAR_2, insumo, lote, lugar, mov, realizado } from './fixtures'

/**
 * Spec 017 T039 (research.md R12, SC-004): un año de datos de una clínica
 * típica (20.000 movimientos, 3.000 tratamientos, 300 lotes, 3 lugares) se
 * calcula en < 300 ms, con margen para los < 2 s de la pantalla completa.
 */
const LUGAR_3 = '00000000-0000-4000-8000-000000000013'
const AHORA = new Date(2026, 9, 15, 10)

describe('rendimiento de Reportes', () => {
  it('calcula KPIs, gráficos y valor de inventario en < 300 ms', () => {
    const lugares = [lugar(LUGAR_1, 'A'), lugar(LUGAR_2, 'B'), lugar(LUGAR_3, 'C')]
    const insumos = Array.from({ length: 120 }, (_, i) =>
      insumo(`i${i}`, { categoria: `Categoría ${i % 8}` }),
    )
    const lotes = Array.from({ length: 300 }, (_, i) =>
      lote(`l${i}`, `i${i % 120}`, i % 10 === 0 ? null : 500 + i),
    )
    const desde = new Date(2025, 9, 1).getTime()
    const lapso = AHORA.getTime() - desde
    const lugarDe = (i: number) => lugares[i % 3].id
    const fecha = (i: number, n: number) => new Date(desde + (lapso * i) / n).toISOString()
    const movimientos: Movimiento[] = []
    for (let i = 0; i < 20000; i++) {
      const tipo = i % 10 === 0 ? 'ingreso' : 'consumo'
      movimientos.push(mov(tipo, `l${i % 300}`, tipo === 'ingreso' ? 50 : 1, fecha(i, 20000), { lugarId: lugarDe(i) }))
    }
    const realizados: TratamientoRealizado[] = Array.from({ length: 3000 }, (_, i) =>
      realizado(45000, 14000, fecha(i, 3000), { lugarId: lugarDe(i), anuladoEn: i % 50 === 0 ? 'x' : null }),
    )

    // El mejor de 3: mide el cálculo, no la contención con los otros workers
    // de la suite.
    const calcular = () => {
      const inicio = performance.now()
      const indice = indiceCostos(lotes, insumos, [], [])
      const consumos = consumosValorizados(movimientos, indice, 'todos')
      const entrada = { realizados, consumos, insumos, lugares }
      const todos = resumenReportes(entrada, { tipo: 'esteAnio' }, 'todos', AHORA)
      resumenReportes(entrada, { tipo: 'esteMes' }, LUGAR_1, AHORA)
      valorInventarioConVariacion(movimientos, lotes, indice, 'todos', AHORA)
      return { todos, duracion: performance.now() - inicio }
    }
    const intentos = [calcular(), calcular(), calcular()]
    const { todos } = intentos[0]
    const duracion = Math.min(...intentos.map((i) => i.duracion))

    expect(todos.produccion.valor).toBeGreaterThan(0)
    expect(todos.gananciaPorLugar).toHaveLength(3)
    expect(duracion).toBeLessThan(300)
  })
})
