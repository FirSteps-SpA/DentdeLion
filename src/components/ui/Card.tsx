import type { ComponentType, ElementType, ReactNode } from 'react'
import { ChevronRight, type IconProps } from '../icons'
import { IconoFondo, MiniBarras } from '../decoracion'
import { CUADRADO_TONO, type TonoIcono } from './tonos'

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
      className={`rounded-lg border border-border bg-surface shadow-tarjeta ${className}`}
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
  /** Color del valor y del cuadrado del ícono cuando importa (p. ej. hay insumos bajo mínimo). */
  tono?: 'neutro' | 'danger' | 'warning'
  ariaLabel: string
  /** Sin `onClick` la tarjeta es informativa (spec 017, Reportes): un `<div>`. */
  onClick?: () => void
  /** Spec 017 (DS §20) — variación frente al período de comparación. */
  variacion?: KpiVariacion
  /** Spec 017 — aclaraciones bajo el valor ("desde $X", "2 sin precio"…). */
  nota?: ReactNode
  /** Spec 027 (FR-008): "Valor de inventario" con degradado y mini gráfico. */
  variante?: 'normal' | 'destacada'
}

const TONO_VALOR: Record<NonNullable<KpiCardProps['tono']>, string> = {
  neutro: 'text-text',
  danger: 'text-danger',
  warning: 'text-warning-30-text',
}

const TONO_CUADRADO: Record<NonNullable<KpiCardProps['tono']>, TonoIcono> = {
  neutro: 'primario',
  danger: 'peligro',
  warning: 'aviso',
}

/** Pastilla "Ver detalle →" con el tinte del tono (texto AA sobre su fondo). */
const TONO_PASTILLA: Record<NonNullable<KpiCardProps['tono']>, string> = {
  neutro: 'bg-secondary-bg text-primary-text',
  danger: 'bg-danger-bg text-danger',
  warning: 'bg-warning-30-bg text-warning-30-text',
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
 *
 * Spec 027 (FR-007, FR-008, research.md R6): ícono en cuadrado con el tinte
 * del tono, ícono grande desvaído de fondo (o el mini gráfico en la
 * `destacada`) y, si navega, la pastilla "Ver detalle →" — parte visual del
 * botón (su nombre accesible ya dice "Ver …").
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
  variante = 'normal',
}: KpiCardProps) {
  const destacada = variante === 'destacada'
  const contenido = (
    <>
      {destacada ? (
        <MiniBarras className="absolute right-3 bottom-3 h-9 w-14 opacity-70" />
      ) : (
        <IconoFondo Icono={Icono} size={76} className="absolute -right-2 -bottom-2" />
      )}
      <span className="relative flex items-center gap-2.5 text-[13px] leading-4 font-semibold text-text">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${CUADRADO_TONO[TONO_CUADRADO[tono]]}`}
        >
          <Icono size={18} />
        </span>
        {titulo}
      </span>
      <span className={`relative flex flex-col gap-1 ${destacada ? 'pb-8' : ''}`}>
        <span className={`text-num break-words ${TONO_VALOR[tono]}`}>{valor}</span>
        {variacion && (
          <span className={`text-caption font-semibold ${TONO_VARIACION[variacion.tono]}`}>
            {variacion.texto}
          </span>
        )}
        {nota && <span className="text-caption text-text-muted">{nota}</span>}
      </span>
      {onClick && !destacada && (
        <span
          aria-hidden="true"
          data-ver-detalle
          className={`relative inline-flex w-fit items-center gap-1 rounded-pill px-3 py-1 text-caption font-semibold ${TONO_PASTILLA[tono]}`}
        >
          Ver detalle <ChevronRight size={14} />
        </span>
      )}
    </>
  )
  const fondo = destacada
    ? 'bg-gradient-to-br from-destacada-desde to-destacada-hasta border-secondary-bg'
    : 'bg-surface border-border'
  const clases = `relative overflow-hidden flex min-h-[148px] flex-col gap-3 rounded-lg border p-5 text-left shadow-tarjeta ${fondo}`
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
      className={`touch-target ${clases} justify-between motion-safe:transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
    >
      {contenido}
    </button>
  )
}
