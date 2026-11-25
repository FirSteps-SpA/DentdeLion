/**
 * Spec 032 US1 (research.md R1, data-model.md "Cantidad doble"): conversión
 * entre la unidad de compra y la de consumo para los campos dobles de stock
 * inicial y stock mínimo. Lo escrito se conserva tal cual en su unidad; el otro
 * campo se calcula y se muestra con hasta 2 decimales, marcado como aproximado
 * si no es exacto. El valor calculado nunca se redondea a entero.
 */

export interface PresentacionDoble {
  unidadMedida: string
  /** Ya resuelta: igual a `unidadMedida` si se compra en la misma unidad. */
  unidadCompra: string
  contenido: number | null
}

/** Lo que la persona escribió y en qué unidad. */
export interface CantidadTecleada {
  cantidad: number | null
  unidad: string
}

export interface Equivalente {
  valor: number
  exacto: boolean
}

export function esDoble(presentacion: PresentacionDoble): boolean {
  return presentacion.unidadCompra !== presentacion.unidadMedida
}

export function contenidoValido(presentacion: PresentacionDoble): boolean {
  return presentacion.contenido !== null && presentacion.contenido > 0
}

/** Elimina el ruido de coma flotante (3 × 0,1) sin redondear de verdad. */
function limpiar(n: number): number {
  return Math.round(n * 1e9) / 1e9
}

/**
 * Unidad efectiva de lo escrito: si ya no es de la presentación (se cambiaron
 * las unidades después de escribir) o las unidades son iguales, la de consumo.
 */
export function unidadEfectiva(
  valor: CantidadTecleada,
  presentacion: PresentacionDoble,
): string {
  return esDoble(presentacion) && valor.unidad === presentacion.unidadCompra
    ? presentacion.unidadCompra
    : presentacion.unidadMedida
}

/**
 * Cantidad en la unidad de consumo (lo que se guarda). `null` si está vacío o
 * si se escribió en la unidad de compra y el contenido aún no es válido.
 */
export function aConsumo(
  valor: CantidadTecleada,
  presentacion: PresentacionDoble,
): number | null {
  if (valor.cantidad === null) return null
  if (unidadEfectiva(valor, presentacion) === presentacion.unidadMedida) return valor.cantidad
  if (!contenidoValido(presentacion)) return null
  return limpiar(valor.cantidad * (presentacion.contenido as number))
}

/** Lo escrito expresado en `unidadDestino`, con ≤ 2 decimales y si es exacto. */
export function equivalente(
  valor: CantidadTecleada,
  presentacion: PresentacionDoble,
  unidadDestino: string,
): Equivalente | null {
  if (valor.cantidad === null) return null
  const origen = unidadEfectiva(valor, presentacion)
  if (origen === unidadDestino) return { valor: valor.cantidad, exacto: true }
  if (!contenidoValido(presentacion)) return null
  const contenido = presentacion.contenido as number
  const crudo =
    origen === presentacion.unidadCompra ? valor.cantidad * contenido : valor.cantidad / contenido
  const redondeado = Math.round(crudo * 100) / 100
  return { valor: redondeado, exacto: Math.abs(crudo - redondeado) < 1e-9 }
}
