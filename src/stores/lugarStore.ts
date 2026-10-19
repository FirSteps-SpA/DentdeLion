import { create } from 'zustand'
import { liveQuery } from 'dexie'
import { db, type Lugar } from '../lib/db'

/**
 * Lugar de trabajo activo en este dispositivo (spec 014 FR-008/FR-009,
 * research.md R10). Los lugares del tenant del usuario con sesión vienen de
 * Dexie vía `liveQuery` (los trae el sync), y el elegido se recuerda en
 * `lugarActivo`. `'todos'` es la vista consolidada de solo lectura (US3).
 */
export type SeleccionLugar = string | 'todos'

interface LugarState {
  /** Todos los lugares del tenant, también los desactivados (Ajustes los muestra). */
  lugares: Lugar[]
  /** Lugar activo ya resuelto: siempre un lugar activo existente o `'todos'`; `null` sin lugares. */
  lugarActivoId: SeleccionLugar | null
  isReady: boolean
  subscribe: () => () => void
  setLugarActivo: (id: SeleccionLugar) => Promise<void>
}

/** Lugares activos, el más antiguo primero (el "lugar principal" del servidor). */
export function lugaresActivos(lugares: Lugar[]): Lugar[] {
  return lugares
    .filter((lugar) => !lugar.desactivadoEn)
    .sort(
      (a, b) =>
        a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id),
    )
}

/**
 * El lugar guardado si sigue activo; si no, el principal (R10). `'todos'` solo
 * tiene sentido con 2 o más lugares activos.
 */
export function resolverLugarActivo(
  lugares: Lugar[],
  guardado: SeleccionLugar | undefined,
): SeleccionLugar | null {
  const activos = lugaresActivos(lugares)
  if (activos.length === 0) return null
  if (guardado === 'todos') return activos.length > 1 ? 'todos' : activos[0].id
  if (guardado && activos.some((lugar) => lugar.id === guardado)) return guardado
  return activos[0].id
}

export const useLugarStore = create<LugarState>((set) => ({
  lugares: [],
  lugarActivoId: null,
  isReady: false,
  subscribe: () => {
    const sub = liveQuery(async () => {
      const usuario = await db.usuarioActual.toCollection().first()
      if (!usuario) return { lugares: [] as Lugar[], guardado: undefined }
      const [lugares, guardado] = await Promise.all([
        db.lugares.where('tenantId').equals(usuario.tenantId).toArray(),
        db.lugarActivo.get('local'),
      ])
      return { lugares, guardado: guardado?.lugarId }
    }).subscribe({
      next: ({ lugares, guardado }) =>
        set({
          lugares,
          lugarActivoId: resolverLugarActivo(lugares, guardado),
          isReady: true,
        }),
    })
    return () => sub.unsubscribe()
  },
  setLugarActivo: async (id) => {
    set({ lugarActivoId: id })
    await db.lugarActivo.put({ id: 'local', lugarId: id })
  },
}))

export function hayVariosLugares(lugares: Lugar[]): boolean {
  return lugaresActivos(lugares).length > 1
}

/**
 * Lugar donde se registra una operación que modifica stock (FR-010): el
 * explícito si se pasa (p. ej. el elegido en "¿En qué lugar?" desde "Todos",
 * FR-014), si no el activo. `null` en "Todos" sin lugar elegido: la interfaz
 * tiene que pedir uno antes de escribir.
 */
export function getLugarParaEscribir(explicito?: string): string | null {
  if (explicito) return explicito
  const { lugarActivoId } = useLugarStore.getState()
  if (!lugarActivoId || lugarActivoId === 'todos') return null
  return lugarActivoId
}

/** Igual que `getLugarParaEscribir`, pero falla con un mensaje claro si no hay lugar. */
export function lugarParaEscribirOFallar(explicito?: string): string {
  const lugarId = getLugarParaEscribir(explicito)
  if (!lugarId) {
    throw new Error('Elige un lugar de trabajo antes de registrar el movimiento.')
  }
  return lugarId
}

/** Nombre de un lugar por id, para chips e historial. */
export function nombreLugar(lugares: Lugar[], id: string): string {
  return lugares.find((lugar) => lugar.id === id)?.nombre ?? 'Lugar'
}
