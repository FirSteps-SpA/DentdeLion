import { create } from 'zustand'
import { liveQuery } from 'dexie'
import { db, type UsuarioConocido } from '../lib/db'
import { delTenant } from '../lib/tenancy'
import {
  agruparPendientes,
  type PendientesPorAutor,
} from '../lib/sync/indicador'

/**
 * Pendientes de sincronizar de este dispositivo, por autor (spec 012 FR-003,
 * FR-013), kept in sync with Dexie via `liveQuery` like `alertasStore`. The
 * age of a pending row depends on the clock, not only on the data, so `ahora`
 * ticks every minute too (research.md R8).
 */
interface PendientesState {
  pendientes: PendientesPorAutor[]
  usuariosConocidos: UsuarioConocido[]
  ahora: number
  subscribe: () => () => void
}

const TICK_MS = 60_000

export const usePendientesStore = create<PendientesState>((set) => ({
  pendientes: [],
  usuariosConocidos: [],
  ahora: Date.now(),
  subscribe: () => {
    const subPendientes = liveQuery(async () =>
      // Spec 014 FR-004: los pendientes de otro tenant no se cuentan ni se nombran.
      agruparPendientes(
        await delTenant('movimientos'),
        await delTenant('cambiosInsumo'),
        await delTenant('categorias'),
        await delTenant('cambiosLote'),
      ),
    ).subscribe({
      next: (pendientes) => set({ pendientes, ahora: Date.now() }),
    })
    const subUsuarios = liveQuery(() => db.usuariosConocidos.toArray()).subscribe({
      next: (usuariosConocidos) => set({ usuariosConocidos }),
    })
    const tick = setInterval(() => set({ ahora: Date.now() }), TICK_MS)
    return () => {
      subPendientes.unsubscribe()
      subUsuarios.unsubscribe()
      clearInterval(tick)
    }
  },
}))
