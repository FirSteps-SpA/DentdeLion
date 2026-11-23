import { formatearCLP } from '../../insumos/lib/precio'
import { TEXTO_MOTIVO } from './montos'
import type { MontosTratamiento, PorcentajeConOrigen } from './useMontosTratamiento'

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

/** "$18.000" o el motivo de su ausencia ("Define el % profesional del lugar"). */
export function textoComision(montos: MontosTratamiento): string {
  const { comision, motivo } = montos.ganancia
  if (comision === null) return motivo ? TEXTO_MOTIVO[motivo] : '—'
  return formatearCLP(comision)
}

const formatoPorcentaje = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })

/**
 * Spec 026 (FR-012): "50 % · Evaluación" o "40 % · general del lugar"; `null`
 * sin porcentaje.
 */
export function textoPorcentaje(porcentaje: PorcentajeConOrigen): string | null {
  if (porcentaje.valor === null) return null
  const valor = `${formatoPorcentaje.format(porcentaje.valor)} %`
  if (porcentaje.origen === 'categoria') {
    return porcentaje.categoriaNombre ? `${valor} · ${porcentaje.categoriaNombre}` : valor
  }
  return `${valor} · general del lugar`
}
