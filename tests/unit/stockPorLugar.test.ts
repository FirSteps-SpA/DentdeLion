import { describe, expect, it } from 'vitest'
import type { Insumo, ItemCompra, Lote, MinimoLugar, Movimiento } from '../../src/lib/db'
import {
  computeStockLote,
  lotesEnBodega,
  lotesEnLugar,
  stockLoteEnBodega,
  stockLoteEnLugar,
} from '../../src/features/insumos/lib/stock'
import { minimoEfectivo, minimoEfectivoBodega } from '../../src/features/insumos/lib/minimos'
import { datosDeBodega, datosDeLugar } from '../../src/features/insumos/lib/vistaLugar'
import { computeInsumosStockBajo } from '../../src/features/alertas/lib/stockBajo'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/** Spec 014 T031/T032/T033 (FR-006/FR-007, SC-003). */
const insumo: Insumo = {
  unidadCompra: 'caja',
  contenido: 1,
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Guantes',
  categoria: 'Protección',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 5,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  marcaId: null,
  creadoPor: null,
}

const lote = (id: string, lugarId: string): Lote => ({
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  id,
  tenantId: TENANT_1,
  lugarId,
  insumoId: 'i1',
  numeroLote: id,
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-01-01T00:00:00.000Z',
})

const mov = (
  loteId: string,
  lugarId: string,
  tipo: Movimiento['tipo'],
  cantidad: number,
): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  id: crypto.randomUUID(),
  tenantId: TENANT_1,
  lugarId,
  trasladoId: tipo.startsWith('traslado') ? 't1' : null,
  tipo,
  loteId,
  cantidad,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-10-01T00:00:00.000Z',
  sincronizado: true,
})

const lotes = [lote('a', LUGAR_1), lote('b', LUGAR_2)]
const movimientos = [
  mov('a', LUGAR_1, 'ingreso', 10),
  mov('a', LUGAR_1, 'traslado_salida', 4),
  mov('a', LUGAR_2, 'traslado_entrada', 4),
  mov('b', LUGAR_2, 'ingreso', 2),
]

describe('stock por lugar (R3)', () => {
  it('el traslado resta en el origen y suma en el destino del mismo lote', () => {
    expect(stockLoteEnLugar(movimientos, 'a', LUGAR_1)).toBe(6)
    expect(stockLoteEnLugar(movimientos, 'a', LUGAR_2)).toBe(4)
    // El total del lote no cambia (SC-008).
    expect(computeStockLote(movimientos.filter((m) => m.loteId === 'a'))).toBe(10)
  })

  it('un lote se ve en su lugar de alta y donde tiene movimientos', () => {
    expect(lotesEnLugar(lotes, movimientos, LUGAR_1).map((l) => l.id)).toEqual(['a'])
    expect(lotesEnLugar(lotes, movimientos, LUGAR_2).map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('mínimo efectivo (FR-007)', () => {
  const minimos: MinimoLugar[] = [
    { insumoId: 'i1', lugarId: LUGAR_2, tenantId: TENANT_1, stockMinimo: 20, sincronizado: true },
  ]

  it('usa el del lugar si existe y si no el del catálogo', () => {
    expect(minimoEfectivo(insumo, LUGAR_2, minimos)).toBe(20)
    expect(minimoEfectivo(insumo, LUGAR_1, minimos)).toBe(5)
  })

  it('una fila con mínimo null vuelve al del catálogo', () => {
    const nulo = [{ ...minimos[0], stockMinimo: null }]
    expect(minimoEfectivo(insumo, LUGAR_2, nulo)).toBe(5)
  })
})

describe('datosDeLugar (SC-003)', () => {
  const minimos: MinimoLugar[] = [
    { insumoId: 'i1', lugarId: LUGAR_2, tenantId: TENANT_1, stockMinimo: 20, sincronizado: true },
  ]
  const items = [
    { id: 'c1', lugarId: LUGAR_1 },
    { id: 'c2', lugarId: LUGAR_2 },
  ] as ItemCompra[]
  const datos = { insumos: [insumo], lotes, movimientos, itemsCompra: items }

  it('las alertas de un lugar no dependen del stock del otro', () => {
    const lugar1 = datosDeLugar(datos, minimos, LUGAR_1)
    const lugar2 = datosDeLugar(datos, minimos, LUGAR_2)

    // Lugar 1: 6 cajas, mínimo 5 → sin alerta. Lugar 2: 6 cajas, mínimo 20 → alerta.
    expect(computeInsumosStockBajo(lugar1.insumos, lugar1.lotes, lugar1.movimientos)).toEqual([])
    expect(
      computeInsumosStockBajo(lugar2.insumos, lugar2.lotes, lugar2.movimientos).map(
        (a) => a.insumo.id,
      ),
    ).toEqual(['i1'])
    expect(lugar1.itemsCompra.map((i) => i.id)).toEqual(['c1'])
    expect(lugar2.itemsCompra.map((i) => i.id)).toEqual(['c2'])
  })

  it('un consumo en un lugar no cambia el stock del otro', () => {
    const conConsumo = { ...datos, movimientos: [...movimientos, mov('a', LUGAR_1, 'consumo', 6)] }
    const lugar2 = datosDeLugar(conConsumo, [], LUGAR_2)
    expect(stockLoteEnLugar(lugar2.movimientos, 'a', LUGAR_2)).toBe(4)
  })
})

/** Spec 033 T006–T008 (research.md R2/R4, FR-012, FR-019). */
describe('bodega compartida: stock, lotes y mínimo comunes', () => {
  const ambos = new Set([LUGAR_1, LUGAR_2])
  const minimos: MinimoLugar[] = [
    { insumoId: 'i1', lugarId: LUGAR_1, tenantId: TENANT_1, stockMinimo: 3, sincronizado: true },
    { insumoId: 'i1', lugarId: LUGAR_2, tenantId: TENANT_1, stockMinimo: 8, sincronizado: true },
  ]
  const items = [
    { id: 'c1', lugarId: LUGAR_1 },
    { id: 'c2', lugarId: LUGAR_2 },
  ] as ItemCompra[]
  const datos = { insumos: [insumo], lotes, movimientos, itemsCompra: items }

  it('el stock de un lote en la bodega suma sus lugares; el saldo propio sigue por lugar', () => {
    // Lote a: 10 en lugar 1, 4 trasladados al lugar 2 → 6 + 4 = 10 en la bodega.
    expect(stockLoteEnBodega(movimientos, 'a', ambos)).toBe(10)
    expect(stockLoteEnLugar(movimientos, 'a', LUGAR_1)).toBe(6)
    expect(lotesEnBodega(lotes, movimientos, ambos).map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('el mínimo de la bodega es el mayor de sus lugares (null si ninguno)', () => {
    expect(minimoEfectivoBodega(insumo, ambos, minimos)).toBe(8)
    expect(minimoEfectivoBodega({ ...insumo, stockMinimo: null }, ambos, [])).toBeNull()
    expect(minimoEfectivoBodega(insumo, new Set([LUGAR_1]), minimos)).toBe(3)
  })

  it('la vista de la bodega junta movimientos, lotes, compras y usa el mínimo común', () => {
    const bodega = datosDeBodega(datos, minimos, ambos)
    expect(bodega.movimientos).toHaveLength(movimientos.length)
    expect(bodega.itemsCompra.map((i) => i.id)).toEqual(['c1', 'c2'])
    expect(bodega.insumos[0].stockMinimo).toBe(8)
    // 12 cajas en total (10 de a + 2 de b), mínimo 8 → sin alerta de stock bajo.
    expect(computeInsumosStockBajo(bodega.insumos, bodega.lotes, bodega.movimientos)).toEqual([])
  })

  it('con un solo lugar es idéntica a la vista del lugar (FR-019)', () => {
    expect(datosDeBodega(datos, minimos, new Set([LUGAR_2]))).toEqual(
      datosDeLugar(datos, minimos, LUGAR_2),
    )
  })
})
