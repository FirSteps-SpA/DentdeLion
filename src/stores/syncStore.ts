import { create } from 'zustand'
import { liveQuery } from 'dexie'
import { db } from '../lib/db'

/**
 * Resultado de un ciclo de sincronización (spec 012 data-model.md, research.md
 * R2): `sesion` > `error` > `sin-red` > `ok`. `etapasConError` es solo para
 * diagnóstico.
 */
export interface ResultadoCiclo {
  estado: 'ok' | 'sin-red' | 'error' | 'sesion'
  etapasConError: string[]
  terminadoEn: string
}

/**
 * Estado en vivo del ciclo de sincronización (spec 012, Constitution II).
 * `fase` y `ultimoResultado` viven solo en memoria: tras reabrir la app no
 * tiene sentido mostrar el "Error" de la carga anterior (research.md R10).
 * `ultimaExitosaEn` es el espejo reactivo de `db.estadoSync`, que sí persiste.
 */
interface SyncState {
  fase: 'inactivo' | 'sincronizando'
  ultimoResultado: ResultadoCiclo['estado'] | null
  ultimaExitosaEn: string | null
  iniciarCiclo: () => void
  terminarCiclo: (resultado: ResultadoCiclo) => void
  /** Evento `offline` del navegador: no pisa un error o una sesión vencida vigentes. */
  marcarSinRed: () => void
  subscribe: () => () => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
  fase: 'inactivo',
  ultimoResultado: null,
  ultimaExitosaEn: null,
  iniciarCiclo: () => set({ fase: 'sincronizando' }),
  terminarCiclo: (resultado) =>
    set({ fase: 'inactivo', ultimoResultado: resultado.estado }),
  marcarSinRed: () => {
    const actual = get().ultimoResultado
    if (actual === 'error' || actual === 'sesion') return
    set({ ultimoResultado: 'sin-red' })
  },
  subscribe: () => {
    const sub = liveQuery(() => db.estadoSync.get('local')).subscribe({
      next: (estado) => set({ ultimaExitosaEn: estado?.ultimaExitosaEn ?? null }),
    })
    return () => sub.unsubscribe()
  },
}))
