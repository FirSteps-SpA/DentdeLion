import { create } from 'zustand'
import { liveQuery } from 'dexie'
import { db } from '../lib/db'
import { HORAS_AVISO_PENDIENTES_POR_DEFECTO } from '../lib/sync/indicador'
import {
  SALUDO_PEDIDO_POR_DEFECTO,
  saludoEfectivo,
} from '../features/compras/lib/pedido'

export { HORAS_AVISO_PENDIENTES_POR_DEFECTO }

/** data-model.md's default when no administrador has ever saved a value (FR-005). */
export const NIVELES_AVISO_POR_DEFECTO: number[] = [30, 7, 1]

/**
 * Reactive global caducidad-warning configuration (Constitution II), kept in
 * sync with Dexie via `liveQuery`. Falls back to
 * `NIVELES_AVISO_POR_DEFECTO` when no `configuracionAlertas` row exists yet
 * (data-model.md's Bootstrapping) — no row is written until an
 * administrador explicitly saves a change. Also holds the device-local
 * notification preferences (spec 010 FR-025/027, research.md R4) — a
 * different sync scope (never leaves this device) but the same domain
 * ("how alerts are computed/shown"), so it lives in the same store.
 */
interface AlertasState {
  nivelesAvisoDias: number[]
  /** Spec 012 FR-011 — umbral global de pendientes antiguos, en horas. */
  horasAvisoPendientes: number
  /** Spec 022 — saludo del pedido por WhatsApp (el del tenant o el de la clienta). */
  saludoPedido: string
  /** spec 010 FR-025 — `true` por defecto sin fila previa. */
  preferenciaStockBajo: boolean
  preferenciaCaducidad: boolean
  isReady: boolean
  subscribe: () => () => void
}

export const useAlertasStore = create<AlertasState>((set) => ({
  nivelesAvisoDias: NIVELES_AVISO_POR_DEFECTO,
  horasAvisoPendientes: HORAS_AVISO_PENDIENTES_POR_DEFECTO,
  saludoPedido: SALUDO_PEDIDO_POR_DEFECTO,
  preferenciaStockBajo: true,
  preferenciaCaducidad: true,
  isReady: false,
  subscribe: () => {
    const subAlertas = liveQuery(() =>
      db.configuracionAlertas.get('global'),
    ).subscribe({
      next: (config) =>
        set({
          nivelesAvisoDias: config?.nivelesAvisoDias ?? NIVELES_AVISO_POR_DEFECTO,
          horasAvisoPendientes:
            config?.horasAvisoPendientes ?? HORAS_AVISO_PENDIENTES_POR_DEFECTO,
          saludoPedido: saludoEfectivo(config),
          isReady: true,
        }),
    })
    const subPreferencias = liveQuery(() =>
      db.preferenciasNotificaciones.get('local'),
    ).subscribe({
      next: (preferencias) =>
        set({
          preferenciaStockBajo: preferencias?.stockBajo ?? true,
          preferenciaCaducidad: preferencias?.caducidad ?? true,
        }),
    })
    return () => {
      subAlertas.unsubscribe()
      subPreferencias.unsubscribe()
    }
  },
}))
