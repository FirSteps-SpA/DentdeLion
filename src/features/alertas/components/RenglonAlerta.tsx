import type { ReactNode } from 'react'
import { Card } from '../../../components/ui/Card'

export interface RenglonAlertaProps {
  /** Ícono o punto de estado, a la izquierda. */
  icono: ReactNode
  /** Nombre del material. */
  titulo: string
  /** Segunda línea: fecha y tiempo restante, o stock; incluye el chip de lugar. */
  detalle: ReactNode
  badge?: ReactNode
  onAbrir: () => void
  /** `tarjeta` en Alertas (una `Card` por alerta); `lista` en Inicio (filas con divisores). */
  variante: 'tarjeta' | 'lista'
}

const FOCO =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * Renglón de alerta que abre el detalle del insumo (spec 018 FR-009, R5,
 * contracts/ui-contracts.md §4). El lote no va en el renglón: se ve en el
 * detalle. Botón de ancho completo y ≥ 48 px (Constitución III).
 */
export function RenglonAlerta({
  icono,
  titulo,
  detalle,
  badge,
  onAbrir,
  variante,
}: RenglonAlertaProps) {
  // Los `{' '}` no se ven entre ítems flex, pero separan las partes del
  // nombre accesible ("Ver detalle de Lidocaína 2 % 3 nov 2026 · …").
  const contenido = (
    <>
      {icono}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-bold text-text">
          <span className="sr-only">Ver detalle de</span> {titulo}
        </span>{' '}
        <span className="text-caption text-text-muted">{detalle}</span>
      </span>{' '}
      {badge}
    </>
  )

  if (variante === 'tarjeta') {
    return (
      <Card
        as="button"
        type="button"
        onClick={onAbrir}
        className={`touch-target flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:border-brand ${FOCO}`}
      >
        {contenido}
      </Card>
    )
  }
  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`touch-target flex w-full items-center gap-3 py-2.5 text-left ${FOCO}`}
    >
      {contenido}
    </button>
  )
}
