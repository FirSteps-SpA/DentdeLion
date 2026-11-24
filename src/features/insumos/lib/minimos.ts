import { db, type Insumo, type MinimoLugar } from '../../../lib/db'
import { tenantActualOFallar } from '../../../stores/authStore'
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
 * Guarda el mínimo de un insumo en un lugar (solo administradores, desde la
 * edición del insumo). `null` vuelve al mínimo del catálogo: se guarda como
 * fila con `stockMinimo: null`, así es un upsert más para el sync y no un
 * borrado.
 */
export async function guardarMinimoLugar(
  insumo: Insumo,
  lugarId: string,
  valor: number | null,
): Promise<void> {
  const error = validarStockMinimo(valor, insumo.unidadMedida)
  if (error) throw new Error(error)
  await db.minimosLugar.put({
    insumoId: insumo.id,
    lugarId,
    tenantId: tenantActualOFallar(),
    stockMinimo: valor,
    sincronizado: false,
  })
}
