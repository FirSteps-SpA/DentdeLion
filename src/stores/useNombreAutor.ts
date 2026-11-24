import { useAuthStore } from './authStore'
import { usePendientesStore } from './pendientesStore'

export const USUARIO_ELIMINADO = 'Usuario eliminado'

/**
 * Nombre del autor de un registro: la persona de la sesión, una conocida en
 * este dispositivo (spec 012), "Usuario eliminado" si su cuenta se eliminó en
 * la plataforma (spec 031, FR-008) o `sinNombre` si no se sabe.
 */
export function useNombreAutor(
  sinNombre = 'otra persona',
): (id: string | null | undefined) => string {
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const eliminados = usePendientesStore((s) => s.usuariosEliminados)
  return (id) => {
    if (!id) return ''
    if (id === usuario?.id) return usuario.nombre
    if (eliminados.includes(id)) return USUARIO_ELIMINADO
    return conocidos.find((c) => c.id === id)?.nombre ?? sinNombre
  }
}
