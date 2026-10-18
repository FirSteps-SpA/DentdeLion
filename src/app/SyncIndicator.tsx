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

const ESTILOS: Record<
  EstadoIndicador,
  { Icono: ComponentType<IconProps>; color: string }
> = {
  sincronizado: { Icono: Check, color: 'text-success-text' },
  pendientes: { Icono: ArrowsSync, color: 'text-primary' },
  'sin-conexion': { Icono: CloudOff, color: 'text-text-muted' },
  error: { Icono: AlertTriangle, color: 'text-danger' },
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
    ? { Icono: Clock, color: 'text-warning-30-text' }
    : ESTILOS[indicador.estado]
  const texto = textoIndicador(indicador)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Estado de sincronización: ${texto}${indicador.alerta ? ' · cambios antiguos sin subir' : ''}`}
      data-estado={indicador.estado}
      data-alerta={indicador.alerta || undefined}
      className={`touch-target flex items-center gap-1.5 rounded-full px-2.5 ${indicador.alerta ? 'bg-warning-30-bg' : ''} ${color}`}
    >
      <Icono
        size={16}
        className={sincronizando ? 'motion-safe:animate-spin' : undefined}
      />
      <span className="whitespace-nowrap text-[11px] font-semibold">
        <span className="sm:hidden">{textoCortoIndicador(indicador)}</span>
        <span className="hidden sm:inline">{texto}</span>
      </span>
    </button>
  )
}
