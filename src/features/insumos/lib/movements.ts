import { db, type Movimiento } from '../../../lib/db'
import { getUsuarioActualId, tenantActualOFallar } from '../../../stores/authStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'

export interface CrearMovimientoInput {
  tipo: Movimiento['tipo']
  loteId: string
  cantidad: number
  movimientoOrigenId?: string
  /**
   * Spec 014 FR-010/FR-014 — lugar del movimiento. Sin él, el lugar activo;
   * en "Todos" hay que pasarlo (lo elige "¿En qué lugar?").
   */
  lugarId?: string
  /** Spec 014 (research.md R4) — solo para las dos mitades de un traslado. */
  trasladoId?: string
}

/**
 * The only way to write a Movimiento row (FR-005/FR-013/FR-015). Writes to
 * Dexie first (Constitution I) and marks the row unsynced for the background
 * sync bridge to push. No update/delete function exists in this module —
 * corrections are new `tipo: 'ajuste'` rows referencing the original.
 */
export async function crearMovimiento(
  input: CrearMovimientoInput,
): Promise<Movimiento> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error(
      'No hay un usuario autenticado local — no se puede registrar el movimiento.',
    )
  }

  const movimiento: Movimiento = {
    id: crypto.randomUUID(),
    tenantId: tenantActualOFallar(),
    lugarId: lugarParaEscribirOFallar(input.lugarId),
    trasladoId: input.trasladoId ?? null,
    tipo: input.tipo,
    loteId: input.loteId,
    cantidad: input.cantidad,
    usuarioId,
    movimientoOrigenId: input.movimientoOrigenId ?? null,
    creadoEn: new Date().toISOString(),
    sincronizado: false,
  }

  await db.movimientos.add(movimiento)
  return movimiento
}
