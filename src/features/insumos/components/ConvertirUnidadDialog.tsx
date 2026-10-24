import { useState } from 'react'
import type { Insumo } from '../../../lib/db'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { UNIDADES, etiquetaUnidad, formatearCantidad } from '../../../lib/unidades'
import {
  convertirUnidadConsumo,
  presentacionTrasConversion,
  textoFactor,
  validarConversion,
} from '../lib/conversion'
import { formatearPresentacion } from '../lib/presentacion'
import { computeStockLote } from '../lib/stock'
import { NumeroInput } from '../../../components/ui/NumeroInput'

const SELECT_CLASS =
  'touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text'

export interface ConvertirUnidadDialogProps {
  insumo: Insumo
  onConvertido: () => void
  onClose: () => void
}

/**
 * Spec 015 (contracts/ui-contracts.md §5, FR-007a): convierte la unidad de
 * consumo de un insumo con historial — "1 caja = 100 unidades" — con vista
 * previa del stock (todos los lugares) y del mínimo. El historial anterior se
 * sigue viendo en su unidad. Solo administración. Controles ≥ 48 px.
 */
export function ConvertirUnidadDialog({ insumo, onConvertido, onClose }: ConvertirUnidadDialogProps) {
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  const opciones = UNIDADES.filter((u) => u.clave !== insumo.unidadMedida)
  const [hasta, setHasta] = useState<string>(opciones[0].clave)
  // "1 anterior = N nuevas" (normal) o "1 nueva = N anteriores" (invertido).
  const [invertido, setInvertido] = useState(false)
  const [cantidad, setCantidad] = useState<number | null>(null)
  const [actualizarPresentacion, setActualizarPresentacion] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const factor = cantidad && cantidad > 0 ? (invertido ? 1 / cantidad : cantidad) : Number.NaN
  const lotesDelInsumo = lotes.filter((lote) => lote.insumoId === insumo.id)
  const stocks = lotesDelInsumo.flatMap((lote) => {
    const delLote = movimientos.filter((m) => m.loteId === lote.id)
    return [...new Set(delLote.map((m) => m.lugarId))].map((lugarId) =>
      computeStockLote(delLote.filter((m) => m.lugarId === lugarId)),
    )
  })
  const stockTotal = stocks.reduce((total, stock) => total + stock, 0)
  const minimos = [
    insumo.stockMinimo,
    ...minimosLugar.filter((m) => m.insumoId === insumo.id).map((m) => m.stockMinimo),
  ]
  const errorValidacion = Number.isNaN(factor)
    ? null
    : validarConversion(insumo, { hasta, factor }, stocks, minimos)
  // Solo tiene sentido comprar por la unidad anterior si es la mayor.
  const puedeProponer = !Number.isNaN(factor) && factor > 1
  const presentacion = Number.isNaN(factor)
    ? null
    : presentacionTrasConversion(insumo, {
        hasta,
        factor,
        actualizarPresentacion: puedeProponer && actualizarPresentacion,
      })

  async function convertir() {
    if (Number.isNaN(factor)) {
      setError('Indica la equivalencia entre las unidades.')
      return
    }
    if (errorValidacion) {
      setError(errorValidacion)
      return
    }
    setIsPending(true)
    setError(null)
    try {
      await convertirUnidadConsumo(insumo.id, {
        hasta,
        factor,
        actualizarPresentacion: puedeProponer && actualizarPresentacion,
      })
      onConvertido()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo convertir.')
    } finally {
      setIsPending(false)
    }
  }

  const [izquierda, derecha] = invertido ? [hasta, insumo.unidadMedida] : [insumo.unidadMedida, hasta]

  return (
    <BottomSheet titulo="Cambiar unidad de consumo" onClose={onClose}>
      <p className="text-sm text-text">
        De: <span className="font-bold">{etiquetaUnidad(insumo.unidadMedida)}</span>
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
        A
        <select value={hasta} onChange={(event) => setHasta(event.target.value)} className={SELECT_CLASS}>
          {opciones.map((u) => (
            <option key={u.clave} value={u.clave}>
              {u.singular}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5 text-sm font-bold text-text">
        <label htmlFor="conversion-cantidad">
          1 {etiquetaUnidad(izquierda, 1)} = ¿cuántas {etiquetaUnidad(derecha, 2)}?
        </label>
        <div className="flex items-stretch gap-2">
          <div className="touch-target flex flex-1 items-center rounded-md border border-border-input bg-surface px-3.5">
            <NumeroInput
              id="conversion-cantidad"
              min={0}
              step="any"
              value={cantidad ?? ''}
              onChange={(event) =>
                setCantidad(event.target.value === '' ? null : Number(event.target.value))
              }
              className="w-full border-none bg-transparent text-[15px] font-normal text-text outline-none"
            />
          </div>
          <TouchButton type="button" variant="ghost" onClick={() => setInvertido(!invertido)}>
            Invertir
          </TouchButton>
        </div>
      </div>

      {!Number.isNaN(factor) && (
        <div className="flex flex-col gap-1 text-sm text-text" aria-live="polite">
          <p className="font-bold">{textoFactor(insumo.unidadMedida, hasta, factor)}</p>
          <p>
            Stock actual: {formatearCantidad(stockTotal, insumo.unidadMedida)} →{' '}
            {formatearCantidad(Math.round(stockTotal * factor * 1e6) / 1e6, hasta)} (en todos los
            lugares)
          </p>
          {insumo.stockMinimo !== null && (
            <p>
              Mínimo: {formatearCantidad(insumo.stockMinimo, insumo.unidadMedida)} →{' '}
              {formatearCantidad(Math.round(insumo.stockMinimo * factor * 1e6) / 1e6, hasta)}
            </p>
          )}
          {presentacion && (
            <p>
              Presentación:{' '}
              {formatearPresentacion({ unidadMedida: hasta, ...presentacion })}
            </p>
          )}
        </div>
      )}

      {puedeProponer && (
        <label className="touch-target flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={actualizarPresentacion}
            onChange={(event) => setActualizarPresentacion(event.target.checked)}
            className="h-5 w-5"
          />
          Comprar por {etiquetaUnidad(insumo.unidadMedida)} × {cantidad}{' '}
          {etiquetaUnidad(hasta, factor)}
        </label>
      )}

      <p className="text-xs text-text-muted">
        Los movimientos anteriores se siguen viendo en {etiquetaUnidad(insumo.unidadMedida, 2)}.
      </p>

      {(error ?? errorValidacion) && (
        <p role="alert" className="text-sm text-danger">
          {error ?? errorValidacion}
        </p>
      )}

      <div className="flex gap-2">
        <TouchButton type="button" variant="ghost" onClick={onClose} className="flex-1">
          Cancelar
        </TouchButton>
        <TouchButton
          type="button"
          onClick={() => void convertir()}
          disabled={isPending || Boolean(errorValidacion)}
          className="flex-1"
        >
          {isPending ? 'Convirtiendo…' : 'Convertir'}
        </TouchButton>
      </div>
    </BottomSheet>
  )
}
