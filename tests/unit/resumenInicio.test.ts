import { describe, expect, it } from 'vitest'
import type { Insumo, ItemCompra, Lote, Movimiento } from '../../src/lib/db'
import { resumenInicio } from '../../src/features/inicio/lib/resumenInicio'
import { computeInsumosStockBajo } from '../../src/features/alertas/lib/stockBajo'
import { computeAlertasCaducidad } from '../../src/features/alertas/lib/caducidad'
import { contarAlertasPendientes } from '../../src/features/alertas/lib/resumen'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const HOY = new Date('2026-10-18T12:00:00')
const enDias = (d: number) =>
  new Date(Date.UTC(2026, 9, 18 + d)).toISOString().slice(0, 10)

function insumo(
  id: string,
  nombre: string,
  extra: Partial<Insumo> = {},
): Insumo {
  return {
    unidadCompra: 'u',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'General',
    unidadMedida: 'u',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: 'x',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...extra,
  }
}
function lote(id: string, insumoId: string, fecha: string | null): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id,
    insumoId,
    numeroLote: id.toUpperCase(),
    proveedor: 'P',
    fechaCaducidad: fecha,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: 'x',
  }
}
function ingreso(loteId: string, cantidad: number): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: `m-${loteId}`,
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'u',
    movimientoOrigenId: null,
    creadoEn: 'x',
    sincronizado: true,
  }
}
function item(id: string, estado: ItemCompra['estado']): ItemCompra {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id,
    nombre: id,
    cantidad: null,
    nota: null,
    insumoId: null,
    estado,
    creadoPor: 'u',
    creadoEn: 'x',
    compradoPor: null,
    compradoEn: null,
  }
}

const insumos = [
  insumo('a', 'Anestesia', { stockMinimo: 10 }), // bajo mínimo (4) + vence en 3 días
  insumo('g', 'Guantes', { stockMinimo: 5, caduca: false }), // bajo mínimo (2)
  insumo('r', 'Resina'), // vence en 200 días (fuera de niveles)
  insumo('x', 'Ácido'), // caducado hace 2 días
  insumo('v', 'Vacío'), // lote sin stock: no cuenta
]
const lotes = [
  lote('la', 'a', enDias(3)),
  lote('lg', 'g', null),
  lote('lr', 'r', enDias(200)),
  lote('lx', 'x', enDias(-2)),
  lote('lv', 'v', enDias(1)),
]
const movimientos = [
  ingreso('la', 4),
  ingreso('lg', 2),
  ingreso('lr', 8),
  ingreso('lx', 1),
]
const itemsCompra = [
  item('c1', 'pendiente'),
  item('c2', 'comprado'),
  item('c3', 'eliminado'),
]
const niveles = [30, 7, 1]
const preferencias = { stockBajo: true, caducidad: true }
const base = {
  insumos,
  lotes,
  movimientos,
  itemsCompra,
  nivelesAvisoDias: niveles,
  preferencias,
  hoy: HOY,
}

describe('resumenInicio (spec 013 FR-022–FR-027)', () => {
  const r = resumenInicio(base)

  it('bajo mínimo y por vencer coinciden con las secciones de Alertas', () => {
    expect(r.bajoMinimo).toBe(
      computeInsumosStockBajo(insumos, lotes, movimientos).length,
    )
    expect(r.bajoMinimo).toBe(2)
    expect(r.porVencer).toBe(
      computeAlertasCaducidad(insumos, lotes, movimientos, niveles, HOY).length,
    )
    expect(r.porVencer).toBe(2)
  })

  it('para comprar suma sugeridos y manuales pendientes (no comprados ni eliminados)', () => {
    // Sugeridos: Anestesia y Guantes (bajo mínimo) + Ácido (caducado) = 3; manuales: 1.
    expect(r.paraComprar).toBe(4)
  })

  it('alertas coincide con la burbuja y respeta las preferencias', () => {
    expect(r.alertas).toBe(
      contarAlertasPendientes(
        insumos,
        lotes,
        movimientos,
        niveles,
        preferencias,
      ),
    )
    const sinStockBajo = resumenInicio({
      ...base,
      preferencias: { stockBajo: false, caducidad: true },
    })
    expect(sinStockBajo.alertas).toBeLessThan(r.alertas)
  })

  it('ordena la lista de alertas: caducado, caducidad por días y stock bajo', () => {
    expect(r.listaAlertas.map((a) => [a.tipo, a.insumo.nombre])).toEqual([
      ['caducado', 'Ácido'],
      ['caducidad', 'Anestesia'],
      ['stock-bajo', 'Anestesia'],
      ['stock-bajo', 'Guantes'],
    ])
  })

  it('próximos vencimientos: por fecha, solo con stock y fecha', () => {
    expect(
      r.proximosVencimientos.map((v) => [v.insumo.nombre, v.diasRestantes]),
    ).toEqual([
      ['Ácido', -2],
      ['Anestesia', 3],
      ['Resina', 200],
    ])
  })

  it('trunca las listas a 5', () => {
    const muchos = Array.from({ length: 8 }, (_, i) =>
      insumo(`n${i}`, `N${i}`, { stockMinimo: 5 }),
    )
    const res = resumenInicio({
      ...base,
      insumos: muchos,
      lotes: [],
      movimientos: [],
    })
    expect(res.bajoMinimo).toBe(8)
    expect(res.listaAlertas).toHaveLength(5)
  })

  it('sin datos todo es 0 o vacío', () => {
    expect(
      resumenInicio({
        ...base,
        insumos: [],
        lotes: [],
        movimientos: [],
        itemsCompra: [],
      }),
    ).toEqual({
      bajoMinimo: 0,
      porVencer: 0,
      paraComprar: 0,
      alertas: 0,
      listaAlertas: [],
      proximosVencimientos: [],
    })
  })
})
