import { useAuthStore } from '../stores/authStore'
import { APP_NAME } from '../lib/branding'
import { Tooth } from '../components/icons'
import { SyncIndicator } from './SyncIndicator'
import { SelectorLugar } from './SelectorLugar'
import { SyncSheet } from './SyncSheet'
import { MenuPerfil } from './MenuPerfil'
import { usePanelSync } from './usePanelSync'

/**
 * Encabezado del teléfono (feature 005, FR-004; DS §1 en la spec 013: diente
 * outline turquesa y "Dentdelion" en Deep Teal): logo mark, the lugar de
 * trabajo selector (spec 014 FR-008 — a plain pill with the lugar's name when
 * the tenant has only one), the sync indicator and the avatar, which opens
 * `MenuPerfil` (spec 032). Identical on every authenticated screen.
 *
 * El indicador (spec 012) cuenta los cambios pendientes reales y el resultado
 * del último ciclo — reemplaza el indicador binario de conexión de la spec
 * 005. Su panel se abre aquí, con estado local: no cambia de vista, así que
 * un formulario a medio llenar abajo conserva lo ingresado (FR-007).
 *
 * Spec 032 (FR-007/008) reemplaza a la spec 011 FR-006/FR-007 en este punto:
 * el avatar abre un menú con "Ver perfil" y "Cerrar sesión" como atajo;
 * Ajustes → Perfil (`PerfilSection.tsx`) sigue siendo el lugar completo.
 */
export function AppHeader({ onVerPerfil }: { onVerPerfil?: () => void }) {
  const usuario = useAuthStore((s) => s.usuario)
  const { indicador, abierto: panelAbierto, abrir, cerrar } = usePanelSync()

  return (
    <div className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 shadow-card">
      <Tooth size={32} className="shrink-0 text-brand" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[22px] leading-7 font-extrabold tracking-tight text-teal-dark">
          {APP_NAME}
        </span>
        <SelectorLugar compacto />
      </div>
      <div className="flex-1" />
      <SyncIndicator indicador={indicador} onClick={abrir} />
      {usuario && <MenuPerfil onVerPerfil={onVerPerfil} tamano="movil" />}
      {panelAbierto && (
        <SyncSheet indicador={indicador} onClose={cerrar} />
      )}
    </div>
  )
}
