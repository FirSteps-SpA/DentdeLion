import { useAuthStore } from '../../src/stores/authStore'

/**
 * `client.auth` mínimo para los clientes Supabase falsos (spec 012
 * research.md R3): el ciclo valida la sesión antes de subir nada, así que
 * `getSession` devuelve la del usuario local mockeado en `useAuthStore`.
 */
export const authFalso = {
  async getSession() {
    const id = useAuthStore.getState().usuario?.id
    return { data: { session: id ? { user: { id } } : null }, error: null }
  },
}
