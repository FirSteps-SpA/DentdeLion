import { beforeEach, describe, expect, it } from 'vitest'
import {
  getLugarParaEscribir,
  hayVariosLugares,
  lugarParaEscribirOFallar,
  lugaresActivos,
  resolverLugarActivo,
  useLugarStore,
} from '../../src/stores/lugarStore'
import { lugar1, lugar2, usarDosLugares, usarLugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2 } from '../helpers/tenancy'

const desactivado = { ...lugar2, desactivadoEn: '2026-10-01T00:00:00.000Z' }

describe('resolverLugarActivo (spec 014 R10)', () => {
  it('sin lugares no hay lugar activo', () => {
    expect(resolverLugarActivo([], LUGAR_1)).toBeNull()
  })

  it('respeta el lugar guardado si sigue activo', () => {
    expect(resolverLugarActivo([lugar1, lugar2], LUGAR_2)).toBe(LUGAR_2)
  })

  it('vuelve al principal (el más antiguo) si el guardado no existe o está desactivado', () => {
    expect(resolverLugarActivo([lugar2, lugar1], 'otro')).toBe(LUGAR_1)
    expect(resolverLugarActivo([lugar1, desactivado], LUGAR_2)).toBe(LUGAR_1)
    expect(resolverLugarActivo([lugar2, lugar1], undefined)).toBe(LUGAR_1)
  })

  it('"Todos" solo con 2 o más lugares activos', () => {
    expect(resolverLugarActivo([lugar1, lugar2], 'todos')).toBe('todos')
    expect(resolverLugarActivo([lugar1, desactivado], 'todos')).toBe(LUGAR_1)
  })
})

describe('lugares activos', () => {
  it('ordena por antigüedad y excluye los desactivados', () => {
    expect(lugaresActivos([lugar2, desactivado, lugar1]).map((l) => l.id)).toEqual([
      LUGAR_1,
      LUGAR_2,
    ])
    expect(hayVariosLugares([lugar1, desactivado])).toBe(false)
    expect(hayVariosLugares([lugar1, lugar2])).toBe(true)
  })
})

describe('lugar para escribir (FR-010/FR-014)', () => {
  beforeEach(() => useLugarStore.setState({ lugares: [], lugarActivoId: null }))

  it('usa el lugar activo', () => {
    usarDosLugares(LUGAR_2)
    expect(getLugarParaEscribir()).toBe(LUGAR_2)
    usarLugar1()
    expect(getLugarParaEscribir()).toBe(LUGAR_1)
  })

  it('en "Todos" exige un lugar explícito', () => {
    usarDosLugares('todos')
    expect(getLugarParaEscribir()).toBeNull()
    expect(getLugarParaEscribir(LUGAR_2)).toBe(LUGAR_2)
    expect(() => lugarParaEscribirOFallar()).toThrow(/Elige un lugar/)
  })
})
