import { useId, type ComponentType } from 'react'
import type { IconProps } from '../icons'

/**
 * Spec 027 (research.md R3, FR-017) — decorados del rediseño: SVG propios,
 * inspirados en `ref/2026-11-23-redesign` (no copiados). Todos son
 * `aria-hidden`, no reciben toques (`pointer-events-none`) y no se imprimen.
 * Van en el bundle: se ven sin conexión.
 */

const DECORADO = 'pointer-events-none select-none print:hidden'

/** Mismo trazo que el ícono `Tooth` (DS §7). */
const DIENTE =
  'M7.5 3.5C5.3 3.5 4 5.2 4 7.6c0 1.6.5 3 1 4.4.5 1.4.7 2.8.9 4.3l.4 3.1c.1.9.8 1.6 1.7 1.6.8 0 1.4-.5 1.6-1.3l.9-3.4c.2-.7.8-1.1 1.5-1.1s1.3.4 1.5 1.1l.9 3.4c.2.8.8 1.3 1.6 1.3.9 0 1.6-.7 1.7-1.6l.4-3.1c.2-1.5.4-2.9.9-4.3.5-1.4 1-2.8 1-4.4 0-2.4-1.3-4.1-3.5-4.1-1.3 0-2.3.5-3.2 1.1-.6.4-1.1.6-1.8.6s-1.2-.2-1.8-.6c-.9-.6-1.9-1.1-3.2-1.1Z'

/** Destello de 4 puntas centrado en (x, y). */
function destello(x: number, y: number, r: number): string {
  const k = r * 0.28
  return `M${x} ${y - r}C${x + k * 0.4} ${y - k} ${x + k} ${y - k * 0.4} ${x + r} ${y}C${x + k} ${y + k * 0.4} ${x + k * 0.4} ${y + k} ${x} ${y + r}C${x - k * 0.4} ${y + k} ${x - k} ${y + k * 0.4} ${x - r} ${y}C${x - k} ${y - k * 0.4} ${x - k * 0.4} ${y - k} ${x} ${y - r}Z`
}

/**
 * Diente en línea (con degradado turquesa y, opcional, destellos), para el
 * saludo de Inicio, el pie de la barra lateral y las pantallas de acceso.
 */
export function DienteLinea({
  size = 96,
  destellos = false,
  className = '',
}: {
  size?: number
  destellos?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 28"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-decorado="diente"
      className={`${DECORADO} ${className}`}
    >
      <defs>
        <linearGradient id={`${id}-trazo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand)" />
          <stop offset="1" stopColor="var(--color-primary)" />
        </linearGradient>
      </defs>
      <path
        d={DIENTE}
        transform="translate(2 2)"
        stroke={`url(#${id}-trazo)`}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {destellos && (
        <g fill="var(--color-brand)">
          <path d={destello(28.5, 5, 2.6)} />
          <path d={destello(25.5, 10.5, 1.4)} opacity={0.7} />
        </g>
      )}
    </svg>
  )
}

/**
 * Ondas suaves del fondo (AppShell y pantallas de acceso), arriba del
 * contenedor y a lo ancho, con alto fijo para que no se estiren en páginas
 * largas. El contenedor debe ser `relative`.
 */
export function OndasFondo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-decorado="ondas"
      className={`${DECORADO} absolute inset-x-0 top-0 h-[420px] w-full ${className}`}
    >
      <path
        d="M520 0c120 70 260 60 380 100s220 150 300 110V0Z"
        fill="var(--color-onda-1)"
      />
      <path
        d="M760 0c90 55 180 50 270 70s130 60 170 40V0Z"
        fill="var(--color-onda-2)"
      />
    </svg>
  )
}

/** Onda turquesa al pie de la barra lateral, con el diente encima (FR-002). */
export function OndaSidebar({ className = '' }: { className?: string }) {
  const id = useId()
  return (
    <div
      aria-hidden="true"
      data-decorado="onda-sidebar"
      className={`${DECORADO} relative h-44 w-full overflow-hidden ${className}`}
    >
      <DienteLinea size={112} className="absolute bottom-14 left-4 opacity-40" />
      <svg
        viewBox="0 0 240 90"
        preserveAspectRatio="none"
        focusable="false"
        className="absolute inset-x-0 bottom-0 h-24 w-full"
      >
        <defs>
          <linearGradient id={`${id}-onda`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-brand)" stopOpacity={0.55} />
            <stop offset="1" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        <path d="M0 40C60 10 120 60 180 35S240 20 240 20V90H0Z" fill="var(--color-onda-2)" />
        <path d="M0 58C70 30 130 80 190 52S240 40 240 40V90H0Z" fill={`url(#${id}-onda)`} />
      </svg>
    </div>
  )
}

/** Mini gráfico de barras decorativo de "Valor de inventario" (FR-008). */
export function MiniBarras({ className = '' }: { className?: string }) {
  const alturas = [10, 16, 13, 22, 19, 28, 34]
  return (
    <svg
      viewBox="0 0 70 36"
      aria-hidden="true"
      focusable="false"
      data-decorado="mini-barras"
      className={`${DECORADO} ${className}`}
    >
      {alturas.map((alto, i) => (
        <rect
          key={i}
          x={i * 10}
          y={36 - alto}
          width={6}
          height={alto}
          rx={2}
          fill="var(--color-brand)"
          opacity={0.25 + i * 0.08}
        />
      ))}
    </svg>
  )
}

/**
 * Ícono grande y desvaído de fondo (la "solución al espacio vacío" de la
 * referencia): se ubica con `className` (p. ej. `absolute -right-2 -bottom-2`).
 */
export function IconoFondo({
  Icono,
  size = 88,
  className = '',
}: {
  Icono: ComponentType<IconProps>
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      data-decorado="icono-fondo"
      className={`${DECORADO} text-brand opacity-[0.13] ${className}`}
    >
      <Icono size={size} />
    </span>
  )
}
