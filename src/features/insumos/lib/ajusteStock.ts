import { db, type Insumo, type Lote, type Lugar, type Movimiento } from '../../../lib/db'
import { estaVencido } from '../../alertas/lib/caducidad'
import { editarInsumo, exigirAdministrador, type CambiosInsumoInput } from './catalogo'
import { guardarMinimoLugar } from './minimos'
import { crearMovimiento } from './movements'
import { lotesEnLugar, movimientosNormalizadosDeLote, stockLoteEnLugar } from './stock'

/**
 * Spec 024 (data-model.md) — corrección de stock de un lote en un lugar:
 * `cantidad` es la cantidad final deseada, en la unidad de consumo actual.
 */
export interface CorreccionStock {
  loteId: string
  lugarId: string
  cantidad: number
}

/** Spec 024 (R4) — un renglón de "Stock por lote" en Editar. */
export interface FilaStockLote {
  lote: Lote
  lugarId: string
  /** Solo en "Todos", donde un mismo lote puede tener stock en varios lugares. */
  nombreLugar: string | null
  stock: number
  vencido: boolean
}

/** Margen para comparar cantidades con decimales (mL, g). */
const EPSILON = 1e-9

/**
 * Spec 024 (R2) — lotes vencidos del insumo con stock en el lugar, para la
 * casilla "Descartar stock vencido" de la recepción. Recibe movimientos
 * normalizados (`inventoryStore`).
 */
export function stockVencidoEnLugar(
  insumo: Insumo,
  lotes: Lote[],
  movimientos: Movimiento[],
  lugarId: string,
  hoy: Date = new Date(),
): { lote: Lote; stock: number }[] {
  if (!insumo.caduca) return []
  return lotes
    .filter((lote) => lote.insumoId === insumo.id && estaVencido(lote, hoy))
    .map((lote) => ({ lote, stock: stockLoteEnLugar(movimientos, lote.id, lugarId) }))
    .filter(({ stock }) => stock > EPSILON)
}

/** Vencimiento ascendente, los que no caducan al final; empate por antigüedad. */
function compararLotes(a: Lote, b: Lote): number {
  if (a.fechaCaducidad !== b.fechaCaducidad) {
    if (a.fechaCaducidad === null) return 1
    if (b.fechaCaducidad === null) return -1
    return a.fechaCaducidad.localeCompare(b.fechaCaducidad)
  }
  return a.creadoEn.localeCompare(b.creadoEn)
}

/**
 * Spec 024 (R4) — renglones de "Stock por lote". En un lugar: los lotes
 * visibles ahí (`lotesEnLugar`), también los que quedaron en 0, para poder
 * corregir un descarte por error. En "Todos": un renglón por lote y lugar con
 * stock, porque el stock vive en cada lugar (spec 014 R3).
 */
export function filasStockPorLote(
  insumo: Insumo,
  lotes: Lote[],
  movimientos: Movimiento[],
  vista: string,
  lugares: Lugar[],
  hoy: Date = new Date(),
): FilaStockLote[] {
  const delInsumo = lotes.filter((lote) => lote.insumoId === insumo.id).sort(compararLotes)

  if (vista !== 'todos') {
    return lotesEnLugar(delInsumo, movimientos, vista).map((lote) => ({
      lote,
      lugarId: vista,
      nombreLugar: null,
      stock: stockLoteEnLugar(movimientos, lote.id, vista),
      vencido: estaVencido(lote, hoy),
    }))
  }

  const filas: FilaStockLote[] = []
  for (const lote of delInsumo) {
    const lugaresDelLote = new Set(
      movimientos.filter((m) => m.loteId === lote.id).map((m) => m.lugarId),
    )
    for (const lugar of lugares) {
      if (!lugaresDelLote.has(lugar.id)) continue
      const stock = stockLoteEnLugar(movimientos, lote.id, lugar.id)
      if (Math.abs(stock) <= EPSILON) continue
      filas.push({
        lote,
        lugarId: lugar.id,
        nombreLugar: lugar.nombre,
        stock,
        vencido: estaVencido(lote, hoy),
      })
    }
  }
  return filas
}

/** Spec 024 (data-model.md) — `null` si la cantidad sirve. */
export function validarCantidadLote(
  cantidad: number,
  insumo: Pick<Insumo, 'permiteDecimales'>,
): string | null {
  if (!Number.isFinite(cantidad) || cantidad < 0) return 'Ingresa una cantidad de 0 o más.'
  if (!insumo.permiteDecimales && !Number.isInteger(cantidad)) {
    return 'Esta unidad no admite decimales.'
  }
  return null
}

/** Stock actual de un lote en un lugar, leído de Dexie y normalizado (R2/R4). */
async function stockActualEnLugar(loteId: string, lugarId: string): Promise<number> {
  return stockLoteEnLugar(await movimientosNormalizadosDeLote(loteId), loteId, lugarId)
}

/**
 * Spec 024 (R2) — deja en 0 cada lote vencido del insumo con stock en el
 * lugar, con un `ajuste` sin `movimientoOrigenId` (no es una anulación). El
 * stock se recalcula aquí, no se toma de la UI. Pensada para correr dentro de
 * la transacción de `recibirEnInsumo`, que debe incluir `lotes`, `insumos`,
 * `cambiosInsumo` y `movimientos`, y antes de agregar el lote nuevo.
 */
export async function descartarVencidosEnTransaccion(
  insumo: Insumo,
  lugarId: string,
  hoy: Date,
): Promise<Movimiento[]> {
  if (!insumo.caduca) return []
  const lotes = await db.lotes.where('insumoId').equals(insumo.id).toArray()
  const ajustes: Movimiento[] = []
  for (const lote of lotes) {
    if (!estaVencido(lote, hoy)) continue
    const stock = await stockActualEnLugar(lote.id, lugarId)
    if (stock <= EPSILON) continue
    ajustes.push(
      await crearMovimiento({
        tipo: 'ajuste',
        loteId: lote.id,
        cantidad: -stock,
        lugarId,
        unidad: insumo.unidadMedida,
      }),
    )
  }
  return ajustes
}

/**
 * Spec 024 (R4, FR-005/FR-006) — corrige el stock de lotes del insumo: un
 * `ajuste` por la diferencia entre lo escrito y el stock actual de cada lote
 * en su lugar, recalculado al guardar. Solo administradores. Si el llamador
 * ya abrió una transacción (`guardarEdicionInsumo`), esta se anida en ella.
 */
export async function ajustarStockLotes(
  insumoId: string,
  correcciones: CorreccionStock[],
): Promise<Movimiento[]> {
  exigirAdministrador('ajustar el stock de')
  if (correcciones.length === 0) return []

  return db.transaction(
    'rw',
    [db.lotes, db.insumos, db.cambiosInsumo, db.movimientos],
    async () => {
      const insumo = await db.insumos.get(insumoId)
      if (!insumo) throw new Error('El insumo no existe.')
      for (const { cantidad } of correcciones) {
        const error = validarCantidadLote(cantidad, insumo)
        if (error) throw new Error(error)
      }

      const ajustes: Movimiento[] = []
      for (const { loteId, lugarId, cantidad } of correcciones) {
        const lote = await db.lotes.get(loteId)
        if (!lote || lote.insumoId !== insumoId) {
          throw new Error('El lote no pertenece a este insumo.')
        }
        const diferencia = cantidad - (await stockActualEnLugar(loteId, lugarId))
        if (Math.abs(diferencia) <= EPSILON) continue
        ajustes.push(
          await crearMovimiento({
            tipo: 'ajuste',
            loteId,
            cantidad: diferencia,
            lugarId,
            unidad: insumo.unidadMedida,
          }),
        )
      }
      return ajustes
    },
  )
}

/**
 * Spec 024 (R4, FR-008) — guarda el formulario de edición completo en una
 * sola transacción: los datos de catálogo, las correcciones de stock por lote
 * y el mínimo del lugar. Las transacciones de cada parte se anidan en esta,
 * así que un error en cualquiera revierte las tres.
 */
export async function guardarEdicionInsumo(input: {
  insumo: Insumo
  cambios: CambiosInsumoInput
  correcciones: CorreccionStock[]
  minimoLugar: { lugarId: string; valor: number | null } | null
}): Promise<void> {
  const { insumo, cambios, correcciones, minimoLugar } = input
  await db.transaction(
    'rw',
    [
      db.insumos,
      db.cambiosInsumo,
      db.categorias,
      db.lotes,
      db.marcas,
      db.movimientos,
      db.minimosLugar,
    ],
    async () => {
      if (Object.keys(cambios).length > 0) await editarInsumo(insumo.id, cambios)
      if (correcciones.length > 0) await ajustarStockLotes(insumo.id, correcciones)
      if (minimoLugar) await guardarMinimoLugar(insumo, minimoLugar.lugarId, minimoLugar.valor)
    },
  )
}
