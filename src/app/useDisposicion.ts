import { useSyncExternalStore } from 'react'

export type Disposicion = 'movil' | 'tablet' | 'desktop'

const TABLET = '(min-width: 768px)'
const DESKTOP = '(min-width: 1200px)'

function consultas(): MediaQueryList[] {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return []
  return [window.matchMedia(TABLET), window.matchMedia(DESKTOP)]
}

function suscribir(aviso: () => void): () => void {
  const lista = consultas()
  for (const mq of lista) mq.addEventListener('change', aviso)
  return () => {
    for (const mq of lista) mq.removeEventListener('change', aviso)
  }
}

function leer(): Disposicion {
  const [tablet, desktop] = consultas()
  if (!tablet || !desktop) return 'movil'
  if (desktop.matches) return 'desktop'
  return tablet.matches ? 'tablet' : 'movil'
}

/**
 * Disposición según el ancho del viewport (spec 013 FR-011, DS §38): móvil
 * < 768 px, tablet 768–1199 px, desktop ≥ 1200 px. Solo para lo que cambia de
 * *estructura* (barra inferior o lateral, tarjetas o tabla): renderiza un único
 * árbol, sin duplicar controles (research.md R5). Lo que solo cambia de estilo
 * usa las variantes `md:` / `desk:`. Sin `matchMedia` (jsdom), móvil.
 */
export function useDisposicion(): Disposicion {
  return useSyncExternalStore(suscribir, leer, () => 'movil')
}
