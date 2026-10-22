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

export interface KpiVariacion {
  /** "↑ 8 % vs. mes anterior completo", "Nuevo", "Sin datos del período anterior"… */
  texto: string
  /** `success`/`danger` cuando subir o bajar es bueno o malo; `muted` si es solo informativo. */
  tono: 'success' | 'danger' | 'muted'
}

export interface KpiCardProps {
  titulo: string
  valor: ReactNode
  Icono: ComponentType<IconProps>
  /** Color del valor cuando importa (p. ej. hay insumos bajo mínimo). */
  tono?: 'neutro' | 'danger' | 'warning'
  ariaLabel: string
  /** Sin `onClick` la tarjeta es informativa (spec 017, Reportes): un `<div>`. */
  onClick?: () => void
  /** Spec 017 (DS §20) — variación frente al período de comparación. */
  variacion?: KpiVariacion
  /** Spec 017 — aclaraciones bajo el valor ("desde $X", "2 sin precio"…). */
  nota?: ReactNode
}

const TONO_VALOR: Record<NonNullable<KpiCardProps['tono']>, string> = {
  neutro: 'text-text',
  danger: 'text-danger',
  warning: 'text-warning-30-text',
}

const TONO_VARIACION: Record<KpiVariacion['tono'], string> = {
  success: 'text-success-text',
  danger: 'text-danger',
  muted: 'text-text-muted',
}

/**
 * Tarjeta KPI del DS §20 (spec 013): título 13/600, número grande y ícono.
 * Con `onClick` es un botón que lleva a la sección donde se resuelve el tema
 * (FR-024); sin él, una tarjeta informativa. La spec 017 agrega la variación
 * ("↑ 12 % vs. mes anterior", 12/600) y una nota bajo el valor.
 */
export function KpiCard({
  titulo,
  valor,
  Icono,
  tono = 'neutro',
  ariaLabel,
  onClick,
  variacion,
  nota,
}: KpiCardProps) {
  const contenido = (
    <>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-muted">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-brand-icon">
          <Icono size={18} />
        </span>
        {titulo}
      </span>
      <span className="flex flex-col gap-1">
        <span className={`text-num ${TONO_VALOR[tono]}`}>{valor}</span>
        {variacion && (
          <span className={`text-caption font-semibold ${TONO_VARIACION[variacion.tono]}`}>
            {variacion.texto}
          </span>
        )}
        {nota && <span className="text-caption text-text-muted">{nota}</span>}
      </span>
    </>
  )
  const clases =
    'flex min-h-[132px] flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-left shadow-card'
  if (!onClick) {
    // Informativa (Reportes): el valor va bajo el título, así los montos de
    // tarjetas vecinas quedan alineados aunque solo algunas tengan notas.
    return (
      <div role="group" aria-label={ariaLabel} className={`${clases} justify-start`}>
        {contenido}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`touch-target ${clases} justify-between transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
    >
      {contenido}
    </button>
  )
}
