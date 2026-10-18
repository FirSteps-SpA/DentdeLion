import { useState } from 'react'
import { useIndicadorSync } from './useIndicadorSync'

/**
 * Estado del indicador de sincronización y de su panel (spec 012), compartido
 * por el encabezado del teléfono (`AppHeader`) y la barra superior de tablet y
 * desktop (`TopBar`, spec 013) para no duplicar la lógica.
 */
export function usePanelSync() {
  const indicador = useIndicadorSync()
  const [abierto, setAbierto] = useState(false)
  return {
    indicador,
    abierto,
    abrir: () => setAbierto(true),
    cerrar: () => setAbierto(false),
  }
}
