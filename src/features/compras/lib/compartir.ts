import type { ItemCompra } from '../../../lib/db'
import { textoPedido, type ItemSugerido } from './sugeridos'

/**
 * Un renglón por ítem pendiente (sugeridos primero, luego manuales), con su
 * cantidad si se indicó y su origen (spec 009 FR-021).
 */
export function construirTextoCompartir(
  sugeridos: ItemSugerido[],
  manuales: ItemCompra[],
): string {
  const lineas: string[] = []
  for (const item of sugeridos) {
    // Spec 015 FR-020: con la cantidad sugerida en unidades de compra.
    const pedido = textoPedido(item)
    lineas.push(`- ${item.insumo.nombre}${pedido ? ` — ${pedido.toLocaleLowerCase('es')}` : ''} (Sugerido)`)
  }
  for (const item of manuales) {
    const cantidad = item.cantidad !== null ? ` x${item.cantidad}` : ''
    lineas.push(`- ${item.nombre}${cantidad} (Manual)`)
  }
  return lineas.join('\n')
}

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
