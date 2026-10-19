import { esUnidad, etiquetaUnidad, formatearNumero, unidadAdmiteDecimales } from '../../../lib/unidades'

/**
 * Spec 015 (FR-003/FR-004, data-model.md "Insumo") — presentación de compra de
 * un insumo: se compra por `unidadCompra` y cada una trae `contenido` unidades
 * de consumo (`unidadMedida`).
 */
export interface Presentacion {
  unidadMedida: string
  unidadCompra: string
  contenido: number | null
}

export type CampoPresentacion = 'unidadMedida' | 'unidadCompra' | 'contenido'

export function validarPresentacion(
  presentacion: Presentacion,
): Partial<Record<CampoPresentacion, string>> {
  const errores: Partial<Record<CampoPresentacion, string>> = {}
  if (!esUnidad(presentacion.unidadMedida)) {
    errores.unidadMedida = 'Elige una unidad de consumo válida.'
  }
  if (!esUnidad(presentacion.unidadCompra)) {
    errores.unidadCompra = 'Elige una unidad de compra válida.'
    return errores
  }
  if (presentacion.unidadCompra === presentacion.unidadMedida) {
    if (presentacion.contenido !== 1) {
      errores.contenido = 'Si se compra y se consume en la misma unidad, el contenido es 1.'
    }
    return errores
  }
  const contenido = presentacion.contenido
  if (contenido === null || !Number.isFinite(contenido) || contenido <= 0) {
    errores.contenido = 'Indica cuántas unidades trae, mayor que cero.'
  } else if (!unidadAdmiteDecimales(presentacion.unidadMedida) && !Number.isInteger(contenido)) {
    errores.contenido = `La unidad "${etiquetaUnidad(presentacion.unidadMedida)}" no admite decimales.`
  }
  return errores
}

/**
 * Normaliza lo elegido en el formulario: la misma unidad fuerza contenido 1
 * (FR-004) para que el formulario no tenga que pedirlo.
 */
export function normalizarPresentacion(presentacion: Presentacion): Presentacion {
  if (presentacion.unidadCompra === presentacion.unidadMedida) {
    return { ...presentacion, contenido: 1 }
  }
  return presentacion
}

/** "Caja × 50 cartuchos", "Frasco × 500 mL" o, si son iguales, "Kit" (FR-005). */
export function formatearPresentacion(presentacion: {
  unidadMedida: string
  unidadCompra: string
  contenido: number
}): string {
  if (presentacion.unidadCompra === presentacion.unidadMedida) {
    return etiquetaUnidad(presentacion.unidadMedida)
  }
  return `${etiquetaUnidad(presentacion.unidadCompra)} × ${formatearNumero(
    presentacion.contenido,
  )} ${etiquetaUnidad(presentacion.unidadMedida, presentacion.contenido)}`
}
