import { describe, expect, it } from 'vitest'
import type { CambioInsumo, Insumo } from '../../../src/lib/db'
import {
  calcularCostoTratamiento,
  calcularGanancia,
  cantidadEfectiva,
} from '../../../src/features/tratamientos/lib/montos'
import type { CostoUnitario } from '../../../src/features/insumos/lib/precio'
import { TENANT_1 } from '../../helpers/tenancy'

function insumo(id: string, unidadMedida: string, extra: Partial<Insumo> = {}): Insumo {
  return {
    id,
    tenantId: TENANT_1,
    nombre: id,
    categoria: 'X',
    unidadMedida,
    unidadCompra: unidadMedida,
    contenido: 1,
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
    ...extra,
  }
}
const costo = (c: number): CostoUnitario => ({ costo: c, loteId: 'l', fecha: '2026-01-01' })

// Ejemplo del DS §26: costo de materiales $3.480.
const insumos = new Map([
  ['art', insumo('art', 'cartucho')],
  ['res', insumo('res', 'g')],
  ['otros', insumo('otros', 'unidad')],
])
const costos = new Map([
  ['art', costo(650)],
  ['res', costo(1200)],
  ['otros', costo(430)],
])
const receta = [
  { insumoId: 'art', cantidad: 1, unidad: 'cartucho' },
  { insumoId: 'res', cantidad: 2, unidad: 'g' },
  { insumoId: 'otros', cantidad: 1, unidad: 'unidad' },
]

describe('costo y ganancia estimada (spec 016 DS §27, SC-002)', () => {
  it('el ejemplo del DS: $3.480 de materiales, $18.000 de comisión y $14.520 de ganancia', () => {
    const { costoMateriales, completo, lineas } = calcularCostoTratamiento(receta, insumos, costos, [])
    expect(lineas.map((l) => l.costo)).toEqual([650, 2400, 430])
    expect(costoMateriales).toBe(3480)
    expect(completo).toBe(true)
    expect(calcularGanancia(45000, 40, costoMateriales)).toEqual({
      comision: 18000,
      ganancia: 14520,
    })
  })

  it('un material sin precio deja el costo incompleto (FR-008)', () => {
    const sinResina = new Map(costos)
    sinResina.delete('res')
    const resultado = calcularCostoTratamiento(receta, insumos, sinResina, [])
    expect(resultado.completo).toBe(false)
    expect(resultado.costoMateriales).toBe(1080)
    expect(resultado.lineas[1].costo).toBeNull()
  })

  it('un material dado de baja no suma ni deja incompleto', () => {
    const conBaja = new Map(insumos)
    conBaja.set('otros', insumo('otros', 'unidad', { dadoDeBajaEn: '2026-02-01' }))
    const resultado = calcularCostoTratamiento(receta, conBaja, costos, [])
    expect(resultado.costoMateriales).toBe(3050)
    expect(resultado.completo).toBe(true)
    expect(resultado.lineas[2].dadoDeBaja).toBe(true)
  })

  it('sin precio o sin porcentaje no hay ganancia, con su motivo', () => {
    expect(calcularGanancia(null, 40, 100)).toMatchObject({ ganancia: null, motivo: 'sin-precio' })
    expect(calcularGanancia(45000, null, 100)).toMatchObject({
      ganancia: null,
      motivo: 'sin-porcentaje',
    })
  })

  it('precio 0 y ganancia negativa se calculan igual', () => {
    expect(calcularGanancia(0, 40, 3480)).toEqual({ comision: 0, ganancia: -3480 })
  })

  it('tras convertir el insumo de caja a unidad ×100, la cantidad física se conserva', () => {
    const guantes = insumo('g', 'unidad')
    const conversion: CambioInsumo = {
      id: 'c1',
      tenantId: TENANT_1,
      insumoId: 'g',
      campo: 'unidadMedida',
      valorAnterior: 'caja',
      valorNuevo: 'unidad',
      factor: 100,
      usuarioId: 'admin',
      creadoEn: '2026-03-01T00:00:00.000Z',
      sincronizado: true,
      rechazadoEn: null,
    }
    expect(cantidadEfectiva({ insumoId: 'g', cantidad: 0.02, unidad: 'caja' }, guantes, [conversion])).toBe(2)
  })
})

describe('rendimiento (plan)', () => {
  it('los montos de 100 tratamientos de 10 materiales se calculan en menos de 100 ms', () => {
    const muchos = new Map<string, Insumo>()
    const precios = new Map<string, CostoUnitario>()
    for (let i = 0; i < 300; i++) {
      muchos.set(`i${i}`, insumo(`i${i}`, 'unidad'))
      precios.set(`i${i}`, costo(100 + i))
    }
    const cambios: CambioInsumo[] = Array.from({ length: 200 }, (_, i) => ({
      id: `c${i}`,
      tenantId: TENANT_1,
      insumoId: `i${i}`,
      campo: 'nombre',
      valorAnterior: 'a',
      valorNuevo: 'b',
      factor: null,
      usuarioId: 'admin',
      creadoEn: '2026-03-01T00:00:00.000Z',
      sincronizado: true,
      rechazadoEn: null,
    }))
    const tratamientos = Array.from({ length: 100 }, (_, t) =>
      Array.from({ length: 10 }, (_, m) => ({
        insumoId: `i${(t * 3 + m) % 300}`,
        cantidad: 1,
        unidad: 'unidad',
      })),
    )

    const inicio = performance.now()
    for (const materiales of tratamientos) {
      const { costoMateriales } = calcularCostoTratamiento(materiales, muchos, precios, cambios)
      calcularGanancia(45000, 40, costoMateriales)
    }
    expect(performance.now() - inicio).toBeLessThan(100)
  })
})
