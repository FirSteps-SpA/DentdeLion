import { db, type Insumo, type MinimoLugar } from '../../../lib/db'
import { tenantActualOFallar } from '../../../stores/authStore'
import { bodegaSegunStore } from '../../../stores/lugarStore'
import { validarStockMinimo } from './catalogo'

/**
 * Spec 014 FR-007: mínimo de un insumo en un lugar — el del lugar si se
 * definió, si no el del catálogo (`Insumo.stockMinimo`).
 */
export function minimoEfectivo(
  insumo: Insumo,
  lugarId: string,
  minimosLugar: MinimoLugar[],
): number | null {
  const propio = minimosLugar.find(
    (minimo) => minimo.insumoId === insumo.id && minimo.lugarId === lugarId,
  )
  return propio && propio.stockMinimo !== null ? propio.stockMinimo : insumo.stockMinimo
}

/**
 * Spec 033 (research.md R4): mínimo de un insumo en una bodega = el mayor de
 * los mínimos efectivos de sus lugares (`null` si ninguno tiene). Con un solo
 * lugar es `minimoEfectivo`. Al editar se escribe en todos los lugares de la
 * bodega, así que normalmente coinciden; "el mayor" resuelve de forma
 * determinista dos ediciones sin conexión en lugares distintos.
 */
export function minimoEfectivoBodega(
  insumo: Insumo,
  lugarIds: ReadonlySet<string>,
  minimosLugar: MinimoLugar[],
): number | null {
  let mayor: number | null = null
  for (const lugarId of lugarIds) {
    const minimo = minimoEfectivo(insumo, lugarId, minimosLugar)
    if (minimo !== null && (mayor === null || minimo > mayor)) mayor = minimo
  }
  return mayor
}

/**
 * Spec 033 (R4): el mínimo propio de la bodega (no el del catálogo), el mayor
 * de las filas de sus lugares; `null` si ninguna tiene uno. Es lo que muestra
 * el campo "Stock mínimo en …" para editar.
 */
export function minimoPropioBodega(
  insumoId: string,
  lugarIds: ReadonlySet<string>,
  minimosLugar: MinimoLugar[],
): number | null {
  let mayor: number | null = null
  for (const minimo of minimosLugar) {
    if (minimo.insumoId !== insumoId || !lugarIds.has(minimo.lugarId)) continue
    if (minimo.stockMinimo !== null && (mayor === null || minimo.stockMinimo > mayor)) {
      mayor = minimo.stockMinimo
    }
  }
  return mayor
}

/**
 * Guarda el mínimo de un insumo en un lugar (solo administradores, desde la
 * edición del insumo). `null` vuelve al mínimo del catálogo: se guarda como
 * fila con `stockMinimo: null`, así es un upsert más para el sync y no un
 * borrado. Spec 033 (R4, FR-006): en una bodega compartida, la misma fila en
 * cada uno de sus lugares.
 */
export async function guardarMinimoLugar(
  insumo: Insumo,
  lugarId: string,
  valor: number | null,
): Promise<void> {
  const error = validarStockMinimo(valor, insumo.unidadMedida)
  if (error) throw new Error(error)
  const tenantId = tenantActualOFallar()
  await db.minimosLugar.bulkPut(
    [...bodegaSegunStore(lugarId)].map((id) => ({
      insumoId: insumo.id,
      lugarId: id,
      tenantId,
      stockMinimo: valor,
      sincronizado: false,
    })),
  )
}
