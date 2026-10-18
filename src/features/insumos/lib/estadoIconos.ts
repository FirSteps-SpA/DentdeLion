import type { ComponentType } from 'react'
import {
  AlertTriangle,
  CircleAlert,
  CircleCheck,
  Clock,
  type IconProps,
} from '../../../components/icons'
import type { IconoEstado } from './estado'

/** Ícono de cada estado visual (DS §21; spec 013 FR-007): nunca solo color. */
export const ICONO_ESTADO: Record<IconoEstado, ComponentType<IconProps>> = {
  ok: CircleCheck,
  bajo: AlertTriangle,
  critico: CircleAlert,
  proximo: Clock,
  caducado: CircleAlert,
}
