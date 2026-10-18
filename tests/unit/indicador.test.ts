import { describe, expect, it } from 'vitest'
import type { CambioInsumo, Categoria, Movimiento } from '../../src/lib/db'
import {
  agruparPendientes,
  calcularIndicador,
  type EntradaIndicador,
} from '../../src/lib/sync/indicador'

const AHORA = Date.parse('2026-10-18T12:00:00.000Z')
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString()

function movimiento(id: string, usuarioId: string, creadoEn = haceHoras(1), sincronizado = false): Movimiento {
  return {
    id,
    tipo: 'consumo',
    loteId: 'l1',
    cantidad: 1,
    usuarioId,
    movimientoOrigenId: null,
    creadoEn,
    sincronizado,
  }
}

function cambio(id: string, usuarioId: string, rechazadoEn: string | null = null): CambioInsumo {
  return {
    id,
    insumoId: 'i1',
    campo: 'nombre',
    valorAnterior: 'a',
    valorNuevo: 'b',
    usuarioId,
    creadoEn: haceHoras(1),
    sincronizado: false,
    rechazadoEn,
  }
}

function categoria(id: string, creadoPor: string): Categoria {
  return {
    id,
    nombre: id,
    creadoPor,
    creadoEn: haceHoras(1),
    sincronizado: false,
    rechazadoEn: null,
    desactivadoEn: null,
  }
}

function entrada(overrides: Partial<EntradaIndicador> = {}): EntradaIndicador {
  return {
    usuarioId: 'B',
    pendientes: [],
    ultimoResultado: 'ok',
    enLinea: true,
    horasAviso: 24,
    ahora: AHORA,
    usuariosConocidos: [],
    ...overrides,
  }
}

describe('calcularIndicador — estados (spec 012 FR-002/003, US1)', () => {
  it('sin pendientes y ciclo ok: sincronizado', () => {
    expect(calcularIndicador(entrada()).estado).toBe('sincronizado')
  })

  it('suma los tres tipos de pendientes propios', () => {
    const pendientes = agruparPendientes(
      [movimiento('m1', 'B'), movimiento('m2', 'B'), movimiento('m3', 'B', haceHoras(1), true)],
      [cambio('c1', 'B'), cambio('c2', 'B', haceHoras(1))],
      [categoria('k1', 'B')],
    )
    const indicador = calcularIndicador(entrada({ pendientes }))

    expect(indicador).toMatchObject({
      estado: 'pendientes',
      propios: 4,
      desglosePropio: { movimientos: 2, cambiosInsumo: 1, categorias: 1 },
    })
  })

  it('no cuenta cambios rechazados', () => {
    const pendientes = agruparPendientes([], [cambio('c1', 'B', haceHoras(1))], [])

    expect(calcularIndicador(entrada({ pendientes })).estado).toBe('sincronizado')
  })

  it('prioridad: error > sin conexión > pendientes', () => {
    const pendientes = agruparPendientes([movimiento('m1', 'B')], [], [])

    expect(calcularIndicador(entrada({ pendientes, ultimoResultado: 'error', enLinea: false })).estado).toBe('error')
    expect(calcularIndicador(entrada({ pendientes, ultimoResultado: 'sin-red' })).estado).toBe('sin-conexion')
    expect(calcularIndicador(entrada({ pendientes })).estado).toBe('pendientes')
  })

  it('sin red según el navegador aunque el último ciclo fuera ok', () => {
    expect(calcularIndicador(entrada({ enLinea: false })).estado).toBe('sin-conexion')
  })

  it('una sesión vencida es error con motivo sesion', () => {
    expect(calcularIndicador(entrada({ ultimoResultado: 'sesion' }))).toMatchObject({
      estado: 'error',
      motivoError: 'sesion',
    })
    expect(calcularIndicador(entrada({ ultimoResultado: 'error' })).motivoError).toBe('servidor')
  })

  it('desde 100 pendientes la etiqueta es 99+', () => {
    const movimientos = Array.from({ length: 100 }, (_, i) => movimiento(`m${i}`, 'B'))
    const indicador = calcularIndicador(entrada({ pendientes: agruparPendientes(movimientos, [], []) }))

    expect(indicador.propios).toBe(100)
    expect(indicador.etiqueta).toBe('99+')
  })
})

describe('calcularIndicador — pendientes antiguos (FR-010, US4)', () => {
  it('25 h con umbral 24: alerta con el más antiguo', () => {
    const pendientes = agruparPendientes(
      [movimiento('m1', 'B', haceHoras(25)), movimiento('m2', 'B', haceHoras(30))],
      [],
      [],
    )
    const indicador = calcularIndicador(entrada({ pendientes }))

    expect(indicador).toMatchObject({ alerta: true, antiguos: 2, masAntiguoEn: haceHoras(30) })
  })

  it('23 h con umbral 24: sin alerta', () => {
    const pendientes = agruparPendientes([movimiento('m1', 'B', haceHoras(23))], [], [])

    expect(calcularIndicador(entrada({ pendientes })).alerta).toBe(false)
  })

  it('un creadoEn en el futuro (reloj atrasado) no da antigüedad negativa ni alerta', () => {
    const pendientes = agruparPendientes([movimiento('m1', 'B', haceHoras(-48))], [], [])

    expect(calcularIndicador(entrada({ pendientes, horasAviso: 1 }))).toMatchObject({
      alerta: false,
      antiguos: 0,
    })
  })
})

describe('calcularIndicador — pendientes de otro usuario (FR-012, US5)', () => {
  it('no cuentan como propios ni cambian el estado, y se nombran', () => {
    const pendientes = agruparPendientes([movimiento('m1', 'A')], [], [])
    const indicador = calcularIndicador(
      entrada({ pendientes, usuariosConocidos: [{ id: 'A', nombre: 'Ana', vistoEn: 'x' }] }),
    )

    expect(indicador.estado).toBe('sincronizado')
    expect(indicador.propios).toBe(0)
    expect(indicador.ajenos).toEqual([{ usuarioId: 'A', nombre: 'Ana', total: 1, antiguo: false }])
  })

  it('sin nombre conocido: "otro usuario"', () => {
    const pendientes = agruparPendientes([movimiento('m1', 'A')], [], [])

    expect(calcularIndicador(entrada({ pendientes })).ajenos[0].nombre).toBe('otro usuario')
  })

  it('un ajeno antiguo activa la alerta (aclaración 2)', () => {
    const pendientes = agruparPendientes([movimiento('m1', 'A', haceHoras(30))], [], [])
    const indicador = calcularIndicador(entrada({ pendientes }))

    expect(indicador.estado).toBe('sincronizado')
    expect(indicador.alerta).toBe(true)
    expect(indicador.ajenos[0].antiguo).toBe(true)
  })
})
