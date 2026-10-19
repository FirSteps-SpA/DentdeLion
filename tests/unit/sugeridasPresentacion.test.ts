import { describe, expect, it } from 'vitest'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
import { formatearEquivalente } from '../../src/lib/unidades'
import {
  computeItemsSugeridos,
  presentacionesParaMinimo,
  textoPedido,
} from '../../src/features/compras/lib/sugeridos'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const articaina: Insumo = {
  id: 'art',
  tenantId: TENANT_1,
  nombre: 'Articaína',
  categoria: 'Cirugía',
  unidadMedida: 'cartucho',
  unidadCompra: 'caja',
  contenido: 50,
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 120,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}

describe('formatearEquivalente (spec 015 R9, FR-021)', () => {
  it('120 cartuchos ≈ 2 cajas + 20', () => {
    expect(formatearEquivalente(120, articaina)).toBe('≈ 2 cajas + 20')
  })

  it('menos de una presentación completa: sin equivalente', () => {
    expect(formatearEquivalente(20, articaina)).toBeNull()
  })

  it('sin resto, solo las presentaciones', () => {
    expect(formatearEquivalente(100, articaina)).toBe('≈ 2 cajas')
    expect(formatearEquivalente(50, articaina)).toBe('≈ 1 caja')
  })

  it('con unidades decimales, en fracciones de presentación', () => {
    expect(
      formatearEquivalente(1250, { unidadMedida: 'mL', unidadCompra: 'frasco', contenido: 500 }),
    ).toBe('≈ 2,5 frascos')
  })

  it('sin presentación distinta (o contenido 1) no hay equivalente', () => {
    expect(
      formatearEquivalente(5, { unidadMedida: 'kit', unidadCompra: 'kit', contenido: 1 }),
    ).toBeNull()
    expect(
      formatearEquivalente(5, { unidadMedida: 'unidad', unidadCompra: 'caja', contenido: 1 }),
    ).toBeNull()
  })
})

describe('presentaciones sugeridas (R8, FR-020)', () => {
  it('max(1, ceil((mínimo − stock) / contenido))', () => {
    expect(presentacionesParaMinimo(articaina, 20)).toBe(2)
    expect(presentacionesParaMinimo(articaina, 119)).toBe(1)
    expect(presentacionesParaMinimo({ ...articaina, stockMinimo: null }, 0)).toBeNull()
  })

  function datos(stock: number, fechaCaducidad: string | null = null) {
    const lote: Lote = {
      id: 'l1',
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      insumoId: 'art',
      numeroLote: 'A1',
      proveedor: 'P',
      fechaCaducidad,
      codigoFabricante: null,
      estado: 'activo',
      creadoEn: '2026-01-01T00:00:00.000Z',
      cantidadIngresada: null,
      unidadIngresada: null,
      contenido: 50,
      unidadConsumo: 'cartucho',
      precioCompra: null,
    }
    const movimiento: Movimiento = {
      id: 'm1',
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      trasladoId: null,
      tipo: 'ingreso',
      loteId: 'l1',
      cantidad: stock,
      unidad: 'cartucho',
      usuarioId: 'u1',
      movimientoOrigenId: null,
      creadoEn: '2026-01-01T00:00:00.000Z',
      sincronizado: true,
    }
    return { lote, movimiento }
  }

  it('el ítem sugerido bajo mínimo trae sus presentaciones y el texto del pedido', () => {
    const { lote, movimiento } = datos(20)
    const [item] = computeItemsSugeridos([articaina], [lote], [movimiento])
    expect(item.presentacionesSugeridas).toBe(2)
    expect(textoPedido(item)).toBe('Pedir 2 cajas (100 cartuchos)')
  })

  it('el mínimo efectivo del lugar (spec 014) es el que llega en el insumo de la vista', () => {
    const { lote, movimiento } = datos(20)
    const [item] = computeItemsSugeridos([{ ...articaina, stockMinimo: 300 }], [lote], [movimiento])
    expect(item.presentacionesSugeridas).toBe(6)
  })

  it('solo caducado: sin cantidad sugerida', () => {
    const { lote, movimiento } = datos(500, '2020-01-01')
    const [item] = computeItemsSugeridos([{ ...articaina, caduca: true }], [lote], [movimiento])
    expect(item).toMatchObject({ stockBajo: false, caducado: true, presentacionesSugeridas: null })
    expect(textoPedido(item)).toBeNull()
  })
})
