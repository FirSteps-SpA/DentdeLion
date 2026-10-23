/**
 * Textos de una alerta de caducidad (spec 018 FR-006/FR-007, research.md
 * R3–R4), compartidos por Alertas e Inicio.
 */

const DIAS_PARA_MESES = 60

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/**
 * "vence hoy", "vence en 12 días", "vence en 2 meses", "caducado hace 5
 * días"… Por debajo de 60 días cuenta días; desde ahí, meses completos de 30
 * días (60–89 = 2 meses), así nunca dice "1 mes" de algo a 59 días.
 */
export function textoTiempoCaducidad(diasRestantes: number): string {
  if (diasRestantes === 0) return 'vence hoy'
  const dias = Math.abs(diasRestantes)
  const cantidad =
    dias < DIAS_PARA_MESES
      ? plural(dias, 'día', 'días')
      : plural(Math.floor(dias / 30), 'mes', 'meses')
  return diasRestantes > 0 ? `vence en ${cantidad}` : `caducado hace ${cantidad}`
}

const formatoFecha = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/**
 * `AAAA-MM-DD` → "3 nov 2026". La fecha se arma en hora local: con
 * `new Date('2026-11-03')` (medianoche UTC) en Chile saldría el día anterior.
 */
export function formatearFechaCaducidad(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!partes) return ''
  const [, anio, mes, dia] = partes
  return formatoFecha.format(new Date(Number(anio), Number(mes) - 1, Number(dia)))
}
