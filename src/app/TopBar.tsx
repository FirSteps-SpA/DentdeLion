import { useAuthStore } from '../stores/authStore'
import { SyncIndicator } from './SyncIndicator'
import { SelectorLugar } from './SelectorLugar'
import { SyncSheet } from './SyncSheet'
import { MenuPerfil } from './MenuPerfil'
import { usePanelSync } from './usePanelSync'

/**
 * Barra superior del área de contenido en tablet y desktop (spec 013 FR-014,
 * contracts/ui-contracts.md): selector de lugar de trabajo (spec 014 FR-008;
 * con un solo lugar, su nombre), indicador de sincronización con su panel
 * (spec 012, mismo comportamiento) y avatar, que abre `MenuPerfil` (spec 032).
 * El logo vive en la `Sidebar`.
 */
export function TopBar({ onVerPerfil }: { onVerPerfil?: () => void }) {
  const usuario = useAuthStore((s) => s.usuario)
  const { indicador, abierto, abrir, cerrar } = usePanelSync()

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border/70 bg-surface/85 px-6 backdrop-blur desk:px-8">
      <SelectorLugar />
      <div className="flex-1" />
      <SyncIndicator indicador={indicador} onClick={abrir} />
      {usuario && <MenuPerfil onVerPerfil={onVerPerfil} />}
      {abierto && <SyncSheet indicador={indicador} onClose={cerrar} />}
    </header>
  )
}
