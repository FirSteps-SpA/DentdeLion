import { useCallback, useEffect, useState } from 'react'
import { esIdSeccion, type IdSeccion } from './secciones'

/**
 * Spec 019 (research.md R1, FR-005/006): la app no tiene rutas, así que la
 * sección abierta de Ajustes va en el hash (`#ajustes/<id>`): se conserva al
 * recargar y el "atrás" del dispositivo vuelve al índice. El hash no viaja al
 * servidor y no choca con `?invitacion=` (`features/auth/invitacion.ts`).
 */
const PREFIJO = '#ajustes/'

function urlSinHash(): string {
  return window.location.pathname + window.location.search
}

export function leerSeccionDeUrl(hash: string = window.location.hash): IdSeccion | null {
  if (!hash.startsWith(PREFIJO)) return null
  const id = hash.slice(PREFIJO.length)
  return esIdSeccion(id) ? id : null
}

export function abrirSeccion(id: IdSeccion): void {
  window.history.pushState({ ajustes: id }, '', urlSinHash() + PREFIJO + id)
}

/**
 * Si la entrada actual la creó `abrirSeccion`, vuelve atrás (así "Volver" y
 * el "atrás" del dispositivo hacen lo mismo y no se acumulan entradas). Si se
 * llegó recargando con el hash, o con `reemplazar`, quita el hash sin sumar
 * entrada.
 */
export function cerrarSeccion({ reemplazar = false }: { reemplazar?: boolean } = {}): void {
  const propia = (window.history.state as { ajustes?: string } | null)?.ajustes
  if (propia && !reemplazar) {
    window.history.back()
    return
  }
  window.history.replaceState(null, '', urlSinHash())
}

/** Al cambiar de vista desde la navegación, Ajustes vuelve a abrir en el índice. */
export function limpiarSeccionDeUrl(): void {
  if (!window.location.hash.startsWith(PREFIJO)) return
  window.history.replaceState(null, '', urlSinHash())
}

export function useSeccionAjustes(): [
  IdSeccion | null,
  (id: IdSeccion) => void,
  (opciones?: { reemplazar?: boolean }) => void,
] {
  const [seccion, setSeccion] = useState<IdSeccion | null>(() => leerSeccionDeUrl())

  useEffect(() => {
    const sincronizar = () => setSeccion(leerSeccionDeUrl())
    window.addEventListener('popstate', sincronizar)
    window.addEventListener('hashchange', sincronizar)
    return () => {
      window.removeEventListener('popstate', sincronizar)
      window.removeEventListener('hashchange', sincronizar)
    }
  }, [])

  const abrir = useCallback((id: IdSeccion) => {
    abrirSeccion(id)
    setSeccion(id)
  }, [])

  const cerrar = useCallback((opciones?: { reemplazar?: boolean }) => {
    cerrarSeccion(opciones)
    // `history.back()` avisa por `popstate`; `replaceState` no, así que se
    // relee la URL (en el caso de `back` sigue con el hash hasta el evento).
    setSeccion(leerSeccionDeUrl())
  }, [])

  return [seccion, abrir, cerrar]
}
