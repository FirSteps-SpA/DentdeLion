import { describe, expect, it } from 'vitest'
import type { Lote } from '../../src/lib/db'
import { repartirFefo } from '../../src/features/insumos/lib/fefo'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

function lote(id: string, fechaCaducidad: string | null): Lote {
  return {
    id,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId: 'i',
    numeroLote: id,
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'g',
    precioCompra: null,
  }
}
const vigente = (l: Lote) => l.fechaCaducidad === null || l.fechaCaducidad >= '2026-10-19'

describe('repartirFefo (spec 016 R4)', () => {
  it('toma del lote que vence primero y completa con el siguiente', () => {
    const r = repartirFefo(
      [
        { lote: lote('tarde', '2027-06-01'), stockDisponible: 10 },
        { lote: lote('pronto', '2026-12-01'), stockDisponible: 1.5 },
        { lote: lote('sin', null), stockDisponible: 5 },
      ],
      2,
      vigente,
    )
    expect(r.partes.map((p) => [p.lote.id, p.cantidad])).toEqual([
      ['pronto', 1.5],
      ['tarde', 0.5],
    ])
    expect(r.faltante).toBe(0)
  })

  it('los lotes sin vencimiento van al final', () => {
    const r = repartirFefo(
      [
        { lote: lote('sin', null), stockDisponible: 5 },
        { lote: lote('fecha', '2027-01-01'), stockDisponible: 1 },
      ],
      3,
      vigente,
    )
    expect(r.partes.map((p) => p.lote.id)).toEqual(['fecha', 'sin'])
  })

  it('nunca usa caducados y avisa cuánto hay vencido', () => {
    const r = repartirFefo(
      [
        { lote: lote('vencido', '2026-01-01'), stockDisponible: 4 },
        { lote: lote('ok', '2027-01-01'), stockDisponible: 1 },
      ],
      3,
      vigente,
    )
    expect(r.partes.map((p) => [p.lote.id, p.cantidad])).toEqual([['ok', 1]])
    expect(r.faltante).toBe(2)
    expect(r.stockCaducado).toBe(4)
  })

  it('cantidad 0 no toma nada', () => {
    expect(repartirFefo([{ lote: lote('ok', null), stockDisponible: 2 }], 0, vigente).partes).toEqual([])
  })
})
