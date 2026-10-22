/**
 * Spec 017 (research.md R4, FR-005, FR-007, FR-018a) — períodos de Reportes,
 * su período de comparación y la ventana de 13 meses. Cortes en meses
 * calendario en la **hora local** del dispositivo, como el historial de la
 * spec 016. Puro: `ahora` siempre se recibe.
 */

export type Periodo =
  | { tipo: 'esteMes' | 'mesAnterior' | 'ultimos3' | 'esteAnio' }
  /** `mes` 0–11, dentro de la ventana. */
  | { tipo: 'mes'; anio: number; mes: number }

export interface Rango {
  desde: Date
  hasta: Date
}

export interface MesCalendario {
  anio: number
  mes: number
}

export interface RangoPeriodo extends Rango {
  /** Período de comparación (FR-005); `null` si empieza antes de la ventana. */
  anterior: Rango | null
  etiqueta: string
  /** "vs. mes anterior completo", … — texto de la variación. */
  etiquetaComparacion: string
  /** Meses de la serie Gastos mensuales (6, o 12 en "Este año"), recortados a la ventana. */
  meses: MesCalendario[]
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** Día 1 del mes `mes` (puede salirse de 0–11: `Date` normaliza el año). */
const inicioMes = (anio: number, mes: number) => new Date(anio, mes, 1)

const aMes = (fecha: Date): MesCalendario => ({ anio: fecha.getFullYear(), mes: fecha.getMonth() })

export function etiquetaMes(anio: number, mes: number): string {
  return `${MESES[mes]} ${anio}`
}

/** Primer instante de la ventana de 13 meses: día 1 del mes actual − 12 meses. */
export function inicioVentana(ahora: Date): Date {
  return inicioMes(ahora.getFullYear(), ahora.getMonth() - 12)
}

/** Los 12 meses completos de la ventana para "Elegir mes…", del más reciente al más antiguo. */
export function mesesSeleccionables(ahora: Date): (MesCalendario & { etiqueta: string })[] {
  return Array.from({ length: 12 }, (_, i) => {
    const { anio, mes } = aMes(inicioMes(ahora.getFullYear(), ahora.getMonth() - 1 - i))
    return { anio, mes, etiqueta: etiquetaMes(anio, mes) }
  })
}

export function rangoPeriodo(periodo: Periodo, ahora: Date): RangoPeriodo {
  const anio = ahora.getFullYear()
  const mes = ahora.getMonth()
  let desde: Date
  let hasta: Date
  let anterior: Rango
  let etiqueta: string
  let etiquetaComparacion = 'vs. mes anterior'
  let ultimoMes: Date
  let largoSerie = 6

  switch (periodo.tipo) {
    case 'esteMes':
      desde = inicioMes(anio, mes)
      hasta = inicioMes(anio, mes + 1)
      anterior = { desde: inicioMes(anio, mes - 1), hasta: desde }
      etiqueta = 'Este mes'
      etiquetaComparacion = 'vs. mes anterior completo'
      ultimoMes = desde
      break
    case 'mesAnterior':
    case 'mes': {
      const base =
        periodo.tipo === 'mes' ? inicioMes(periodo.anio, periodo.mes) : inicioMes(anio, mes - 1)
      desde = base
      hasta = inicioMes(base.getFullYear(), base.getMonth() + 1)
      anterior = { desde: inicioMes(base.getFullYear(), base.getMonth() - 1), hasta: base }
      etiqueta =
        periodo.tipo === 'mes' ? etiquetaMes(base.getFullYear(), base.getMonth()) : 'Mes anterior'
      ultimoMes = base
      break
    }
    case 'ultimos3':
      desde = inicioMes(anio, mes - 2)
      hasta = inicioMes(anio, mes + 1)
      anterior = { desde: inicioMes(anio, mes - 5), hasta: desde }
      etiqueta = 'Últimos 3 meses'
      etiquetaComparacion = 'vs. 3 meses anteriores'
      ultimoMes = inicioMes(anio, mes)
      break
    case 'esteAnio':
      desde = inicioMes(anio, 0)
      hasta = inicioMes(anio, mes + 1)
      anterior = { desde: inicioMes(anio - 1, 0), hasta: inicioMes(anio - 1, mes + 1) }
      etiqueta = 'Este año'
      etiquetaComparacion = 'vs. mismo período del año anterior'
      ultimoMes = inicioMes(anio, mes)
      largoSerie = 12
      break
  }

  const ventana = inicioVentana(ahora)
  const meses = Array.from({ length: largoSerie }, (_, i) =>
    inicioMes(ultimoMes.getFullYear(), ultimoMes.getMonth() - (largoSerie - 1 - i)),
  )
    .filter((inicio) => inicio >= ventana)
    .map(aMes)

  return {
    desde,
    hasta,
    anterior: anterior.desde < ventana ? null : anterior,
    etiqueta,
    etiquetaComparacion,
    meses,
  }
}

/** `desde ≤ fecha < hasta`. */
export function enRango(iso: string, desde: Date, hasta: Date): boolean {
  const t = Date.parse(iso)
  return t >= desde.getTime() && t < hasta.getTime()
}

/** Clave estable de un período, para memorizar cálculos. */
export function clavePeriodo(periodo: Periodo): string {
  return periodo.tipo === 'mes' ? `mes-${periodo.anio}-${periodo.mes}` : periodo.tipo
}
