import { APP_NAME } from '../lib/branding'
import { PanelLeftClose, PanelLeftOpen, Tooth } from '../components/icons'
import { SECCIONES, type Vista } from './navegacion'

export interface SidebarProps {
  vista: Vista
  onCambiarVista: (vista: Vista) => void
  alertasBadge?: number
  /** Tablet con la sidebar contraída: solo íconos (spec 013 FR-011/FR-013). */
  contraida: boolean
  /** Solo en tablet: botón para expandir/contraer. */
  onAlternar?: () => void
}

/**
 * Navegación lateral de tablet y desktop (DS §18–19, spec 013 US2/US4):
 * logo arriba y las secciones de `SECCIONES`; ítem activo en menta. Ítems de
 * 48 px de alto (el DS pide 42; Constitución III). Contraída, de 72 px y solo
 * íconos con nombre accesible y `title`.
 */
export function Sidebar({
  vista,
  onCambiarVista,
  alertasBadge,
  contraida,
  onAlternar,
}: SidebarProps) {
  const burbuja = !!alertasBadge && alertasBadge > 0

  return (
    <aside
      className={`sticky top-0 flex h-dvh shrink-0 flex-col gap-6 border-r border-border bg-surface py-5 motion-safe:transition-[width] motion-safe:duration-200 ${
        contraida ? 'w-[72px] items-center px-3' : 'w-60 px-4'
      }`}
    >
      <div
        className={`flex items-center gap-2 ${contraida ? 'justify-center' : 'px-2'}`}
      >
        <Tooth size={32} className="shrink-0 text-brand" />
        {!contraida && (
          <span className="text-[22px] leading-7 font-extrabold tracking-tight text-teal-dark">
            {APP_NAME}
          </span>
        )}
      </div>

      <nav aria-label="Secciones" className="flex w-full flex-col gap-1">
        {SECCIONES.map(({ vista: v, etiquetaLateral, Icon }) => {
          const activa = v === vista
          const conBurbuja = v === 'alertas' && burbuja
          return (
            <button
              key={v}
              type="button"
              onClick={() => onCambiarVista(v)}
              aria-pressed={activa}
              aria-current={activa ? 'page' : undefined}
              aria-label={contraida ? etiquetaLateral : undefined}
              title={contraida ? etiquetaLateral : undefined}
              className={`touch-target relative flex items-center gap-2.5 rounded-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand ${
                contraida ? 'justify-center' : ''
              } ${activa ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:bg-bg'}`}
            >
              <span
                className={`relative shrink-0 ${activa ? 'text-brand-icon' : ''}`}
              >
                <Icon size={20} />
                {conBurbuja && contraida && (
                  <span
                    aria-label={`${alertasBadge} alertas pendientes`}
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold text-white"
                  >
                    {alertasBadge}
                  </span>
                )}
              </span>
              {!contraida && (
                <span className="flex-1 truncate text-left">
                  {etiquetaLateral}
                </span>
              )}
              {conBurbuja && !contraida && (
                <span
                  aria-label={`${alertasBadge} alertas pendientes`}
                  className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1.5 text-[11px] font-bold text-white"
                >
                  {alertasBadge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {onAlternar && (
        <button
          type="button"
          onClick={onAlternar}
          aria-label={contraida ? 'Expandir menú' : 'Contraer menú'}
          title={contraida ? 'Expandir menú' : 'Contraer menú'}
          className={`touch-target mt-auto flex items-center gap-2.5 rounded-md px-3 text-sm font-semibold text-text-muted hover:bg-bg focus-visible:outline-2 focus-visible:outline-brand ${
            contraida ? 'justify-center' : ''
          }`}
        >
          {contraida ? (
            <PanelLeftOpen size={20} />
          ) : (
            <PanelLeftClose size={20} />
          )}
          {!contraida && 'Contraer menú'}
        </button>
      )}
    </aside>
  )
}
