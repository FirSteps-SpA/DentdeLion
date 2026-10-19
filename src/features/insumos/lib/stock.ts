import type { Lote, Movimiento } from '../../../lib/db'

/**
 * A lot's available stock is always derived from its full movement history,
 * never a mutable counter (data-model.md) — this is what makes the
 * "never lose a transaction" guarantee (FR-014) straightforward.
 */
export function computeStockLote(movimientos: Movimiento[]): number {
  return movimientos.reduce((total, movimiento) => {
    switch (movimiento.tipo) {
      case 'ingreso':
      case 'traslado_entrada':
        return total + movimiento.cantidad
      case 'consumo':
      case 'traslado_salida':
        return total - movimiento.cantidad
      case 'ajuste':
        return total + movimiento.cantidad
      default:
        return total
    }
  }, 0)
}

/**
 * Spec 014 (research.md R3): stock de un lote en un lugar = suma de sus
 * movimientos registrados en ese lugar. El lote no "pertenece" a un lugar: un
 * traslado mueve stock del mismo lote de un lugar a otro.
 */
export function stockLoteEnLugar(
  movimientos: Movimiento[],
  loteId: string,
  lugarId: string,
): number {
  return computeStockLote(
    movimientos.filter(
      (movimiento) => movimiento.loteId === loteId && movimiento.lugarId === lugarId,
    ),
  )
}

/**
 * Lotes visibles en un lugar (data-model.md): los dados de alta ahí, más los
 * que tienen movimientos ahí (llegaron por traslado). Así un lote recién
 * creado se ve aunque aún no tenga stock, y uno que solo pasó por el lugar se
 * sigue viendo en su historial.
 */
export function lotesEnLugar(
  lotes: Lote[],
  movimientos: Movimiento[],
  lugarId: string,
): Lote[] {
  const conMovimientos = new Set(
    movimientos
      .filter((movimiento) => movimiento.lugarId === lugarId)
      .map((movimiento) => movimiento.loteId),
  )
  return lotes.filter((lote) => lote.lugarId === lugarId || conMovimientos.has(lote.id))
}
