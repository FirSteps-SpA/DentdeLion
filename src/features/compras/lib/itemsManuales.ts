import { db, type Insumo, type ItemCompra } from '../../../lib/db'
import { getUsuarioActualId, tenantActualOFallar } from '../../../stores/authStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'

/** Formulario "+ Añadir Ítem Manual" (spec 009 contracts/ui-contracts.md). */
export interface ItemManualInput {
  nombre: string
  cantidad: number | null
  nota: string
  insumoId: string | null
}

export type CampoItemManual = 'nombre'

export type ValidacionItemManual =
  | { valido: true }
  | { valido: false; errores: Partial<Record<CampoItemManual, string>> }

/** Valida el formulario de ítem manual (spec 009 FR-015/FR-020: sin restricción de unicidad). */
export function validarItemManual(input: ItemManualInput): ValidacionItemManual {
  if (!input.nombre.trim()) {
    return { valido: false, errores: { nombre: 'Ingresa el nombre del ítem.' } }
  }
  return { valido: true }
}

/**
 * Crea un ítem de compra manual (spec 009 FR-015). Abierto a todo usuario
 * autenticado, sin guard de rol — recibir mercadería o pedir algo puntual no
 * es gestión de catálogo (Assumptions).
 */
export async function agregarItemManual(
  input: ItemManualInput,
  /** Spec 014 FR-006/FR-014 — la lista es por lugar; desde "Todos" se elige. */
  opciones: { lugarId?: string } = {},
): Promise<ItemCompra> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error(
      'No hay un usuario autenticado local — no se puede agregar el ítem.',
    )
  }
  const validacion = validarItemManual(input)
  if (!validacion.valido) {
    throw new Error(Object.values(validacion.errores).join(' '))
  }

  const item: ItemCompra = {
    id: crypto.randomUUID(),
    tenantId: tenantActualOFallar(),
    lugarId: lugarParaEscribirOFallar(opciones.lugarId),
    nombre: input.nombre.trim(),
    cantidad: input.cantidad,
    nota: input.nota.trim() || null,
    insumoId: input.insumoId,
    estado: 'pendiente',
    creadoPor: usuarioId,
    creadoEn: new Date().toISOString(),
    compradoPor: null,
    compradoEn: null,
  }
  await db.itemsCompra.add(item)
  return item
}

/**
 * Descarta un ítem manual pendiente (spec 009 FR-018): cualquier usuario
 * autenticado, sin importar quién lo creó. Nunca borra la fila
 * (research.md R1) — solo cambia su `estado`.
 */
export async function eliminarItemManual(itemId: string): Promise<void> {
  await db.itemsCompra.update(itemId, { estado: 'eliminado' })
}

/**
 * Marca un ítem manual sin vincular como comprado sin afectar el inventario
 * (spec 009 FR-012, segundo camino).
 */
export async function marcarCompradoSinInventario(itemId: string): Promise<void> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error(
      'No hay un usuario autenticado local — no se puede marcar el ítem.',
    )
  }
  await db.itemsCompra.update(itemId, {
    estado: 'comprado',
    compradoPor: usuarioId,
    compradoEn: new Date().toISOString(),
  })
}

/**
 * El `Insumo` vinculado a un ítem manual si sigue activo; `null` si no hay
 * vínculo o el insumo se dio de baja (spec 009 FR-017, research.md R8) —
 * derivado, nunca escribe `ItemCompra.insumoId`.
 */
export function insumoVinculado(
  item: ItemCompra,
  insumosActivos: Insumo[],
): Insumo | null {
  if (item.insumoId === null) return null
  return insumosActivos.find((insumo) => insumo.id === item.insumoId) ?? null
}
