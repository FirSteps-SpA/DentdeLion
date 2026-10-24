import { describe, expect, it } from 'vitest'
import {
  activosDe,
  buscarEnCatalogo,
  coincidenciaEn,
  desactivadosDe,
  ordenarCatalogo,
  type ItemCatalogo,
} from '../../src/lib/catalogo'

/** Spec 023 T012 (research.md R7) — helpers comunes a proveedores y marcas. */
function item(id: string, nombre: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return { id, nombre, desactivadoEn: null, eliminadoEn: null, ...extra }
}

const catalogo = [
  item('b', 'Ivoclar'),
  item('a', '3M'),
  item('d', 'Dentsply', { desactivadoEn: '2026-10-01T00:00:00.000Z' }),
  item('e', 'Élite', { eliminadoEn: '2026-10-01T00:00:00.000Z' }),
  item('c', 'élan'),
]

describe('catálogo genérico (spec 023)', () => {
  it('ordena por nombre sin tildes ni mayúsculas, con desempate por id', () => {
    expect(ordenarCatalogo(catalogo).map((i) => i.id)).toEqual(['a', 'd', 'c', 'e', 'b'])
    expect(
      ordenarCatalogo([item('z', 'GC'), item('y', 'gc')]).map((i) => i.id),
    ).toEqual(['y', 'z'])
  })

  it('activos y desactivados excluyen los eliminados', () => {
    expect(activosDe(catalogo).map((i) => i.id)).toEqual(['a', 'c', 'b'])
    expect(desactivadosDe(catalogo).map((i) => i.id)).toEqual(['d'])
  })

  it('busca entre los activos sin distinguir mayúsculas ni tildes', () => {
    expect(buscarEnCatalogo(catalogo, 'ELAN').map((i) => i.id)).toEqual(['c'])
    expect(buscarEnCatalogo(catalogo, '  3m ').map((i) => i.id)).toEqual(['a'])
    expect(buscarEnCatalogo(catalogo, 'dents')).toEqual([])
    expect(buscarEnCatalogo(catalogo, '')).toHaveLength(3)
  })

  it('encuentra la coincidencia por clave: activa, desactivada o ninguna', () => {
    expect(coincidenciaEn(catalogo, ' 3m ')).toEqual({ tipo: 'activo', item: catalogo[1] })
    expect(coincidenciaEn(catalogo, 'dentsply')).toEqual({
      tipo: 'desactivado',
      item: catalogo[2],
    })
    expect(coincidenciaEn(catalogo, 'elite')).toEqual({ tipo: 'ninguna' })
    expect(coincidenciaEn(catalogo, '   ')).toEqual({ tipo: 'ninguna' })
  })
})
