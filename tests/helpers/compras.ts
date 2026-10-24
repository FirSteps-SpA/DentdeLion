import type { Insumo, ItemCompra, Lote, Movimiento } from '../../src/lib/db'
import { LUGAR_1, TENANT_1 } from './tenancy'

/**
 * Spec 022 — datos de la lista de compras: un insumo, su lote con precio y el
 * ingreso que le da stock. Con `stockMinimo` sobre el stock, sale sugerido.
 */
export function insumoCompra(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id: 'i1',
    nombre: 'Insumo',
    categoria: 'Cirugía',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
    ...overrides,
  }
}

export function loteCompra(overrides: Partial<Lote>): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'caja',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: 'l1',
    insumoId: 'i1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    proveedorId: null,
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function ingresoCompra(
  loteId: string,
  cantidad: number,
  lugarId = LUGAR_1,
): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'caja',
    tenantId: TENANT_1,
    lugarId,
    trasladoId: null,
    id: `mov-${loteId}-${lugarId}`,
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'usuario-1',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

export function itemManual(overrides: Partial<ItemCompra>): ItemCompra {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: 'm1',
    nombre: 'Torundas',
    cantidad: null,
    nota: null,
    insumoId: null,
    estado: 'pendiente',
    creadoPor: 'usuario-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    compradoPor: null,
    compradoEn: null,
    ...overrides,
  }
}

/**
 * Un insumo sugerido con precio: `faltan` cajas para el mínimo y `precio`
 * por caja en su único lote.
 */
export function sugeridoConPrecio(
  id: string,
  nombre: string,
  faltan: number,
  precio: number | null,
): { insumo: Insumo; lote: Lote; ingreso: Movimiento } {
  const lote = loteCompra({ id: `l-${id}`, insumoId: id, precioCompra: precio })
  return {
    insumo: insumoCompra({ id, nombre, stockMinimo: 10 + faltan }),
    lote,
    ingreso: ingresoCompra(lote.id, 10),
  }
}
