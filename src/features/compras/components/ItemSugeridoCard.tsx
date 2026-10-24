import { textoPedido, type ItemSugerido } from '../lib/sugeridos'
import { formatearEquivalente } from '../../../lib/unidades'
import { AlertTriangle, PackageMinus, Check } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import type { ValorItem } from '../lib/pedido'
import { CasillaSeleccion, ValorDelItem } from './CasillaSeleccion'

export interface ItemSugeridoCardProps {
  itemSugerido: ItemSugerido
  stockTotal: number
  onRecibir: (insumoId: string) => void
  /** Spec 022: casilla de selección y, si está marcado, su monto. */
  seleccionado: boolean
  onAlternar: () => void
  etiquetaSeleccion: string
  valor: ValorItem | null
}

/**
 * Tarjeta de un ítem sugerido (spec 009 FR-003/FR-006). Badges combinables:
 * "🟠 Stock Mínimo" y "🔴 Caducado" pueden aparecer juntos en un mismo
 * insumo, nunca ocultándose entre sí (spec 004 Edge Cases, reutilizado aquí).
 */
export function ItemSugeridoCard({
  itemSugerido,
  stockTotal,
  onRecibir,
  seleccionado,
  onAlternar,
  etiquetaSeleccion,
  valor,
}: ItemSugeridoCardProps) {
  const { insumo, stockBajo, caducado } = itemSugerido

  return (
    <Card
      className={`flex w-full items-center gap-1 py-1.5 pr-1.5 pl-0 ${seleccionado ? 'border-primary!' : ''}`}
    >
      <CasillaSeleccion
        seleccionado={seleccionado}
        onAlternar={onAlternar}
        etiqueta={etiquetaSeleccion}
      />
      <div className="flex flex-1 flex-col gap-1 py-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-muted">{insumo.categoria}</span>
          {stockBajo && (
            <Badge variant="warning-30">
              <PackageMinus size={12} />
              Stock Mínimo
            </Badge>
          )}
          {caducado && (
            <Badge variant="danger">
              <AlertTriangle size={12} />
              Caducado
            </Badge>
          )}
        </span>
        <span className="text-sm font-bold text-text">{insumo.nombre}</span>
        <span className="text-sm font-bold text-text-muted">
          {stockTotal} {insumo.unidadMedida}
          {formatearEquivalente(stockTotal, insumo) && (
            <span className="font-normal"> {formatearEquivalente(stockTotal, insumo)}</span>
          )}
        </span>
        {textoPedido(itemSugerido) && (
          // Spec 015 FR-020 (UI §6).
          <span className="text-sm font-bold text-text">{textoPedido(itemSugerido)}</span>
        )}
        {valor && <ValorDelItem valor={valor} />}
      </div>

      <button
        type="button"
        onClick={() => onRecibir(insumo.id)}
        aria-label={`Marcar ${insumo.nombre} como comprado o recibido`}
        className="touch-target flex shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted"
      >
        <Check size={20} />
      </button>
    </Card>
  )
}
