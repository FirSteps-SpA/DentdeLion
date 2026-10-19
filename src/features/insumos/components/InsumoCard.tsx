import { estadoVisual, type EstadoInsumo } from '../lib/estado'
import { ICONO_ESTADO } from '../lib/estadoIconos'
import type { DisponibilidadConsumoRapido } from '../lib/consumoRapido'
import { useLongPress } from '../lib/useLongPress'
import { MoreVertical } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { formatearPresentacion } from '../lib/presentacion'
import { formatearEquivalente } from '../../../lib/unidades'
import { formatearCLP } from '../lib/precio'
import { useCostosUnitarios } from '../lib/useCostosUnitarios'

export interface InsumoCardProps {
  estadoInsumo: EstadoInsumo
  disponibilidad: DisponibilidadConsumoRapido
  /** Spec 008 FR-026/R9 — solo lo pasa `InventarioView` cuando el usuario es administrador. */
  posibleDuplicado?: boolean
  /** Spec 014 — en "Todos", el stock de cada lugar ("Providencia 4 · Las Condes 2"). */
  desglose?: string
  onOpen: (insumoId: string) => void
  onConsumirUno: (insumoId: string) => void
  onAbrirMenu: (insumoId: string) => void
}

// eslint-disable-next-line react-refresh/only-export-components -- compartido con InventarioTabla
export const MOTIVO_DESHABILITADO: Record<
  'sin-stock' | 'solo-caducado',
  string
> = {
  'sin-stock': 'Sin stock',
  'solo-caducado': 'Solo stock caducado',
}

/**
 * Tarjeta de listado (spec 006 FR-009) con acciones rápidas (spec 007): el
 * área principal abre el detalle, "Consumir 1" consume con un toque, y "⋮"
 * o un toque largo abren el menú de opciones. Tres controles hermanos, no
 * un único botón — HTML no permite botones anidados (research.md R5). El
 * estado de salud y el motivo de un "Consumir 1" deshabilitado siempre son
 * texto, nunca solo color.
 */
export function InsumoCard({
  estadoInsumo,
  disponibilidad,
  posibleDuplicado = false,
  desglose,
  onOpen,
  onConsumirUno,
  onAbrirMenu,
}: InsumoCardProps) {
  const { insumo, stockTotal, loteMasProximoAVencer } = estadoInsumo
  const visual = estadoVisual(estadoInsumo)
  const longPress = useLongPress(() => onAbrirMenu(insumo.id))
  const costo = useCostosUnitarios().get(insumo.id)

  return (
    <Card className="flex w-full items-center gap-2 py-1.5 pr-1.5 pl-0">
      <button
        type="button"
        onClick={() => onOpen(insumo.id)}
        {...longPress}
        className="touch-target flex flex-1 flex-col gap-1 rounded-lg py-1 pl-3.5 text-left select-none"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-muted">{insumo.categoria}</span>
          <Badge variant={visual.tono} icono={ICONO_ESTADO[visual.icono]}>
            {visual.etiqueta}
          </Badge>
          {posibleDuplicado && (
            <Badge variant="warning-30">Posible duplicado</Badge>
          )}
        </span>
        <span className="text-[15px] leading-5 font-bold text-text">
          {insumo.nombre}
        </span>
        {insumo.unidadCompra !== insumo.unidadMedida && (
          // Spec 015 FR-005 (UI §3): "Caja × 50 cartuchos".
          <span className="text-xs text-text-muted">{formatearPresentacion(insumo)}</span>
        )}
        {loteMasProximoAVencer?.fechaCaducidad && (
          <span className="text-xs text-text-muted">
            Lote {loteMasProximoAVencer.numeroLote} — vence{' '}
            {loteMasProximoAVencer.fechaCaducidad}
          </span>
        )}
        <span className="text-sm font-bold text-text-muted">
          {stockTotal} {insumo.unidadMedida}
          {formatearEquivalente(stockTotal, insumo) && (
            // Spec 015 FR-021.
            <span className="font-normal"> {formatearEquivalente(stockTotal, insumo)}</span>
          )}
          {costo && (
            // Spec 015 FR-017 (UI §3): costo unitario junto al stock.
            <span className="font-normal">
              {' · '}
              {formatearCLP(costo.costo)} c/u
            </span>
          )}
        </span>
        {desglose && <span className="text-xs text-text-muted">{desglose}</span>}
      </button>

      <TouchButton
        type="button"
        variant={disponibilidad.ok ? 'secondary' : 'ghost'}
        disabled={!disponibilidad.ok}
        onClick={() => onConsumirUno(insumo.id)}
        aria-label={
          disponibilidad.ok
            ? `Consumir 1 ${insumo.unidadMedida} de ${insumo.nombre}`
            : `${MOTIVO_DESHABILITADO[disponibilidad.motivo]}: ${insumo.nombre}`
        }
        className="shrink-0 px-3 text-sm disabled:text-text-muted"
      >
        {disponibilidad.ok
          ? 'Consumir 1'
          : MOTIVO_DESHABILITADO[disponibilidad.motivo]}
      </TouchButton>

      <TouchButton
        type="button"
        variant="ghost"
        onClick={() => onAbrirMenu(insumo.id)}
        aria-label={`Más opciones de ${insumo.nombre}`}
        aria-haspopup="dialog"
        className="shrink-0 border-none px-0 text-text-muted"
      >
        <MoreVertical size={20} />
      </TouchButton>
    </Card>
  )
}
