import { unidadAdmiteDecimales } from '../../../lib/unidades'

/**
 * Units that allow a fractional (decimal) quantity — mL/g-style units, as
 * opposed to countable units (pieza/caja) where only whole numbers make
 * sense (FR-016, research.md).
 */
export function permiteDecimales(unidadMedida: string): boolean {
  return unidadAdmiteDecimales(unidadMedida)
}

export interface QuantityValidation {
  valid: boolean
  error?: string
}

/**
 * Shared quantity validator (FR-016): rejects non-finite/negative/zero
 * values always, and additionally rejects non-integer values when the
 * insumo's unit of measure doesn't allow decimals. Used by both
 * RegistroForm and ConsumoForm so the two never drift out of sync.
 */
export function validateQuantity(
  value: number,
  unidadMedida: string,
): QuantityValidation {
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, error: 'Ingresa una cantidad mayor a cero.' }
  }
  if (!permiteDecimales(unidadMedida) && !Number.isInteger(value)) {
    return {
      valid: false,
      error: `La unidad "${unidadMedida}" no admite cantidades decimales.`,
    }
  }
  return { valid: true }
}
