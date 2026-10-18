import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfigError {
  message: string
}

export type SupabaseStatus =
  | { client: SupabaseClient; error: null }
  | { client: null; error: SupabaseConfigError }

function readConfig(): { url: string; anonKey: string } | SupabaseConfigError {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const missing: string[] = []
  if (!url) missing.push('VITE_SUPABASE_URL')
  if (!anonKey) missing.push('VITE_SUPABASE_ANON_KEY')
  if (missing.length > 0) {
    return {
      message:
        `Falta configurar: ${missing.join(', ')}. Copia .env.example a .env ` +
        'y completa los valores de tu proyecto Supabase de desarrollo (ver README).',
    }
  }

  try {
    new URL(url)
  } catch {
    return { message: `VITE_SUPABASE_URL no es una URL válida: "${url}"` }
  }

  return { url, anonKey }
}

/**
 * Reads env-based Supabase config and returns either a ready client or a
 * specific, readable config error (FR-005) — never throws, so the app shell
 * can still render in local/offline mode when the backend isn't configured
 * (FR-004).
 */
export function getSupabaseStatus(): SupabaseStatus {
  const config = readConfig()
  if ('message' in config) {
    return { client: null, error: config }
  }
  // Sin los reintentos internos de PostgREST (hasta 3 por GET, 1+2+4 s): sin
  // red cada descarga del ciclo esperaba ~7 s y "Sincronizar ahora" tardaba
  // cerca de un minuto en responder (spec 012 FR-009). El ciclo de sync ya
  // reintenta solo cada 30 s y al volver la red.
  return {
    client: createClient(config.url, config.anonKey, { db: { retry: false } }),
    error: null,
  }
}
