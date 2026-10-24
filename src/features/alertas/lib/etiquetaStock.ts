import type { ComponentType } from 'react'
import { AlertTriangle, CircleAlert, type IconProps } from '../../../components/icons'
import type { BadgeVariant } from '../../../components/ui/Badge'

export interface EtiquetaStock {
  texto: 'Sin stock' | 'Bajo mínimo'
  variante: Extract<BadgeVariant, 'danger' | 'warning-30'>
  icono: ComponentType<IconProps>
}

/**
 * Etiqueta de una alerta de stock bajo (spec 018 FR-011/FR-012, research.md
 * R6), la misma en Alertas e Inicio: sin nada que usar es "Sin stock"; si
 * queda algo bajo el mínimo, "Bajo mínimo".
 */
export function etiquetaStockBajo(stockActual: number): EtiquetaStock {
  return stockActual <= 0
    ? { texto: 'Sin stock', variante: 'danger', icono: CircleAlert }
    : { texto: 'Bajo mínimo', variante: 'warning-30', icono: AlertTriangle }
}
