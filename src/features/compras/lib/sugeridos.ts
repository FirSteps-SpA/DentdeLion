import type { Insumo, Lote, Movimiento } from '../../../lib/db'
import { formatearCantidad } from '../../../lib/unidades'
import { computeInsumosStockBajo } from '../../alertas/lib/stockBajo'
import { computeAlertasCaducidad } from '../../alertas/lib/caducidad'

/** data-model.md's ItemSugerido view-model — never persisted, always recomputed. */
export interface ItemSugerido {
  insumo: Insumo
  stockBajo: boolean
  caducado: boolean
  /**
   * Spec 015 (FR-020, research.md R8) — presentaciones completas a pedir para
   * salir de la alerta de stock bajo; `null` si solo está caducado.
   */
  presentacionesSugeridas: number | null
}

/**
 * `max(1, ceil((mínimo − stock) / contenido))`: el mínimo que llega (por la
 * vista de lugar) ya es el efectivo del lugar (spec 014 FR-007).
 */
export function presentacionesParaMinimo(
  insumo: Pick<Insumo, 'stockMinimo' | 'contenido'>,
  stockActual: number,
): number | null {
  if (insumo.stockMinimo === null) return null
  const contenido = insumo.contenido > 0 ? insumo.contenido : 1
  return Math.max(1, Math.ceil((insumo.stockMinimo - stockActual) / contenido))
}

/** "Pedir 2 cajas (100 cartuchos)" o, sin presentación distinta, "Pedir 3 cajas". */
export function textoPedido(item: ItemSugerido): string | null {
  const n = item.presentacionesSugeridas
  if (n === null) return null
  const { insumo } = item
  const pedido = `Pedir ${formatearCantidad(n, insumo.unidadCompra)}`
  if (insumo.unidadCompra === insumo.unidadMedida) return pedido
  return `${pedido} (${formatearCantidad(n * insumo.contenido, insumo.unidadMedida)})`
}

/**
 * Une `computeInsumosStockBajo` y `computeAlertasCaducidad` (nivel
 * `'caducado'`) por `insumo.id` (spec 009 FR-004/FR-005/FR-006,
 * research.md R5) — sin reimplementar ninguna regla de alerta. Un insumo
 * dado de baja nunca aparece porque `insumos` ya viene filtrado por
 * `inventoryStore` (FR-008).
 */
export function computeItemsSugeridos(
  insumos: Insumo[],
  lotes: Lote[],
  movimientos: Movimiento[],
): ItemSugerido[] {
  const stockBajo = new Map(
    computeInsumosStockBajo(insumos, lotes, movimientos).map(
      ({ insumo, stockActual }) => [insumo.id, stockActual],
    ),
  )
  // `nivelesAvisoDias: []` — el nivel 'caducado' de computeAlertasCaducidad
  // depende solo de `diasRestantes < 0`, nunca de los niveles configurados
  // (ver caducidad.ts's nivelAplicable), así que no hace falta leer
  // `alertasStore` aquí para quedarnos solo con los ya vencidos.
  const caducadoIds = new Set(
    computeAlertasCaducidad(insumos, lotes, movimientos, [])
      .filter((alerta) => alerta.nivel === 'caducado')
      .map((alerta) => alerta.insumo.id),
  )

  const items: ItemSugerido[] = []
  for (const insumo of insumos) {
    const stockActual = stockBajo.get(insumo.id)
    const caducado = caducadoIds.has(insumo.id)
    if (stockActual === undefined && !caducado) continue
    items.push({
      insumo,
      stockBajo: stockActual !== undefined,
      caducado,
      presentacionesSugeridas:
        stockActual !== undefined ? presentacionesParaMinimo(insumo, stockActual) : null,
    })
  }
  return items
}
