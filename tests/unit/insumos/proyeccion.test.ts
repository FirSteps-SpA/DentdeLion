import { describe, expect, it } from 'vitest'
import type { CambioInsumo, Insumo } from '../../../src/lib/db'
import {
  filaParaSubir,
  proyectarInsumo,
} from '../../../src/features/insumos/lib/proyeccion'
import { TENANT_1 } from '../../helpers/tenancy'

const base: Insumo = {
  unidadCompra: 'caja',
  contenido: 1,
  tenantId: TENANT_1,
  id: 'i1',
  nombre: 'Anestesia',
  categoria: 'Cirugía',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: true,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}

let n = 0
function cambio(overrides: Partial<CambioInsumo>): CambioInsumo {
  n += 1
  return {
    factor: null,
    tenantId: TENANT_1,
    id: `c-${String(n).padStart(3, '0')}`,
    insumoId: 'i1',
    campo: 'nombre',
    valorAnterior: null,
    valorNuevo: null,
    usuarioId: 'admin-a',
    creadoEn: '2026-09-01T10:00:00.000Z',
    sincronizado: true,
    rechazadoEn: null,
    ...overrides,
  }
}

describe('proyectarInsumo (spec 007 FR-021a, research.md R9)', () => {
  it('applies the latest cambio per field', () => {
    const r = proyectarInsumo(base, [
      cambio({
        campo: 'nombre',
        valorNuevo: 'Nuevo',
        creadoEn: '2026-09-02T00:00:00.000Z',
      }),
      cambio({
        campo: 'nombre',
        valorNuevo: 'Viejo',
        creadoEn: '2026-09-01T00:00:00.000Z',
      }),
    ])
    expect(r.nombre).toBe('Nuevo')
  })

  it('merges changes to different fields from two authors', () => {
    const r = proyectarInsumo(base, [
      cambio({
        campo: 'nombre',
        valorNuevo: 'Anestesia X',
        usuarioId: 'admin-a',
      }),
      cambio({ campo: 'stockMinimo', valorNuevo: 5, usuarioId: 'admin-b' }),
    ])
    expect(r).toMatchObject({ nombre: 'Anestesia X', stockMinimo: 5 })
  })

  it('breaks equal timestamps by the larger id, independent of input order', () => {
    const t = '2026-09-03T00:00:00.000Z'
    const a = cambio({
      id: 'aaa',
      campo: 'categoria',
      valorNuevo: 'Fresas',
      creadoEn: t,
    })
    const b = cambio({
      id: 'bbb',
      campo: 'categoria',
      valorNuevo: 'Restauración',
      creadoEn: t,
    })
    expect(proyectarInsumo(base, [a, b]).categoria).toBe('Restauración')
    expect(proyectarInsumo(base, [b, a]).categoria).toBe('Restauración')
  })

  it('baja wins over a concurrent edit to another field, regardless of order', () => {
    const r = proyectarInsumo(base, [
      cambio({
        campo: 'baja',
        valorNuevo: true,
        usuarioId: 'admin-a',
        creadoEn: '2026-09-04T00:00:00.000Z',
      }),
      cambio({
        campo: 'nombre',
        valorNuevo: 'Editado',
        creadoEn: '2026-09-06T00:00:00.000Z',
      }),
    ])
    expect(r).toMatchObject({
      nombre: 'Editado',
      dadoDeBajaEn: '2026-09-04T00:00:00.000Z',
      dadoDeBajaPor: 'admin-a',
    })
  })

  it('two concurrent bajas resolve to the most recent one, like any other field (spec 010 research.md R2)', () => {
    const r = proyectarInsumo(base, [
      cambio({
        campo: 'baja',
        valorNuevo: true,
        usuarioId: 'admin-a',
        creadoEn: '2026-09-04T00:00:00.000Z',
      }),
      cambio({
        campo: 'baja',
        valorNuevo: true,
        usuarioId: 'admin-b',
        creadoEn: '2026-09-05T00:00:00.000Z',
      }),
    ])
    expect(r).toMatchObject({
      dadoDeBajaEn: '2026-09-05T00:00:00.000Z',
      dadoDeBajaPor: 'admin-b',
    })
  })

  it('a later restaurar reverts an earlier baja (spec 010 FR-023, research.md R2)', () => {
    const r = proyectarInsumo(base, [
      cambio({
        campo: 'baja',
        valorAnterior: null,
        valorNuevo: true,
        usuarioId: 'admin-a',
        creadoEn: '2026-09-04T00:00:00.000Z',
      }),
      cambio({
        campo: 'baja',
        valorAnterior: true,
        valorNuevo: null,
        usuarioId: 'admin-b',
        creadoEn: '2026-09-05T00:00:00.000Z',
      }),
    ])
    expect(r).toMatchObject({ dadoDeBajaEn: null, dadoDeBajaPor: null })
  })

  it('a later baja re-baja-s an insumo after an earlier restaurar', () => {
    const r = proyectarInsumo(base, [
      cambio({
        campo: 'baja',
        valorAnterior: true,
        valorNuevo: null,
        usuarioId: 'admin-a',
        creadoEn: '2026-09-04T00:00:00.000Z',
      }),
      cambio({
        campo: 'baja',
        valorAnterior: null,
        valorNuevo: true,
        usuarioId: 'admin-b',
        creadoEn: '2026-09-05T00:00:00.000Z',
      }),
    ])
    expect(r).toMatchObject({
      dadoDeBajaEn: '2026-09-05T00:00:00.000Z',
      dadoDeBajaPor: 'admin-b',
    })
  })

  it('recomputes permiteDecimales from unidadMedida', () => {
    const r = proyectarInsumo(base, [
      cambio({ campo: 'unidadMedida', valorNuevo: 'mL' }),
    ])
    expect(r.permiteDecimales).toBe(true)
  })

  it('leaves the row unchanged without cambios', () => {
    expect(proyectarInsumo(base, [])).toEqual(base)
  })

  it('ignores and undoes a cambio rejected by the server (FR-021b)', () => {
    const localmenteAplicado = {
      ...base,
      nombre: 'Rechazado',
      dadoDeBajaEn: 'x',
      dadoDeBajaPor: 'y',
    }
    const r = proyectarInsumo(localmenteAplicado, [
      cambio({
        campo: 'nombre',
        valorAnterior: 'Anestesia',
        valorNuevo: 'Rechazado',
        rechazadoEn: 'now',
      }),
      cambio({ campo: 'baja', valorNuevo: true, rechazadoEn: 'now' }),
    ])
    expect(r).toMatchObject({
      nombre: 'Anestesia',
      dadoDeBajaEn: null,
      dadoDeBajaPor: null,
    })
  })
})

describe('filaParaSubir', () => {
  it('undoes pending cambios so the remote row never runs ahead of the ledger', () => {
    const local = { ...base, nombre: 'Pendiente', stockMinimo: 3 }
    const fila = filaParaSubir(local, [
      cambio({
        campo: 'nombre',
        valorAnterior: 'Anestesia',
        valorNuevo: 'Pendiente',
        sincronizado: false,
      }),
      cambio({
        campo: 'stockMinimo',
        valorAnterior: null,
        valorNuevo: 3,
        sincronizado: true,
      }),
    ])
    expect(fila).toMatchObject({ nombre: 'Anestesia', stockMinimo: 3 })
  })

  it('reflects the most recent synced baja/restaurar, not the first one (spec 010 research.md R2)', () => {
    const fila = filaParaSubir(base, [
      cambio({
        campo: 'baja',
        valorAnterior: null,
        valorNuevo: true,
        creadoEn: '2026-09-04T00:00:00.000Z',
        sincronizado: true,
      }),
      cambio({
        campo: 'baja',
        valorAnterior: true,
        valorNuevo: null,
        creadoEn: '2026-09-05T00:00:00.000Z',
        sincronizado: true,
      }),
    ])
    expect(fila).toMatchObject({ dadoDeBajaEn: null, dadoDeBajaPor: null })
  })
})
