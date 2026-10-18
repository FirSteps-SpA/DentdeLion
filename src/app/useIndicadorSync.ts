import { useSyncExternalStore } from 'react'
import { calcularIndicador, type Indicador } from '../lib/sync/indicador'
import { useAlertasStore } from '../stores/alertasStore'
import { useAuthStore } from '../stores/authStore'
import { usePendientesStore } from '../stores/pendientesStore'
import { useSyncStore } from '../stores/syncStore'

function suscribirConexion(aviso: () => void): () => void {
  window.addEventListener('online', aviso)
  window.addEventListener('offline', aviso)
  return () => {
    window.removeEventListener('online', aviso)
    window.removeEventListener('offline', aviso)
  }
}

const enLineaAhora = () => navigator.onLine

/**
 * Lo que muestran el indicador del encabezado y su panel (spec 012), derivado
 * de los stores locales con `calcularIndicador` — funciona sin conexión
 * (FR-013). `umbralHoras` va aparte porque el panel lo muestra siempre.
 */
export function useIndicadorSync(): Indicador & { umbralHoras: number } {
  const usuarioId = useAuthStore((s) => s.usuario?.id ?? '')
  const pendientes = usePendientesStore((s) => s.pendientes)
  const usuariosConocidos = usePendientesStore((s) => s.usuariosConocidos)
  const ahora = usePendientesStore((s) => s.ahora)
  const ultimoResultado = useSyncStore((s) => s.ultimoResultado)
  const umbralHoras = useAlertasStore((s) => s.horasAvisoPendientes)
  const enLinea = useSyncExternalStore(suscribirConexion, enLineaAhora)

  return {
    ...calcularIndicador({
      usuarioId,
      pendientes,
      ultimoResultado,
      enLinea,
      horasAviso: umbralHoras,
      ahora,
      usuariosConocidos,
    }),
    umbralHoras,
  }
}
