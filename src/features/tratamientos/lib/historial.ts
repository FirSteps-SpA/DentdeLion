import type { TratamientoRealizado } from '../../../lib/db'

export type Periodo = 'hoy' | 'semana' | 'mes'

export const ETIQUETA_PERIODO: Record<Periodo, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
}

/** Inicio del período en hora local: hoy, el lunes de esta semana o el día 1 (R8). */
export function inicioPeriodo(periodo: Periodo, ahora: Date = new Date()): Date {
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  if (periodo === 'semana') {
    const desdeLunes = (inicio.getDay() + 6) % 7
    inicio.setDate(inicio.getDate() - desdeLunes)
  } else if (periodo === 'mes') {
    inicio.setDate(1)
  }
  return inicio
}

/**
 * Spec 016 US5 (FR-019): registros del período del más reciente al más
 * antiguo; `lugarId` null = todos los lugares.
 */
export function registrosDelPeriodo(
  registros: TratamientoRealizado[],
  periodo: Periodo,
  lugarId: string | null,
  ahora: Date = new Date(),
): TratamientoRealizado[] {
  const desde = inicioPeriodo(periodo, ahora).getTime()
  return registros
    .filter((r) => (lugarId === null || r.lugarId === lugarId) && Date.parse(r.creadoEn) >= desde)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
}

export interface TotalesHistorial {
  cantidad: number
  precios: number
  costoMateriales: number
  gananciaEstimada: number
  /** Registros vigentes sin precio o sin %: no suman a precio ni a ganancia. */
  sinMonto: number
}

/** Totales sin los anulados; los sin precio no suman a precios ni a ganancia (R8). */
export function totalesHistorial(registros: TratamientoRealizado[]): TotalesHistorial {
  const vigentes = registros.filter((r) => !r.anuladoEn)
  return {
    cantidad: vigentes.length,
    precios: vigentes.reduce((t, r) => t + (r.precio ?? 0), 0),
    costoMateriales: vigentes.reduce((t, r) => t + r.costoMateriales, 0),
    gananciaEstimada: vigentes.reduce((t, r) => t + (r.gananciaEstimada ?? 0), 0),
    sinMonto: vigentes.filter((r) => r.gananciaEstimada === null).length,
  }
}
