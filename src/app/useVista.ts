import { useCallback, useState } from 'react'
import {
  abrirSeccion,
  leerSeccionDeUrl,
  limpiarSeccionDeUrl,
} from '../features/ajustes/lib/seccionUrl'
import type { IdSeccion } from '../features/ajustes/lib/secciones'
import type { Vista } from './navegacion'

/**
 * Vista activa de la app. Spec 019 (research.md R1): con `#ajustes/<sección>`
 * en la URL (recarga con una sección abierta) arranca en Ajustes, y cambiar
 * de vista quita la sección de la URL para que Ajustes vuelva a abrir en el
 * índice (FR-006).
 */
export function useVista(): [Vista, (vista: Vista) => void] {
  const [vista, setVistaEstado] = useState<Vista>(() =>
    leerSeccionDeUrl() ? 'mas' : 'inicio',
  )
  const setVista = useCallback((siguiente: Vista) => {
    limpiarSeccionDeUrl()
    setVistaEstado(siguiente)
  }, [])
  return [vista, setVista]
}

/**
 * Spec 032 (research.md R6): abre una sección de Ajustes desde fuera de
 * Ajustes (p. ej. "Ver perfil" del menú del avatar). Cambia a la vista de
 * Ajustes y deja la sección en la URL como lo hace `abrirSeccion`. El
 * `popstate` avisa a un `AjustesView` ya montado (`useSeccionAjustes` lo
 * escucha); uno que recién se monta la lee de la URL al iniciar.
 */
export function irASeccionAjustes(cambiarVista: (vista: Vista) => void, id: IdSeccion): void {
  cambiarVista('mas')
  abrirSeccion(id)
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
}
