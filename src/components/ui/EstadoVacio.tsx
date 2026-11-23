import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '../icons'

export interface EstadoVacioProps {
  Icono: ComponentType<IconProps>
  texto: ReactNode
  accion?: ReactNode
  /** Variante más baja dentro de una tarjeta pequeña. */
  compacto?: boolean
}

/**
 * Spec 027 (FR-013, research.md R7) — estado vacío: ícono grande desvaído del
 * tema, el mismo texto de siempre y una acción opcional, en vez de una
 * tarjeta casi vacía.
 */
export function EstadoVacio({ Icono, texto, accion, compacto = false }: EstadoVacioProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 text-center ${compacto ? 'py-4' : 'py-8'}`}
    >
      <span
        aria-hidden="true"
        data-decorado="vacio"
        className="pointer-events-none flex h-16 w-16 items-center justify-center rounded-full bg-tinte-primario text-brand-icon/70 print:hidden"
      >
        <Icono size={compacto ? 26 : 32} />
      </span>
      <p className="text-body text-text-muted">{texto}</p>
      {accion}
    </div>
  )
}
