import { forwardRef, useId, type ComponentType } from 'react'
import { ChevronRight, type IconProps } from '../../../components/icons'

interface TarjetaSeccionProps {
  titulo: string
  resumen: string | null
  Icon: ComponentType<IconProps>
  onClick: () => void
}

/**
 * Tarjeta del índice de Ajustes (spec 019, UI §2): toda la tarjeta es el
 * botón (56 px en móvil, para que el índice entre en una pantalla, y 72 desde tablet, sobre los 48 de la Constitución III); el resumen se anuncia como
 * descripción. `ref` deja devolverle el foco al volver de la sección.
 */
export const TarjetaSeccion = forwardRef<HTMLButtonElement, TarjetaSeccionProps>(
  function TarjetaSeccion({ titulo, resumen, Icon, onClick }, ref) {
    const idTitulo = useId()
    const idResumen = useId()
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-labelledby={idTitulo}
        aria-describedby={resumen ? idResumen : undefined}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2 md:min-h-[72px] md:py-3 text-left shadow-card transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-brand-icon"
        >
          <Icon size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={idTitulo} className="text-h3 text-text">
            {titulo}
          </span>
          {resumen && (
            <span id={idResumen} className="truncate text-sm text-text-muted">
              {resumen}
            </span>
          )}
        </span>
        <ChevronRight size={18} className="shrink-0 text-text-muted" />
      </button>
    )
  },
)
