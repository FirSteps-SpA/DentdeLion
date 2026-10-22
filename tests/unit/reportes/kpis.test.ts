import { describe, expect, it } from 'vitest'
import {
  consumosValorizados,
  indiceCostos,
  type ConsumoValorizado,
} from '../../../src/features/reportes/lib/gasto'
import {
  resumenReportes,
  variacion,
  type EntradaReportes,
} from '../../../src/features/reportes/lib/kpis'
import type { Insumo, Lote, Movimiento, TratamientoRealizado } from '../../../src/lib/db'
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
} from './fixtures'

/**
 * Spec 017 T012 / T022 / T027 (lib §kpis, FR-003 a FR-012, FR-016, FR-017):
 * KPIs, variación, filtro por lugar y datos de los gráficos.
 */
const AHORA = new Date(2026, 9, 15, 10)
const ESTE_MES = { tipo: 'esteMes' } as const
const lugares = [lugar(LUGAR_1, 'Clínica Providencia'), lugar(LUGAR_2, 'Box Las Condes')]

function entrada(
  realizados: TratamientoRealizado[],
  movimientos: Movimiento[] = [],
  lotes: Lote[] = [],
  insumos: Insumo[] = [],
): EntradaReportes {
  const consumos: ConsumoValorizado[] = consumosValorizados(
    movimientos,
    indiceCostos(lotes, insumos, [], []),
    'todos',
  )
  return { realizados, consumos, insumos, lugares }
}

describe('variacion (R5)', () => {
  it('porcentaje con signo, "nuevo" con base 0, "sin-datos" sin base y null sin cambio desde 0', () => {
    expect(variacion(120, 100)).toEqual({ tipo: 'porcentaje', valor: 0.2 })
    expect(variacion(80, 100)).toEqual({ tipo: 'porcentaje', valor: -0.2 })
    expect(variacion(-50, -100)).toEqual({ tipo: 'porcentaje', valor: 0.5 })
    expect(variacion(10, 0)).toEqual({ tipo: 'nuevo' })
    expect(variacion(0, 0)).toBeNull()
    expect(variacion(10, null)).toEqual({ tipo: 'sin-datos' })
  })
})

describe('KPIs del período (US1)', () => {
  it('producción y ganancia salen de los snapshots vigentes del período', () => {
    const r = resumenReportes(
      entrada([
        realizado(45000, 14520, iso(2026, 9, 3)),
        realizado(45000, 14520, iso(2026, 9, 5)),
        realizado(30000, 9000, iso(2026, 9, 7)),
        realizado(99999, 99999, iso(2026, 9, 8), { anuladoEn: iso(2026, 9, 9) }),
        realizado(45000, 14520, iso(2026, 8, 20)),
      ]),
      ESTE_MES,
      LUGAR_1,
      AHORA,
    )
    expect(r.produccion.valor).toBe(120000)
    expect(r.ganancia.valor).toBe(38040)
    expect(r.produccion.variacion).toMatchObject({ tipo: 'porcentaje' })
    expect((r.produccion.variacion as { valor: number }).valor).toBeCloseTo(120000 / 45000 - 1)
    expect(r.produccion.mejora).toBe(true)
    expect(r.vacio).toBe(false)
  })

  it('cuenta aparte los sin precio y los sin % profesional', () => {
    const r = resumenReportes(
      entrada([
        realizado(null, null, iso(2026, 9, 3)),
        realizado(20000, null, iso(2026, 9, 4)),
        realizado(10000, 4000, iso(2026, 9, 5)),
      ]),
      ESTE_MES,
      LUGAR_1,
      AHORA,
    )
    expect(r.produccion.valor).toBe(30000)
    expect(r.produccion.incompleto).toEqual({ tratamientosSinPrecio: 1 })
    expect(r.ganancia.valor).toBe(4000)
    expect(r.ganancia.incompleto).toEqual({ tratamientosSinPrecio: 1, tratamientosSinPorcentaje: 1 })
  })

  it('el gasto es lo consumido valorizado; subir es empeorar; los sin precio se cuentan por insumo', () => {
    const insumos = [insumo('i1'), insumo('i2')]
    const lotes = [lote('l1', 'i1', 650), lote('l2', 'i2', null)]
    const movimientos = [
      mov('consumo', 'l1', 2, iso(2026, 9, 3)),
      mov('consumo', 'l2', 1, iso(2026, 9, 3)),
      mov('consumo', 'l2', 1, iso(2026, 9, 4)),
      mov('consumo', 'l1', 1, iso(2026, 8, 3)),
    ]
    const r = resumenReportes(entrada([], movimientos, lotes, insumos), ESTE_MES, LUGAR_1, AHORA)
    expect(r.gasto.valor).toBe(1300)
    expect(r.gasto.incompleto).toEqual({ materialesSinPrecio: 1 })
    expect(r.gasto.mejora).toBe(false)
  })

  it('el consumo deshecho no suma', () => {
    const consumo = mov('consumo', 'l1', 3, iso(2026, 9, 3))
    const r = resumenReportes(
      entrada([], [consumo, deshacer(consumo, iso(2026, 9, 3))], [lote('l1', 'i1', 650)], [insumo('i1')]),
      ESTE_MES,
      LUGAR_1,
      AHORA,
    )
    expect(r.gasto.valor).toBe(0)
    expect(r.vacio).toBe(true)
  })

  it('un mes elegido se compara con el anterior y "Este año" en octubre queda sin datos', () => {
    const datos = entrada([realizado(10000, 4000, iso(2026, 2, 5)), realizado(5000, 2000, iso(2026, 1, 5))])
    const marzo = resumenReportes(datos, { tipo: 'mes', anio: 2026, mes: 2 }, LUGAR_1, AHORA)
    expect(marzo.produccion.valor).toBe(10000)
    expect(marzo.produccion.variacion).toEqual({ tipo: 'porcentaje', valor: 1 })
    const anio = resumenReportes(datos, { tipo: 'esteAnio' }, LUGAR_1, AHORA)
    expect(anio.produccion.valor).toBe(15000)
    expect(anio.produccion.variacion).toEqual({ tipo: 'sin-datos' })
    expect(anio.produccion.mejora).toBeNull()
  })

  it('sin tratamientos ni consumos el resumen está vacío', () => {
    const r = resumenReportes(entrada([]), ESTE_MES, LUGAR_1, AHORA)
    expect(r.vacio).toBe(true)
    expect(r.produccion.variacion).toBeNull()
  })
})

describe('lugar y "Todos" (US2)', () => {
  const insumos = [insumo('i1')]
  const lotes = [lote('l1', 'i1', 1000)]
  const datos = entrada(
    [
      realizado(45000, 14000, iso(2026, 9, 3)),
      realizado(50000, -2000, iso(2026, 9, 4), { lugarId: LUGAR_2 }),
      realizado(30000, 9000, iso(2026, 9, 5), { lugarId: LUGAR_2 }),
    ],
    [mov('consumo', 'l1', 2, iso(2026, 9, 3)), mov('consumo', 'l1', 5, iso(2026, 9, 3), { lugarId: LUGAR_2 })],
    lotes,
    insumos,
  )

  it('Σ por lugar = "Todos" en producción, gasto y ganancia (SC-003)', () => {
    const todos = resumenReportes(datos, ESTE_MES, 'todos', AHORA)
    const l1 = resumenReportes(datos, ESTE_MES, LUGAR_1, AHORA)
    const l2 = resumenReportes(datos, ESTE_MES, LUGAR_2, AHORA)
    for (const k of ['produccion', 'gasto', 'ganancia'] as const) {
      expect(l1[k].valor + l2[k].valor).toBe(todos[k].valor)
    }
    expect(todos.gasto.valor).toBe(7000)
  })

  it('ganancia por lugar de mayor a menor, solo en "Todos"', () => {
    expect(resumenReportes(datos, ESTE_MES, 'todos', AHORA).gananciaPorLugar).toEqual([
      { lugarId: LUGAR_1, nombre: 'Clínica Providencia', monto: 14000 },
      { lugarId: LUGAR_2, nombre: 'Box Las Condes', monto: 7000 },
    ])
    expect(resumenReportes(datos, ESTE_MES, LUGAR_1, AHORA).gananciaPorLugar).toBeNull()
  })

  it('es null con un solo lugar con datos en el período, aunque el tenant tenga más', () => {
    const uno = entrada([realizado(45000, 14000, iso(2026, 9, 3)), realizado(1, 1, iso(2026, 8, 3), { lugarId: LUGAR_2 })])
    expect(resumenReportes(uno, ESTE_MES, 'todos', AHORA).gananciaPorLugar).toBeNull()
  })

  it('incluye un lugar desactivado con datos del período', () => {
    const desactivado = { ...entrada([]), lugares: [lugares[0], lugar(LUGAR_2, 'Box cerrado', { desactivadoEn: iso(2026, 9, 1) })] }
    const r = resumenReportes(
      { ...desactivado, realizados: [realizado(1000, 500, iso(2026, 9, 2)), realizado(1000, 900, iso(2026, 9, 2), { lugarId: LUGAR_2 })] },
      ESTE_MES,
      'todos',
      AHORA,
    )
    expect(r.gananciaPorLugar?.map((g) => g.nombre)).toEqual(['Box cerrado', 'Clínica Providencia'])
  })
})

describe('gráficos de gasto (US3)', () => {
  const insumos = [
    insumo('a', { nombre: 'Anestesia', categoria: 'Anestesia' }),
    insumo('b', { nombre: 'Resina', categoria: 'Restauración', unidadMedida: 'g' }),
    insumo('c', { nombre: 'Guantes', categoria: 'Protección' }),
    insumo('d', { nombre: 'Gasa', categoria: '' }),
    insumo('e', { nombre: 'Fresa', categoria: 'restauracion ', dadoDeBajaEn: iso(2026, 9, 1) }),
    insumo('f', { nombre: 'Hilo', categoria: 'Periodoncia' }),
    insumo('g', { nombre: 'Sin precio', categoria: 'Anestesia' }),
  ]
  const lotes = [
    lote('la', 'a', 1000),
    lote('lb', 'b', 500),
    lote('lc', 'c', 100),
    lote('ld', 'd', 50),
    lote('le', 'e', 2000),
    lote('lf', 'f', 10),
    lote('lg', 'g', null),
  ]
  const movimientos = [
    mov('consumo', 'la', 3, iso(2026, 9, 2)),
    mov('consumo', 'lb', 5, iso(2026, 9, 2), { unidad: 'g' }),
    mov('consumo', 'lc', 10, iso(2026, 9, 2)),
    mov('consumo', 'ld', 4, iso(2026, 9, 2)),
    mov('consumo', 'le', 1, iso(2026, 9, 2)),
    mov('consumo', 'lf', 5, iso(2026, 9, 2)),
    mov('consumo', 'lg', 1, iso(2026, 9, 2)),
    mov('consumo', 'la', 1, iso(2026, 7, 2)),
  ]
  const r = resumenReportes(entrada([], movimientos, lotes, insumos), ESTE_MES, LUGAR_1, AHORA)

  it('agrupa por categoría (clave sin tildes ni mayúsculas), máximo 3 + "Otras", y suma el gasto', () => {
    expect(r.porCategoria.map((c) => [c.nombre, c.monto])).toEqual([
      ['Restauración', 4500],
      ['Anestesia', 3000],
      ['Protección', 1000],
      ['Otras', 250],
    ])
    expect(r.porCategoria.reduce((t, c) => t + c.monto, 0)).toBe(r.gasto.valor)
    expect(r.porCategoria.reduce((t, c) => t + c.porcentaje, 0)).toBeCloseTo(100)
  })

  it('"Sin categoría" agrupa los insumos sin categoría', () => {
    const solo = resumenReportes(
      entrada([], [mov('consumo', 'ld', 4, iso(2026, 9, 2))], lotes, insumos),
      ESTE_MES,
      LUGAR_1,
      AHORA,
    )
    expect(solo.porCategoria).toEqual([{ clave: 'sin categoria', nombre: 'Sin categoría', monto: 200, porcentaje: 100 }])
  })

  it('gastos mensuales: 6 puntos terminando en el mes, con 0 en los meses sin consumo', () => {
    expect(r.gastosMensuales.map((m) => [m.mes, m.monto])).toEqual([
      [4, 0],
      [5, 0],
      [6, 0],
      [7, 1000],
      [8, 0],
      [9, 8750],
    ])
  })

  it('materiales más utilizados por monto, con cantidad y unidad, y el dado de baja marcado', () => {
    expect(r.masUtilizados.slice(0, 2)).toEqual([
      { insumoId: 'a', nombre: 'Anestesia', monto: 3000, cantidad: 3, unidad: 'unidad', dadoDeBaja: false },
      { insumoId: 'b', nombre: 'Resina', monto: 2500, cantidad: 5, unidad: 'g', dadoDeBaja: false },
    ])
    expect(r.masUtilizados.find((m) => m.insumoId === 'e')).toMatchObject({ monto: 2000, dadoDeBaja: true })
    expect(r.masUtilizados.some((m) => m.insumoId === 'g')).toBe(false)
    expect(r.gasto.incompleto).toEqual({ materialesSinPrecio: 1 })
  })

  it('limita a 10 materiales', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => insumo(`x${i}`))
    const lotesMuchos = muchos.map((x, i) => lote(`lx${i}`, x.id, 100 + i))
    const consumos = lotesMuchos.map((l) => mov('consumo', l.id, 1, iso(2026, 9, 2)))
    const top = resumenReportes(entrada([], consumos, lotesMuchos, muchos), ESTE_MES, LUGAR_1, AHORA)
    expect(top.masUtilizados).toHaveLength(10)
    expect(top.masUtilizados[0].insumoId).toBe('x11')
  })

  it('el resultado no depende del orden de la entrada', () => {
    const invertido = resumenReportes(
      entrada([], [...movimientos].reverse(), [...lotes].reverse(), [...insumos].reverse()),
      ESTE_MES,
      LUGAR_1,
      AHORA,
    )
    expect(invertido.porCategoria).toEqual(r.porCategoria)
    expect(invertido.masUtilizados).toEqual(r.masUtilizados)
    expect(invertido.gasto.valor).toBe(r.gasto.valor)
  })
})
