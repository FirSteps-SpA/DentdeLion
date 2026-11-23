import { describe, expect, it } from 'vitest'
import type { CambioTratamiento, Tratamiento } from '../../../src/lib/db'
import {
  claveCategoriaLugar,
  porcentajeAplicable,
  porcentajesPorCategoria,
  porcentajesPorLugar,
  proyectarTratamientos,
} from '../../../src/features/tratamientos/lib/proyeccion'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

/** Spec 026 (research.md R3–R5). */
const fila: Tratamiento = {
  id: 't1',
  tenantId: TENANT_1,
  creadoPor: 'admin',
  creadoEn: '2026-10-01T00:00:00.000Z',
  sincronizado: true,
  rechazadoEn: null,
}

const EVALUACION = 'cat-evaluacion'
const RESTAURACION = 'cat-restauracion'

let n = 0
function cambio(
  campo: CambioTratamiento['campo'],
  valorNuevo: CambioTratamiento['valorNuevo'],
  creadoEn: string,
  extra: Partial<CambioTratamiento> = {},
): CambioTratamiento {
  n += 1
  const sinTratamiento = campo === 'porcentajeProfesional' || campo === 'porcentajeCategoria'
  return {
    id: `c${String(n).padStart(3, '0')}`,
    tenantId: TENANT_1,
    tratamientoId: sinTratamiento ? null : 't1',
    lugarId: null,
    categoriaId: null,
    campo,
    valorAnterior: null,
    valorNuevo,
    usuarioId: 'admin',
    creadoEn,
    sincronizado: true,
    rechazadoEn: null,
    ...extra,
  }
}

const nombre = cambio('nombre', 'Evaluación inicial', '2026-10-01T00:00:00.000Z')

describe('categoriaId proyectado (R3)', () => {
  it('sin cambios de categoría queda en null', () => {
    const [t] = proyectarTratamientos([fila], [nombre])
    expect(t.categoriaId).toBeNull()
  })

  it('gana el último cambio, y null vuelve a "Sin categoría"', () => {
    const [con] = proyectarTratamientos(
      [fila],
      [
        nombre,
        cambio('categoria', RESTAURACION, '2026-10-02T00:00:00.000Z'),
        cambio('categoria', EVALUACION, '2026-10-03T00:00:00.000Z'),
      ],
    )
    expect(con.categoriaId).toBe(EVALUACION)

    const [sin] = proyectarTratamientos(
      [fila],
      [
        nombre,
        cambio('categoria', EVALUACION, '2026-10-02T00:00:00.000Z'),
        cambio('categoria', null, '2026-10-03T00:00:00.000Z'),
      ],
    )
    expect(sin.categoriaId).toBeNull()
  })

  it('ignora un cambio rechazado', () => {
    const [t] = proyectarTratamientos(
      [fila],
      [nombre, cambio('categoria', EVALUACION, '2026-10-02T00:00:00.000Z', { rechazadoEn: 'x' })],
    )
    expect(t.categoriaId).toBeNull()
  })
})

describe('porcentajesPorCategoria (R4)', () => {
  it('el último cambio por categoría y lugar; null lo borra', () => {
    const porcentajes = porcentajesPorCategoria([
      cambio('porcentajeCategoria', 50, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_1, categoriaId: EVALUACION }),
      cambio('porcentajeCategoria', 55, '2026-10-02T00:00:00.000Z', { lugarId: LUGAR_1, categoriaId: EVALUACION }),
      cambio('porcentajeCategoria', 60, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_2, categoriaId: EVALUACION }),
      cambio('porcentajeCategoria', null, '2026-10-02T00:00:00.000Z', { lugarId: LUGAR_2, categoriaId: EVALUACION }),
      // El % general del lugar no se mezcla.
      cambio('porcentajeProfesional', 40, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_1 }),
    ])
    expect(porcentajes.get(claveCategoriaLugar(EVALUACION, LUGAR_1))).toBe(55)
    expect(porcentajes.has(claveCategoriaLugar(EVALUACION, LUGAR_2))).toBe(false)
    expect(porcentajes.size).toBe(1)
  })

  it('los % de categoría no cambian el % general del lugar', () => {
    const general = porcentajesPorLugar([
      cambio('porcentajeProfesional', 40, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_1 }),
      cambio('porcentajeCategoria', 50, '2026-10-02T00:00:00.000Z', { lugarId: LUGAR_1, categoriaId: EVALUACION }),
    ])
    expect(general.get(LUGAR_1)).toBe(40)
  })
})

describe('porcentajeAplicable (R5, FR-010)', () => {
  const porcentajesLugar = new Map([[LUGAR_1, 40]])
  const porcentajesCategoria = new Map([[claveCategoriaLugar(EVALUACION, LUGAR_1), 50]])

  it('la categoría en el lugar gana sobre el general', () => {
    expect(
      porcentajeAplicable({ categoriaId: EVALUACION, lugarId: LUGAR_1, porcentajesLugar, porcentajesCategoria }),
    ).toEqual({ valor: 50, origen: 'categoria' })
  })

  it('sin % de la categoría en ese lugar usa el general', () => {
    expect(
      porcentajeAplicable({ categoriaId: RESTAURACION, lugarId: LUGAR_1, porcentajesLugar, porcentajesCategoria }),
    ).toEqual({ valor: 40, origen: 'lugar' })
  })

  it('sin categoría usa el general', () => {
    expect(
      porcentajeAplicable({ categoriaId: null, lugarId: LUGAR_1, porcentajesLugar, porcentajesCategoria }),
    ).toEqual({ valor: 40, origen: 'lugar' })
  })

  it('sin general y sin % de categoría: ninguno', () => {
    expect(
      porcentajeAplicable({ categoriaId: EVALUACION, lugarId: LUGAR_2, porcentajesLugar, porcentajesCategoria }),
    ).toEqual({ valor: null, origen: null })
  })

  it('lugar sin general pero categoría con %: el de la categoría', () => {
    expect(
      porcentajeAplicable({
        categoriaId: EVALUACION,
        lugarId: LUGAR_2,
        porcentajesLugar,
        porcentajesCategoria: new Map([[claveCategoriaLugar(EVALUACION, LUGAR_2), 45]]),
      }),
    ).toEqual({ valor: 45, origen: 'categoria' })
  })

  it('un % de categoría en 0 aplica (no se confunde con "sin %")', () => {
    expect(
      porcentajeAplicable({
        categoriaId: EVALUACION,
        lugarId: LUGAR_1,
        porcentajesLugar,
        porcentajesCategoria: new Map([[claveCategoriaLugar(EVALUACION, LUGAR_1), 0]]),
      }),
    ).toEqual({ valor: 0, origen: 'categoria' })
  })
})
