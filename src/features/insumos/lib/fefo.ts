import type { Lote } from '../../../lib/db'

export interface LoteConStock {
  lote: Lote
  stockDisponible: number
}

/**
 * Orders by `fechaCaducidad` ascending, treating `null` (insumo marked as
 * not expiring, FR-002b) as sorting after every dated value — a lote with
 * no fecha de caducidad is a last resort, never picked ahead of a dated one.
 */
export function compararFefo(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b)
}

/**
 * FEFO (First-Expire-First-Out) default lot pick (FR-006): among lots with
 * stock available, prefers the earliest-expiring lot that can fully cover
 * `cantidadNecesaria`; if none can, falls back to the earliest-expiring lot
 * with any stock (so a manual override or an explicit over-consumption
 * rejection has a concrete lot to reason about). Lotes without a fecha de
 * caducidad (FR-002b) are always ordered last — consumed only once every
 * dated lote of the same insumo is exhausted. Returns `null` only when no
 * lot has any stock at all. Pure function — no Dexie/React dependency, so
 * it's directly unit-testable and reusable to validate a manual override.
 */
export function selectFefoLot(
  lotesConStock: LoteConStock[],
  cantidadNecesaria: number,
): LoteConStock | null {
  const conStock = [...lotesConStock]
    .filter((entry) => entry.stockDisponible > 0)
    .sort((a, b) => compararFefo(a.lote.fechaCaducidad, b.lote.fechaCaducidad))

  if (conStock.length === 0) return null

  return (
    conStock.find((entry) => entry.stockDisponible >= cantidadNecesaria) ??
    conStock[0]
  )
}

export interface RepartoFefo {
  partes: { lote: Lote; cantidad: number }[]
  /** Lo que no alcanzó a cubrirse con lotes vigentes (0 si alcanza). */
  faltante: number
  /** Stock en lotes caducados (no se usa; sirve para avisar "solo caducado"). */
  stockCaducado: number
}

/**
 * Spec 016 (research.md R4) — reparte `cantidad` entre los lotes **vigentes**
 * en orden FEFO, completando con el siguiente si uno no alcanza. Los
 * caducados nunca se usan (Constitución IV, mismo criterio que "Consumir 1");
 * `vigente` decide cuáles lo están.
 */
export function repartirFefo(
  lotesConStock: LoteConStock[],
  cantidad: number,
  vigente: (lote: Lote) => boolean,
): RepartoFefo {
  const ordenados = [...lotesConStock]
    .filter((entry) => entry.stockDisponible > 0)
    .sort((a, b) => compararFefo(a.lote.fechaCaducidad, b.lote.fechaCaducidad))
  const stockCaducado = ordenados
    .filter((entry) => !vigente(entry.lote))
    .reduce((total, entry) => total + entry.stockDisponible, 0)

  const partes: RepartoFefo['partes'] = []
  let restante = cantidad
  for (const entry of ordenados) {
    if (restante <= 0) break
    if (!vigente(entry.lote)) continue
    const tomar = Math.min(entry.stockDisponible, restante)
    partes.push({ lote: entry.lote, cantidad: Math.round(tomar * 1e9) / 1e9 })
    restante = Math.round((restante - tomar) * 1e9) / 1e9
  }
  return { partes, faltante: Math.max(0, restante), stockCaducado }
}
