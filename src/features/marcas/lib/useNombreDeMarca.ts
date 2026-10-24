import { useInventoryStore } from '../../../stores/inventoryStore'

/**
 * Spec 023 (R8, FR-011/FR-012) — nombre actual de la marca de un insumo para
 * mostrarlo junto al nombre, o `null` si no tiene o la marca no está en el
 * dispositivo. Devuelve un string: el componente solo se vuelve a pintar si
 * cambia ese nombre. El store ya excluye las eliminadas.
 */
export function useNombreDeMarca(marcaId: string | null | undefined): string | null {
  return useInventoryStore((s) =>
    marcaId ? (s.marcas.find((marca) => marca.id === marcaId)?.nombre ?? null) : null,
  )
}
