import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '../icons'
import { CUADRADO_TONO, type TonoIcono } from './tonos'

export interface EncabezadoSeccionProps {
  Icono: ComponentType<IconProps>
  titulo: ReactNode
  id?: string
  nivel?: 2 | 3
  tono?: TonoIcono
  /** "Ver todas →" u otra acción a la derecha. */
  accion?: ReactNode
}

/**
 * Spec 027 (FR-009, FR-012, research.md R6) — encabezado de una tarjeta de
 * sección: ícono en cuadrado de color suave, título y acción opcional.
 */
export function EncabezadoSeccion({
  Icono,
  titulo,
  id,
  nivel = 2,
  tono = 'primario',
  accion,
}: EncabezadoSeccionProps) {
  const Titulo = nivel === 2 ? 'h2' : 'h3'
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${CUADRADO_TONO[tono]}`}
        >
          <Icono size={18} />
        </span>
        <Titulo id={id} className="truncate text-h3 text-text">
          {titulo}
        </Titulo>
      </div>
      {accion}
    </div>
  )
}
