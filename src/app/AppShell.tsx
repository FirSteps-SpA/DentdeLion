import type { ReactNode } from 'react'
import { useLayoutStore } from '../stores/layoutStore'
import { AppHeader } from './AppHeader'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import type { Vista } from './navegacion'
import { useDisposicion } from './useDisposicion'

export interface AppShellProps {
  vista: Vista
  onCambiarVista: (vista: Vista) => void
  alertasBadge?: number
  children: ReactNode
}

const ANCHO_CONTENIDO = {
  movil:
    'mx-auto w-full max-w-[480px] px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] gap-4',
  tablet: 'w-full p-6 gap-6',
  desktop: 'mx-auto w-full max-w-[1440px] p-8 gap-6',
} as const

/**
 * Armazón autenticado (spec 013 R8, contracts/ui-contracts.md): según
 * `useDisposicion()`, encabezado + barra inferior en el teléfono, o sidebar +
 * barra superior en tablet y desktop. La vista activa (`children`) va siempre
 * en el mismo `<main>`, en la misma posición del árbol — cambiar de ancho
 * cambia la envoltura pero no desmonta la vista, así que un formulario a medio
 * llenar o los filtros sobreviven (FR-015).
 */
export function AppShell({
  vista,
  onCambiarVista,
  alertasBadge,
  children,
}: AppShellProps) {
  const disposicion = useDisposicion()
  const sidebarExpandida = useLayoutStore((s) => s.sidebarExpandida)
  const alternarSidebar = useLayoutStore((s) => s.alternarSidebar)
  const movil = disposicion === 'movil'

  return (
    <div className="flex min-h-dvh w-full bg-bg text-left">
      {!movil && (
        <Sidebar
          vista={vista}
          onCambiarVista={onCambiarVista}
          alertasBadge={alertasBadge}
          contraida={disposicion === 'tablet' && !sidebarExpandida}
          onAlternar={disposicion === 'tablet' ? alternarSidebar : undefined}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {movil ? (
          <div className="mx-auto w-full max-w-[480px] px-4 pt-4">
            <AppHeader />
          </div>
        ) : (
          <TopBar />
        )}
        <main className={`flex flex-col ${ANCHO_CONTENIDO[disposicion]}`}>
          {children}
        </main>
      </div>
      {movil && (
        <BottomNav
          active={vista}
          onChange={onCambiarVista}
          alertasBadge={alertasBadge}
        />
      )}
    </div>
  )
}
