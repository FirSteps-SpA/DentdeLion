import { create } from 'zustand'
import { liveQuery } from 'dexie'
import type {
  CambioTratamiento,
  CategoriaTratamiento,
  PacienteRegistro,
  Tratamiento,
  TratamientoRealizado,
} from '../lib/db'
import { delTenant } from '../lib/tenancy'
import {
  porcentajesPorCategoria,
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
  /** Spec 026 (R4): % por categoría y lugar (`claveCategoriaLugar`). */
  porcentajesCategoria: Map<string, number>
  /** Spec 026 (R1): categorías no rechazadas, activas y desactivadas, por nombre. */
  categorias: CategoriaTratamiento[]
  /**
   * Spec 028: pacientes del dispositivo (los que el servidor deja leer más los
   * pendientes). La UI muestra solo los visibles (`usePacientesVisibles`).
   */
  pacientesRegistro: PacienteRegistro[]
  cambiosTratamiento: CambioTratamiento[]
  realizados: TratamientoRealizado[]
  isReady: boolean
  subscribe: () => () => void
}

export const useTratamientosStore = create<TratamientosState>((set) => ({
  tratamientos: [],
  porcentajes: new Map(),
  porcentajesCategoria: new Map(),
  categorias: [],
  pacientesRegistro: [],
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
        porcentajesCategoria: porcentajesPorCategoria(cambios),
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
    const categoriasSub = liveQuery(() => delTenant('categoriasTratamiento')).subscribe({
      next: (valor) =>
        set({
          categorias: valor
            .filter((c) => c.rechazadoEn === null)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        }),
    })
    const pacientesSub = liveQuery(() => delTenant('pacientesRegistro')).subscribe({
      next: (pacientesRegistro) => set({ pacientesRegistro }),
    })
    return () => {
      filasSub.unsubscribe()
      cambiosSub.unsubscribe()
      categoriasSub.unsubscribe()
      pacientesSub.unsubscribe()
      realizadosSub.unsubscribe()
    }
  },
}))
