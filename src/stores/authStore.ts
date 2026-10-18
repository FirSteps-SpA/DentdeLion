import { create } from 'zustand'
import { db, type UsuarioActual } from '../lib/db'

/**
 * Auth state (Constitution II: single reactive source). `hydrate` reads only
 * from Dexie — never a live Supabase call — so offline app access is never
 * gated on network (spec FR-002/FR-006, research.md's offline-durable
 * session decision).
 */
interface AuthState {
  usuario: UsuarioActual | null
  isReady: boolean
  hydrate: () => Promise<void>
  login: (usuario: UsuarioActual) => Promise<void>
  logout: () => Promise<void>
  /** Feature 007 FR-021b: refresh a role the server changed (e.g. admin demoted). */
  actualizarRol: (rol: UsuarioActual['rol']) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  isReady: false,
  hydrate: async () => {
    try {
      const usuario = (await db.usuarioActual.toCollection().first()) ?? null
      set({ usuario, isReady: true })
    } catch {
      // IndexedDB unavailable (e.g. private browsing) — degrade to the login
      // screen rather than crashing the boot guard.
      set({ usuario: null, isReady: true })
    }
  },
  login: async (usuario) => {
    await db.usuarioActual.clear()
    await db.usuarioActual.add(usuario)
    // Spec 012 research.md R7: nombra los pendientes que esta persona deje en
    // el dispositivo cuando otra tenga la sesión. `logout` no la borra.
    await db.usuariosConocidos.put({
      id: usuario.id,
      nombre: usuario.nombre,
      vistoEn: new Date().toISOString(),
    })
    set({ usuario, isReady: true })
  },
  logout: async () => {
    await db.usuarioActual.clear()
    await db.borradores.clear()
    set({ usuario: null, isReady: true })
  },
  actualizarRol: async (rol) => {
    const usuario = get().usuario
    if (!usuario || usuario.rol === rol) return
    const actualizado = { ...usuario, rol }
    await db.usuarioActual.put(actualizado)
    set({ usuario: actualizado })
  },
}))

/**
 * Stable accessor for the attributed user id — future inventory features
 * (002) MUST read this for `Movimiento.usuarioId` (spec FR-003).
 */
export function getUsuarioActualId(): string | undefined {
  return useAuthStore.getState().usuario?.id
}
