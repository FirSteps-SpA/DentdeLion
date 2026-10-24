import type {
  CambioInsumo,
  CambioLote,
  Insumo,
  Lote,
  Lugar,
  Movimiento,
  TratamientoRealizado,
} from '../../../src/lib/db'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

/** Spec 017 — constructores de datos para las pruebas de Reportes. */
export { LUGAR_1, LUGAR_2, TENANT_1 }

export const iso = (anio: number, mes: number, dia = 10, hora = 12) =>
  new Date(anio, mes, dia, hora).toISOString()

export function insumo(id: string, extra: Partial<Insumo> = {}): Insumo {
  return {
    id,
    tenantId: TENANT_1,
    nombre: `Insumo ${id}`,
    categoria: 'Anestesia',
    unidadMedida: 'unidad',
    unidadCompra: 'unidad',
    contenido: 1,
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2025-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...extra,
  }
}

/** Lote con `precioCompra` por unidad de compra; `contenido` 1 por defecto. */
export function lote(id: string, insumoId: string, precioCompra: number | null, extra: Partial<Lote> = {}): Lote {
  return {
    id,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId,
    numeroLote: id,
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2025-06-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra,
    ...extra,
  }
}

let n = 0
export function mov(
  tipo: Movimiento['tipo'],
  loteId: string,
  cantidad: number,
  creadoEn: string,
  extra: Partial<Movimiento> = {},
): Movimiento {
  n++
  return {
    id: `m${String(n).padStart(6, '0')}`,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    tipo,
    trasladoId: null,
    loteId,
    cantidad,
    unidad: 'unidad',
    tratamientoRealizadoId: null,
    usuarioId: 'A',
    movimientoOrigenId: null,
    creadoEn,
    sincronizado: true,
    ...extra,
  }
}

/** Deshacer de un consumo: `ajuste` vinculado con la misma cantidad. */
export function deshacer(consumo: Movimiento, creadoEn: string): Movimiento {
  return mov('ajuste', consumo.loteId, consumo.cantidad, creadoEn, {
    movimientoOrigenId: consumo.id,
    lugarId: consumo.lugarId,
    unidad: consumo.unidad,
  })
}

export function realizado(
  precio: number | null,
  gananciaEstimada: number | null,
  creadoEn: string,
  extra: Partial<TratamientoRealizado> = {},
): TratamientoRealizado {
  n++
  return {
    id: `r${String(n).padStart(6, '0')}`,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    tratamientoId: 't1',
    nombre: 'Restauración',
    precio,
    porcentajeProfesional: precio === null ? null : 40,
    materiales: [],
    costoMateriales: 0,
    costoCompleto: true,
    gananciaEstimada,
    usuarioId: 'A',
    creadoEn,
    anuladoEn: null,
    anuladoPor: null,
    sincronizado: true,
    anulacionSincronizada: true,
    ...extra,
  }
}

export function lugar(id: string, nombre: string, extra: Partial<Lugar> = {}): Lugar {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    desactivadoEn: null,
    creadoEn: '2025-01-01T00:00:00.000Z',
    sincronizado: true,
    proveedorPredeterminadoId: null,
    ...extra,
  }
}

export function cambioPrecio(loteId: string, valorNuevo: number | null, creadoEn: string): CambioLote {
  n++
  return {
    id: `cl${n}`,
    tenantId: TENANT_1,
    loteId,
    campo: 'precioCompra',
    valorAnterior: null,
    valorNuevo,
    usuarioId: 'A',
    creadoEn,
    sincronizado: true,
  }
}

export function conversion(
  insumoId: string,
  desde: string,
  hasta: string,
  factor: number,
  creadoEn: string,
): CambioInsumo {
  n++
  return {
    id: `ci${n}`,
    tenantId: TENANT_1,
    insumoId,
    campo: 'unidadMedida',
    valorAnterior: desde,
    valorNuevo: hasta,
    factor,
    usuarioId: 'A',
    creadoEn,
    sincronizado: true,
    rechazadoEn: null,
  }
}
