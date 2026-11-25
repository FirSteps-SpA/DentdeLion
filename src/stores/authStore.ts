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
  /** Spec 014 FR-021: refleja la (des)activación que el sync leyó del servidor. */
  marcarDesactivado: (desactivadoEn: string | null) => Promise<void>
  /**
   * Spec 032 (FR-010): el nombre guardado desde Perfil o leído por el sync.
   * También actualiza `usuariosConocidos`, que nombra al autor en el historial.
   */
  actualizarNombre: (nombre: string) => Promise<void>
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
    // Spec 028 (FR-006): los pacientes ya subidos no quedan en el dispositivo;
    // los pendientes se conservan para subir (y la UI solo los muestra a quien
    // corresponde).
    await db.pacientesRegistro.bulkDelete(
      (await db.pacientesRegistro.toArray())
        .filter((p) => p.sincronizado)
        .map((p) => p.registroId),
    )
    set({ usuario: null, isReady: true })
  },
  actualizarRol: async (rol) => {
    const usuario = get().usuario
    if (!usuario || usuario.rol === rol) return
    const actualizado = { ...usuario, rol }
    await db.usuarioActual.put(actualizado)
    set({ usuario: actualizado })
  },
  actualizarNombre: async (nombre) => {
    const usuario = get().usuario
    if (!usuario || usuario.nombre === nombre) return
    const actualizado = { ...usuario, nombre }
    await db.usuarioActual.put(actualizado)
    await db.usuariosConocidos.put({
      id: usuario.id,
      nombre,
      vistoEn: new Date().toISOString(),
    })
    set({ usuario: actualizado })
  },
  marcarDesactivado: async (desactivadoEn) => {
    const usuario = get().usuario
    if (!usuario || usuario.desactivadoEn === desactivadoEn) return
    const actualizado = { ...usuario, desactivadoEn }
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

/**
 * Spec 014 FR-001/FR-004 — tenant del usuario con sesión. Toda fila de negocio
 * nueva lo lleva, y todo lo que se lee de Dexie se filtra por él.
 */
export function getTenantActualId(): string | undefined {
  return useAuthStore.getState().usuario?.tenantId
}

/** Igual que `getTenantActualId`, para escrituras: sin sesión local no se escribe nada. */
export function tenantActualOFallar(): string {
  const tenantId = getTenantActualId()
  if (!tenantId) {
    throw new Error('No hay un usuario autenticado local — no se puede registrar el cambio.')
  }
  return tenantId
}
