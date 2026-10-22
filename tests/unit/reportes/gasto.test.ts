import { describe, expect, it } from 'vitest'
import { normalizarMovimientos } from '../../../src/features/insumos/lib/stock'
import { consumosValorizados, indiceCostos } from '../../../src/features/reportes/lib/gasto'
import {
  LUGAR_1,
  LUGAR_2,
  cambioPrecio,
  conversion,
  deshacer,
  insumo,
  iso,
  lote,
  mov,
} from './fixtures'

/**
 * Spec 017 T008 (research.md R2, FR-004, Clarifications Q1): el gasto es lo
 * consumido, valorizado al costo de su lote, neto de reversiones imputadas al
 * consumo original.
 */
const anestesia = insumo('i1')
const resina = insumo('i2', { categoria: 'Restauración' })

describe('indiceCostos', () => {
  it('usa el precio vigente del lote, con correcciones', () => {
    const l = lote('l1', 'i1', 650)
    const indice = indiceCostos([l], [anestesia], [cambioPrecio('l1', 700, iso(2026, 1))], [])
    expect(indice.costoPorLote.get('l1')).toBe(700)
    expect(indice.insumoPorLote.get('l1')?.id).toBe('i1')
  })

  it('divide por el contenido de la presentación y respeta un lote sin precio', () => {
    const caja = lote('l1', 'i1', 32500, { contenido: 50 })
    const sinPrecio = lote('l2', 'i1', null)
    const indice = indiceCostos([caja, sinPrecio], [anestesia], [], [])
    expect(indice.costoPorLote.get('l1')).toBe(650)
    expect(indice.costoPorLote.get('l2')).toBeNull()
  })

  it('convierte el costo a la unidad de consumo actual tras una conversión', () => {
    const guantes = insumo('i3', { unidadMedida: 'unidad' })
    const l = lote('l3', 'i3', 5000, { unidadConsumo: 'caja', contenido: 1 })
    const indice = indiceCostos([l], [guantes], [], [conversion('i3', 'caja', 'unidad', 50, iso(2026, 2))])
    expect(indice.costoPorLote.get('l3')).toBe(100)
  })
})

describe('consumosValorizados', () => {
  const l1 = lote('l1', 'i1', 650)
  const l2 = lote('l2', 'i2', 1200)
  const indice = indiceCostos([l1, l2], [anestesia, resina], [], [])

  it('valoriza cada consumo al costo de su lote e ignora ingresos y traslados', () => {
    const movimientos = [
      mov('ingreso', 'l1', 50, iso(2026, 8, 1)),
      mov('consumo', 'l1', 2, iso(2026, 9, 3)),
      mov('consumo', 'l2', 3, iso(2026, 9, 4)),
      mov('traslado_salida', 'l1', 5, iso(2026, 9, 5)),
      mov('traslado_entrada', 'l1', 5, iso(2026, 9, 5), { lugarId: LUGAR_2 }),
    ]
    const consumos = consumosValorizados(movimientos, indice, 'todos')
    expect(consumos.map((c) => c.monto)).toEqual([1300, 3600])
    expect(consumos[1]).toMatchObject({ insumoId: 'i2', lugarId: LUGAR_1, cantidad: 3 })
  })

  it('netea el deshacer en la fecha y el lugar del consumo aunque sea de otro mes', () => {
    const consumo = mov('consumo', 'l1', 4, iso(2026, 8, 30))
    const parcial = mov('consumo', 'l1', 3, iso(2026, 8, 30))
    const movimientos = [consumo, parcial, deshacer(consumo, iso(2026, 9, 2))]
    const consumos = consumosValorizados(movimientos, indice, 'todos')
    expect(consumos).toHaveLength(1)
    expect(consumos[0]).toMatchObject({ movimientoId: parcial.id, creadoEn: parcial.creadoEn, monto: 1950 })
  })

  it('deja monto null en lotes sin precio', () => {
    const indiceSinPrecio = indiceCostos([lote('l9', 'i1', null)], [anestesia], [], [])
    const consumos = consumosValorizados([mov('consumo', 'l9', 1, iso(2026, 9))], indiceSinPrecio, 'todos')
    expect(consumos[0].monto).toBeNull()
  })

  it('filtra por el lugar del consumo', () => {
    const movimientos = [
      mov('consumo', 'l1', 1, iso(2026, 9)),
      mov('consumo', 'l1', 2, iso(2026, 9), { lugarId: LUGAR_2 }),
    ]
    expect(consumosValorizados(movimientos, indice, LUGAR_2).map((c) => c.cantidad)).toEqual([2])
    expect(consumosValorizados(movimientos, indice, 'todos')).toHaveLength(2)
  })

  it('valoriza en la unidad actual tras una conversión (cantidad normalizada × costo convertido)', () => {
    const guantes = insumo('i3', { unidadMedida: 'unidad' })
    const l = lote('l3', 'i3', 5000, { unidadConsumo: 'caja', contenido: 1 })
    const cambios = [conversion('i3', 'caja', 'unidad', 50, iso(2026, 2))]
    const crudos = [mov('consumo', 'l3', 1, iso(2026, 1), { unidad: 'caja' })]
    const normalizados = normalizarMovimientos(crudos, [l], [guantes], cambios)
    const consumos = consumosValorizados(normalizados, indiceCostos([l], [guantes], [], cambios), 'todos')
    expect(consumos[0]).toMatchObject({ cantidad: 50, monto: 5000 })
  })

  it('da el mismo resultado con la entrada desordenada', () => {
    const consumo = mov('consumo', 'l1', 4, iso(2026, 8, 30))
    const movimientos = [mov('consumo', 'l2', 1, iso(2026, 9)), consumo, deshacer(consumo, iso(2026, 9, 2))]
    const ordenar = (xs: { movimientoId: string }[]) =>
      [...xs].sort((a, b) => a.movimientoId.localeCompare(b.movimientoId))
    expect(ordenar(consumosValorizados([...movimientos].reverse(), indice, 'todos'))).toEqual(
      ordenar(consumosValorizados(movimientos, indice, 'todos')),
    )
  })
})
