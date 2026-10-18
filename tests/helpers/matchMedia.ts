/**
 * Simulador de ancho de pantalla para las pruebas de la spec 013: jsdom no trae
 * `window.matchMedia`, así que `simularAncho(px)` lo define evaluando consultas
 * `(min-width: Npx)` y avisa a los listeners al cambiar de ancho, como lo haría
 * un navegador al redimensionar. `restaurarMatchMedia()` lo quita (vuelve a
 * la disposición móvil por defecto de `useDisposicion`).
 */
type Listener = (evento: { matches: boolean }) => void

let ancho = 1024
const consultas = new Map<string, Set<Listener>>()

function coincide(consulta: string): boolean {
  const minimo = /\(min-width:\s*(\d+)px\)/.exec(consulta)
  return minimo ? ancho >= Number(minimo[1]) : false
}

function matchMediaFalso(consulta: string): MediaQueryList {
  const listeners = consultas.get(consulta) ?? new Set<Listener>()
  consultas.set(consulta, listeners)
  return {
    get matches() {
      return coincide(consulta)
    },
    media: consulta,
    onchange: null,
    addEventListener: (_tipo: string, fn: Listener) => listeners.add(fn),
    removeEventListener: (_tipo: string, fn: Listener) => listeners.delete(fn),
    addListener: (fn: Listener) => listeners.add(fn),
    removeListener: (fn: Listener) => listeners.delete(fn),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList
}

export function simularAncho(px: number): void {
  ancho = px
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMediaFalso,
  })
  for (const [consulta, listeners] of consultas) {
    for (const fn of listeners) fn({ matches: coincide(consulta) })
  }
}

export function restaurarMatchMedia(): void {
  delete (window as { matchMedia?: unknown }).matchMedia
  consultas.clear()
}
