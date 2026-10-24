import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../../../lib/db'
import { getTenantActualId } from '../../../stores/authStore'

const ID = 'seleccion-compras'

function podar(
  claves: Set<string>,
  pendientes: ReadonlySet<string> | null,
): Set<string> {
  if (!pendientes) return claves
  const podada = new Set([...claves].filter((clave) => pendientes.has(clave)))
  return podada.size === claves.size ? claves : podada
}

/**
 * Spec 022 (research.md R2, FR-003): los ítems marcados en Compras, guardados
 * en este dispositivo (una fila de `borradores`, sin sincronizar) para que
 * sigan marcados al volver. El estado en memoria cambia al instante y la
 * fila se escribe detrás.
 *
 * `clavesPendientes` son las de **todos** los lugares del tenant (no solo la
 * vista), para que cambiar de lugar no borre lo marcado en otro. `null` =
 * todavía no se sabe (inventario cargando): no se poda. Una clave que deja de
 * estar pendiente se quita, así el ítem vuelve sin marcar si reaparece.
 */
export function useSeleccionCompras(
  clavesPendientes: ReadonlySet<string> | null,
): {
  seleccion: ReadonlySet<string>
  alternar: (clave: string) => void
  marcarTodos: (claves: string[]) => void
  cargando: boolean
} {
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set())
  const [cargando, setCargando] = useState(true)
  const pendientesRef = useRef(clavesPendientes)

  // Poda al cambiar lo pendiente (ajuste durante el render, sin efecto).
  const [pendientesPrevias, setPendientesPrevias] = useState(clavesPendientes)
  if (pendientesPrevias !== clavesPendientes) {
    setPendientesPrevias(clavesPendientes)
    const podada = podar(seleccion, clavesPendientes)
    if (podada !== seleccion) setSeleccion(podada)
  }

  useEffect(() => {
    pendientesRef.current = clavesPendientes
  }, [clavesPendientes])

  useEffect(() => {
    let cancelado = false
    void db.borradores.get(ID).then((fila) => {
      if (cancelado) return
      if (fila?.id === ID && fila.datos.tenantId === getTenantActualId()) {
        setSeleccion(podar(new Set(fila.datos.claves), pendientesRef.current))
      }
      setCargando(false)
    })
    return () => {
      cancelado = true
    }
  }, [])

  // La fila sigue al estado: marcar, desmarcar y podar se guardan igual.
  useEffect(() => {
    const tenantId = getTenantActualId()
    if (cargando || !tenantId) return
    void db.borradores.put({
      id: ID,
      datos: { tenantId, claves: [...seleccion] },
      actualizadoEn: new Date().toISOString(),
    })
  }, [cargando, seleccion])

  const alternar = useCallback((clave: string) => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(clave)) siguiente.delete(clave)
      else siguiente.add(clave)
      return siguiente
    })
  }, [])

  /** FR-002: marca todas las `claves`; si ya estaban todas, las desmarca. */
  const marcarTodos = useCallback((claves: string[]) => {
    setSeleccion((actual) => {
      const siguiente = new Set(actual)
      const todas =
        claves.length > 0 && claves.every((clave) => siguiente.has(clave))
      for (const clave of claves) {
        if (todas) siguiente.delete(clave)
        else siguiente.add(clave)
      }
      return siguiente
    })
  }, [])

  return { seleccion, alternar, marcarTodos, cargando }
}
