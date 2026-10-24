import { paginasVisibles, rangoPagina } from '../../lib/paginacion'
import { ChevronLeft, ChevronRight } from '../icons'
import { TouchButton } from './TouchButton'

export interface PaginadorProps {
  pagina: number
  paginas: number
  total: number
  /** `aria-label` del `<nav>`, p. ej. "Páginas del inventario". */
  etiqueta: string
  onIrAPagina: (pagina: number) => void
}

/**
 * Páginas numeradas de la tabla de desktop (spec 020 FR-007, R6): anterior,
 * números abreviados con "…", siguiente y el rango visible. No se muestra con
 * una sola página.
 */
export function Paginador({
  pagina,
  paginas,
  total,
  etiqueta,
  onIrAPagina,
}: PaginadorProps) {
  if (paginas <= 1) return null
  const { desde, hasta } = rangoPagina(pagina, total)
  return (
    <nav
      aria-label={etiqueta}
      className="flex flex-wrap items-center justify-between gap-2"
    >
      <p className="text-sm text-text-muted">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex items-center gap-1">
        <TouchButton
          type="button"
          variant="ghost"
          onClick={() => onIrAPagina(pagina - 1)}
          disabled={pagina <= 1}
        >
          <ChevronLeft size={16} />
          Anterior
        </TouchButton>
        {paginasVisibles(pagina, paginas).map((p, i) =>
          p === '…' ? (
            <span
              key={`hueco-${i}`}
              aria-hidden="true"
              className="px-1 text-sm text-text-muted"
            >
              …
            </span>
          ) : (
            <TouchButton
              key={p}
              type="button"
              variant={p === pagina ? 'primary' : 'ghost'}
              aria-label={`Página ${p}`}
              aria-current={p === pagina ? 'page' : undefined}
              onClick={() => onIrAPagina(p)}
              className="px-3"
            >
              {p}
            </TouchButton>
          ),
        )}
        <TouchButton
          type="button"
          variant="ghost"
          onClick={() => onIrAPagina(pagina + 1)}
          disabled={pagina >= paginas}
        >
          Siguiente
          <ChevronRight size={16} />
        </TouchButton>
      </div>
    </nav>
  )
}
