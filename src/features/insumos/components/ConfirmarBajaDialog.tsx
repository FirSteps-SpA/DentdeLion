import type { Insumo } from '../../../lib/db'
import { AlertTriangle } from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { formatearCantidad } from '../../../lib/unidades'

export interface ConfirmarBajaDialogProps {
  insumo: Insumo
  stockTotal: number
  isPending?: boolean
  error?: string | null
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Confirmación de baja lógica (spec 007 FR-019). Si aún queda stock, lo
 * advierte con color + ícono + texto, pero no bloquea la baja
 * (Clarification Q5).
 */
export function ConfirmarBajaDialog({
  insumo,
  stockTotal,
  isPending = false,
  error = null,
  onConfirmar,
  onCancelar,
}: ConfirmarBajaDialogProps) {
  return (
    <BottomSheet titulo="Eliminar insumo" onClose={onCancelar}>
      <p className="text-sm text-text">
        ¿Eliminar «{insumo.nombre}»? Dejará de aparecer en el inventario, las
        alertas y los formularios. Su historial de movimientos se conserva.
      </p>
      {stockTotal > 0 && (
        <Card className="flex items-center gap-2 bg-warning-30-bg px-3.5 py-2.5">
          <AlertTriangle size={18} className="shrink-0 text-warning-30-text" />
          <p className="text-sm font-bold text-warning-30-text">
            Aún quedan {formatearCantidad(stockTotal, insumo.unidadMedida)} en stock.
          </p>
        </Card>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <TouchButton
          type="button"
          variant="ghost"
          onClick={onCancelar}
          className="flex-1"
        >
          Cancelar
        </TouchButton>
        <TouchButton
          type="button"
          onClick={onConfirmar}
          disabled={isPending}
          className="flex-1 bg-danger!"
        >
          Eliminar
        </TouchButton>
      </div>
    </BottomSheet>
  )
}
