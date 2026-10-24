import { db } from '../../../lib/db'
import { permiteDecimales } from '../../insumos/lib/quantity'
import { editarInsumo } from '../../insumos/lib/catalogo'
import { NIVELES_AVISO_POR_DEFECTO } from '../../../stores/alertasStore'
import { tenantActualOFallar } from '../../../stores/authStore'

export interface StockMinimoValidation {
  valid: boolean
  error?: string
}

/**
 * Validates a proposed `stockMinimo` against the insumo's `unidadMedida`
 * (data-model.md's Validation): finite and `>= 0` always — unlike movement
 * quantities (`validateQuantity`), zero is a legitimate mínimo (alert only
 * once fully out of stock) — and only whole numbers for non-decimal units.
 */
export function validateStockMinimo(
  value: number,
  unidadMedida: string,
): StockMinimoValidation {
  if (!Number.isFinite(value) || value < 0) {
    return { valid: false, error: 'Ingresa un stock mínimo mayor o igual a cero.' }
  }
  if (!permiteDecimales(unidadMedida) && !Number.isInteger(value)) {
    return {
      valid: false,
      error: `La unidad "${unidadMedida}" no admite cantidades decimales.`,
    }
  }
  return { valid: true }
}

/**
 * Sets (or clears, with `null`) an insumo's stock mínimo (FR-001). Since
 * feature 007 the `Insumo` row is a projection of the `CambioInsumo` ledger,
 * so this goes through `editarInsumo` (admin-only, recorded per field) —
 * writing the row directly would be undone by the next reprojection.
 */
export async function actualizarStockMinimo(
  insumoId: string,
  stockMinimo: number | null,
): Promise<void> {
  if (stockMinimo !== null) {
    const insumo = await db.insumos.get(insumoId)
    if (!insumo) {
      throw new Error('El insumo no existe.')
    }
    const validation = validateStockMinimo(stockMinimo, insumo.unidadMedida)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
  }
  await editarInsumo(insumoId, { stockMinimo })
}

/**
 * Sets the global caducidad-warning day-levels (FR-005). Only callable from
 * an administrador-gated UI (`AlertasView`) — this function itself performs
 * no role check (research.md's client-side gating decision).
 */
export async function actualizarNivelesAviso(dias: number[]): Promise<void> {
  const niveles = dias.filter((dia) => Number.isInteger(dia) && dia > 0)
  if (niveles.length === 0) {
    throw new Error('Ingresa al menos un nivel de aviso válido (días > 0).')
  }
  const actual = await db.configuracionAlertas.get('global')
  // Conserva el umbral de pendientes y marca la fila para el próximo push
  // (spec 012 research.md R5).
  await db.configuracionAlertas.put({
    ...actual,
    id: 'global',
    tenantId: tenantActualOFallar(),
    nivelesAvisoDias: niveles,
    sincronizado: false,
  })
}

/**
 * Sets the global threshold, in hours, after which a not-yet-synced change is
 * flagged as old (spec 012 FR-011). Only callable from an administrador-gated
 * UI (`ConfiguracionAlertasSection`), same client-side gating as
 * `actualizarNivelesAviso`. Keeps the caducidad levels and marks the row for
 * the next push (research.md R5).
 */
export async function actualizarHorasAvisoPendientes(horas: number): Promise<void> {
  if (!Number.isInteger(horas) || horas < 1 || horas > 168) {
    throw new Error('Ingresa un número de horas entre 1 y 168.')
  }
  const actual = await db.configuracionAlertas.get('global')
  // Spec 022: conserva el saludo del pedido (misma fila).
  await db.configuracionAlertas.put({
    ...actual,
    id: 'global',
    tenantId: tenantActualOFallar(),
    nivelesAvisoDias: actual?.nivelesAvisoDias ?? NIVELES_AVISO_POR_DEFECTO,
    horasAvisoPendientes: horas,
    sincronizado: false,
  })
}
