import { APP_NAME } from '../../lib/branding'
import { CircleAlert } from '../../components/icons'
import { TouchButton } from '../../components/ui/TouchButton'
import { useAuthStore } from '../../stores/authStore'
import { usePendientesStore } from '../../stores/pendientesStore'
import { useLogout } from './useLogout'

/**
 * Usuario sin acceso (spec 014 FR-021, contracts/ui-contracts.md): perfil
 * desactivado por la administradora, o tenant sin lugares activos. Los
 * pendientes registrados antes de la desactivación ya se intentaron subir;
 * si queda algo, se dice cuánto, en vez de perderlo en silencio
 * (Constitución I).
 */
export function AccesoDesactivado() {
  const usuarioId = useAuthStore((s) => s.usuario?.id)
  const pendientes = usePendientesStore((s) => s.pendientes)
  const { signOut } = useLogout()
  const propios = pendientes.find((p) => p.usuarioId === usuarioId)
  const sinSubir = propios
    ? propios.movimientos + propios.cambiosInsumo + propios.categorias
    : 0

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 text-center shadow-card md:p-8">
      <CircleAlert size={40} className="text-danger" />
      <h1 className="text-h2 text-text">Acceso desactivado</h1>
      <p className="text-body text-text-muted">
        Tu acceso a {APP_NAME} está desactivado. Contacta a tu administradora.
      </p>
      {sinSubir > 0 && (
        <p role="status" className="rounded-md bg-warning-30-bg px-3.5 py-2.5 text-sm text-text">
          {sinSubir === 1
            ? '1 registro no se pudo subir.'
            : `${sinSubir} registros no se pudieron subir.`}
        </p>
      )}
      <TouchButton type="button" variant="ghost" onClick={() => void signOut()} className="w-full">
        Cerrar sesión
      </TouchButton>
    </div>
  )
}
