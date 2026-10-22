import { useEffect, useState, type FormEvent } from 'react'
import type { Insumo, Lote } from '../../../lib/db'
import { selectFefoLot, type LoteConStock } from '../lib/fefo'
import { crearMovimiento } from '../lib/movements'
import { computeStockLote, movimientosNormalizadosDeLote } from '../lib/stock'
import { validateQuantity } from '../lib/quantity'
import {
  lotesDeInsumo,
  useInventoryStore,
} from '../../../stores/inventoryStore'
import { SearchPicker } from './SearchPicker'
import { Package, Plus, Minus } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useLugarStore } from '../../../stores/lugarStore'

/**
 * User Story 2 (P2): busca un insumo y confirma una cantidad de consumo,
 * descontada por defecto del lote más próximo a caducar (FEFO, FR-006), con
 * override manual, rechazando cualquier sobreconsumo sin escribir movimiento
 * (FR-007).
 *
 * Feature 007: con `insumoInicial` (menú "Consumir otra cantidad") el insumo
 * llega preseleccionado y no se muestra la búsqueda; el override manual de
 * lote sigue listando lotes caducados con stock — la vía explícita para
 * consumirlos (Clarification Q1). `onDone` se llama tras un consumo exitoso.
 * Sin props muestra la búsqueda completa, como en la spec 002 original.
 */
export interface ConsumoFormProps {
  insumoInicial?: Insumo
  onDone?: () => void
  /** Spec 014 FR-014 — lugar elegido desde "Todos"; sin él, el lugar activo. */
  lugarId?: string
}

export function ConsumoForm({ insumoInicial, onDone, lugarId: lugarElegido }: ConsumoFormProps = {}) {
  const lotesCache = useInventoryStore((s) => s.lotes)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  // Spec 014 FR-010: el stock disponible es el del lote en este lugar.
  const lugarId =
    lugarElegido ?? (lugarActivoId && lugarActivoId !== 'todos' ? lugarActivoId : null)
  const [insumo, setInsumo] = useState<Insumo | null>(insumoInicial ?? null)
  const [lotesConStock, setLotesConStock] = useState<LoteConStock[]>([])
  // Only set by a user action (manual override in the <select>, or a scan
  // matching a specific lote) — never by an effect — so the FEFO default
  // below stays a plain derived value instead of duplicated state.
  const [loteOverrideId, setLoteOverrideId] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (!insumo) return

    let cancelado = false
    async function cargarStock() {
      const lotesDelInsumo = lotesDeInsumo(lotesCache, insumo!.id)
      const conStock = await Promise.all(
        lotesDelInsumo.map(async (lote) => {
          const movimientos = (await movimientosNormalizadosDeLote(lote.id)).filter(
            (movimiento) => !lugarId || movimiento.lugarId === lugarId,
          )
          return { lote, stockDisponible: computeStockLote(movimientos) }
        }),
      )
      if (cancelado) return
      setLotesConStock(conStock)
    }
    void cargarStock()
    return () => {
      cancelado = true
    }
  }, [insumo, lotesCache, lugarId])

  const cantidadNumerica = Number(cantidad) || 0
  const loteSeleccionado = loteOverrideId
    ? (lotesConStock.find((entry) => entry.lote.id === loteOverrideId) ?? null)
    : selectFefoLot(lotesConStock, cantidadNumerica)

  function seleccionarInsumo(selected: Insumo, lote?: Lote) {
    setMensajeExito(null)
    setLotesConStock([])
    setLoteOverrideId(lote?.id ?? null)
    setInsumo(selected)
  }

  function reiniciar() {
    setInsumo(insumoInicial ?? null)
    setLotesConStock([])
    setLoteOverrideId(null)
    setCantidad('')
    setError(null)
  }

  function ajustarCantidad(delta: number) {
    const siguiente = cantidadNumerica + delta
    setCantidad(siguiente > 0 ? String(siguiente) : '')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!insumo) return

    setError(null)
    setMensajeExito(null)

    if (!loteSeleccionado) {
      setError('No hay lotes disponibles para este insumo.')
      return
    }

    const validacion = validateQuantity(cantidadNumerica, insumo.unidadMedida)
    if (!validacion.valid) {
      setError(validacion.error ?? 'Cantidad inválida.')
      return
    }

    if (cantidadNumerica > loteSeleccionado.stockDisponible) {
      setError(
        `Stock insuficiente en el lote ${loteSeleccionado.lote.numeroLote}: ` +
          `disponible ${loteSeleccionado.stockDisponible} ${insumo.unidadMedida}.`,
      )
      return
    }

    setIsPending(true)
    try {
      await crearMovimiento({
        tipo: 'consumo',
        loteId: loteSeleccionado.lote.id,
        cantidad: cantidadNumerica,
        lugarId: lugarId ?? undefined,
        unidad: insumo.unidadMedida,
      })
      setMensajeExito(`Consumo de "${insumo.nombre}" registrado.`)
      reiniciar()
      onDone?.()
    } finally {
      setIsPending(false)
    }
  }

  if (!insumo) {
    return (
      <div className="flex flex-col gap-3">
        {mensajeExito && (
          <Card className="bg-success-bg px-3.5 py-2.5">
            <p role="status" className="text-sm text-success-text">
              {mensajeExito}
            </p>
          </Card>
        )}
        <SearchPicker onSelect={(insumo) => seleccionarInsumo(insumo)} />
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-white">
          <Package size={20} />
        </div>
        <p className="text-sm font-bold text-text">{insumo.nombre}</p>
        <div className="flex-1" />
        {!insumoInicial && (
          <TouchButton type="button" variant="ghost" onClick={reiniciar} className="text-sm">
            Cambiar insumo
          </TouchButton>
        )}
      </div>

      {lotesConStock.length === 0 ? (
        <Card className="px-3.5 py-2.5">
          <p className="text-sm text-text-muted">
            No hay lotes disponibles para este insumo.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-1.5">
          {!loteOverrideId && (
            <Badge variant="neutral">Recomendado FEFO</Badge>
          )}
          <IconField
            label="Lote (por defecto, el más próximo a caducar)"
            htmlFor="lote-consumo"
          >
            <select
              id="lote-consumo"
              value={loteSeleccionado?.lote.id ?? ''}
              onChange={(event) => setLoteOverrideId(event.target.value)}
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            >
              {lotesConStock.map(({ lote, stockDisponible }) => (
                <option key={lote.id} value={lote.id}>
                  {lote.numeroLote} —{' '}
                  {lote.fechaCaducidad
                    ? `vence ${lote.fechaCaducidad}`
                    : 'sin fecha de caducidad'}{' '}
                  — disponible {stockDisponible} {insumo.unidadMedida}
                </option>
              ))}
            </select>
          </IconField>
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-sm font-bold text-text">
        <label htmlFor="cantidad-consumo">
          Cantidad a consumir ({insumo.unidadMedida})
        </label>
        <div className="flex items-stretch gap-2">
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => ajustarCantidad(-1)}
            aria-label="Restar uno"
          >
            <Minus size={16} />
          </TouchButton>
          <div className="touch-target flex flex-1 items-center justify-center rounded-md border border-border bg-surface">
            <input
              id="cantidad-consumo"
              type="number"
              step="any"
              required
              value={cantidad}
              onChange={(event) => setCantidad(event.target.value)}
              className="w-full border-none bg-transparent text-center text-[15px] font-extrabold text-text outline-none"
            />
          </div>
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => ajustarCantidad(1)}
            aria-label="Sumar uno"
          >
            <Plus size={16} />
          </TouchButton>
        </div>
      </div>

      {error && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}

      <TouchButton type="submit" disabled={isPending || lotesConStock.length === 0}>
        {isPending ? 'Guardando…' : 'Confirmar consumo'}
      </TouchButton>
    </form>
  )
}
