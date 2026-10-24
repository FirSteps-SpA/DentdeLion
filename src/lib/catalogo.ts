import { claveCategoria, plegar } from '../features/insumos/lib/categorias'

/**
 * Spec 023 (research.md R7) — lo común a los catálogos de nombres del tenant
 * (proveedores, marcas): orden, filtro de activos, búsqueda y coincidencia por
 * clave (FR-002 de la 021 y de la 023). Extraído de `proveedores.ts`.
 */
export interface ItemCatalogo {
  id: string
  nombre: string
  desactivadoEn: string | null
  eliminadoEn: string | null
}

const visible = (item: ItemCatalogo) => item.eliminadoEn === null

/** Por nombre sin distinguir mayúsculas ni tildes; desempate por id (estable). */
export function ordenarCatalogo<T extends ItemCatalogo>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const porNombre = plegar(a.nombre).localeCompare(plegar(b.nombre), 'es')
    return porNombre !== 0 ? porNombre : a.id.localeCompare(b.id)
  })
}

/** Los que se pueden elegir: ni eliminados ni desactivados. */
export function activosDe<T extends ItemCatalogo>(items: readonly T[]): T[] {
  return ordenarCatalogo(
    items.filter((item) => visible(item) && item.desactivadoEn === null),
  )
}

export function desactivadosDe<T extends ItemCatalogo>(items: readonly T[]): T[] {
  return ordenarCatalogo(
    items.filter((item) => visible(item) && item.desactivadoEn !== null),
  )
}

/** Activos cuyo nombre contiene el texto, sin distinguir mayúsculas ni tildes. */
export function buscarEnCatalogo<T extends ItemCatalogo>(
  items: readonly T[],
  texto: string,
): T[] {
  const buscado = plegar(texto.trim()).replace(/\s+/g, ' ')
  const lista = activosDe(items)
  if (!buscado) return lista
  return lista.filter((item) =>
    plegar(item.nombre).replace(/\s+/g, ' ').includes(buscado),
  )
}

export type CoincidenciaCatalogo<T> =
  | { tipo: 'activo'; item: T }
  | { tipo: 'desactivado'; item: T }
  | { tipo: 'ninguna' }

/** El ítem no eliminado con la misma clave que el texto, si lo hay. */
export function coincidenciaEn<T extends ItemCatalogo>(
  items: readonly T[],
  texto: string,
): CoincidenciaCatalogo<T> {
  const clave = claveCategoria(texto)
  if (!clave) return { tipo: 'ninguna' }
  const encontrado = items.find(
    (item) => visible(item) && claveCategoria(item.nombre) === clave,
  )
  if (!encontrado) return { tipo: 'ninguna' }
  return encontrado.desactivadoEn === null
    ? { tipo: 'activo', item: encontrado }
    : { tipo: 'desactivado', item: encontrado }
}
