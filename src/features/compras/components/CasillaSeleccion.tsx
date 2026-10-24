import { formatearCLP } from '../../insumos/lib/precio'
import type { ValorItem } from '../lib/pedido'

export interface CasillaSeleccionProps {
  seleccionado: boolean
  onAlternar: () => void
  etiqueta: string
}

/**
 * Spec 022 (FR-001, ui-contracts.md "Casilla en las tarjetas"): la casilla
 * nativa dentro de un `label` de 48 × 48 px (Constitución III), así el toque
 * en cualquier punto del área la alterna y el lector de pantalla la anuncia
 * con el nombre del ítem.
 */
export function CasillaSeleccion({
  seleccionado,
  onAlternar,
  etiqueta,
}: CasillaSeleccionProps) {
  return (
    <label className="touch-target flex shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={seleccionado}
        onChange={onAlternar}
        aria-label={etiqueta}
        className="h-5 w-5 cursor-pointer accent-primary"
      />
    </label>
  )
}

/** El monto del ítem marcado, o por qué no suma (FR-006). */
export function ValorDelItem({ valor }: { valor: ValorItem }) {
  if (valor.tipo === 'monto') {
    return (
      <span className="text-sm font-bold text-text">
        {formatearCLP(valor.monto)}
      </span>
    )
  }
  return (
    <span className="text-xs text-text-muted">
      {valor.tipo === 'sin-precio' ? 'Sin precio' : 'Sin cantidad'}
    </span>
  )
}
