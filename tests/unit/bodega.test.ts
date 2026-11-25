import { describe, expect, it } from 'vitest'
import {
  bodegaDe,
  bodegasActivas,
  comparteBodega,
  lugaresDeBodega,
  rotuloBodega,
} from '../../src/stores/lugarStore'
import type { Lugar } from '../../src/lib/db'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2 } from '../helpers/tenancy'

const LUGAR_3 = '00000000-0000-4000-8000-000000000013'
const lugar3: Lugar = { ...lugar2, id: LUGAR_3, nombre: 'Box 3', creadoEn: '2026-12-01T00:00:00.000Z' }

describe('bodegas (spec 033 data-model § Bodega)', () => {
  it('sin bodega compartida, cada lugar es su propia bodega (FR-019)', () => {
    const lugares = [lugar1, lugar2]
    expect(bodegaDe(lugar1)).toBe(LUGAR_1)
    expect([...lugaresDeBodega(LUGAR_1, lugares)]).toEqual([LUGAR_1])
    expect(comparteBodega(LUGAR_1, lugares)).toBe(false)
    expect(bodegasActivas(lugares).map((g) => g.map((l) => l.id))).toEqual([[LUGAR_1], [LUGAR_2]])
  })

  it('lugares con el mismo bodegaId comparten; el resto queda aparte', () => {
    const lugares = [
      { ...lugar1, bodegaId: 'b' },
      { ...lugar2, bodegaId: 'b' },
      lugar3,
    ]
    expect(lugaresDeBodega(LUGAR_2, lugares)).toEqual(new Set([LUGAR_1, LUGAR_2]))
    expect(comparteBodega(LUGAR_3, lugares)).toBe(false)
    expect(bodegasActivas(lugares).map((g) => g.map((l) => l.id))).toEqual([
      [LUGAR_1, LUGAR_2],
      [LUGAR_3],
    ])
    expect(rotuloBodega(lugaresDeBodega(LUGAR_1, lugares), lugares)).toBe(
      `${lugar1.nombre} + ${lugar2.nombre}`,
    )
  })

  it('un lugar desactivado no cuenta en la bodega', () => {
    const lugares = [
      { ...lugar1, bodegaId: 'b' },
      { ...lugar2, bodegaId: 'b', desactivadoEn: '2026-11-01T00:00:00.000Z' },
    ]
    expect([...lugaresDeBodega(LUGAR_1, lugares)]).toEqual([LUGAR_1])
    expect([...lugaresDeBodega(LUGAR_2, lugares)]).toEqual([LUGAR_2])
  })

  it('un lugar desconocido es su propia bodega', () => {
    expect([...lugaresDeBodega('otro', [lugar1])]).toEqual(['otro'])
  })
})
