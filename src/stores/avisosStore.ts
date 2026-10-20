import { create } from 'zustand'
import { deshacerConsumo } from '../features/insumos/lib/consumoRapido'
import { deshacerTraslado } from '../features/insumos/lib/traslado'
import { anularTratamiento } from '../features/tratamientos/lib/registro'

export const DURACION_AVISO_MS = 8000
export const DURACION_MATERIAL_CREADO_MS = 4000
export const DURACION_REVERTIDO_MS = 2000
export const MAX_AVISOS = 3

/** data-model.md's "Aviso" — transient UI state, never persisted. */
export interface Aviso {
  id: string
  tipo:
    | 'consumo'
    | 'traslado'
    | 'tratamiento'
    | 'cambio-rechazado'
    | 'material-creado'
    | 'categoria-rechazada'
  /**
   * Consumo: el movimiento de consumo. Traslado (spec 014): la salida del par.
   * Tratamiento (spec 016): el tratamiento realizado.
   */
  movimientoId: string | null
  loteId: string | null
  insumoNombre: string
  unidadMedida: string | null
  /** Spec 014 — texto del aviso de traslado ("Trasladado 4 cajas a Las Condes"). */
  detalle?: string
  estado: 'pendiente' | 'revertido'
  expiraEn: number
}

/** Informativos (spec 008): nunca tienen "Deshacer" ni ceden su turno a uno de consumo. */
function esInformativo(aviso: Pick<Aviso, 'tipo'>): boolean {
  return aviso.tipo === 'material-creado' || aviso.tipo === 'categoria-rechazada'
}

export type NuevoAviso = Omit<Aviso, 'id' | 'estado' | 'expiraEn'>

interface AvisosState {
  avisos: Aviso[]
  agregar: (aviso: NuevoAviso) => void
  deshacer: (avisoId: string) => Promise<void>
  descartar: (avisoId: string) => void
}

// Timers live outside the store state: they're not renderable data, and
// keeping them here lets `descartar` always clear the pending one.
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function programar(id: string, ms: number, fn: () => void) {
  const previo = timers.get(id)
  if (previo) clearTimeout(previo)
  timers.set(id, setTimeout(fn, ms))
}

/**
 * Avisos de consumo rápido con "Deshacer" (spec 007 FR-006/FR-009,
 * research.md R3) — global (Constitution II) porque deben sobrevivir a la
 * navegación entre secciones. Cada aviso expira a los 8 s con su propio
 * temporizador; como máximo 3 a la vez: el 4º retira al más antiguo, cuyo
 * consumo queda definitivo. También transporta los avisos informativos de
 * cambios de catálogo rechazados (FR-021b).
 */
export const useAvisosStore = create<AvisosState>((set, get) => ({
  avisos: [],
  agregar: (nuevo) => {
    const duracion =
      nuevo.tipo === 'material-creado'
        ? DURACION_MATERIAL_CREADO_MS
        : DURACION_AVISO_MS
    const aviso: Aviso = {
      ...nuevo,
      id: crypto.randomUUID(),
      estado: 'pendiente',
      expiraEn: Date.now() + duracion,
    }
    let avisos = [...get().avisos, aviso]
    while (avisos.length > MAX_AVISOS) {
      const indice = avisos.findIndex(esInformativo)
      const retirado = avisos[indice === -1 ? 0 : indice]
      avisos = avisos.filter((a) => a.id !== retirado.id)
      const timer = timers.get(retirado.id)
      if (timer) clearTimeout(timer)
      timers.delete(retirado.id)
    }
    set({ avisos })
    if (avisos.some((a) => a.id === aviso.id)) {
      programar(aviso.id, duracion, () => get().descartar(aviso.id))
    }
  },
  deshacer: async (avisoId) => {
    const aviso = get().avisos.find((a) => a.id === avisoId)
    if (!aviso || aviso.estado !== 'pendiente' || !aviso.movimientoId) return

    const marcar = (estado: Aviso['estado']) =>
      set({
        avisos: get().avisos.map((a) =>
          a.id === avisoId ? { ...a, estado } : a,
        ),
      })

    marcar('revertido')
    try {
      if (aviso.tipo === 'traslado') await deshacerTraslado(aviso.movimientoId)
      else if (aviso.tipo === 'tratamiento') await anularTratamiento(aviso.movimientoId)
      else await deshacerConsumo(aviso.movimientoId)
    } catch (error) {
      marcar('pendiente')
      throw error
    }
    programar(avisoId, DURACION_REVERTIDO_MS, () => get().descartar(avisoId))
  },
  descartar: (avisoId) => {
    const timer = timers.get(avisoId)
    if (timer) clearTimeout(timer)
    timers.delete(avisoId)
    set({ avisos: get().avisos.filter((a) => a.id !== avisoId) })
  },
}))
