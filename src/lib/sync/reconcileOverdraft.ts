import { db } from '../db'
import {
  computeStockLote,
  movimientosNormalizadosDeLote,
} from '../../features/insumos/lib/stock'

/**
 * Recomputes a lot's derived stock from its full movement history and flags
 * it for manual review if negative (FR-014). Never rejects or reverts a
 * movement — this is the sole reconciliation action, run after every sync
 * batch for each lot touched by a movement that lowered its stock. Spec 014:
 * a lot can hold stock in several lugares, so it's flagged if it is negative
 * in any of them.
 */
export async function reconcileOverdraft(loteId: string): Promise<void> {
  // Spec 015 (R4): en la unidad actual, por si hubo una conversión.
  const movimientos = await movimientosNormalizadosDeLote(loteId)
  const porLugar = new Map<string, typeof movimientos>()
  for (const movimiento of movimientos) {
    const grupo = porLugar.get(movimiento.lugarId) ?? []
    grupo.push(movimiento)
    porLugar.set(movimiento.lugarId, grupo)
  }
  if ([...porLugar.values()].some((grupo) => computeStockLote(grupo) < 0)) {
    await db.lotes.update(loteId, { estado: 'revision' })
  }
}
