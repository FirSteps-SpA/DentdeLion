import { useEffect, useRef } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { ChartColumn, ShoppingCart } from '../../../components/icons'
import { TouchButton } from '../../../components/ui/TouchButton'
import type { Vista } from '../../../app/navegacion'
import { seccionesVisibles, type IdSeccion } from '../lib/secciones'
import { useResumenesAjustes } from '../lib/useResumenesAjustes'
import { TarjetaSeccion } from './TarjetaSeccion'

interface AjustesIndiceProps {
  onAbrir: (id: IdSeccion) => void
  /** Tarjeta que recibe el foco al montar (la sección de la que se vuelve). */
  enfocar?: IdSeccion | null
  onNavegar?: (vista: Vista) => void
}

/**
 * Índice de Ajustes (spec 019 FR-001–004, UI §2): una tarjeta por sección
 * visible para el rol, con su resumen; en móvil, Compras y Reportes arriba.
 */
export function AjustesIndice({ onAbrir, enfocar, onNavegar }: AjustesIndiceProps) {
  const usuario = useAuthStore((s) => s.usuario)
  const resumenes = useResumenesAjustes()
  const refs = useRef(new Map<IdSeccion, HTMLButtonElement>())

  useEffect(() => {
    if (enfocar) refs.current.get(enfocar)?.focus()
  }, [enfocar])

  const esAdministrador = usuario?.rol === 'administrador'

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 text-left md:gap-6">
      <h1 className="text-h2 text-text">Ajustes</h1>
      {/* Specs 016 (R7) y 017 (R11): en móvil, Compras y Reportes se abren
          desde "Más"; lado a lado para que el índice entre en una pantalla
          (spec 019 SC-002). */}
      {onNavegar && (
        <div className="grid grid-cols-2 gap-2 md:hidden">
          <TouchButton type="button" variant="secondary" onClick={() => onNavegar('compras')}>
            <ShoppingCart size={18} />
            Compras
          </TouchButton>
          <TouchButton type="button" variant="secondary" onClick={() => onNavegar('reportes')}>
            <ChartColumn size={18} />
            Reportes
          </TouchButton>
        </div>
      )}
      {usuario && (
        <ul
          aria-label="Secciones de Ajustes"
          className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3 xl:grid-cols-3"
        >
          {seccionesVisibles(usuario.rol).map((seccion) => (
            <li key={seccion.id}>
              <TarjetaSeccion
                ref={(nodo) => {
                  if (nodo) refs.current.set(seccion.id, nodo)
                  else refs.current.delete(seccion.id)
                }}
                titulo={seccion.titulo(esAdministrador)}
                resumen={resumenes[seccion.id]}
                Icon={seccion.Icon}
                onClick={() => onAbrir(seccion.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
