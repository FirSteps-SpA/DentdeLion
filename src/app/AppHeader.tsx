import { useAuthStore } from '../stores/authStore'
import { useClinicaStore } from '../stores/clinicaStore'
import { APP_NAME } from '../lib/branding'
import { Tooth } from '../components/icons'
import { SyncIndicator } from './SyncIndicator'
import { SyncSheet } from './SyncSheet'
import { iniciales } from './iniciales'
import { usePanelSync } from './usePanelSync'

/**
 * Encabezado del teléfono (feature 005, FR-004; DS §1 en la spec 013: diente
 * outline turquesa y "Dentdelion" en Deep Teal): logo mark, a pill showing the configured clinic name (spec 010 FR-020,
 * `useClinicaStore` — falls back to "Gabinete" until one is set), the sync
 * indicator and an avatar-initials chip. Identical on every authenticated
 * screen.
 *
 * El indicador (spec 012) cuenta los cambios pendientes reales y el resultado
 * del último ciclo — reemplaza el indicador binario de conexión de la spec
 * 005. Su panel se abre aquí, con estado local: no cambia de vista, así que
 * un formulario a medio llenar abajo conserva lo ingresado (FR-007).
 *
 * No renderiza sesión/cerrar sesión (spec 011 FR-006/FR-007) — esa
 * información y acción viven únicamente en Ajustes → Perfil
 * (`PerfilSection.tsx`) para evitar duplicación.
 */
export function AppHeader() {
  const usuario = useAuthStore((s) => s.usuario)
  const nombreClinica = useClinicaStore((s) => s.nombreClinica)
  const { indicador, abierto: panelAbierto, abrir, cerrar } = usePanelSync()

  return (
    <div className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 shadow-card">
      <Tooth size={32} className="shrink-0 text-brand" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[22px] leading-7 font-extrabold tracking-tight text-teal-dark">
          {APP_NAME}
        </span>
        <span className="inline-flex w-fit max-w-full items-center truncate rounded-pill bg-primary-soft px-2 py-px text-[11px] font-bold text-primary-text">
          {nombreClinica ?? 'Gabinete'}
        </span>
      </div>
      <div className="flex-1" />
      <SyncIndicator indicador={indicador} onClick={abrir} />
      {usuario && (
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-text">
          {iniciales(usuario.nombre)}
        </div>
      )}
      {panelAbierto && (
        <SyncSheet indicador={indicador} onClose={cerrar} />
      )}
    </div>
  )
}
