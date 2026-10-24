import { db, type Lote, type Lugar, type Proveedor } from '../../../lib/db'
import { claveCategoria } from '../../insumos/lib/categorias'
import {
  activosDe,
  buscarEnCatalogo,
  coincidenciaEn,
  desactivadosDe,
  ordenarCatalogo,
} from '../../../lib/catalogo'

/**
 * Spec 021 (research.md R1) — clave de un nombre de proveedor: la misma regla
 * que las categorías y que `clave_nombre` del servidor (trim, sin tildes,
 * minúsculas, espacios colapsados). Dos nombres con la misma clave son el
 * mismo proveedor (FR-002).
 */
export const claveNombre = claveCategoria

const visible = (p: Proveedor) => p.eliminadoEn === null

/** Por nombre sin distinguir mayúsculas ni tildes; desempate por id (estable). */
export function ordenarProveedores(
  proveedores: readonly Proveedor[],
): Proveedor[] {
  return ordenarCatalogo(proveedores)
}

/** Los que se pueden elegir al registrar (FR-005). */
export function activos(proveedores: readonly Proveedor[]): Proveedor[] {
  return activosDe(proveedores)
}

export function desactivados(proveedores: readonly Proveedor[]): Proveedor[] {
  return desactivadosDe(proveedores)
}

/** Activos cuyo nombre contiene el texto, sin distinguir mayúsculas ni tildes. */
export function buscarProveedores(
  proveedores: readonly Proveedor[],
  texto: string,
): Proveedor[] {
  return buscarEnCatalogo(proveedores, texto)
}

export type Coincidencia =
  | { tipo: 'activo'; proveedor: Proveedor }
  | { tipo: 'desactivado'; proveedor: Proveedor }
  | { tipo: 'ninguna' }

/** El proveedor no eliminado con la misma clave que el texto, si lo hay. */
export function coincidencia(
  proveedores: readonly Proveedor[],
  texto: string,
): Coincidencia {
  const encontrada = coincidenciaEn(proveedores, texto)
  return encontrada.tipo === 'ninguna'
    ? encontrada
    : { tipo: encontrada.tipo, proveedor: encontrada.item }
}

/** El predeterminado del lugar, solo si sigue activo (FR-006, FR-013). */
export function predeterminadoDe(
  lugar: Pick<Lugar, 'proveedorPredeterminadoId'> | undefined,
  proveedores: readonly Proveedor[],
): Proveedor | null {
  const id = lugar?.proveedorPredeterminadoId
  if (!id) return null
  const proveedor = proveedores.find((p) => p.id === id)
  return proveedor && visible(proveedor) && proveedor.desactivadoEn === null
    ? proveedor
    : null
}

/**
 * Nombre que se muestra para el proveedor de un lote (R11): el actual del
 * catálogo; si el lote aún no tiene `proveedorId` (antes del primer pull tras
 * actualizar) o el proveedor no está en el dispositivo, el texto del lote.
 */
export function nombreDelLote(
  lote: Pick<Lote, 'proveedorId' | 'proveedor'>,
  porId: ReadonlyMap<string, Proveedor>,
): string {
  const proveedor = lote.proveedorId ? porId.get(lote.proveedorId) : undefined
  return (proveedor?.nombre ?? lote.proveedor).trim()
}

export function mapaPorId(
  proveedores: readonly Proveedor[],
): Map<string, Proveedor> {
  return new Map(proveedores.map((p) => [p.id, p]))
}

/**
 * Lee, dentro de la transacción del registro, el proveedor elegido para un
 * lote nuevo (FR-007, FR-009). Uno desactivado mientras el formulario estaba
 * abierto se acepta (Edge Cases); uno eliminado o inexistente, no.
 */
export async function proveedorParaLote(
  proveedorId: string | null,
): Promise<Proveedor> {
  const proveedor = proveedorId
    ? await db.proveedores.get(proveedorId)
    : undefined
  if (!proveedor || proveedor.eliminadoEn)
    throw new Error(MENSAJE_FALTA_PROVEEDOR)
  return proveedor
}

/** Mismo aviso que cuando el proveedor era texto (spec, US1-3). */
export const MENSAJE_FALTA_PROVEEDOR = 'Ingresa el proveedor.'
