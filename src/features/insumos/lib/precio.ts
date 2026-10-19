import { db, type CambioInsumo, type CambioLote, type Insumo, type Lote } from '../../../lib/db'
import { getUsuarioActualId, tenantActualOFallar } from '../../../stores/authStore'
import { normalizarUnidad } from '../../../lib/unidades'
import { compararCambios } from './proyeccion'
import { factoresDeUnidad } from './stock'

/**
 * Spec 015 (FR-013, contracts/ui-contracts.md §2) — precio escrito al
 * ingresar: por unidad de compra o el total pagado. `null` = sin precio.
 */
export type PrecioIngreso = { modo: 'unidad' | 'total'; valor: number } | null

/** Total pagado ÷ presentaciones = precio por unidad de compra (sin redondear). */
export function precioDesdeTotal(total: number, presentaciones: number): number {
  return presentaciones > 0 ? total / presentaciones : total
}

/** Precio por unidad de compra a guardar en `Lote.precioCompra` (R6). */
export function precioPorUnidadCompra(
  precio: PrecioIngreso,
  presentaciones: number,
): number | null {
  if (precio === null) return null
  return precio.modo === 'total' ? precioDesdeTotal(precio.valor, presentaciones) : precio.valor
}

/** Spec 015 FR-014 — un precio vacío está permitido; uno escrito debe ser ≥ 0. */
export function validarPrecio(precio: PrecioIngreso): string | null {
  if (precio === null) return null
  if (!Number.isFinite(precio.valor) || precio.valor < 0) {
    return 'El precio debe ser un monto mayor o igual a 0.'
  }
  return null
}

/**
 * Precio vigente de un lote (R6): el último `CambioLote` por `(creadoEn, id)`
 * o, sin cambios, el del ingreso. Puro: el mismo ledger da el mismo precio en
 * cualquier dispositivo, sin importar el orden de llegada.
 */
export function precioVigenteLote(
  lote: Pick<Lote, 'id' | 'precioCompra'>,
  cambiosLote: CambioLote[],
): number | null {
  const ultimo = cambiosLote
    .filter((cambio) => cambio.loteId === lote.id && cambio.campo === 'precioCompra')
    .sort(compararCambios)
    .at(-1)
  return ultimo ? ultimo.valorNuevo : lote.precioCompra
}

/**
 * Costo del lote por unidad de consumo **actual**: precio por unidad de compra
 * ÷ (contenido × factor de su unidad de consumo a la actual, R3). `null` sin
 * precio.
 */
export function costoLote(
  lote: Lote,
  cambiosLote: CambioLote[],
  factores: Map<string, number> = new Map(),
): number | null {
  const precio = precioVigenteLote(lote, cambiosLote)
  if (precio === null) return null
  const factor = factores.get(normalizarUnidad(lote.unidadConsumo)) ?? 1
  const divisor = (lote.contenido > 0 ? lote.contenido : 1) * factor
  return precio / divisor
}

export interface CostoUnitario {
  costo: number
  loteId: string
  /** Fecha del ingreso de ese lote. */
  fecha: string
}

/**
 * Spec 015 FR-012 (Clarifications Q2, research.md R7): el costo por unidad de
 * consumo del **último ingreso con precio** del insumo, en cualquier lugar del
 * tenant. Un ingreso sin precio no lo reemplaza; un precio 0 sí cuenta.
 */
export function costoUnitarioInsumo(
  insumo: Pick<Insumo, 'id'>,
  lotes: Lote[],
  cambiosLote: CambioLote[],
  factores: Map<string, number> = new Map(),
): CostoUnitario | null {
  const conPrecio = lotes
    .filter((lote) => lote.insumoId === insumo.id)
    .filter((lote) => precioVigenteLote(lote, cambiosLote) !== null)
    .sort(compararCambios)
  const ultimo = conPrecio.at(-1)
  if (!ultimo) return null
  return {
    costo: costoLote(ultimo, cambiosLote, factores) as number,
    loteId: ultimo.id,
    fecha: ultimo.creadoEn,
  }
}

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

/** "$1.284.500" — pesos chilenos, redondeado al peso solo al mostrar (FR-017). */
export function formatearCLP(monto: number): string {
  return CLP.format(monto)
}

/**
 * Spec 015 (T048, research.md R7) — costo unitario de cada insumo del tenant,
 * con los factores de su unidad (R3). Para todo el tenant, no por lugar.
 */
export function costosUnitariosPorInsumo(
  insumos: Insumo[],
  lotes: Lote[],
  cambiosLote: CambioLote[],
  cambiosInsumo: CambioInsumo[],
): Map<string, CostoUnitario> {
  const lotesPorInsumo = new Map<string, Lote[]>()
  for (const lote of lotes) {
    const grupo = lotesPorInsumo.get(lote.insumoId) ?? []
    grupo.push(lote)
    lotesPorInsumo.set(lote.insumoId, grupo)
  }
  const costos = new Map<string, CostoUnitario>()
  for (const insumo of insumos) {
    const delInsumo = lotesPorInsumo.get(insumo.id)
    if (!delInsumo) continue
    const factores = factoresDeUnidad(
      insumo,
      cambiosInsumo.filter((c) => c.insumoId === insumo.id),
    )
    const costo = costoUnitarioInsumo(insumo, delInsumo, cambiosLote, factores)
    if (costo) costos.set(insumo.id, costo)
  }
  return costos
}

/**
 * Spec 015 (FR-015, Clarifications Q3, research.md R6) — agrega o corrige el
 * precio por unidad de compra de un lote: una fila nueva de `cambiosLote` con
 * el precio vigente como anterior, sin tocar el lote. Cualquier miembro del
 * tenant; offline-first (Dexie primero, Constitución I). No escribe nada si el
 * precio no cambia.
 */
export async function corregirPrecioLote(
  loteId: string,
  nuevo: number | null,
): Promise<CambioLote | null> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error('No hay un usuario autenticado local — no se puede guardar el precio.')
  }
  if (nuevo !== null && (!Number.isFinite(nuevo) || nuevo < 0)) {
    throw new Error('El precio debe ser un monto mayor o igual a 0.')
  }
  const tenantId = tenantActualOFallar()
  return db.transaction('rw', db.lotes, db.cambiosLote, async () => {
    const lote = await db.lotes.get(loteId)
    if (!lote) throw new Error('El lote no existe.')
    const cambios = await db.cambiosLote.where('loteId').equals(loteId).toArray()
    const anterior = precioVigenteLote(lote, cambios)
    if (anterior === nuevo) return null
    const cambio: CambioLote = {
      id: crypto.randomUUID(),
      tenantId,
      loteId,
      campo: 'precioCompra',
      valorAnterior: anterior,
      valorNuevo: nuevo,
      usuarioId,
      creadoEn: new Date().toISOString(),
      sincronizado: false,
    }
    await db.cambiosLote.add(cambio)
    return cambio
  })
}
