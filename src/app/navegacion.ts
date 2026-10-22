import {
  Bell,
  Boxes,
  ChartColumn,
  House,
  Settings,
  ShoppingCart,
  Stethoscope,
  type IconProps,
} from '../components/icons'
import type { ComponentType } from 'react'

export type Vista =
  | 'inicio'
  | 'inventario'
  | 'tratamientos'
  | 'compras'
  | 'reportes'
  | 'alertas'
  | 'mas'

export interface Seccion {
  vista: Vista
  /** Barra inferior (móvil). */
  etiquetaMovil: string
  /** Sidebar (tablet y desktop). */
  etiquetaLateral: string
  Icon: ComponentType<IconProps>
  /**
   * Spec 016 (research.md R7): solo en la sidebar; en móvil la barra tiene 5
   * ítems y esta sección se abre desde "Más" (y desde Inicio).
   */
  soloLateral?: boolean
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
    vista: 'tratamientos',
    etiquetaMovil: 'Tratamientos',
    etiquetaLateral: 'Tratamientos',
    Icon: Stethoscope,
  },
  {
    vista: 'compras',
    etiquetaMovil: 'Compras',
    etiquetaLateral: 'Compras',
    Icon: ShoppingCart,
    soloLateral: true,
  },
  {
    // Spec 017 (research.md R11): sidebar en tablet/desktop; en móvil, desde "Más".
    vista: 'reportes',
    etiquetaMovil: 'Reportes',
    etiquetaLateral: 'Reportes',
    Icon: ChartColumn,
    soloLateral: true,
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
