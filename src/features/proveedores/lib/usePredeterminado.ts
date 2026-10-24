import { useInventoryStore } from '../../../stores/inventoryStore'
import { useLugarStore } from '../../../stores/lugarStore'
import { predeterminadoDe } from './proveedores'

/**
 * Spec 021 (FR-006) — id del proveedor predeterminado del lugar donde se
 * registra: el explícito (elegido desde "Todos") o el activo. `null` sin
 * lugar, sin predeterminado o si está desactivado.
 *
 * Los formularios usan "lo elegido, o si no esto": mientras la persona no
 * elige a mano, el campo sigue al predeterminado (también si cambia el lugar
 * o llega uno nuevo por sincronización), y el borrador no lo congela.
 */
export function usePredeterminado(lugarId?: string): string | null {
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const proveedores = useInventoryStore((s) => s.proveedores)
  const id = lugarId ?? (lugarActivoId !== 'todos' ? lugarActivoId : null)
  const lugar = id ? lugares.find((l) => l.id === id) : undefined
  return predeterminadoDe(lugar, proveedores)?.id ?? null
}
