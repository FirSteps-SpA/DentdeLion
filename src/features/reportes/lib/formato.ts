import { formatearCLP } from '../../insumos/lib/precio'
import type { KpiVariacion } from '../../../components/ui/Card'
import { NOTA_GANANCIA } from '../../tratamientos/lib/montos'
import type { Incompleto, Kpi, Variacion } from './kpis'

// Spec 017 (UI §2, FR-005, FR-016, FR-019) — textos de Reportes. Los montos se
// redondean al peso solo al mostrar.

/** "$120.000" / "−$500": signo menos tipográfico antes del peso (Intl da "$-500"). */
export function formatearMonto(monto: number): string {
  return monto < 0 ? `−${formatearCLP(-monto)}` : formatearCLP(monto)
}

/** "↑ 8 % vs. mes anterior completo", "Nuevo", "Sin datos del período anterior". */
export function textoVariacion(v: Variacion, comparacion: string): string | null {
  if (v === null) return null
  if (v.tipo === 'sin-datos') return 'Sin datos del período anterior'
  if (v.tipo === 'nuevo') return `Nuevo ${comparacion}`
  const porcentaje = Math.round(Math.abs(v.valor) * 100)
  if (porcentaje === 0) return `Sin cambio ${comparacion}`
  return `${v.valor > 0 ? '↑' : '↓'} ${porcentaje} % ${comparacion}`
}

/** Variación de una tarjeta de Reportes: verde si mejora, rojo si empeora (FR-005). */
export function variacionKpi(kpi: Kpi, comparacion: string): KpiVariacion | undefined {
  const texto = textoVariacion(kpi.variacion, comparacion)
  if (texto === null) return undefined
  return { texto, tono: kpi.mejora === null ? 'muted' : kpi.mejora ? 'success' : 'danger' }
}

const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`

/** Notas de lo que un valor no incluye (FR-016). */
export function notasIncompleto(incompleto: Incompleto | null): string[] {
  if (!incompleto) return []
  const notas: string[] = []
  if (incompleto.tratamientosSinPrecio)
    notas.push(plural(incompleto.tratamientosSinPrecio, 'tratamiento sin precio', 'tratamientos sin precio'))
  if (incompleto.tratamientosSinPorcentaje)
    notas.push(`${incompleto.tratamientosSinPorcentaje} sin % profesional`)
  if (incompleto.materialesSinPrecio)
    notas.push(plural(incompleto.materialesSinPrecio, 'material sin precio', 'materiales sin precio'))
  return notas
}

/** "$120.000", o "desde $120.000" si el valor excluye datos sin precio (FR-016). */
export function montoKpi(valor: number, incompleto: unknown): string {
  return incompleto ? `desde ${formatearMonto(valor)}` : formatearMonto(valor)
}

/** Eje de montos compacto: "$1,2 M", "$120 mil", "$900". */
export function montoCompacto(monto: number): string {
  const signo = monto < 0 ? '−' : ''
  const abs = Math.abs(monto)
  if (abs >= 1_000_000) {
    return `${signo}$${(abs / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`
  }
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000).toLocaleString('es-CL')} mil`
  return `${signo}$${Math.round(abs)}`
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const MES_LARGO = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

export const mesCorto = (mes: number) => MES_CORTO[mes]
export const mesLargo = (anio: number, mes: number) => `${MES_LARGO[mes]} ${anio}`

/** "36 %" — porcentaje redondeado a entero (al menos "<1 %" si no es 0). */
export function porcentaje(valor: number): string {
  if (valor > 0 && valor < 0.5) return '<1 %'
  return `${Math.round(valor)} %`
}

/** Notas fijas de las tarjetas (DS §27; ayuda del gasto, research.md R2). */
export const NOTAS_GANANCIA = [NOTA_GANANCIA]
export const NOTAS_GASTO = ['Materiales consumidos, al costo de su lote']
