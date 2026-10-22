import type { Lote, Movimiento } from '../../../lib/db'
import { diasEntre } from '../../../lib/dateMath'
import { computeStockLote } from '../../insumos/lib/stock'
import type { FiltroLugar, IndiceCostos } from './gasto'
import { variacion, type Variacion } from './kpis'

export interface ValorEnFecha {
  /** Σ stock × costo de lotes no caducados con stock > 0 (sin redondear). */
  valor: number
  /** Lotes con stock que no se pudieron valorizar. */
  lotesSinPrecio: number
}

export interface ValorInventario extends ValorEnFecha {
  variacion: Variacion
}

/**
 * Spec 017 (FR-015, research.md R8) — valor del inventario del lugar (o de
 * todos) **justo antes** de `fecha`: solo cuentan los movimientos anteriores y
 * los lotes que no estaban caducados el día previo (mismo criterio que las
 * alertas: caducado = días restantes < 0). Un traslado baja en el origen y
 * sube en el destino, así que no cambia el total de "Todos". Recibe
 * movimientos normalizados, en la misma unidad que el costo del índice.
 */
export function valorInventario(
  movimientos: Movimiento[],
  lotes: Lote[],
  indice: IndiceCostos,
  filtro: FiltroLugar,
  fecha: Date,
): ValorEnFecha {
  const limite = fecha.getTime()
  const dia = new Date(limite - 1)
  const porLote = new Map<string, Movimiento[]>()
  for (const movimiento of movimientos) {
    if (Date.parse(movimiento.creadoEn) >= limite) continue
    if (filtro !== 'todos' && movimiento.lugarId !== filtro) continue
    const grupo = porLote.get(movimiento.loteId)
    if (grupo) grupo.push(movimiento)
    else porLote.set(movimiento.loteId, [movimiento])
  }
  let valor = 0
  let lotesSinPrecio = 0
  for (const lote of lotes) {
    const delLote = porLote.get(lote.id)
    if (!delLote) continue
    if (lote.fechaCaducidad !== null && diasEntre(lote.fechaCaducidad, dia) < 0) continue
    const stock = computeStockLote(delLote)
    if (stock <= 1e-9) continue
    const costo = indice.costoPorLote.get(lote.id) ?? null
    if (costo === null) lotesSinPrecio++
    else valor += stock * costo
  }
  return { valor, lotesSinPrecio }
}

/**
 * Valor actual y su variación frente al cierre del mes anterior (el valor
 * justo antes del día 1 del mes en curso). Se usa el precio vigente hoy para
 * ambos (spec Assumptions).
 */
export function valorInventarioConVariacion(
  movimientos: Movimiento[],
  lotes: Lote[],
  indice: IndiceCostos,
  filtro: FiltroLugar,
  ahora: Date,
): ValorInventario {
  const actual = valorInventario(movimientos, lotes, indice, filtro, new Date(ahora.getTime() + 1))
  const cierre = valorInventario(
    movimientos,
    lotes,
    indice,
    filtro,
    new Date(ahora.getFullYear(), ahora.getMonth(), 1),
  )
  return { ...actual, variacion: variacion(actual.valor, cierre.valor) }
}
