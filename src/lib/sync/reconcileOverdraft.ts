import { db } from '../db'
import {
  computeStockLote,
  movimientosNormalizadosDeLote,
} from '../../features/insumos/lib/stock'
import { bodegaDe } from '../../stores/lugarStore'

/**
 * Recomputes a lot's derived stock from its full movement history and flags
 * it for manual review if negative (FR-014). Never rejects or reverts a
 * movement — this is the sole reconciliation action, run after every sync
 * batch for each lot touched by a movement that lowered its stock. Spec 014:
 * a lot can hold stock in several lugares, so it's flagged if it is negative
 * in any of them. Spec 033 (R3): lugares that share a bodega share its stock,
 * so the check is per bodega (a deactivated or unknown lugar counts alone).
 */
export async function reconcileOverdraft(loteId: string): Promise<void> {
  // Spec 015 (R4): en la unidad actual, por si hubo una conversión.
  const movimientos = await movimientosNormalizadosDeLote(loteId)
  const lugares = new Map((await db.lugares.toArray()).map((lugar) => [lugar.id, lugar]))
  const porBodega = new Map<string, typeof movimientos>()
  for (const movimiento of movimientos) {
    const lugar = lugares.get(movimiento.lugarId)
    const clave = lugar && !lugar.desactivadoEn ? bodegaDe(lugar) : movimiento.lugarId
    const grupo = porBodega.get(clave) ?? []
    grupo.push(movimiento)
    porBodega.set(clave, grupo)
  }
  if ([...porBodega.values()].some((grupo) => computeStockLote(grupo) < 0)) {
    await db.lotes.update(loteId, { estado: 'revision' })
  }
}
