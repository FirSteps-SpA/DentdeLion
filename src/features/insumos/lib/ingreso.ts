import type { Insumo, Lote } from '../../../lib/db'
import { formatearCantidad, unidadAdmiteDecimales } from '../../../lib/unidades'

/** Spec 015 (FR-009) — cantidad tal como la escribe quien ingresa stock. */
export interface CantidadIngreso {
  cantidad: number
  /** `insumo.unidadCompra` (por defecto) o `insumo.unidadMedida`. */
  unidad: string
}

export interface ConversionIngreso {
  /** Lo que suma al stock, en unidad de consumo. */
  cantidadConsumo: number
  /** Cuántas presentaciones (unidades de compra) son. */
  presentaciones: number
  error?: string
}

type InsumoPresentacion = Pick<Insumo, 'unidadMedida' | 'unidadCompra' | 'contenido'>

/** Evita restos de coma flotante (0,1 × 3 = 0,30000000000000004). */
function redondear(n: number): number {
  return Math.round(n * 1e9) / 1e9
}

/**
 * Spec 015 (FR-009, research.md R5): convierte lo ingresado a unidades de
 * consumo (`cantidad × contenido` si viene en unidad de compra) y valida que
 * el resultado sea una cantidad admisible para la unidad de consumo (US2-4).
 */
export function convertirIngreso(
  insumo: InsumoPresentacion,
  { cantidad, unidad }: CantidadIngreso,
): ConversionIngreso {
  const enCompra = unidad === insumo.unidadCompra && unidad !== insumo.unidadMedida
  const contenido = insumo.contenido > 0 ? insumo.contenido : 1
  const cantidadConsumo = enCompra ? redondear(cantidad * contenido) : cantidad
  const presentaciones = enCompra ? cantidad : redondear(cantidad / contenido)

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return { cantidadConsumo, presentaciones, error: 'Ingresa una cantidad mayor a cero.' }
  }
  if (!unidadAdmiteDecimales(insumo.unidadMedida) && !Number.isInteger(cantidadConsumo)) {
    const detalle = enCompra
      ? `${formatearCantidad(cantidad, unidad)} son ${formatearCantidad(
          cantidadConsumo,
          insumo.unidadMedida,
        )}: `
      : ''
    return {
      cantidadConsumo,
      presentaciones,
      error: `${detalle}la unidad "${insumo.unidadMedida}" no admite cantidades decimales.`,
    }
  }
  return { cantidadConsumo, presentaciones }
}

/** "2 cajas = 100 cartuchos", o `null` si se ingresa en unidad de consumo. */
export function textoEquivalenciaIngreso(
  insumo: InsumoPresentacion,
  ingreso: CantidadIngreso,
): string | null {
  if (ingreso.unidad === insumo.unidadMedida || !(ingreso.cantidad > 0)) return null
  const { cantidadConsumo } = convertirIngreso(insumo, ingreso)
  return `${formatearCantidad(ingreso.cantidad, ingreso.unidad)} = ${formatearCantidad(
    cantidadConsumo,
    insumo.unidadMedida,
  )}`
}

/**
 * Spec 015 (R5) — snapshot inmutable del ingreso para el lote: lo que se
 * escribió y la presentación vigente. El precio lo agrega la US3.
 */
export function snapshotIngreso(
  insumo: InsumoPresentacion,
  ingreso: CantidadIngreso,
): Pick<Lote, 'cantidadIngresada' | 'unidadIngresada' | 'contenido' | 'unidadConsumo'> {
  return {
    cantidadIngresada: ingreso.cantidad,
    unidadIngresada: ingreso.unidad,
    contenido: insumo.contenido > 0 ? insumo.contenido : 1,
    unidadConsumo: insumo.unidadMedida,
  }
}
