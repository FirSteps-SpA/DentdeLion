import { describe, expect, it } from 'vitest'
import type { Categoria, Insumo } from '../../../src/lib/db'
import {
  CATEGORIAS_PRECARGADAS,
  SIN_CATEGORIA,
  catalogoCategorias,
  categoriasEnUso,
  claveCategoria,
  resolverCategoria,
} from '../../../src/features/insumos/lib/categorias'
import { TENANT_1 } from '../../helpers/tenancy'

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'pieza',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
    categoria: 'Fresas',
    unidadMedida: 'pieza',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function categoria(overrides: Partial<Categoria>): Categoria {
  return {
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Ortodoncia',
    creadoPor: 'admin-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
    desactivadoEn: null,
    ...overrides,
  }
}

describe('claveCategoria (research.md R2)', () => {
  it('trims, strips accents and lowercases', () => {
    expect(claveCategoria('  Restauración ')).toBe('restauracion')
    expect(claveCategoria('FRESAS')).toBe('fresas')
  })
})

describe('catalogoCategorias (FR-009/FR-010)', () => {
  it('returns the 4 precargadas + "Sin categoría" last with empty inputs', () => {
    const catalogo = catalogoCategorias([], [])
    const nombres: string[] = [...CATEGORIAS_PRECARGADAS].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    expect(catalogo.map((c) => c.nombre)).toEqual([...nombres, SIN_CATEGORIA])
    expect(catalogo.at(-1)).toMatchObject({ nombre: SIN_CATEGORIA, origen: 'sin-categoria' })
  })

  it('merges free-text "restauracion" into the precargada "Restauración"', () => {
    const catalogo = catalogoCategorias(
      [],
      [insumo({ categoria: 'restauracion' })],
    )
    const restauracion = catalogo.filter((c) => c.clave === claveCategoria('Restauración'))
    expect(restauracion).toHaveLength(1)
    expect(restauracion[0]).toMatchObject({ nombre: 'Restauración', origen: 'precargada' })
  })

  it('merges two Categoria rows by clave, naming the entry after the older row', () => {
    const vieja = categoria({
      id: 'a',
      nombre: 'Ortodoncia',
      creadoEn: '2026-01-01T00:00:00.000Z',
    })
    const nueva = categoria({
      id: 'b',
      nombre: 'ortodoncia',
      creadoEn: '2026-02-01T00:00:00.000Z',
    })
    const catalogo = catalogoCategorias([nueva, vieja], [])
    const entradas = catalogo.filter((c) => c.clave === claveCategoria('ortodoncia'))
    expect(entradas).toHaveLength(1)
    expect(entradas[0]).toMatchObject({ nombre: 'Ortodoncia', origen: 'creada' })
  })

  it('excludes rejected rows', () => {
    const rechazada = categoria({ nombre: 'Implantes', rechazadoEn: '2026-01-01T00:00:00.000Z' })
    const catalogo = catalogoCategorias([rechazada], [])
    expect(catalogo.some((c) => c.clave === claveCategoria('Implantes'))).toBe(false)
  })

  it('maps free text "sin categoria" to the fixed entry', () => {
    const catalogo = catalogoCategorias([], [insumo({ categoria: 'sin categoria' })])
    const entradas = catalogo.filter((c) => c.clave === claveCategoria(SIN_CATEGORIA))
    expect(entradas).toHaveLength(1)
    expect(entradas[0]).toMatchObject({ nombre: SIN_CATEGORIA, origen: 'sin-categoria' })
  })
})

describe('categoriasEnUso (FR-011a)', () => {
  it('omits unused precargadas', () => {
    const enUso = categoriasEnUso([], [insumo({ categoria: 'Fresas' })])
    expect(enUso.map((c) => c.nombre)).toEqual(['Fresas'])
  })

  it('includes "Sin categoría" only if some active insumo uses it', () => {
    expect(
      categoriasEnUso([], [insumo({ categoria: SIN_CATEGORIA })]).some(
        (c) => c.origen === 'sin-categoria',
      ),
    ).toBe(true)
    expect(
      categoriasEnUso([], [insumo({ categoria: 'Fresas' })]).some(
        (c) => c.origen === 'sin-categoria',
      ),
    ).toBe(false)
  })
})

describe('resolverCategoria (FR-012)', () => {
  it('resolves an existing clave to its canonical name, and an unknown one to null', () => {
    const catalogo = catalogoCategorias([], [])
    expect(resolverCategoria('fresas', catalogo)).toBe('Fresas')
    expect(resolverCategoria('Ortodoncia', catalogo)).toBeNull()
  })
})
