import { describe, expect, it } from 'vitest'
import type { CambioTratamiento, Tratamiento } from '../../../src/lib/db'
import {
  porcentajesPorLugar,
  proyectarTratamientos,
} from '../../../src/features/tratamientos/lib/proyeccion'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

const fila: Tratamiento = {
  id: 't1',
  tenantId: TENANT_1,
  creadoPor: 'admin',
  creadoEn: '2026-10-01T00:00:00.000Z',
  sincronizado: true,
  rechazadoEn: null,
}

let n = 0
function cambio(
  campo: CambioTratamiento['campo'],
  valorNuevo: CambioTratamiento['valorNuevo'],
  creadoEn: string,
  extra: Partial<CambioTratamiento> = {},
): CambioTratamiento {
  n += 1
  return {
    id: `c${String(n).padStart(3, '0')}`,
    tenantId: TENANT_1,
    tratamientoId: campo === 'porcentajeProfesional' ? null : 't1',
    lugarId: null,
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

const base = [
  cambio('nombre', 'Restauración clase II', '2026-10-01T00:00:00.000Z'),
  cambio('activo', true, '2026-10-01T00:00:00.000Z'),
  cambio('materiales', [{ insumoId: 'art', cantidad: 1, unidad: 'cartucho' }], '2026-10-01T00:00:00.000Z'),
  cambio('precio', 45000, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_1 }),
  cambio('precio', 50000, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_2 }),
]

describe('proyectarTratamientos (spec 016 R1)', () => {
  it('proyecta nombre, materiales y precios por lugar', () => {
    const [t] = proyectarTratamientos([fila], base)
    expect(t.nombre).toBe('Restauración clase II')
    expect(t.activo).toBe(true)
    expect(t.materiales).toEqual([{ insumoId: 'art', cantidad: 1, unidad: 'cartucho' }])
    expect([...t.precios]).toEqual([
      [LUGAR_1, 45000],
      [LUGAR_2, 50000],
    ])
  })

  it('por campo gana el último, sin importar el orden de llegada', () => {
    const tarde = cambio('nombre', 'Resina clase II', '2026-10-05T00:00:00.000Z')
    const temprano = cambio('nombre', 'Otro', '2026-10-03T00:00:00.000Z')
    expect(proyectarTratamientos([fila], [...base, tarde, temprano])[0].nombre).toBe('Resina clase II')
    expect(proyectarTratamientos([fila], [temprano, tarde, ...base])[0].nombre).toBe('Resina clase II')
  })

  it('el precio de cada lugar es independiente y null lo borra', () => {
    const cambios = [
      ...base,
      cambio('precio', 47000, '2026-10-02T00:00:00.000Z', { lugarId: LUGAR_1 }),
      cambio('precio', null, '2026-10-02T00:00:00.000Z', { lugarId: LUGAR_2 }),
    ]
    const [t] = proyectarTratamientos([fila], cambios)
    expect(t.precios.get(LUGAR_1)).toBe(47000)
    expect(t.precios.has(LUGAR_2)).toBe(false)
  })

  it('ignora cambios rechazados y filas rechazadas', () => {
    const rechazado = cambio('nombre', 'X', '2026-10-09T00:00:00.000Z', {
      rechazadoEn: '2026-10-10T00:00:00.000Z',
    })
    expect(proyectarTratamientos([fila], [...base, rechazado])[0].nombre).toBe(
      'Restauración clase II',
    )
    expect(
      proyectarTratamientos([{ ...fila, rechazadoEn: '2026-10-10T00:00:00.000Z' }], base),
    ).toEqual([])
  })

  it('desactivar deja el tratamiento inactivo', () => {
    const [t] = proyectarTratamientos([fila], [
      ...base,
      cambio('activo', false, '2026-10-02T00:00:00.000Z'),
    ])
    expect(t.activo).toBe(false)
  })
})

describe('porcentajesPorLugar (Q2)', () => {
  it('el último % de cada lugar; null lo borra', () => {
    const cambios = [
      cambio('porcentajeProfesional', 40, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_1 }),
      cambio('porcentajeProfesional', 45, '2026-10-02T00:00:00.000Z', { lugarId: LUGAR_1 }),
      cambio('porcentajeProfesional', 50, '2026-10-01T00:00:00.000Z', { lugarId: LUGAR_2 }),
      cambio('porcentajeProfesional', null, '2026-10-03T00:00:00.000Z', { lugarId: LUGAR_2 }),
    ]
    const porcentajes = porcentajesPorLugar(cambios)
    expect(porcentajes.get(LUGAR_1)).toBe(45)
    expect(porcentajes.has(LUGAR_2)).toBe(false)
  })
})
