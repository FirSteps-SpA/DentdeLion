import {
  db,
  type CambioInsumo,
  type Insumo,
  type Lote,
  type Movimiento,
} from '../../../lib/db'
import { reportarErrorSync } from '../../../lib/sync/reportar'
import { normalizarUnidad } from '../../../lib/unidades'
import { compararCambios } from './proyeccion'

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

/**
 * Spec 015 (research.md R3) — cuántas unidades de consumo **actuales** vale una
 * unidad de cada unidad en que el insumo se contó alguna vez. Pliega sus
 * cambios `unidadMedida` vigentes en orden `(creadoEn, id)`; un cambio sin
 * `factor` (etiqueta, anterior a la spec 015) vale 1. Pura y determinista:
 * el mismo ledger da los mismos factores en cualquier dispositivo, sin
 * importar el orden de llegada.
 */
export function factoresDeUnidad(
  insumo: Insumo,
  cambios: CambioInsumo[],
): Map<string, number> {
  const delInsumo = cambios
    .filter((cambio) => cambio.insumoId === insumo.id && cambio.campo === 'unidadMedida')
    .sort(compararCambios)
  const vigentes = delInsumo.filter((cambio) => cambio.rechazadoEn === null)

  const inicial = vigentes[0]
    ? normalizarUnidad(String(vigentes[0].valorAnterior))
    : normalizarUnidad(insumo.unidadMedida)
  const factores = new Map<string, number>([[inicial, 1]])
  for (const cambio of vigentes) {
    const desde = normalizarUnidad(String(cambio.valorAnterior))
    const hasta = normalizarUnidad(String(cambio.valorNuevo))
    const k = cambio.factor ?? 1
    const base = factores.get(desde) ?? 1
    for (const [unidad, f] of factores) factores.set(unidad, (f / base) * k)
    factores.set(hasta, 1)
  }

  // Una conversión rechazada por el servidor no cambia la unidad del insumo,
  // pero pudo haber movimientos registrados en su unidad nueva mientras tanto:
  // se resuelven por la inversa de su factor (R3).
  for (const cambio of delInsumo) {
    if (cambio.rechazadoEn === null) continue
    const desde = normalizarUnidad(String(cambio.valorAnterior))
    const hasta = normalizarUnidad(String(cambio.valorNuevo))
    const fDesde = factores.get(desde)
    if (!factores.has(hasta) && fDesde !== undefined) {
      factores.set(hasta, fDesde / (cambio.factor ?? 1))
    }
  }
  return factores
}

const unidadesDesconocidasReportadas = new Set<string>()

/**
 * Spec 015 (R4) — cantidad de un movimiento en la unidad de consumo actual.
 * Una unidad fuera de la cadena vale 1; solo se reporta si el insumo tuvo
 * alguna conversión real (con factor), porque sin ellas todas las unidades
 * del insumo son equivalentes.
 */
export function cantidadEnUnidadActual(
  movimiento: Pick<Movimiento, 'cantidad' | 'unidad' | 'loteId'>,
  factores: Map<string, number>,
): number {
  const factor = factores.get(normalizarUnidad(movimiento.unidad))
  if (factor !== undefined) return movimiento.cantidad * factor
  const clave = `${movimiento.loteId}|${movimiento.unidad}`
  const huboConversion = [...factores.values()].some((f) => f !== 1)
  if (huboConversion && !unidadesDesconocidasReportadas.has(clave)) {
    unidadesDesconocidasReportadas.add(clave)
    reportarErrorSync('unidad sin factor', {
      message: `Movimiento del lote ${movimiento.loteId} en "${movimiento.unidad}" sin factor de conversión`,
    })
  }
  return movimiento.cantidad
}

/** Movimiento con `cantidad` en la unidad de consumo actual (spec 015 R4). */
export interface MovimientoNormalizado extends Movimiento {
  /**
   * La cantidad tal como se registró, en `unidad`. Opcional solo para que una
   * fila sin normalizar (sin conversiones son iguales) también sirva.
   */
  cantidadOriginal?: number
}

/**
 * Spec 015 (R4) — copia de los movimientos con `cantidad` convertida a la
 * unidad de consumo actual de su insumo. La fila Dexie no cambia; las
 * funciones de stock, alertas, FEFO y compras reciben estas copias.
 */
export function normalizarMovimientos(
  movimientos: Movimiento[],
  lotes: Pick<Lote, 'id' | 'insumoId'>[],
  insumos: Insumo[],
  cambios: CambioInsumo[],
): MovimientoNormalizado[] {
  const insumoDeLote = new Map(lotes.map((lote) => [lote.id, lote.insumoId]))
  const cambiosPorInsumo = new Map<string, CambioInsumo[]>()
  for (const cambio of cambios) {
    if (cambio.campo !== 'unidadMedida') continue
    const grupo = cambiosPorInsumo.get(cambio.insumoId) ?? []
    grupo.push(cambio)
    cambiosPorInsumo.set(cambio.insumoId, grupo)
  }
  const factoresPorInsumo = new Map<string, Map<string, number>>()
  for (const insumo of insumos) {
    factoresPorInsumo.set(
      insumo.id,
      factoresDeUnidad(insumo, cambiosPorInsumo.get(insumo.id) ?? []),
    )
  }
  return movimientos.map((movimiento) => {
    const insumoId = insumoDeLote.get(movimiento.loteId)
    const factores = insumoId ? factoresPorInsumo.get(insumoId) : undefined
    return {
      ...movimiento,
      cantidadOriginal: movimiento.cantidad,
      cantidad: factores ? cantidadEnUnidadActual(movimiento, factores) : movimiento.cantidad,
    }
  })
}

/**
 * Spec 015 (R4) — los movimientos de un lote leídos de Dexie, normalizados a
 * la unidad actual. Es el único punto donde se leen movimientos para calcular
 * stock (prueba de arquitectura `lecturas-movimientos.test.ts`). Lee `lotes`,
 * `insumos`, `cambiosInsumo` y `movimientos`: quien lo llame dentro de una
 * transacción debe incluirlas.
 */
export async function movimientosNormalizadosDeLote(
  loteId: string,
): Promise<MovimientoNormalizado[]> {
  const movimientos = await db.movimientos.where('loteId').equals(loteId).toArray()
  const lote = await db.lotes.get(loteId)
  const insumo = lote ? await db.insumos.get(lote.insumoId) : undefined
  if (!lote || !insumo) {
    return movimientos.map((m) => ({ ...m, cantidadOriginal: m.cantidad }))
  }
  const cambios = await db.cambiosInsumo.where('insumoId').equals(insumo.id).toArray()
  return normalizarMovimientos(movimientos, [lote], [insumo], cambios)
}
