import { formatearCLP } from '../../insumos/lib/precio'
import { TEXTO_MOTIVO } from './montos'
import type { MontosTratamiento } from './useMontosTratamiento'

/** "$3.480" o "desde $1.080" si falta el precio de algún material (FR-008). */
export function textoCosto(montos: MontosTratamiento): string {
  const monto = formatearCLP(montos.costo.costoMateriales)
  return montos.costo.completo ? monto : `desde ${monto}`
}

/** Un monto con signo: "−$3.480" si es negativo (FR-007). */
export function formatearConSigno(monto: number): string {
  return monto < 0 ? `−${formatearCLP(-monto)}` : formatearCLP(monto)
}

/** "$14.520", "−$3.480" o el motivo de su ausencia ("Sin precio en este lugar"). */
export function textoGanancia(montos: MontosTratamiento): string {
  const { ganancia, motivo } = montos.ganancia
  if (ganancia === null) return motivo ? TEXTO_MOTIVO[motivo] : '—'
  return formatearConSigno(ganancia)
}
