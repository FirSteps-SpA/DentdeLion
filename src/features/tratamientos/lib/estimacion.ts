import { useSyncExternalStore } from 'react'
import { getSupabaseStatus } from '../../../lib/supabase'

/**
 * Spec 029 (research.md R6) — cliente de la Edge Function
 * `estimar-materiales`. Solo envía el nombre y los ids; el servidor lee el
 * resto de la base. Nunca lanza: devuelve la estimación o un código.
 */

export interface SugerenciaMaterial {
  insumoId: string
  cantidad: number | null
  nota: string
}

export type CodigoEstimacion =
  | 'sin_conexion'
  | 'limite_diario'
  | 'no_configurado'
  | 'no_reconocido'
  | 'solo_administracion'
  | 'error'

export const MAX_MATERIALES_ESTIMACION = 20

export const MENSAJES_ESTIMACION: Record<CodigoEstimacion, string> = {
  sin_conexion: 'Necesita conexión.',
  limite_diario: `Se alcanzó el límite de ${MAX_MATERIALES_ESTIMACION} estimaciones por día. Intenta mañana.`,
  no_configurado: 'La estimación no está disponible.',
  no_reconocido: 'No se reconoció como un tratamiento dental.',
  solo_administracion: 'Solo administración puede pedir estimaciones.',
  error: 'No se pudo estimar ahora; intenta más tarde.',
}

const DESDE_SERVIDOR: Partial<Record<string, CodigoEstimacion>> = {
  limite_diario: 'limite_diario',
  no_configurado: 'no_configurado',
  solo_administracion: 'solo_administracion',
  sin_sesion: 'solo_administracion',
}

export async function estimarMateriales(
  tratamiento: string,
  insumoIds: string[],
): Promise<SugerenciaMaterial[] | CodigoEstimacion> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'sin_conexion'
  const { client, error } = getSupabaseStatus()
  if (error) return 'sin_conexion'
  const { data, error: errorFuncion } = await client.functions.invoke('estimar-materiales', {
    body: { tratamiento: tratamiento.trim(), insumoIds: insumoIds.slice(0, MAX_MATERIALES_ESTIMACION) },
  })
  if (!errorFuncion) {
    const respuesta = data as { reconocido?: boolean; sugerencias?: SugerenciaMaterial[] } | null
    if (!respuesta || typeof respuesta.reconocido !== 'boolean') return 'error'
    if (!respuesta.reconocido) return 'no_reconocido'
    return Array.isArray(respuesta.sugerencias) ? respuesta.sugerencias : 'error'
  }
  // FunctionsHttpError trae la respuesta: { codigo }.
  const contexto = (errorFuncion as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const cuerpo = (await contexto.json()) as { codigo?: string }
      return (cuerpo.codigo && DESDE_SERVIDOR[cuerpo.codigo]) || 'error'
    } catch {
      return 'error'
    }
  }
  return 'sin_conexion'
}

function suscribirConexion(aviso: () => void): () => void {
  window.addEventListener('online', aviso)
  window.addEventListener('offline', aviso)
  return () => {
    window.removeEventListener('online', aviso)
    window.removeEventListener('offline', aviso)
  }
}

/** Estado de conexión del navegador, reactivo (FR-001, edge "sin conexión"). */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirConexion, () => navigator.onLine)
}
