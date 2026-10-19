import { describe, expect, it } from 'vitest'
import { computeInsumosStockBajo } from '../../../src/features/alertas/lib/stockBajo'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

function makeInsumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Guantes de nitrilo',
    categoria: 'Protección',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: new Date().toISOString(),
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function makeLote(overrides: Partial<Lote>): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'insumo-1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    fechaCaducidad: '2027-01-01',
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeMovimiento(overrides: Partial<Movimiento>): Movimiento {
  return {
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId: 'lote-1',
    cantidad: 1,
    usuarioId: 'usuario-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
    ...overrides,
  }
}

describe('computeInsumosStockBajo', () => {
  it('flags an insumo whose stock is below its configured mínimo', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 10 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1' })
    const movimientos = [
      makeMovimiento({ loteId: 'l1', tipo: 'ingreso', cantidad: 5 }),
    ]

    const alertas = computeInsumosStockBajo([insumo], [lote], movimientos)

    expect(alertas).toHaveLength(1)
    expect(alertas[0].insumo.id).toBe('i1')
    expect(alertas[0].stockActual).toBe(5)
  })

  it('does not flag an insumo whose stock is at or above its mínimo', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 10 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1' })
    const movimientos = [
      makeMovimiento({ loteId: 'l1', tipo: 'ingreso', cantidad: 10 }),
    ]

    expect(computeInsumosStockBajo([insumo], [lote], movimientos)).toEqual([])
  })

  it('never flags an insumo without a configured stock mínimo, regardless of stock', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: null })
    const lote = makeLote({ id: 'l1', insumoId: 'i1' })
    const movimientos = [
      makeMovimiento({ loteId: 'l1', tipo: 'consumo', cantidad: 100 }),
    ]

    expect(computeInsumosStockBajo([insumo], [lote], movimientos)).toEqual([])
  })

  it('sums stock across every lote of the insumo', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 10 })
    const loteA = makeLote({ id: 'la', insumoId: 'i1' })
    const loteB = makeLote({ id: 'lb', insumoId: 'i1' })
    const movimientos = [
      makeMovimiento({ loteId: 'la', tipo: 'ingreso', cantidad: 4 }),
      makeMovimiento({ loteId: 'lb', tipo: 'ingreso', cantidad: 4 }),
    ]

    const alertas = computeInsumosStockBajo([insumo], [loteA, loteB], movimientos)

    expect(alertas).toHaveLength(1)
    expect(alertas[0].stockActual).toBe(8)
  })
})
