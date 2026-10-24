import { db, type Insumo, type Marca } from '../../../lib/db'
import { claveCategoria } from '../../insumos/lib/categorias'

/**
 * Spec 023 (research.md R1) — clave de un nombre de marca: la misma regla que
 * categorías, proveedores y `clave_nombre` del servidor. Dos nombres con la
 * misma clave son la misma marca (FR-002).
 */
export const claveMarca = claveCategoria

export function mapaMarcas(marcas: readonly Marca[]): Map<string, Marca> {
  return new Map(marcas.map((marca) => [marca.id, marca]))
}

/**
 * Nombre que se muestra para la marca de un insumo (R8): `null` si no tiene,
 * si la marca todavía no está en el dispositivo o si está eliminada.
 */
export function nombreDeMarca(
  insumo: Pick<Insumo, 'marcaId'>,
  porId: ReadonlyMap<string, Marca>,
): string | null {
  const marca = insumo.marcaId ? porId.get(insumo.marcaId) : undefined
  return marca && !marca.eliminadoEn ? marca.nombre : null
}

/** Insumos que usan cada marca, contando los dados de baja (R11, FR-016). */
export function usosPorMarca(insumos: readonly Insumo[]): Map<string, number> {
  const usos = new Map<string, number>()
  for (const insumo of insumos) {
    if (insumo.marcaId) usos.set(insumo.marcaId, (usos.get(insumo.marcaId) ?? 0) + 1)
  }
  return usos
}

/**
 * Lee, dentro de la transacción del alta o la edición, la marca elegida
 * (Edge Cases): una desactivada mientras el formulario estaba abierto se
 * acepta; una eliminada o inexistente se descarta (`null`).
 */
export async function marcaParaInsumo(
  marcaId: string | null | undefined,
): Promise<string | null> {
  if (!marcaId) return null
  const marca = await db.marcas.get(marcaId)
  return marca && !marca.eliminadoEn ? marca.id : null
}
