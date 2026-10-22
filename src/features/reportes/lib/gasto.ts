import type { CambioInsumo, CambioLote, Insumo, Lote, Movimiento } from '../../../lib/db'
import { costoLote } from '../../insumos/lib/precio'
import { factoresDeUnidad } from '../../insumos/lib/stock'

/** Spec 017 — id de un lugar, o todos los lugares del tenant. */
export type FiltroLugar = string | 'todos'

export interface IndiceCostos {
  /** Costo por unidad de consumo **actual** de cada lote; `null` = sin precio. */
  costoPorLote: Map<string, number | null>
  insumoPorLote: Map<string, Insumo>
}

/**
 * Spec 017 (research.md R2, R12) — costo de cada lote calculado una sola vez,
 * con su precio vigente (correcciones de la spec 015) y los factores de
 * conversión de su insumo. Agrupa los ledgers para no recorrerlos por lote.
 */
export function indiceCostos(
  lotes: Lote[],
  insumos: Insumo[],
  cambiosLote: CambioLote[],
  cambiosInsumo: CambioInsumo[],
): IndiceCostos {
  const insumoPorId = new Map(insumos.map((insumo) => [insumo.id, insumo]))
  const cambiosPorLote = agrupar(cambiosLote, (cambio) => cambio.loteId)
  const conversionesPorInsumo = agrupar(
    cambiosInsumo.filter((cambio) => cambio.campo === 'unidadMedida'),
    (cambio) => cambio.insumoId,
  )
  const factoresPorInsumo = new Map<string, Map<string, number>>()
  const costoPorLote = new Map<string, number | null>()
  const insumoPorLote = new Map<string, Insumo>()
  for (const lote of lotes) {
    const insumo = insumoPorId.get(lote.insumoId)
    if (!insumo) continue
    let factores = factoresPorInsumo.get(insumo.id)
    if (!factores) {
      factores = factoresDeUnidad(insumo, conversionesPorInsumo.get(insumo.id) ?? [])
      factoresPorInsumo.set(insumo.id, factores)
    }
    insumoPorLote.set(lote.id, insumo)
    costoPorLote.set(lote.id, costoLote(lote, cambiosPorLote.get(lote.id) ?? [], factores))
  }
  return { costoPorLote, insumoPorLote }
}

export interface ConsumoValorizado {
  movimientoId: string
  insumoId: string
  lugarId: string
  /** Fecha del consumo (también para sus reversiones). */
  creadoEn: string
  /** Cantidad neta de reversiones, en la unidad de consumo actual. */
  cantidad: number
  /** `cantidad × costo del lote`; `null` si el lote no tiene precio. */
  monto: number | null
}

/**
 * Spec 017 (research.md R2, FR-004) — cada consumo del lugar con su monto,
 * neto de los `ajuste` que lo revierten (`movimientoOrigenId`): la reversión
 * se imputa a la fecha y el lugar del consumo, así deshacer algo del mes
 * pasado no deja un gasto negativo este mes. Los consumos revertidos por
 * completo no aparecen. Recibe movimientos **normalizados** a la unidad actual
 * (`inventoryStore.movimientos`), igual que `costoLote`.
 */
export function consumosValorizados(
  movimientos: Movimiento[],
  indice: IndiceCostos,
  filtro: FiltroLugar,
): ConsumoValorizado[] {
  const revertido = new Map<string, number>()
  for (const movimiento of movimientos) {
    if (movimiento.tipo !== 'ajuste' || movimiento.movimientoOrigenId === null) continue
    const origen = movimiento.movimientoOrigenId
    revertido.set(origen, (revertido.get(origen) ?? 0) + movimiento.cantidad)
  }
  const consumos: ConsumoValorizado[] = []
  for (const movimiento of movimientos) {
    if (movimiento.tipo !== 'consumo') continue
    if (filtro !== 'todos' && movimiento.lugarId !== filtro) continue
    const insumo = indice.insumoPorLote.get(movimiento.loteId)
    if (!insumo) continue
    const cantidad = movimiento.cantidad - (revertido.get(movimiento.id) ?? 0)
    if (cantidad <= 1e-9) continue
    const costo = indice.costoPorLote.get(movimiento.loteId) ?? null
    consumos.push({
      movimientoId: movimiento.id,
      insumoId: insumo.id,
      lugarId: movimiento.lugarId,
      creadoEn: movimiento.creadoEn,
      cantidad,
      monto: costo === null ? null : cantidad * costo,
    })
  }
  return consumos
}

function agrupar<T>(items: T[], clave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const item of items) {
    const k = clave(item)
    const grupo = grupos.get(k)
    if (grupo) grupo.push(item)
    else grupos.set(k, [item])
  }
  return grupos
}
