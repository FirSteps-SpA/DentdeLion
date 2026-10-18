import * as Sentry from '@sentry/react'

type ErrorSupabase = { message?: string; code?: string } | null

const yaReportados = new Set<string>()

/** Sin red no es una falla: el ciclo se reintenta solo (Constitution I). */
function esFallaDeRed(error: NonNullable<ErrorSupabase>): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return true
  return /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(
    error.message ?? '',
  )
}

/**
 * Reporta a Sentry una falla de sincronización que no se debe a la red: los
 * push/pull devuelven `{ error }` (no lanzan) y el ciclo la descarta en
 * silencio para reintentar, así que sin esto un rechazo persistente del
 * servidor sería invisible. Una vez por etapa y error por carga de la app,
 * para no repetirlo cada 30 s.
 */
export function reportarErrorSync(etapa: string, error: ErrorSupabase): void {
  if (!error || esFallaDeRed(error)) return
  const clave = `${etapa}|${error.code ?? ''}|${error.message ?? ''}`
  if (yaReportados.has(clave)) return
  yaReportados.add(clave)
  console.error(`[inDENTory] Sync (${etapa}):`, error)
  Sentry.captureException(
    new Error(`Sync ${etapa}: ${error.message ?? 'error'}`),
    {
      tags: { etapa, code: error.code ?? 'sin-codigo' },
    },
  )
}
