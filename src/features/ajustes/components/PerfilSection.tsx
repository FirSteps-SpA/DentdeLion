import { useAuthStore } from '../../../stores/authStore'
import { useLogout } from '../../auth/useLogout'
import { User } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'

/**
 * Sección "Perfil" (spec 010 FR-004/005): nombre/correo/rol del usuario
 * autenticado y "Cerrar sesión", con el mismo comportamiento que la acción
 * ya existente en el encabezado. Visible para todo usuario autenticado.
 */
export function PerfilSection() {
  const usuario = useAuthStore((s) => s.usuario)
  const { signOut } = useLogout()

  if (!usuario) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-h3 text-text">
        <User size={18} className="text-primary" />
        Perfil
      </h2>
      <Card className="flex flex-col gap-2.5 px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-text">{usuario.nombre}</span>
          <span className="text-sm text-text-muted">{usuario.email}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {usuario.rol}
          </span>
        </div>
        <TouchButton
          type="button"
          variant="ghost"
          onClick={() => void signOut()}
          className="w-fit text-sm"
        >
          Cerrar sesión
        </TouchButton>
      </Card>
    </section>
  )
}
