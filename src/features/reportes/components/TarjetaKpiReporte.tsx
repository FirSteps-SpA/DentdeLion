import type { ComponentType } from 'react'
import { KpiCard } from '../../../components/ui/Card'
import type { IconProps } from '../../../components/icons'
import { montoKpi, notasIncompleto, variacionKpi } from '../lib/formato'
import type { Kpi } from '../lib/kpis'

export interface TarjetaKpiReporteProps {
  titulo: string
  Icono: ComponentType<IconProps>
  kpi: Kpi
  comparacion: string
  /** Notas fijas bajo el valor (la de "Ganancia estimada", la ayuda del gasto). */
  notasFijas?: string[]
}

/**
 * Spec 017 (US1, UI §2) — tarjeta informativa de Reportes sobre la `KpiCard`
 * del DS §20: monto con la utilidad `text-num` (FR-019), "desde $X" si
 * faltan precios (FR-016), variación coloreada según mejore o empeore
 * (FR-005) y negativos en rojo con signo.
 */
export function TarjetaKpiReporte({ titulo, Icono, kpi, comparacion, notasFijas = [] }: TarjetaKpiReporteProps) {
  const valor = montoKpi(kpi.valor, kpi.incompleto)
  const variacion = variacionKpi(kpi, comparacion)
  const notas = [...notasIncompleto(kpi.incompleto), ...notasFijas]
  return (
    <KpiCard
      titulo={titulo}
      valor={valor}
      Icono={Icono}
      tono={kpi.valor < 0 ? 'danger' : 'neutro'}
      ariaLabel={[`${titulo}: ${valor}`, variacion?.texto, ...notas].filter(Boolean).join('. ')}
      variacion={variacion}
      nota={
        notas.length > 0 ? (
          <span className="flex flex-col">
            {notas.map((nota) => (
              <span key={nota}>{nota}</span>
            ))}
          </span>
        ) : undefined
      }
    />
  )
}
