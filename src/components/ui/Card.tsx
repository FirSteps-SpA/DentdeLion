import type { ComponentType, ElementType, ReactNode } from 'react'
import type { IconProps } from '../icons'

interface CardProps {
  as?: ElementType
  className?: string
  children?: ReactNode
  [prop: string]: unknown
}

/**
 * Shared rounded-card container (feature 005; DS §10–12 en la spec 013:
 * radio 16, borde claro y sombra suave).
 * Every card-shaped element in the redesign (insumo rows, alert rows, form
 * sections) renders through this instead of a one-off `div` — `as` lets an
 * interactive row render as a `<button>` or `<form>` while keeping the same
 * visual recipe.
 */
export function Card({ as: Component = 'div', className = '', ...props }: CardProps) {
  return (
    <Component
      className={`rounded-lg border border-border bg-surface shadow-card ${className}`}
      {...props}
    />
  )
}

export interface KpiCardProps {
  titulo: string
  valor: number | string
  Icono: ComponentType<IconProps>
  /** Color del valor cuando importa (p. ej. hay insumos bajo mínimo). */
  tono?: 'neutro' | 'danger' | 'warning'
  ariaLabel: string
  onClick: () => void
}

const TONO_VALOR: Record<NonNullable<KpiCardProps['tono']>, string> = {
  neutro: 'text-text',
  danger: 'text-danger',
  warning: 'text-warning-30-text',
}

/**
 * Tarjeta KPI del DS §20 (spec 013): título 13/600, número grande y ícono.
 * Es un botón que lleva a la sección donde se resuelve el tema (FR-024).
 */
export function KpiCard({ titulo, valor, Icono, tono = 'neutro', ariaLabel, onClick }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="touch-target flex min-h-[132px] flex-col justify-between gap-3 rounded-lg border border-border bg-surface p-5 text-left shadow-card transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-muted">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-brand-icon">
          <Icono size={18} />
        </span>
        {titulo}
      </span>
      <span className={`text-num ${TONO_VALOR[tono]}`}>{valor}</span>
    </button>
  )
}
