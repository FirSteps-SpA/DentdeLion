import { useAuthStore } from '../../../stores/authStore'
import { PerfilSection } from './PerfilSection'
import { ConfiguracionAlertasSection } from './ConfiguracionAlertasSection'
import { LugaresSection } from './LugaresSection'
import { EquipoSection } from './EquipoSection'
import { CategoriasSection } from './CategoriasSection'
import { InsumosBajaSection } from './InsumosBajaSection'
import { NotificacionesSection } from './NotificacionesSection'

/**
 * Vista "Ajustes" (spec 010 FR-001/002/003): reemplaza el puente temporal
 * "Consumir insumo" de la spec 006 en la pestaña "Más". Organiza secciones
 * abiertas a todo usuario autenticado (Perfil, Notificaciones) y secciones
 * solo para administradores (Configuración de Alertas, Lugares de trabajo —
 * spec 014, reemplaza "Clínica" —, Categorías,
 * Insumos dados de baja) — ocultas por completo para `personal`, no solo
 * deshabilitadas, mismo criterio que ya usa `AlertasView`.
 */
export function AjustesView() {
  const usuario = useAuthStore((s) => s.usuario)
  const esAdministrador = usuario?.rol === 'administrador'

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      {/* Spec 013 FR-011: perfil y notificaciones en 2 columnas desde tablet. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
        <PerfilSection />
        <NotificacionesSection />
      </div>

      {esAdministrador && (
        <>
          <ConfiguracionAlertasSection />
          <LugaresSection />
          <EquipoSection />
          <CategoriasSection />
          <InsumosBajaSection />
        </>
      )}
    </div>
  )
}
