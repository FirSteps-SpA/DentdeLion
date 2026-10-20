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
  /**
   * Spec 015 (research.md R2/R4) — unidad en que está `cantidad`. Sin ella, la
   * unidad de consumo actual del insumo del lote.
   */
  unidad?: string
  /** Spec 016 (R4/R5) — consumos de un tratamiento realizado y su reversión. */
  tratamientoRealizadoId?: string
}

/**
 * The only way to write a Movimiento row (FR-005/FR-013/FR-015). Writes to
 * Dexie first (Constitution I) and marks the row unsynced for the background
 * sync bridge to push. No update/delete function exists in this module —
 * corrections are new `tipo: 'ajuste'` rows referencing the original.
 */
/**
 * Unidad de consumo actual del insumo de un lote (spec 015 R4). Lee `lotes` e
 * `insumos`: quien llame dentro de una transacción debe incluirlas.
 */
export async function unidadDeConsumoDelLote(loteId: string): Promise<string> {
  const lote = await db.lotes.get(loteId)
  const insumo = lote ? await db.insumos.get(lote.insumoId) : undefined
  if (!insumo) {
    throw new Error('El lote no existe — no se puede registrar el movimiento.')
  }
  return insumo.unidadMedida
}

export async function crearMovimiento(
  input: CrearMovimientoInput,
): Promise<Movimiento> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error(
      'No hay un usuario autenticado local — no se puede registrar el movimiento.',
    )
  }

  const tenantId = tenantActualOFallar()
  const lugarId = lugarParaEscribirOFallar(input.lugarId)
  const unidad = input.unidad ?? (await unidadDeConsumoDelLote(input.loteId))

  const movimiento: Movimiento = {
    id: crypto.randomUUID(),
    tenantId,
    lugarId,
    trasladoId: input.trasladoId ?? null,
    tipo: input.tipo,
    loteId: input.loteId,
    cantidad: input.cantidad,
    unidad,
    tratamientoRealizadoId: input.tratamientoRealizadoId ?? null,
    usuarioId,
    movimientoOrigenId: input.movimientoOrigenId ?? null,
    creadoEn: new Date().toISOString(),
    sincronizado: false,
  }

  await db.movimientos.add(movimiento)
  return movimiento
}
