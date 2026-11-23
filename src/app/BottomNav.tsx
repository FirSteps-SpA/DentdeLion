import { SECCIONES, type Vista } from './navegacion'

export type { Vista }

export interface BottomNavProps {
  active: Vista
  onChange: (vista: Vista) => void
  /** spec 010 FR-026 — total de alertas pendientes según preferencias; burbuja oculta si es 0/undefined. */
  alertasBadge?: number
}

/**
 * Barra de navegación inferior del teléfono (DS §29, spec 013): las secciones
 * de `SECCIONES`, 80 px de alto con el área segura, íconos de 24 px y
 * etiquetas de 11/600; activo en turquesa oscuro (AA). Purely presentational;
 * `App.tsx` keeps owning the `vista` state. En tablet y desktop la reemplaza
 * la `Sidebar` (`AppShell`).
 *
 * Anclada (fixed) al borde inferior de la pantalla, tipo app nativa (spec
 * 011 FR-004/FR-005): su padding inferior respeta el área segura del
 * dispositivo (requiere `viewport-fit=cover` en el meta viewport de
 * `index.html`). `AppShell` reserva espacio equivalente en el contenido para
 * que nada quede oculto detrás de la barra.
 *
 * Spec 027 (FR-005, research.md R4): el activo lleva una pastilla menta
 * detrás del ícono (color y texto, no solo color).
 */
export function BottomNav({ active, onChange, alertasBadge }: BottomNavProps) {
  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex h-20 w-full max-w-[480px] items-stretch px-2">
        {SECCIONES.filter((seccion) => !seccion.soloLateral).map(({ vista, etiquetaMovil, Icon }) => {
          const activa = active === vista
          return (
            <button
              key={vista}
              type="button"
              onClick={() => onChange(vista)}
              aria-pressed={activa}
              aria-current={activa ? 'page' : undefined}
              className={`touch-target relative flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-brand ${
                activa ? 'text-primary-text' : 'text-text-muted'
              }`}
            >
              <span
                className={`relative flex h-8 w-14 items-center justify-center rounded-pill ${
                  activa ? 'bg-primary-soft text-brand-icon' : ''
                }`}
              >
                <Icon size={24} />
                {vista === 'alertas' && !!alertasBadge && alertasBadge > 0 && (
                  <span
                    aria-label={`${alertasBadge} alertas pendientes`}
                    className="absolute right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold text-white"
                  >
                    {alertasBadge}
                  </span>
                )}
              </span>
              {etiquetaMovil}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
