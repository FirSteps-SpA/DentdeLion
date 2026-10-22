import { db, type Insumo, type Lote, type Movimiento } from '../../../lib/db'
import { diasEntre } from '../../../lib/dateMath'
import { vibrarLeve } from '../../../lib/haptics'
import { useAvisosStore } from '../../../stores/avisosStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'
import { compararFefo, type LoteConStock } from './fefo'
import { crearMovimiento } from './movements'
import { computeStockLote, movimientosNormalizadosDeLote } from './stock'

export type DisponibilidadConsumoRapido =
  | { ok: true; lote: Lote }
  | { ok: false; motivo: 'sin-stock' | 'solo-caducado' }

function esVigente(lote: Lote, hoy: Date): boolean {
  // Misma regla que computeAlertasCaducidad (`diasRestantes < 0` = caducado),
  // para que la tarjeta y la alerta nunca discrepen (research.md R1).
  return (
    lote.fechaCaducidad === null || diasEntre(lote.fechaCaducidad, hoy) >= 0
  )
}

/**
 * Lote del que descuenta "Consumir 1" (spec 007 FR-002/FR-003): el vigente
 * (no caducado) con vencimiento más próximo que tenga al menos 1 unidad,
 * con el mismo orden FEFO que `selectFefoLot` (lotes sin fecha al final).
 * A diferencia de `selectFefoLot`, nunca hace fallback a un lote caducado ni
 * a uno que no cubre la unidad completa — eso queda para el flujo completo
 * de "Consumir otra cantidad" (Clarification Q1).
 */
export function selectLoteConsumoRapido(
  lotesConStock: LoteConStock[],
  hoy: Date = new Date(),
): DisponibilidadConsumoRapido {
  const conUnidad = lotesConStock.filter((entry) => entry.stockDisponible >= 1)
  const vigentes = conUnidad
    .filter((entry) => esVigente(entry.lote, hoy))
    .sort((a, b) => compararFefo(a.lote.fechaCaducidad, b.lote.fechaCaducidad))

  if (vigentes.length > 0) return { ok: true, lote: vigentes[0].lote }
  if (conUnidad.length > 0) return { ok: false, motivo: 'solo-caducado' }
  return { ok: false, motivo: 'sin-stock' }
}

/** `lotesConStock` de un insumo a partir de lotes/movimientos ya cargados. */
export function lotesConStockDeInsumo(
  insumoId: string,
  lotes: Lote[],
  movimientos: Movimiento[],
): LoteConStock[] {
  return lotes
    .filter((lote) => lote.insumoId === insumoId)
    .map((lote) => ({
      lote,
      stockDisponible: computeStockLote(
        movimientos.filter((movimiento) => movimiento.loteId === lote.id),
      ),
    }))
}

/**
 * "Consumir 1" (spec 007 FR-001/FR-004): re-elige el lote dentro de una
 * transacción `rw` sobre lotes+movimientos, leyendo Dexie y no el snapshot
 * de la store — así dos toques seguidos no pueden sobregirar un lote antes
 * de que `liveQuery` refresque la UI (spec Edge Cases). Devuelve `null` sin
 * escribir si ya no queda un lote vigente con 1 unidad. La vibración y el
 * aviso solo ocurren tras el commit.
 */
export async function consumirUno(
  insumo: Insumo,
  /** Spec 014 FR-014 — lugar elegido en "¿En qué lugar?" desde "Todos". */
  opciones: { lugarId?: string } = {},
): Promise<Movimiento | null> {
  // Spec 014 FR-010: descuenta del stock del lote en el lugar activo.
  const lugarId = lugarParaEscribirOFallar(opciones.lugarId)
  const movimiento = await db.transaction(
    'rw',
    [db.lotes, db.movimientos, db.insumos, db.cambiosInsumo],
    async () => {
      const lotes = await db.lotes.where('insumoId').equals(insumo.id).toArray()
      const lotesConStock = await Promise.all(
        lotes.map(async (lote) => ({
          lote,
          stockDisponible: computeStockLote(
            (await movimientosNormalizadosDeLote(lote.id)).filter(
              (m) => m.lugarId === lugarId,
            ),
          ),
        })),
      )
      const disponibilidad = selectLoteConsumoRapido(lotesConStock)
      if (!disponibilidad.ok) return null
      return crearMovimiento({
        tipo: 'consumo',
        loteId: disponibilidad.lote.id,
        cantidad: 1,
        lugarId,
        unidad: insumo.unidadMedida,
      })
    },
  )

  if (!movimiento) return null

  vibrarLeve()
  useAvisosStore.getState().agregar({
    tipo: 'consumo',
    movimientoId: movimiento.id,
    loteId: movimiento.loteId,
    insumoNombre: insumo.nombre,
    unidadMedida: insumo.unidadMedida,
  })
  return movimiento
}

/**
 * "Deshacer" (spec 007 FR-008, research.md R2): escribe un `ajuste` que
 * compensa el consumo, vinculado por `movimientoOrigenId`, sin tocar el
 * consumo original. Idempotente: si ya existe una reversión para ese
 * consumo devuelve `null` sin escribir (un doble toque no restaura 2).
 */
export async function deshacerConsumo(
  movimientoConsumoId: string,
): Promise<Movimiento | null> {
  return db.transaction(
    'rw',
    [db.movimientos, db.lotes, db.insumos, db.cambiosInsumo],
    async () => {
    const consumo = await db.movimientos.get(movimientoConsumoId)
    if (!consumo || consumo.tipo !== 'consumo') return null

    const delLote = await movimientosNormalizadosDeLote(consumo.loteId)
    const yaRevertido = delLote.some(
      (movimiento) =>
        movimiento.tipo === 'ajuste' &&
        movimiento.movimientoOrigenId === consumo.id,
    )
    if (yaRevertido) return null

    return crearMovimiento({
      tipo: 'ajuste',
      loteId: consumo.loteId,
      cantidad: consumo.cantidad,
      // Spec 015: en la unidad del consumo, aunque después se haya convertido.
      unidad: consumo.unidad,
      movimientoOrigenId: consumo.id,
      // Spec 014: se revierte en el lugar del consumo, aunque ya se haya
      // cambiado de lugar.
      lugarId: consumo.lugarId,
    })
    },
  )
}
