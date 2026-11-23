import type { CategoriaTratamiento, TratamientoRealizado } from '../../../lib/db'
import { FILTRO_SIN_CATEGORIA, SIN_CATEGORIA_TRATAMIENTO } from './categorias'
import { comisionRegistro } from './montos'

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
  /** Σ precio × % profesional: lo que gana el profesional (dato principal). */
  gananciaProfesional: number
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
    gananciaProfesional: vigentes.reduce((t, r) => t + (comisionRegistro(r) ?? 0), 0),
    costoMateriales: vigentes.reduce((t, r) => t + r.costoMateriales, 0),
    gananciaEstimada: vigentes.reduce((t, r) => t + (r.gananciaEstimada ?? 0), 0),
    sinMonto: vigentes.filter((r) => r.gananciaEstimada === null).length,
  }
}

/**
 * Spec 026 (FR-014, R11): nombre de la categoría de un registro para el
 * historial: el que tenía al registrarse ("Sin categoría" si no tenía).
 */
export function categoriaDeRegistro(registro: TratamientoRealizado): string {
  return registro.categoriaNombre ?? SIN_CATEGORIA_TRATAMIENTO
}

/**
 * Opciones del filtro del historial: cada categoría presente en los registros
 * (por identidad, con su nombre actual o, si ya no está, el del registro) y
 * "Sin categoría" al final si hay registros sin ella.
 */
export function opcionesCategoriaHistorial(
  registros: readonly TratamientoRealizado[],
  categorias: readonly CategoriaTratamiento[],
): { valor: string; nombre: string }[] {
  const porId = new Map<string, string>()
  let haySin = false
  for (const registro of registros) {
    if (registro.categoriaId === null) {
      haySin = true
      continue
    }
    if (porId.has(registro.categoriaId)) continue
    const actual = categorias.find((c) => c.id === registro.categoriaId)?.nombre
    porId.set(registro.categoriaId, actual ?? registro.categoriaNombre ?? SIN_CATEGORIA_TRATAMIENTO)
  }
  const opciones = [...porId.entries()]
    .map(([valor, nombre]) => ({ valor, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  if (haySin) opciones.push({ valor: FILTRO_SIN_CATEGORIA, nombre: SIN_CATEGORIA_TRATAMIENTO })
  return opciones
}

/** '' = todas; `FILTRO_SIN_CATEGORIA` = sin categoría; si no, el id registrado. */
export function filtrarPorCategoria(
  registros: TratamientoRealizado[],
  filtro: string,
): TratamientoRealizado[] {
  if (filtro === '') return registros
  if (filtro === FILTRO_SIN_CATEGORIA) return registros.filter((r) => r.categoriaId === null)
  return registros.filter((r) => r.categoriaId === filtro)
}
