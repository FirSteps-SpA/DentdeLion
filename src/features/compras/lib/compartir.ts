// Spec 022: el texto del pedido lo arma `construirMensajePedido` (pedido.ts).

/** true si `navigator.share` existe en este runtime (FR-021). */
export function puedeCompartir(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator
}

/** `navigator.clipboard.writeText` con try/catch; `false` si no está disponible o falla (FR-023). */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
