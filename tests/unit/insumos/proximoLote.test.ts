import { describe, expect, it } from 'vitest'
import { loteMasProximoAVencer } from '../../../src/features/insumos/lib/proximoLote'
import type { Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

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
    tratamientoRealizadoId: null,
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

describe('loteMasProximoAVencer', () => {
  it('picks the earliest-expiring lote among several with stock', () => {
    const loteLejano = makeLote({ id: 'la', fechaCaducidad: '2028-01-01' })
    const loteCercano = makeLote({ id: 'lb', fechaCaducidad: '2026-12-01' })
    const movimientos = [
      makeMovimiento({ loteId: 'la', cantidad: 10 }),
      makeMovimiento({ loteId: 'lb', cantidad: 10 }),
    ]

    const resultado = loteMasProximoAVencer([loteLejano, loteCercano], movimientos)

    expect(resultado?.id).toBe('lb')
  })

  it('ignores lotes with no stock disponible', () => {
    const loteAgotado = makeLote({ id: 'la', fechaCaducidad: '2026-01-01' })
    const loteConStock = makeLote({ id: 'lb', fechaCaducidad: '2028-01-01' })
    const movimientos = [
      makeMovimiento({ loteId: 'la', tipo: 'ingreso', cantidad: 5 }),
      makeMovimiento({ loteId: 'la', tipo: 'consumo', cantidad: 5 }),
      makeMovimiento({ loteId: 'lb', tipo: 'ingreso', cantidad: 3 }),
    ]

    const resultado = loteMasProximoAVencer([loteAgotado, loteConStock], movimientos)

    expect(resultado?.id).toBe('lb')
  })

  it('returns null when no lote has any stock disponible', () => {
    const lote = makeLote({ id: 'la' })
    const movimientos = [
      makeMovimiento({ loteId: 'la', tipo: 'consumo', cantidad: 1 }),
    ]

    expect(loteMasProximoAVencer([lote], movimientos)).toBeNull()
  })

  it('returns null for an insumo with no lotes', () => {
    expect(loteMasProximoAVencer([], [])).toBeNull()
  })
})
