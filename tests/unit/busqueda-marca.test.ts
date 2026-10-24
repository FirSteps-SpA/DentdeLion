import { describe, expect, it } from 'vitest'
import type { Insumo, Marca } from '../../src/lib/db'
import { searchInsumosPorTexto } from '../../src/stores/inventoryStore'
import { mapaMarcas } from '../../src/features/marcas/lib/marcas'
import { TENANT_1 } from '../helpers/tenancy'

/** Spec 023 T036 (FR-013, R9; SC-007). */
const insumo = (id: string, nombre: string, marcaId: string | null = null) =>
  ({ id, nombre, marcaId }) as Insumo

function marca(id: string, nombre: string, extra: Partial<Marca> = {}): Marca {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    creadoPor: null,
    creadoEn: '2026-10-24T10:00:00.000Z',
    desactivadoEn: null,
    eliminadoEn: null,
    sincronizado: true,
    ...extra,
  }
}

const insumos = [
  insumo('z350', 'Composite Z350', 'tres'),
  insumo('adhesivo', 'Adhesivo Single Bond', 'tres'),
  insumo('emax', 'Bloque e.max', 'ivoclar'),
  insumo('guantes', 'Guantes de nitrilo'),
  insumo('vieja', 'Cemento viejo', 'eliminada'),
]
const marcas = mapaMarcas([
  marca('tres', '3M'),
  marca('ivoclar', 'Ivoclár'),
  marca('eliminada', 'Cementos SA', { eliminadoEn: '2026-10-01T00:00:00.000Z' }),
])
const ids = (lista: Insumo[]) => lista.map((i) => i.id)

describe('searchInsumosPorTexto — marca (spec 023)', () => {
  it('"3m" encuentra todos los insumos de esa marca', () => {
    expect(ids(searchInsumosPorTexto(insumos, '3m', marcas))).toEqual(['z350', 'adhesivo'])
  })

  it('compara la marca sin tildes ni mayúsculas', () => {
    expect(ids(searchInsumosPorTexto(insumos, 'IVOCLAR', marcas))).toEqual(['emax'])
  })

  it('sigue encontrando por nombre, junto con los de la marca', () => {
    expect(ids(searchInsumosPorTexto(insumos, 'composite', marcas))).toEqual(['z350'])
  })

  it('una marca eliminada no cuenta', () => {
    expect(ids(searchInsumosPorTexto(insumos, 'cementos sa', marcas))).toEqual([])
  })

  it('sin mapa se comporta como antes (solo por nombre)', () => {
    expect(ids(searchInsumosPorTexto(insumos, '3m'))).toEqual([])
    expect(ids(searchInsumosPorTexto(insumos, 'guantes'))).toEqual(['guantes'])
  })
})
