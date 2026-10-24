import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import type { Vista } from '../../../app/navegacion'
import { seccionesVisibles, type IdSeccion } from '../lib/secciones'
import { useSeccionAjustes } from '../lib/seccionUrl'
import { AjustesIndice } from './AjustesIndice'
import { SeccionAjustesPantalla } from './SeccionAjustesPantalla'

/**
 * Vista "Ajustes" (spec 010; spec 019): abre en un índice de tarjetas y cada
 * tarjeta abre su sección por separado, con "Volver". La sección abierta va
 * en la URL (`#ajustes/<id>`, research.md R1) para conservarla al recargar y
 * que el "atrás" del dispositivo vuelva al índice. Las secciones solo para
 * administración quedan ocultas por completo para `personal`, también si se
 * llega a ellas por la URL o tras un cambio de rol (FR-012/013, R7).
 * Reemplaza la página larga con perfil y notificaciones en dos columnas
 * (spec 013 FR-011).
 */
export function AjustesView({ onNavegar }: { onNavegar?: (vista: Vista) => void } = {}) {
  const usuario = useAuthStore((s) => s.usuario)
  const [seccion, abrir, cerrar] = useSeccionAjustes()
  const [enfocar, setEnfocar] = useState<IdSeccion | null>(null)
  const scrollIndice = useRef(0)

  const visible =
    seccion !== null && !!usuario && seccionesVisibles(usuario.rol).some((s) => s.id === seccion)

  // Una sección que el rol no puede ver no se muestra ni un instante: se
  // renderiza el índice y se quita de la URL sin sumar entrada.
  useEffect(() => {
    if (seccion !== null && usuario && !visible) cerrar({ reemplazar: true })
  }, [seccion, usuario, visible, cerrar])

  // Al volver al índice, misma posición de desplazamiento que al salir.
  const seccionAnterior = useRef(seccion)
  useLayoutEffect(() => {
    if (seccionAnterior.current !== null && seccion === null) {
      setEnfocar(seccionAnterior.current)
      window.scrollTo(0, scrollIndice.current)
    }
    seccionAnterior.current = seccion
  }, [seccion])

  function abrirSeccion(id: IdSeccion) {
    scrollIndice.current = window.scrollY
    setEnfocar(null)
    abrir(id)
    window.scrollTo(0, 0)
  }

  if (visible && seccion) {
    return <SeccionAjustesPantalla id={seccion} onVolver={() => cerrar()} />
  }
  return <AjustesIndice onAbrir={abrirSeccion} enfocar={enfocar} onNavegar={onNavegar} />
}
