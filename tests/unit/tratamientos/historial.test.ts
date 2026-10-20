import { describe, expect, it } from 'vitest'
import type { TratamientoRealizado } from '../../../src/lib/db'
import {
  inicioPeriodo,
  registrosDelPeriodo,
  totalesHistorial,
} from '../../../src/features/tratamientos/lib/historial'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

function registro(id: string, creadoEn: Date, extra: Partial<TratamientoRealizado> = {}): TratamientoRealizado {
  return {
    id,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    tratamientoId: 't1',
    nombre: 'Restauración',
    precio: 45000,
    porcentajeProfesional: 40,
    materiales: [],
    costoMateriales: 3480,
    costoCompleto: true,
    gananciaEstimada: 14520,
    usuarioId: 'p1',
    creadoEn: creadoEn.toISOString(),
    anuladoEn: null,
    anuladoPor: null,
    sincronizado: true,
    anulacionSincronizada: true,
    ...extra,
  }
}

// Jueves 15 de octubre de 2026, 15:00 hora local (lunes 12).
const ahora = new Date(2026, 9, 15, 15, 0)

describe('períodos del historial (spec 016 R8)', () => {
  it('hoy, semana desde el lunes y mes desde el día 1, en hora local', () => {
    expect(inicioPeriodo('hoy', ahora)).toEqual(new Date(2026, 9, 15))
    expect(inicioPeriodo('semana', ahora)).toEqual(new Date(2026, 9, 12))
    expect(inicioPeriodo('mes', ahora)).toEqual(new Date(2026, 9, 1))
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(inicioPeriodo('semana', new Date(2026, 9, 18, 10))).toEqual(new Date(2026, 9, 12))
  })

  it('filtra por período y lugar, del más reciente al más antiguo', () => {
    const registros = [
      registro('a', new Date(2026, 9, 15, 9)),
      registro('b', new Date(2026, 9, 13, 9)),
      registro('e', new Date(2026, 9, 11, 9)),
      registro('c', new Date(2026, 9, 2, 9)),
      registro('d', new Date(2026, 9, 15, 11), { lugarId: LUGAR_2 }),
    ]
    expect(registrosDelPeriodo(registros, 'hoy', LUGAR_1, ahora).map((r) => r.id)).toEqual(['a'])
    expect(registrosDelPeriodo(registros, 'semana', LUGAR_1, ahora).map((r) => r.id)).toEqual(['a', 'b'])
    expect(registrosDelPeriodo(registros, 'mes', null, ahora).map((r) => r.id)).toEqual(['d', 'a', 'b', 'e', 'c'])
  })
})

describe('totales (FR-019)', () => {
  it('excluyen anulados; los sin precio no suman a producción ni a ganancia', () => {
    const totales = totalesHistorial([
      registro('a', ahora),
      registro('b', ahora, { anuladoEn: ahora.toISOString(), anuladoPor: 'p1' }),
      registro('c', ahora, { precio: null, gananciaEstimada: null, costoMateriales: 1000 }),
    ])
    expect(totales).toEqual({
      cantidad: 2,
      precios: 45000,
      costoMateriales: 4480,
      gananciaEstimada: 14520,
      sinMonto: 1,
    })
  })
})
