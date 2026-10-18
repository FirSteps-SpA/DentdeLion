import type { Insumo, Lote, Movimiento } from '../../../lib/db'
import { computeInsumosStockBajo } from '../../alertas/lib/stockBajo'
import { computeAlertasCaducidad } from '../../alertas/lib/caducidad'
import { computeStockLote } from './stock'
import { loteMasProximoAVencer } from './proximoLote'

export type Estado = 'ok' | 'bajo-stock' | 'proximo-a-caducar' | 'caducado'

/** data-model.md's EstadoInsumo view-model — never persisted, always recomputed. */
export interface EstadoInsumo {
  insumo: Insumo
  estado: Estado
  stockTotal: number
  loteMasProximoAVencer: Lote | null
}

/**
 * Un `EstadoInsumo` por insumo, agregando sin redefinir los cálculos ya
 * existentes de `computeInsumosStockBajo`/`computeAlertasCaducidad` (spec
 * 004) según la prioridad de research.md: `caducado` > `proximo-a-caducar` >
 * `bajo-stock` > `ok` — el riesgo clínico más alto gana cuando un insumo
 * califica para más de un estado a la vez.
 */
export function computeEstadoInsumo(
  insumos: Insumo[],
  lotes: Lote[],
  movimientos: Movimiento[],
  nivelesAvisoDias: number[],
  hoy: Date = new Date(),
): EstadoInsumo[] {
  const stockBajoIds = new Set(
    computeInsumosStockBajo(insumos, lotes, movimientos).map(
      ({ insumo }) => insumo.id,
    ),
  )

  const alertasCaducidad = computeAlertasCaducidad(
    insumos,
    lotes,
    movimientos,
    nivelesAvisoDias,
    hoy,
  )
  const caducadoIds = new Set(
    alertasCaducidad
      .filter((alerta) => alerta.nivel === 'caducado')
      .map((alerta) => alerta.insumo.id),
  )
  const proximoACaducarIds = new Set(
    alertasCaducidad
      .filter((alerta) => alerta.nivel !== 'caducado')
      .map((alerta) => alerta.insumo.id),
  )

  return insumos.map((insumo) => {
    const lotesDelInsumo = lotes.filter((lote) => lote.insumoId === insumo.id)
    const stockTotal = lotesDelInsumo.reduce(
      (total, lote) =>
        total +
        computeStockLote(
          movimientos.filter((movimiento) => movimiento.loteId === lote.id),
        ),
      0,
    )

    let estado: Estado = 'ok'
    if (caducadoIds.has(insumo.id)) estado = 'caducado'
    else if (proximoACaducarIds.has(insumo.id)) estado = 'proximo-a-caducar'
    else if (stockBajoIds.has(insumo.id)) estado = 'bajo-stock'

    return {
      insumo,
      estado,
      stockTotal,
      loteMasProximoAVencer: loteMasProximoAVencer(lotesDelInsumo, movimientos),
    }
  })
}

export type TonoEstado = 'success' | 'warning-30' | 'urgent-7' | 'danger'
export type IconoEstado = 'ok' | 'bajo' | 'critico' | 'proximo' | 'caducado'

export interface EstadoVisual {
  etiqueta: string
  tono: TonoEstado
  icono: IconoEstado
}

/**
 * Cómo se muestra el estado de un insumo (spec 013 FR-007, data-model.md):
 * agrega "Stock crítico" (stock total 0, el "Agotado" del DS §21) sin tocar
 * `computeEstadoInsumo` — es solo visual, no crea alertas ni cambia filtros,
 * contadores ni sugeridos. La caducidad conserva su prioridad (spec 006).
 */
export function estadoVisual({
  estado,
  stockTotal,
}: EstadoInsumo): EstadoVisual {
  if (estado === 'caducado')
    return { etiqueta: 'Caducado', tono: 'danger', icono: 'caducado' }
  if (estado === 'proximo-a-caducar') {
    return { etiqueta: 'Próximo a caducar', tono: 'urgent-7', icono: 'proximo' }
  }
  if (stockTotal === 0)
    return { etiqueta: 'Stock crítico', tono: 'danger', icono: 'critico' }
  if (estado === 'bajo-stock')
    return { etiqueta: 'Bajo Stock', tono: 'warning-30', icono: 'bajo' }
  return { etiqueta: 'Ok', tono: 'success', icono: 'ok' }
}
