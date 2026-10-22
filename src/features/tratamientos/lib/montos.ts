import type { CambioInsumo, Insumo, MaterialTratamiento } from '../../../lib/db'
import { normalizarUnidad } from '../../../lib/unidades'
import type { CostoUnitario } from '../../insumos/lib/precio'
import { factoresDeUnidad } from '../../insumos/lib/stock'

/** FR-010 (DS §27): la ganancia nunca se llama "utilidad". */
export const ETIQUETA_GANANCIA = 'Ganancia estimada'
export const NOTA_GANANCIA = 'No es utilidad contable'

/**
 * Spec 016 R2 — cantidad del material en la unidad de consumo **actual** del
 * insumo: si el insumo se convirtió (spec 015), se aplica el mismo factor, así
 * la cantidad física no cambia.
 */
export function cantidadEfectiva(
  material: MaterialTratamiento,
  insumo: Insumo | undefined,
  cambiosInsumo: CambioInsumo[],
): number {
  if (!insumo) return material.cantidad
  const factores = factoresDeUnidad(
    insumo,
    cambiosInsumo.filter((cambio) => cambio.insumoId === insumo.id),
  )
  const factor = factores.get(normalizarUnidad(material.unidad)) ?? 1
  return Math.round(material.cantidad * factor * 1e9) / 1e9
}

export interface LineaCosto {
  material: MaterialTratamiento
  insumo: Insumo | undefined
  /** En la unidad de consumo actual del insumo. */
  cantidad: number
  costoUnitario: number | null
  /** `null` = sin precio. Los dados de baja no cuentan (no se descuentan). */
  costo: number | null
  dadoDeBaja: boolean
}

export interface CostoTratamiento {
  lineas: LineaCosto[]
  /** Σ de los materiales con precio (FR-006); "desde $X" si no está completo. */
  costoMateriales: number
  /** `false` si algún material que se usaría no tiene precio (FR-008). */
  completo: boolean
}

/**
 * Spec 016 FR-006/FR-008 (R3): costo de materiales = Σ cantidad × costo
 * unitario vigente (spec 015). Un material sin precio deja el total
 * incompleto; uno dado de baja no suma ni lo deja incompleto.
 */
export function calcularCostoTratamiento(
  materiales: MaterialTratamiento[],
  insumos: Map<string, Insumo>,
  costos: Map<string, CostoUnitario>,
  cambiosInsumo: CambioInsumo[],
): CostoTratamiento {
  const lineas = materiales.map((material): LineaCosto => {
    const insumo = insumos.get(material.insumoId)
    const dadoDeBaja = Boolean(insumo?.dadoDeBajaEn)
    const cantidad = cantidadEfectiva(material, insumo, cambiosInsumo)
    const costoUnitario = costos.get(material.insumoId)?.costo ?? null
    return {
      material,
      insumo,
      cantidad,
      costoUnitario,
      costo: dadoDeBaja || costoUnitario === null ? null : cantidad * costoUnitario,
      dadoDeBaja,
    }
  })
  return {
    lineas,
    costoMateriales: lineas.reduce((total, linea) => total + (linea.costo ?? 0), 0),
    completo: lineas.every((linea) => linea.dadoDeBaja || linea.costo !== null),
  }
}

export interface Ganancia {
  /** precio × % profesional (FR-007). */
  comision: number | null
  /** comisión − costo de materiales (FR-007); puede ser negativa. */
  ganancia: number | null
  motivo?: 'sin-precio' | 'sin-porcentaje'
}

export function calcularGanancia(
  precio: number | null | undefined,
  porcentaje: number | null | undefined,
  costoMateriales: number,
): Ganancia {
  if (precio === null || precio === undefined) {
    return { comision: null, ganancia: null, motivo: 'sin-precio' }
  }
  if (porcentaje === null || porcentaje === undefined) {
    return { comision: null, ganancia: null, motivo: 'sin-porcentaje' }
  }
  const comision = (precio * porcentaje) / 100
  return { comision, ganancia: comision - costoMateriales }
}

export const TEXTO_MOTIVO: Record<NonNullable<Ganancia['motivo']>, string> = {
  'sin-precio': 'Sin precio en este lugar',
  'sin-porcentaje': 'Define el % profesional del lugar',
}
