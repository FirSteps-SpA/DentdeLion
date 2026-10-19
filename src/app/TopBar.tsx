import { useAuthStore } from '../stores/authStore'
import { SyncIndicator } from './SyncIndicator'
import { SelectorLugar } from './SelectorLugar'
import { SyncSheet } from './SyncSheet'
import { iniciales } from './iniciales'
import { usePanelSync } from './usePanelSync'

/**
 * Barra superior del área de contenido en tablet y desktop (spec 013 FR-014,
 * contracts/ui-contracts.md): selector de lugar de trabajo (spec 014 FR-008;
 * con un solo lugar, su nombre), indicador de sincronización con su panel
 * (spec 012, mismo comportamiento) y avatar. El logo vive en la `Sidebar`.
 */
export function TopBar() {
  const usuario = useAuthStore((s) => s.usuario)
  const { indicador, abierto, abrir, cerrar } = usePanelSync()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface px-6 desk:px-8">
      <SelectorLugar />
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
