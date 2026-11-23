import type { ComponentType } from 'react'
import type { EstadoIndicador, Indicador } from '../lib/sync/indicador'
import { useSyncStore } from '../stores/syncStore'
import { textoCortoIndicador, textoIndicador } from './textosSync'
import {
  AlertTriangle,
  ArrowsSync,
  Check,
  Clock,
  CloudOff,
  type IconProps,
} from '../components/icons'

/**
 * Spec 027 (FR-004, research.md R4): pastilla con fondo por estado (todas con
 * texto AA sobre su fondo); el error en ámbar, como en la referencia.
 */
const ESTILOS: Record<
  EstadoIndicador,
  { Icono: ComponentType<IconProps>; color: string }
> = {
  sincronizado: { Icono: Check, color: 'bg-success-bg text-success-text' },
  pendientes: { Icono: ArrowsSync, color: 'bg-primary-soft text-primary-text' },
  'sin-conexion': { Icono: CloudOff, color: 'bg-bg-secondary text-text-muted' },
  error: { Icono: AlertTriangle, color: 'bg-warning-30-bg text-warning-30-text' },
}

export interface SyncIndicatorProps {
  indicador: Indicador
  onClick: () => void
}

/**
 * Indicador de sincronización del encabezado (spec 012 FR-001/002/010/014):
 * estado real según pendientes locales y el último ciclo, no solo la
 * conexión. Botón de ≥48×48 px que abre el panel; ícono y color por estado
 * (nunca solo texto) y, si hay pendientes antiguos, reloj y color de
 * advertencia.
 */
export function SyncIndicator({ indicador, onClick }: SyncIndicatorProps) {
  const sincronizando = useSyncStore((s) => s.fase === 'sincronizando')
  const { Icono, color } = indicador.alerta
    ? { Icono: Clock, color: 'bg-warning-30-bg text-warning-30-text' }
    : ESTILOS[indicador.estado]
  const texto = textoIndicador(indicador)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Estado de sincronización: ${texto}${indicador.alerta ? ' · cambios antiguos sin subir' : ''}`}
      data-estado={indicador.estado}
      data-alerta={indicador.alerta || undefined}
      className={`touch-target flex items-center gap-1.5 rounded-full px-2.5 focus-visible:outline-2 focus-visible:outline-brand ${color}`}
    >
      <Icono
        size={16}
        className={sincronizando ? 'motion-safe:animate-spin' : undefined}
      />
      <span className="whitespace-nowrap text-[11px] font-semibold sm:text-xs">
        <span className="sm:hidden">{textoCortoIndicador(indicador)}</span>
        <span className="hidden sm:inline">{texto}</span>
      </span>
    </button>
  )
}
