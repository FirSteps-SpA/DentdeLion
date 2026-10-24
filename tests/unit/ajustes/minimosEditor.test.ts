import { describe, expect, it } from 'vitest'
import type { Insumo, MinimoLugar } from '../../../src/lib/db'
import { filasMinimos } from '../../../src/features/ajustes/lib/minimosEditor'
import { lugar1, lugar2 } from '../../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

/** Spec 019 T020 (FR-014–FR-019, research.md R4, data-model.md `FilaMinimo`). */
function insumo(id: string, nombre: string, overrides: Partial<Insumo> = {}): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'Cirugía',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: 5,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function minimo(insumoId: string, lugarId: string, stockMinimo: number | null): MinimoLugar {
  return { insumoId, lugarId, tenantId: TENANT_1, stockMinimo, sincronizado: true }
}

const guantes = insumo('g', 'Guantes de nitrilo')
const anestesia = insumo('a', 'Anestesia local', { stockMinimo: null })
const bisturi = insumo('b', 'Bisturí')

describe('filasMinimos', () => {
  it('con un solo lugar activo edita el mínimo del catálogo', () => {
    const filas = filasMinimos([guantes], [minimo('g', LUGAR_1, 9)], LUGAR_1, [lugar1], '')
    expect(filas).toEqual([{ insumo: guantes, modo: 'catalogo', minimo: 5 }])
  })

  it('un segundo lugar desactivado no cuenta como varios lugares', () => {
    const desactivado = { ...lugar2, desactivadoEn: '2026-05-01T00:00:00.000Z' }
    const filas = filasMinimos([guantes], [], LUGAR_1, [lugar1, desactivado], '')
    expect(filas[0].modo).toBe('catalogo')
  })

  it('con varios lugares y uno elegido muestra el que rige en ese lugar y su origen', () => {
    const filas = filasMinimos(
      [guantes, anestesia, bisturi],
      [minimo('g', LUGAR_1, 12), minimo('b', LUGAR_1, null), minimo('a', LUGAR_2, 3)],
      LUGAR_1,
      [lugar1, lugar2],
      '',
    )
    expect(filas).toEqual([
      { insumo: anestesia, modo: 'lugar', minimo: null, origen: 'catalogo' },
      { insumo: bisturi, modo: 'lugar', minimo: 5, origen: 'catalogo' },
      { insumo: guantes, modo: 'lugar', minimo: 12, origen: 'lugar' },
    ])
  })

  it('en "Todos" lista el mínimo de cada lugar activo, sin los desactivados', () => {
    const tercero = { ...lugar2, id: 'l3', nombre: 'Cerrado', desactivadoEn: 'x' }
    const filas = filasMinimos(
      [guantes],
      [minimo('g', LUGAR_2, 20)],
      'todos',
      [lugar1, lugar2, tercero],
      '',
    )
    expect(filas).toEqual([
      {
        insumo: guantes,
        modo: 'todos',
        porLugar: [
          { lugar: lugar1, minimo: 5, origen: 'catalogo' },
          { lugar: lugar2, minimo: 20, origen: 'lugar' },
        ],
      },
    ])
  })

  it('ordena por nombre y deja fuera los dados de baja', () => {
    const bajado = insumo('z', 'Algodón', { dadoDeBajaEn: '2026-09-01T00:00:00.000Z' })
    const filas = filasMinimos([guantes, bisturi, bajado, anestesia], [], LUGAR_1, [lugar1], '')
    expect(filas.map((f) => f.insumo.nombre)).toEqual([
      'Anestesia local',
      'Bisturí',
      'Guantes de nitrilo',
    ])
  })

  it('busca sin distinguir mayúsculas ni tildes', () => {
    const buscar = (texto: string) =>
      filasMinimos([guantes, anestesia, bisturi], [], LUGAR_1, [lugar1], texto).map(
        (f) => f.insumo.nombre,
      )
    expect(buscar('guantes')).toEqual(['Guantes de nitrilo'])
    expect(buscar('GUANTÉS')).toEqual(['Guantes de nitrilo'])
    expect(buscar('BISTURI')).toEqual(['Bisturí'])
    expect(buscar('local')).toEqual(['Anestesia local'])
    expect(buscar('   ')).toHaveLength(3)
    expect(buscar('')).toHaveLength(3)
  })
})
