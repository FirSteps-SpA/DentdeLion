import { useState, type FormEvent } from 'react'
import type { Insumo } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { lugaresActivos, nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { useAvisosStore } from '../../../stores/avisosStore'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Stepper } from '../../../components/ui/Stepper'
import { TouchButton } from '../../../components/ui/TouchButton'
import { compararFefo } from '../lib/fefo'
import { permiteDecimales } from '../lib/quantity'
import { stockLoteEnLugar } from '../lib/stock'
import { trasladar } from '../lib/traslado'

export interface TrasladoFormProps {
  insumo: Insumo
  /** Lugar de origen: el activo, o el elegido desde "Todos". */
  origenId: string
  onClose: () => void
}

const SELECT =
  'touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text'

/**
 * "Trasladar {insumo}" (spec 014 US6, contracts/ui-contracts.md): lote (FEFO
 * por defecto, solo con stock en el origen), destino (los otros lugares
 * activos) y cantidad, con máximo el stock del lote en el origen. Al guardar,
 * aviso con "Deshacer" (como el consumo, spec 007).
 */
export function TrasladoForm({ insumo, origenId, onClose }: TrasladoFormProps) {
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const lugares = useLugarStore((s) => s.lugares)

  const conStock = lotes
    .filter((lote) => lote.insumoId === insumo.id)
    .map((lote) => ({ lote, stock: stockLoteEnLugar(movimientos, lote.id, origenId) }))
    .filter((entrada) => entrada.stock > 0)
    .sort((a, b) => compararFefo(a.lote.fechaCaducidad, b.lote.fechaCaducidad))
  const destinos = lugaresActivos(lugares).filter((lugar) => lugar.id !== origenId)

  const [loteId, setLoteId] = useState(conStock[0]?.lote.id ?? '')
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? '')
  const [cantidad, setCantidad] = useState<number | null>(1)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const seleccionado = conStock.find((entrada) => entrada.lote.id === loteId)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!seleccionado || !destinoId || cantidad === null) return
    setError(null)
    setOcupado(true)
    try {
      const [salida] = await trasladar(insumo, {
        loteId,
        origenId,
        destinoId,
        cantidad,
      })
      useAvisosStore.getState().agregar({
        tipo: 'traslado',
        movimientoId: salida.id,
        loteId,
        insumoNombre: insumo.nombre,
        unidadMedida: insumo.unidadMedida,
        detalle: `Trasladado ${cantidad} ${insumo.unidadMedida} a ${nombreLugar(lugares, destinoId)}`,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el traslado.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <BottomSheet titulo={`Trasladar ${insumo.nombre}`} onClose={onClose}>
      {conStock.length === 0 ? (
        <p data-sheet-body className="text-sm text-text-muted">
          No hay stock de {insumo.nombre} en {nombreLugar(lugares, origenId)} para trasladar.
        </p>
      ) : (
        <form
          data-sheet-body
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-col gap-3"
        >
          <p className="text-sm text-text-muted">Desde {nombreLugar(lugares, origenId)}</p>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
            Lote
            <select value={loteId} onChange={(e) => setLoteId(e.target.value)} className={SELECT}>
              {conStock.map(({ lote, stock }) => (
                <option key={lote.id} value={lote.id}>
                  {lote.numeroLote}
                  {lote.fechaCaducidad ? ` — vence ${lote.fechaCaducidad}` : ''} ({stock}{' '}
                  {insumo.unidadMedida})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
            Destino
            <select
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className={SELECT}
            >
              {destinos.map((lugar) => (
                <option key={lugar.id} value={lugar.id}>
                  {lugar.nombre}
                </option>
              ))}
            </select>
          </label>
          <Stepper
            id="traslado-cantidad"
            label={`Cantidad (máximo ${seleccionado?.stock ?? 0} ${insumo.unidadMedida})`}
            value={cantidad}
            onChange={(valor) =>
              setCantidad(valor === null ? null : Math.min(valor, seleccionado?.stock ?? valor))
            }
            min={0}
            permiteDecimales={permiteDecimales(insumo.unidadMedida)}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <TouchButton type="submit" disabled={ocupado || !cantidad || !destinoId}>
            Trasladar
          </TouchButton>
        </form>
      )}
    </BottomSheet>
  )
}
