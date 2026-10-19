import { describe, expect, it } from 'vitest'
import { contarAlertasPendientes } from '../../../src/features/alertas/lib/resumen'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
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
    ...overrides,
  }
}

function lote(overrides: Partial<Lote>): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'i1',
    numeroLote: 'L1',
    proveedor: 'P',
    fechaCaducidad: '2020-01-01',
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function ingreso(loteId: string, cantidad: number): Movimiento {
  return {
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'u1',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

const bajoMinimo = insumo({ id: 'bajo', stockMinimo: 100 })
const caducado = insumo({ id: 'caducado', stockMinimo: null })
const ambos = insumo({ id: 'ambos', stockMinimo: 100 })
const loteBajo = lote({ id: 'l-bajo', insumoId: 'bajo', fechaCaducidad: '2030-01-01' })
const loteCaducado = lote({ id: 'l-caducado', insumoId: 'caducado' })
const loteAmbos1 = lote({ id: 'l-ambos-1', insumoId: 'ambos' })
const loteAmbos2 = lote({ id: 'l-ambos-2', insumoId: 'ambos', numeroLote: 'L2' })

const insumos = [bajoMinimo, caducado, ambos]
const lotes = [loteBajo, loteCaducado, loteAmbos1, loteAmbos2]
const movimientos = [
  ingreso('l-bajo', 1),
  ingreso('l-caducado', 1),
  ingreso('l-ambos-1', 1),
  ingreso('l-ambos-2', 1),
]

describe('contarAlertasPendientes (spec 010 FR-025/026/028)', () => {
  it('counts the union of insumos with either alert type, deduping repeats', () => {
    const total = contarAlertasPendientes(insumos, lotes, movimientos, [30, 7, 1], {
      stockBajo: true,
      caducidad: true,
    })
    // bajo (stock), caducado (caducidad), ambos (both, counted once) = 3
    expect(total).toBe(3)
  })

  it('excludes stock bajo when that preference is off', () => {
    const total = contarAlertasPendientes(insumos, lotes, movimientos, [30, 7, 1], {
      stockBajo: false,
      caducidad: true,
    })
    // caducado + ambos (via its caducado lote) = 2
    expect(total).toBe(2)
  })

  it('excludes caducidad when that preference is off', () => {
    const total = contarAlertasPendientes(insumos, lotes, movimientos, [30, 7, 1], {
      stockBajo: true,
      caducidad: false,
    })
    // bajo + ambos (via its low stock) = 2
    expect(total).toBe(2)
  })

  it('returns 0 when both preferences are off', () => {
    const total = contarAlertasPendientes(insumos, lotes, movimientos, [30, 7, 1], {
      stockBajo: false,
      caducidad: false,
    })
    expect(total).toBe(0)
  })

  it('counts an insumo with two expiring lotes once', () => {
    const total = contarAlertasPendientes(
      [ambos],
      [loteAmbos1, loteAmbos2],
      [ingreso('l-ambos-1', 1), ingreso('l-ambos-2', 1)],
      [30, 7, 1],
      { stockBajo: false, caducidad: true },
    )
    expect(total).toBe(1)
  })
})
