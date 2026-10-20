import { create } from 'zustand'
import { liveQuery } from 'dexie'
import type { CambioTratamiento, Tratamiento, TratamientoRealizado } from '../lib/db'
import { delTenant } from '../lib/tenancy'
import {
  porcentajesPorLugar,
  proyectarTratamientos,
  type TratamientoProyectado,
} from '../features/tratamientos/lib/proyeccion'

/**
 * Spec 016 (Constitución II) — tratamientos del tenant proyectados desde su
 * ledger (research.md R1), % profesional por lugar y tratamientos realizados,
 * en vivo desde Dexie como `inventoryStore`.
 */
interface TratamientosState {
  /** Todos, activos y desactivados, ordenados por nombre. */
  tratamientos: TratamientoProyectado[]
  /** % profesional por lugar (Clarifications Q2). */
  porcentajes: Map<string, number>
  cambiosTratamiento: CambioTratamiento[]
  realizados: TratamientoRealizado[]
  isReady: boolean
  subscribe: () => () => void
}

export const useTratamientosStore = create<TratamientosState>((set) => ({
  tratamientos: [],
  porcentajes: new Map(),
  cambiosTratamiento: [],
  realizados: [],
  isReady: false,
  subscribe: () => {
    let filas: Tratamiento[] = []
    let cambios: CambioTratamiento[] = []
    const proyectar = () =>
      set({
        tratamientos: proyectarTratamientos(filas, cambios),
        porcentajes: porcentajesPorLugar(cambios),
        cambiosTratamiento: cambios,
        isReady: true,
      })
    const filasSub = liveQuery(() => delTenant('tratamientos')).subscribe({
      next: (valor) => {
        filas = valor
        proyectar()
      },
    })
    const cambiosSub = liveQuery(() => delTenant('cambiosTratamiento')).subscribe({
      next: (valor) => {
        cambios = valor
        proyectar()
      },
    })
    const realizadosSub = liveQuery(() => delTenant('tratamientosRealizados')).subscribe({
      next: (realizados) => set({ realizados }),
    })
    return () => {
      filasSub.unsubscribe()
      cambiosSub.unsubscribe()
      realizadosSub.unsubscribe()
    }
  },
}))
