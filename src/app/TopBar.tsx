import { useAuthStore } from '../stores/authStore'
import { useClinicaStore } from '../stores/clinicaStore'
import { SyncIndicator } from './SyncIndicator'
import { SyncSheet } from './SyncSheet'
import { iniciales } from './iniciales'
import { usePanelSync } from './usePanelSync'

/**
 * Barra superior del área de contenido en tablet y desktop (spec 013 FR-014,
 * contracts/ui-contracts.md): nombre de la clínica, indicador de
 * sincronización con su panel (spec 012, mismo comportamiento) y avatar. El
 * logo vive en la `Sidebar`. Deja lugar para el selector de lugar de trabajo
 * de la spec 014.
 */
export function TopBar() {
  const usuario = useAuthStore((s) => s.usuario)
  const nombreClinica = useClinicaStore((s) => s.nombreClinica)
  const { indicador, abierto, abrir, cerrar } = usePanelSync()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface px-6 desk:px-8">
      <span className="inline-flex min-w-0 items-center truncate rounded-pill bg-primary-soft px-3 py-1 text-[13px] font-bold text-primary-text">
        {nombreClinica ?? 'Gabinete'}
      </span>
      <div className="flex-1" />
      <SyncIndicator indicador={indicador} onClick={abrir} />
      {usuario && (
        <div
          title={usuario.nombre}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-text"
        >
          {iniciales(usuario.nombre)}
        </div>
      )}
      {abierto && <SyncSheet indicador={indicador} onClose={cerrar} />}
    </header>
  )
}
