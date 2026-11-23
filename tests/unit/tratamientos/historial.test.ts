import { describe, expect, it } from 'vitest'
import type { TratamientoRealizado } from '../../../src/lib/db'
import {
  categoriaDeRegistro,
  filtrarPorCategoria,
  inicioPeriodo,
  opcionesCategoriaHistorial,
  registrosDelPeriodo,
  totalesHistorial,
} from '../../../src/features/tratamientos/lib/historial'
import { FILTRO_SIN_CATEGORIA } from '../../../src/features/tratamientos/lib/categorias'
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
    categoriaId: null,
    categoriaNombre: null,
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
      gananciaProfesional: 18000,
      costoMateriales: 4480,
      gananciaEstimada: 14520,
      sinMonto: 1,
    })
  })
})

/** Spec 026 T028 (FR-014, US3-1, US3-2, US3-4). */
describe('historial por categoría (spec 026)', () => {
  const t = new Date(2026, 9, 15, 10)
  const registros = [
    registro('a', t, { categoriaId: 'eval', categoriaNombre: 'Evaluación', precio: 20000, porcentajeProfesional: 50 }),
    registro('b', t, { categoriaId: 'eval', categoriaNombre: 'Evaluación', precio: 20000, porcentajeProfesional: 50, anuladoEn: 'x', anuladoPor: 'p1' }),
    registro('c', t, { categoriaId: 'rest', categoriaNombre: 'Restauración' }),
    registro('d', t),
  ]
  const categorias = [
    { id: 'eval', tenantId: TENANT_1, nombre: 'Evaluación y diagnóstico', creadoPor: null, creadoEn: '', desactivadoEn: null, sincronizado: true, rechazadoEn: null },
  ]

  it('cada registro muestra el nombre que tenía al registrarse', () => {
    expect(categoriaDeRegistro(registros[0])).toBe('Evaluación')
    expect(categoriaDeRegistro(registros[3])).toBe('Sin categoría')
  })

  it('opciones: por identidad con el nombre actual (o el registrado si ya no está), y "Sin categoría" al final', () => {
    expect(opcionesCategoriaHistorial(registros, categorias)).toEqual([
      { valor: 'eval', nombre: 'Evaluación y diagnóstico' },
      { valor: 'rest', nombre: 'Restauración' },
      { valor: FILTRO_SIN_CATEGORIA, nombre: 'Sin categoría' },
    ])
  })

  it('el filtro deja los totales de la categoría, sin anulados', () => {
    const evaluacion = filtrarPorCategoria(registros, 'eval')
    expect(evaluacion.map((r) => r.id)).toEqual(['a', 'b'])
    expect(totalesHistorial(evaluacion)).toMatchObject({
      cantidad: 1,
      precios: 20000,
      gananciaProfesional: 10000,
    })
    expect(filtrarPorCategoria(registros, FILTRO_SIN_CATEGORIA).map((r) => r.id)).toEqual(['d'])
    expect(filtrarPorCategoria(registros, '')).toHaveLength(4)
  })
})
