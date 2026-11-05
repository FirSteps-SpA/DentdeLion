import { describe, expect, it } from 'vitest'
import {
  filasStockPorLote,
  stockVencidoEnLugar,
  validarCantidadLote,
} from '../../../src/features/insumos/lib/ajusteStock'
import type { Lugar, Movimiento } from '../../../src/lib/db'
import { ingresoCompra, insumoCompra, loteCompra } from '../../helpers/compras'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

const HOY = new Date('2026-11-05T12:00:00Z')
const VENCIDO = '2026-10-01'
const VIGENTE = '2027-06-01'

const insumo = insumoCompra({ id: 'i1', caduca: true })

function lugar(id: string, nombre: string): Lugar {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    desactivadoEn: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
    proveedorPredeterminadoId: null,
  }
}

function consumo(loteId: string, cantidad: number, lugarId = LUGAR_1): Movimiento {
  return { ...ingresoCompra(loteId, cantidad, lugarId), id: `c-${loteId}`, tipo: 'consumo' }
}

describe('stockVencidoEnLugar (spec 024 R2)', () => {
  const vencido = loteCompra({ id: 'lv', fechaCaducidad: VENCIDO })
  const vigente = loteCompra({ id: 'lok', fechaCaducidad: VIGENTE })

  it('devuelve solo los lotes vencidos con stock en el lugar', () => {
    const movimientos = [ingresoCompra('lv', 4), ingresoCompra('lok', 2)]
    expect(stockVencidoEnLugar(insumo, [vencido, vigente], movimientos, LUGAR_1, HOY)).toEqual([
      { lote: vencido, stock: 4 },
    ])
  })

  it('ignora el stock vencido de otro lugar', () => {
    const movimientos = [ingresoCompra('lv', 4, LUGAR_2)]
    expect(stockVencidoEnLugar(insumo, [vencido], movimientos, LUGAR_1, HOY)).toEqual([])
  })

  it('un lote vencido ya en 0 no aparece', () => {
    const movimientos = [ingresoCompra('lv', 4), consumo('lv', 4)]
    expect(stockVencidoEnLugar(insumo, [vencido], movimientos, LUGAR_1, HOY)).toEqual([])
  })

  it('un insumo que no caduca nunca tiene vencidos', () => {
    const noCaduca = { ...insumo, caduca: false }
    expect(
      stockVencidoEnLugar(noCaduca, [vencido], [ingresoCompra('lv', 4)], LUGAR_1, HOY),
    ).toEqual([])
  })
})

describe('validarCantidadLote (spec 024)', () => {
  it('acepta 0 y enteros positivos', () => {
    expect(validarCantidadLote(0, { permiteDecimales: false })).toBeNull()
    expect(validarCantidadLote(3, { permiteDecimales: false })).toBeNull()
  })

  it('rechaza negativos y NaN', () => {
    expect(validarCantidadLote(-1, { permiteDecimales: true })).toBe(
      'Ingresa una cantidad de 0 o más.',
    )
    expect(validarCantidadLote(Number.NaN, { permiteDecimales: true })).toBe(
      'Ingresa una cantidad de 0 o más.',
    )
  })

  it('rechaza decimales solo si la unidad no los admite', () => {
    expect(validarCantidadLote(1.5, { permiteDecimales: false })).toBe(
      'Esta unidad no admite decimales.',
    )
    expect(validarCantidadLote(1.5, { permiteDecimales: true })).toBeNull()
  })
})

describe('filasStockPorLote (spec 024 R4)', () => {
  const lugares = [lugar(LUGAR_1, 'Centro'), lugar(LUGAR_2, 'Norte')]
  const nuevo = loteCompra({ id: 'l-nuevo', fechaCaducidad: VIGENTE, creadoEn: '2026-03-01' })
  const viejo = loteCompra({ id: 'l-viejo', fechaCaducidad: VENCIDO, creadoEn: '2026-02-01' })
  const sinFecha = loteCompra({ id: 'l-sin', fechaCaducidad: null, creadoEn: '2026-01-01' })

  it('en un lugar lista sus lotes por vencimiento, también los que están en 0', () => {
    const movimientos = [
      ingresoCompra('l-nuevo', 2),
      ingresoCompra('l-viejo', 4),
      consumo('l-viejo', 4),
      ingresoCompra('l-sin', 1),
    ]
    const filas = filasStockPorLote(
      insumo,
      [sinFecha, nuevo, viejo],
      movimientos,
      LUGAR_1,
      lugares,
      HOY,
    )
    expect(filas.map((f) => [f.lote.id, f.stock, f.vencido, f.nombreLugar])).toEqual([
      ['l-viejo', 0, true, null],
      ['l-nuevo', 2, false, null],
      ['l-sin', 1, false, null],
    ])
    expect(filas.every((f) => f.lugarId === LUGAR_1)).toBe(true)
  })

  it('no muestra lotes de otro lugar sin movimientos ahí', () => {
    const otro = loteCompra({ id: 'l-otro', lugarId: LUGAR_2, fechaCaducidad: VIGENTE })
    const filas = filasStockPorLote(
      insumo,
      [otro],
      [ingresoCompra('l-otro', 3, LUGAR_2)],
      LUGAR_1,
      lugares,
      HOY,
    )
    expect(filas).toEqual([])
  })

  it('en "Todos" da un renglón por lote y lugar con stock, con el nombre del lugar', () => {
    const movimientos = [
      ingresoCompra('l-nuevo', 2, LUGAR_1),
      ingresoCompra('l-nuevo', 5, LUGAR_2),
      ingresoCompra('l-viejo', 4, LUGAR_1),
      consumo('l-viejo', 4, LUGAR_1),
    ]
    const filas = filasStockPorLote(insumo, [nuevo, viejo], movimientos, 'todos', lugares, HOY)
    expect(filas.map((f) => [f.lote.id, f.lugarId, f.nombreLugar, f.stock])).toEqual([
      ['l-nuevo', LUGAR_1, 'Centro', 2],
      ['l-nuevo', LUGAR_2, 'Norte', 5],
    ])
  })

  it('en empate de vencimiento, el más antiguo primero', () => {
    const a = loteCompra({ id: 'a', fechaCaducidad: VIGENTE, creadoEn: '2026-05-01' })
    const b = loteCompra({ id: 'b', fechaCaducidad: VIGENTE, creadoEn: '2026-04-01' })
    const filas = filasStockPorLote(
      insumo,
      [a, b],
      [ingresoCompra('a', 1), ingresoCompra('b', 1)],
      LUGAR_1,
      lugares,
      HOY,
    )
    expect(filas.map((f) => f.lote.id)).toEqual(['b', 'a'])
  })
})
