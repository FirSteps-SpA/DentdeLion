import { db, type Insumo, type MinimoLugar } from '../../../lib/db'
import { esUnidad, etiquetaUnidad, formatearNumero, unidadAdmiteDecimales } from '../../../lib/unidades'
import { exigirAdministrador, nuevoCambio } from './catalogo'
import { reproyectarEnTransaccion } from './proyeccion'
import { computeStockLote, movimientosNormalizadosDeLote } from './stock'

/**
 * Spec 015 (FR-007a, Clarifications Q1, research.md R3): cambiar la unidad de
 * consumo de un insumo con historial. El factor es cuántas unidades nuevas hay
 * en una anterior ("1 caja = 100 unidades" → 100). Los movimientos no se
 * reescriben: el ledger guarda el factor y el stock se lee convertido (R4).
 */
export interface ConversionInput {
  hasta: string
  factor: number
  /**
   * La UI propone "Comprar por {anterior} × factor" (p. ej. guantes que se
   * contaban en cajas pasan a contarse por unidad y se siguen comprando por
   * caja de 100).
   */
  actualizarPresentacion: boolean
}

/** Tolerancia de coma flotante para decidir si un resultado es entero. */
function esEntero(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 1e-9
}

function redondear(n: number): number {
  return esEntero(n) ? Math.round(n) : Math.round(n * 1e9) / 1e9
}

/**
 * Valida una conversión contra el stock de cada lote en cada lugar y los
 * mínimos (Edge Cases "Conversión que no da entero"). `null` si es válida.
 */
export function validarConversion(
  insumo: Pick<Insumo, 'unidadMedida'>,
  { hasta, factor }: Pick<ConversionInput, 'hasta' | 'factor'>,
  stocks: number[],
  minimos: (number | null)[],
): string | null {
  if (!esUnidad(hasta)) return 'Elige una unidad de consumo válida.'
  if (hasta === insumo.unidadMedida) return 'Elige una unidad distinta de la actual.'
  if (!Number.isFinite(factor) || factor <= 0) return 'El factor debe ser un número mayor que cero.'
  if (unidadAdmiteDecimales(hasta)) return null

  const lotesNoEnteros = stocks.filter((stock) => !esEntero(stock * factor)).length
  if (lotesNoEnteros > 0) {
    return `El stock de ${lotesNoEnteros} ${lotesNoEnteros === 1 ? 'lote no es' : 'lotes no son'} múltiplo de la nueva unidad: "${etiquetaUnidad(hasta)}" no admite decimales.`
  }
  if (minimos.some((minimo) => minimo !== null && !esEntero(minimo * factor))) {
    return `El stock mínimo no da un número entero de ${etiquetaUnidad(hasta, 2)}: ajústalo antes de convertir.`
  }
  return null
}

/** Nueva presentación tras convertir (data-model.md "CambioInsumo"). */
export function presentacionTrasConversion(
  insumo: Pick<Insumo, 'unidadMedida' | 'unidadCompra' | 'contenido'>,
  { hasta, factor, actualizarPresentacion }: ConversionInput,
): { unidadCompra: string; contenido: number } {
  const desde = insumo.unidadMedida
  if (actualizarPresentacion) return { unidadCompra: desde, contenido: redondear(factor) }
  if (insumo.unidadCompra === desde || insumo.unidadCompra === hasta) {
    return { unidadCompra: hasta, contenido: 1 }
  }
  return { unidadCompra: insumo.unidadCompra, contenido: redondear(insumo.contenido * factor) }
}

/** "1 caja = 100 unidades". */
export function textoFactor(desde: string, hasta: string, factor: number): string {
  return `1 ${etiquetaUnidad(desde, 1)} = ${formatearNumero(factor)} ${etiquetaUnidad(hasta, factor)}`
}

/**
 * Convierte la unidad de consumo en una transacción Dexie (Constitución I):
 * escribe el cambio `unidadMedida` con su factor, el mínimo convertido y, si
 * cambia, la presentación; convierte los mínimos por lugar y reproyecta. Solo
 * administración (el RLS de `cambios_insumo` también lo exige).
 */
export async function convertirUnidadConsumo(
  insumoId: string,
  input: ConversionInput,
): Promise<void> {
  const usuarioId = exigirAdministrador('convertir la unidad de')

  await db.transaction(
    'rw',
    [db.insumos, db.cambiosInsumo, db.lotes, db.movimientos, db.minimosLugar],
    async () => {
      const insumo = await db.insumos.get(insumoId)
      if (!insumo) throw new Error('El insumo no existe.')

      const stocks: number[] = []
      for (const lote of await db.lotes.where('insumoId').equals(insumoId).toArray()) {
        const movimientos = await movimientosNormalizadosDeLote(lote.id)
        for (const lugarId of new Set(movimientos.map((m) => m.lugarId))) {
          stocks.push(computeStockLote(movimientos.filter((m) => m.lugarId === lugarId)))
        }
      }
      const delInsumo: MinimoLugar[] = await db.minimosLugar
        .filter((minimo) => minimo.insumoId === insumoId)
        .toArray()

      const error = validarConversion(
        insumo,
        input,
        stocks,
        [insumo.stockMinimo, ...delInsumo.map((m) => m.stockMinimo)],
      )
      if (error) throw new Error(error)

      const cambios = [
        nuevoCambio(insumoId, 'unidadMedida', insumo.unidadMedida, input.hasta, usuarioId, input.factor),
      ]
      if (insumo.stockMinimo !== null) {
        cambios.push(
          nuevoCambio(
            insumoId,
            'stockMinimo',
            insumo.stockMinimo,
            redondear(insumo.stockMinimo * input.factor),
            usuarioId,
          ),
        )
      }
      const presentacion = presentacionTrasConversion(insumo, input)
      if (presentacion.unidadCompra !== insumo.unidadCompra) {
        cambios.push(
          nuevoCambio(insumoId, 'unidadCompra', insumo.unidadCompra, presentacion.unidadCompra, usuarioId),
        )
      }
      if (presentacion.contenido !== insumo.contenido) {
        cambios.push(
          nuevoCambio(insumoId, 'contenido', insumo.contenido, presentacion.contenido, usuarioId),
        )
      }
      await db.cambiosInsumo.bulkAdd(cambios)

      for (const minimo of delInsumo) {
        if (minimo.stockMinimo === null) continue
        await db.minimosLugar.put({
          ...minimo,
          stockMinimo: redondear(minimo.stockMinimo * input.factor),
          sincronizado: false,
        })
      }
      await reproyectarEnTransaccion([insumoId])
    },
  )
}
