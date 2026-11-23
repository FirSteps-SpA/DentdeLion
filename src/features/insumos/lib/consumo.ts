import { db, type Insumo, type Lote, type Movimiento } from '../../../lib/db'
import { vibrarLeve } from '../../../lib/haptics'
import { formatearCantidad } from '../../../lib/unidades'
import { useAvisosStore } from '../../../stores/avisosStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'
import type { LoteConStock } from './fefo'
import { crearMovimiento } from './movements'
import { computeStockLote, movimientosNormalizadosDeLote } from './stock'

/**
 * Spec 025 (research.md R2): consumo desde la hoja "Consumir <insumo>", que
 * reemplaza al "Consumir 1" de un toque de la spec 007.
 */
export type DisponibilidadConsumo =
  | { ok: true }
  | { ok: false; motivo: 'sin-stock' }

/**
 * Habilita "Consumir" con cualquier stock > 0 en el lugar, aunque sea menos
 * de una unidad o solo esté en lotes vencidos (FR-008, FR-009, Clarifications):
 * la hoja deja elegir la cantidad y muestra "Lote vencido".
 */
export function disponibilidadConsumo(
  lotesConStock: LoteConStock[],
): DisponibilidadConsumo {
  return lotesConStock.some((entry) => entry.stockDisponible > 0)
    ? { ok: true }
    : { ok: false, motivo: 'sin-stock' }
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

/** El lote ya no tiene la cantidad pedida al momento de guardar. */
export class StockInsuficienteConsumoError extends Error {
  readonly numeroLote: string
  readonly disponible: number

  constructor(numeroLote: string, disponible: number, unidad: string) {
    super(
      `Stock insuficiente en el lote ${numeroLote}: ` +
        `disponible ${formatearCantidad(disponible, unidad)}.`,
    )
    this.name = 'StockInsuficienteConsumoError'
    this.numeroLote = numeroLote
    this.disponible = disponible
  }
}

export interface RegistrarConsumoInput {
  insumo: Insumo
  loteId: string
  cantidad: number
  /** Spec 014 FR-014 — lugar elegido en "¿En qué lugar?" desde "Todos". */
  lugarId?: string
}

/**
 * Registra el consumo dentro de una transacción `rw` que recalcula el stock
 * del lote en el lugar leyendo Dexie, no el snapshot de la store: dos envíos
 * seguidos no pueden sobregirar el lote antes de que `liveQuery` refresque la
 * UI. Si no alcanza, lanza `StockInsuficienteConsumoError` sin escribir. La
 * vibración y el aviso con "Deshacer" (FR-007) solo ocurren tras el commit.
 */
export async function registrarConsumo({
  insumo,
  loteId,
  cantidad,
  lugarId: lugarElegido,
}: RegistrarConsumoInput): Promise<Movimiento> {
  // Spec 014 FR-010: descuenta del stock del lote en el lugar activo.
  const lugarId = lugarParaEscribirOFallar(lugarElegido)
  const movimiento = await db.transaction(
    'rw',
    [db.lotes, db.movimientos, db.insumos, db.cambiosInsumo],
    async () => {
      const lote = await db.lotes.get(loteId)
      if (!lote || lote.insumoId !== insumo.id) {
        throw new Error('El lote elegido ya no existe.')
      }
      const disponible = computeStockLote(
        (await movimientosNormalizadosDeLote(loteId)).filter(
          (m) => m.lugarId === lugarId,
        ),
      )
      if (cantidad > disponible) {
        throw new StockInsuficienteConsumoError(
          lote.numeroLote,
          disponible,
          insumo.unidadMedida,
        )
      }
      return crearMovimiento({
        tipo: 'consumo',
        loteId,
        cantidad,
        lugarId,
        unidad: insumo.unidadMedida,
      })
    },
  )

  vibrarLeve()
  useAvisosStore.getState().agregar({
    tipo: 'consumo',
    movimientoId: movimiento.id,
    loteId: movimiento.loteId,
    insumoNombre: insumo.nombre,
    unidadMedida: insumo.unidadMedida,
    detalle: `Consumido ${formatearCantidad(cantidad, insumo.unidadMedida)} de ${insumo.nombre}`,
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
