import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { ArrowLeft } from '../../../components/icons'
import { TouchButton } from '../../../components/ui/TouchButton'
import { SECCIONES_AJUSTES, type IdSeccion } from '../lib/secciones'
import { PerfilSection } from './PerfilSection'
import { EquipoSection } from './EquipoSection'
import { LugaresSection } from './LugaresSection'
import { NotificacionesSection } from './NotificacionesSection'
import { AvisosSection } from './AvisosSection'
import { MinimosPorInsumoSection } from './MinimosPorInsumoSection'
import { CategoriasSection } from './CategoriasSection'
import { InsumosBajaSection } from './InsumosBajaSection'
import { ProveedoresSection } from './ProveedoresSection'

/**
 * Subpantalla de una sección de Ajustes (spec 019 FR-004/007, UI §3):
 * "Volver" y el título arriba; el contenido reusa los componentes de sección
 * de siempre, con el mismo comportamiento. Las partes de administración de
 * Perfil y Notificaciones siguen ocultas para `personal` (FR-012).
 */
export function SeccionAjustesPantalla({
  id,
  onVolver,
}: {
  id: IdSeccion
  onVolver: () => void
}) {
  const usuario = useAuthStore((s) => s.usuario)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titulo.current?.focus()
  }, [id])

  const esAdministrador = usuario?.rol === 'administrador'
  const seccion = SECCIONES_AJUSTES.find((s) => s.id === id)
  if (!seccion) return null

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 text-left">
      <header className="flex items-center gap-3">
        <TouchButton
          type="button"
          variant="ghost"
          onClick={onVolver}
          aria-label="Volver a Ajustes"
        >
          <ArrowLeft size={18} />
          Volver
        </TouchButton>
        <h1 ref={titulo} tabIndex={-1} className="text-h2 text-text outline-none">
          {seccion.titulo(esAdministrador)}
        </h1>
      </header>

      {id === 'perfil' && (
        <>
          <PerfilSection />
          {esAdministrador && <EquipoSection />}
        </>
      )}
      {id === 'lugares' && <LugaresSection sinTitulo />}
      {id === 'avisos' && (
        <>
          <NotificacionesSection sinTitulo={!esAdministrador} />
          {esAdministrador && (
            <>
              <AvisosSection />
              <MinimosPorInsumoSection />
            </>
          )}
        </>
      )}
      {id === 'categorias' && <CategoriasSection sinTitulo />}
      {id === 'proveedores' && <ProveedoresSection />}
      {id === 'baja' && <InsumosBajaSection sinTitulo />}
    </div>
  )
}
