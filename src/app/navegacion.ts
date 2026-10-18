import {
  Bell,
  Boxes,
  House,
  Settings,
  ShoppingCart,
  type IconProps,
} from '../components/icons'
import type { ComponentType } from 'react'

export type Vista = 'inicio' | 'inventario' | 'compras' | 'alertas' | 'mas'

export interface Seccion {
  vista: Vista
  /** Barra inferior (móvil). */
  etiquetaMovil: string
  /** Sidebar (tablet y desktop). */
  etiquetaLateral: string
  Icon: ComponentType<IconProps>
}

/**
 * Secciones de la app, en orden, compartidas por la barra inferior y la sidebar
 * (spec 013 FR-010, data-model.md). Íconos del DS §7.
 */
export const SECCIONES: Seccion[] = [
  {
    vista: 'inicio',
    etiquetaMovil: 'Inicio',
    etiquetaLateral: 'Inicio',
    Icon: House,
  },
  {
    vista: 'inventario',
    etiquetaMovil: 'Inventario',
    etiquetaLateral: 'Inventario',
    Icon: Boxes,
  },
  {
    vista: 'compras',
    etiquetaMovil: 'Compras',
    etiquetaLateral: 'Compras',
    Icon: ShoppingCart,
  },
  {
    vista: 'alertas',
    etiquetaMovil: 'Alertas',
    etiquetaLateral: 'Alertas',
    Icon: Bell,
  },
  {
    vista: 'mas',
    etiquetaMovil: 'Más',
    etiquetaLateral: 'Ajustes',
    Icon: Settings,
  },
]
