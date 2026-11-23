import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

/**
 * Spec 028 (research.md R6): los breadcrumbs `ui.input` pueden llevar lo que
 * se escribe en un campo (p. ej. el paciente); no se envían.
 */
export function filtrarBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  return breadcrumb.category === 'ui.input' ? null : breadcrumb
}

// Sin DSN (desarrollo local, tests) Sentry queda desactivado.
export function initSentry() {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Datos clínicos: no enviar usuario, cookies, headers, bodies ni query params.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeBreadcrumb: filtrarBreadcrumb,
  })
}
