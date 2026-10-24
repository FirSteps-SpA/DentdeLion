import { useCallback, useState } from 'react'
import { leerSeccionDeUrl, limpiarSeccionDeUrl } from '../features/ajustes/lib/seccionUrl'
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
