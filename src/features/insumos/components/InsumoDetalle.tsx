import type { Insumo, Lote, Movimiento } from '../../../lib/db'
import { computeStockLote } from '../lib/stock'
import { X } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'

export interface InsumoDetalleProps {
  insumo: Insumo
  lotes: Lote[]
  movimientos: Movimiento[]
  onClose: () => void
}

/**
 * Vista de detalle de solo lectura (spec 006 FR-010): todos los lotes del
 * insumo, su fecha de vencimiento (o "No caduca") y su stock individual, más
 * el stock total agregado. Sin acciones de consumo/edición/eliminación —
 * llegan en la spec 007 (Assumptions).
 */
export function InsumoDetalle({
  insumo,
  lotes,
  movimientos,
  onClose,
}: InsumoDetalleProps) {
  const lotesConStock = lotes.map((lote) => ({
    lote,
    stock: computeStockLote(
      movimientos.filter((movimiento) => movimiento.loteId === lote.id),
    ),
  }))
  const stockTotal = lotesConStock.reduce((total, { stock }) => total + stock, 0)

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">{insumo.categoria}</span>
          <h3 className="text-h3 text-text">{insumo.nombre}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="touch-target flex items-center justify-center rounded-full text-text-muted"
        >
          <X size={20} />
        </button>
      </div>

      <p className="text-sm font-bold text-text">
        Stock total: {stockTotal} {insumo.unidadMedida}
      </p>

      <ul className="flex flex-col divide-y divide-border">
        {lotesConStock.map(({ lote, stock }) => (
          <li key={lote.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="text-text">
              Lote {lote.numeroLote} —{' '}
              {lote.fechaCaducidad
                ? `vence ${lote.fechaCaducidad}`
                : 'No caduca'}
            </span>
            <span className="font-bold text-text-muted">
              {stock} {insumo.unidadMedida}
            </span>
          </li>
        ))}
      </ul>

      <TouchButton type="button" variant="ghost" onClick={onClose}>
        Volver
      </TouchButton>
    </Card>
  )
}
