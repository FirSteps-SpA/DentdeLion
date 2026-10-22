import type { Insumo, Lugar, TratamientoRealizado } from '../../../lib/db'
import { SIN_CATEGORIA, claveCategoria } from '../../insumos/lib/categorias'
import type { ConsumoValorizado, FiltroLugar } from './gasto'
import { rangoPeriodo, type Periodo, type Rango, type RangoPeriodo } from './periodos'

/** Spec 017 (research.md R5) — variación frente al período de comparación. */
export type Variacion =
  | { tipo: 'porcentaje'; valor: number }
  | { tipo: 'nuevo' }
  | { tipo: 'sin-datos' }
  | null

/** Spec 017 (FR-016) — lo que un valor no incluye por falta de precio o %. */
export interface Incompleto {
  tratamientosSinPrecio?: number
  tratamientosSinPorcentaje?: number
  materialesSinPrecio?: number
}

export interface Kpi {
  /** Sin redondear (FR-019). */
  valor: number
  variacion: Variacion
  /** `true` si el cambio es favorable, `false` si no, `null` sin cambio o sin base. */
  mejora: boolean | null
  incompleto: Incompleto | null
}

export interface CategoriaGasto {
  clave: string
  nombre: string
  monto: number
  porcentaje: number
}

export interface GastoMes {
  anio: number
  mes: number
  monto: number
}

export interface MaterialMasUsado {
  insumoId: string
  nombre: string
  monto: number
  cantidad: number
  unidad: string
  dadoDeBaja: boolean
}

export interface GananciaLugar {
  lugarId: string
  nombre: string
  monto: number
}

export interface ResumenReportes {
  rango: RangoPeriodo
  produccion: Kpi
  gasto: Kpi
  ganancia: Kpi
  porCategoria: CategoriaGasto[]
  gastosMensuales: GastoMes[]
  masUtilizados: MaterialMasUsado[]
  /** `null` salvo "Todos" con ≥ 2 lugares con datos en el período (FR-012). */
  gananciaPorLugar: GananciaLugar[] | null
  /** Sin tratamientos realizados ni consumos en el período (FR-017). */
  vacio: boolean
}

export interface EntradaReportes {
  realizados: TratamientoRealizado[]
  /** Consumos valorizados de **todos** los lugares (`consumosValorizados(…, 'todos')`). */
  consumos: ConsumoValorizado[]
  /** Activos y dados de baja. */
  insumos: Insumo[]
  /** Incluidos los desactivados, para nombrar sus datos históricos. */
  lugares: Lugar[]
}

/** Máximo de sectores del donut: 3 categorías + "Otras" (research.md R7). */
export const MAX_CATEGORIAS = 4
export const MAX_MATERIALES = 10
export const OTRAS = 'Otras'

/** research.md R5: base fuera de la ventana → sin datos; base 0 → "Nuevo". */
export function variacion(actual: number, anterior: number | null): Variacion {
  if (anterior === null) return { tipo: 'sin-datos' }
  if (anterior === 0) return actual === 0 ? null : { tipo: 'nuevo' }
  return { tipo: 'porcentaje', valor: (actual - anterior) / Math.abs(anterior) }
}

function kpi(
  actual: number,
  anterior: number | null,
  subirEsMejor: boolean,
  incompleto: Incompleto | null,
): Kpi {
  const v = variacion(actual, anterior)
  const comparable = v !== null && v.tipo !== 'sin-datos' && actual !== anterior
  const sube = anterior !== null && actual > anterior
  return {
    valor: actual,
    variacion: v,
    mejora: comparable ? sube === subirEsMejor : null,
    incompleto,
  }
}

const delLugar = (filtro: FiltroLugar) => (item: { lugarId: string }) =>
  filtro === 'todos' || item.lugarId === filtro

/** Elemento con su fecha ya parseada (R12: cada `creadoEn` se parsea una sola vez). */
interface ConFecha<T> {
  item: T
  t: number
}

const conFecha = <T extends { creadoEn: string }>(items: T[]): ConFecha<T>[] =>
  items.map((item) => ({ item, t: Date.parse(item.creadoEn) }))

function enElRango<T>(items: ConFecha<T>[], rango: Rango): T[] {
  const desde = rango.desde.getTime()
  const hasta = rango.hasta.getTime()
  return items.filter(({ t }) => t >= desde && t < hasta).map(({ item }) => item)
}

/** Gasto de cada mes de la serie en una sola pasada (R12). */
function gastosPorMes(consumos: ConFecha<ConsumoValorizado>[], meses: RangoPeriodo['meses']): GastoMes[] {
  const inicios = meses.map(({ anio, mes }) => new Date(anio, mes, 1).getTime())
  const ultimo = meses.at(-1)
  const fin = ultimo ? new Date(ultimo.anio, ultimo.mes + 1, 1).getTime() : 0
  const montos = meses.map(() => 0)
  for (const { item, t } of consumos) {
    if (item.monto === null || t < inicios[0] || t >= fin) continue
    let i = inicios.length - 1
    while (inicios[i] > t) i--
    montos[i] += item.monto
  }
  return meses.map(({ anio, mes }, i) => ({ anio, mes, monto: montos[i] }))
}

interface TotalesTratamientos {
  produccion: number
  ganancia: number
  sinPrecio: number
  sinPorcentaje: number
  cantidad: number
}

/** research.md R3: precios y ganancias de los snapshots; los sin precio no suman. */
function totalesTratamientos(realizados: TratamientoRealizado[]): TotalesTratamientos {
  const totales = { produccion: 0, ganancia: 0, sinPrecio: 0, sinPorcentaje: 0, cantidad: 0 }
  for (const r of realizados) {
    totales.cantidad++
    if (r.precio === null) {
      totales.sinPrecio++
      continue
    }
    totales.produccion += r.precio
    if (r.gananciaEstimada === null) totales.sinPorcentaje++
    else totales.ganancia += r.gananciaEstimada
  }
  return totales
}

interface TotalesGasto {
  gasto: number
  materialesSinPrecio: number
  cantidad: number
}

function totalesGasto(consumos: ConsumoValorizado[]): TotalesGasto {
  const sinPrecio = new Set<string>()
  let gasto = 0
  for (const c of consumos) {
    if (c.monto === null) sinPrecio.add(c.insumoId)
    else gasto += c.monto
  }
  return { gasto, materialesSinPrecio: sinPrecio.size, cantidad: consumos.length }
}

const incompletoTratamientos = (t: TotalesTratamientos, conPorcentaje: boolean): Incompleto | null => {
  const incompleto: Incompleto = {}
  if (t.sinPrecio > 0) incompleto.tratamientosSinPrecio = t.sinPrecio
  if (conPorcentaje && t.sinPorcentaje > 0) incompleto.tratamientosSinPorcentaje = t.sinPorcentaje
  return Object.keys(incompleto).length > 0 ? incompleto : null
}

/**
 * Spec 017 (FR-003 a FR-012, FR-016, FR-017) — KPIs y datos de los gráficos de
 * Reportes para un período y un lugar (o "Todos"). Puro y determinista: el
 * mismo resultado con cualquier orden de entrada.
 */
export function resumenReportes(
  entrada: EntradaReportes,
  periodo: Periodo,
  filtro: FiltroLugar,
  ahora: Date,
): ResumenReportes {
  const rango = rangoPeriodo(periodo, ahora)
  const vigentes = conFecha(
    entrada.realizados.filter((r) => r.anuladoEn === null).filter(delLugar(filtro)),
  )
  const consumos = conFecha(entrada.consumos.filter(delLugar(filtro)))

  const realizadosRango = enElRango(vigentes, rango)
  const consumosRango = enElRango(consumos, rango)
  const t = totalesTratamientos(realizadosRango)
  const g = totalesGasto(consumosRango)
  const tAnterior = rango.anterior ? totalesTratamientos(enElRango(vigentes, rango.anterior)) : null
  const gAnterior = rango.anterior ? totalesGasto(enElRango(consumos, rango.anterior)) : null

  const insumos = new Map(entrada.insumos.map((insumo) => [insumo.id, insumo]))
  const valorizados = consumosRango.filter((c) => c.monto !== null)

  return {
    rango,
    produccion: kpi(t.produccion, tAnterior?.produccion ?? null, true, incompletoTratamientos(t, false)),
    gasto: kpi(
      g.gasto,
      gAnterior?.gasto ?? null,
      false,
      g.materialesSinPrecio > 0 ? { materialesSinPrecio: g.materialesSinPrecio } : null,
    ),
    ganancia: kpi(t.ganancia, tAnterior?.ganancia ?? null, true, incompletoTratamientos(t, true)),
    porCategoria: porCategoria(valorizados, insumos),
    gastosMensuales: gastosPorMes(consumos, rango.meses),
    masUtilizados: masUtilizados(valorizados, insumos),
    gananciaPorLugar: filtro === 'todos' ? gananciaPorLugar(realizadosRango, entrada.lugares) : null,
    vacio: t.cantidad === 0 && g.cantidad === 0,
  }
}

const porMontoYNombre = (a: { monto: number; nombre: string }, b: { monto: number; nombre: string }) =>
  b.monto - a.monto || a.nombre.localeCompare(b.nombre, 'es')

function porCategoria(
  consumos: ConsumoValorizado[],
  insumos: Map<string, Insumo>,
): CategoriaGasto[] {
  const grupos = new Map<string, { monto: number; porTexto: Map<string, number> }>()
  for (const c of consumos) {
    const texto = insumos.get(c.insumoId)?.categoria.trim() || SIN_CATEGORIA
    const clave = claveCategoria(texto)
    const grupo = grupos.get(clave) ?? { monto: 0, porTexto: new Map<string, number>() }
    grupo.monto += c.monto as number
    grupo.porTexto.set(texto, (grupo.porTexto.get(texto) ?? 0) + (c.monto as number))
    grupos.set(clave, grupo)
  }
  const total = [...grupos.values()].reduce((suma, g) => suma + g.monto, 0)
  if (total <= 0) return []
  const ordenadas = [...grupos.entries()]
    .map(([clave, g]) => ({ clave, nombre: nombreVisible(g.porTexto), monto: g.monto }))
    .sort(porMontoYNombre)
  const visibles =
    ordenadas.length > MAX_CATEGORIAS
      ? [
          ...ordenadas.slice(0, MAX_CATEGORIAS - 1),
          {
            clave: claveCategoria(OTRAS),
            nombre: OTRAS,
            monto: ordenadas.slice(MAX_CATEGORIAS - 1).reduce((suma, g) => suma + g.monto, 0),
          },
        ]
      : ordenadas
  return visibles.map((g) => ({ ...g, porcentaje: (g.monto / total) * 100 }))
}

/** La grafía con más gasto ("Restauración" frente a "restauracion "); empate: alfabética. */
function nombreVisible(porTexto: Map<string, number>): string {
  return [...porTexto.entries()]
    .map(([nombre, monto]) => ({ nombre, monto }))
    .sort(porMontoYNombre)[0].nombre
}

function masUtilizados(consumos: ConsumoValorizado[], insumos: Map<string, Insumo>): MaterialMasUsado[] {
  const grupos = new Map<string, { monto: number; cantidad: number }>()
  for (const c of consumos) {
    const grupo = grupos.get(c.insumoId) ?? { monto: 0, cantidad: 0 }
    grupo.monto += c.monto as number
    grupo.cantidad += c.cantidad
    grupos.set(c.insumoId, grupo)
  }
  return [...grupos.entries()]
    .map(([insumoId, g]) => {
      const insumo = insumos.get(insumoId)
      return {
        insumoId,
        nombre: insumo?.nombre ?? 'Material',
        monto: g.monto,
        cantidad: g.cantidad,
        unidad: insumo?.unidadMedida ?? '',
        dadoDeBaja: (insumo?.dadoDeBajaEn ?? null) !== null,
      }
    })
    .sort(porMontoYNombre)
    .slice(0, MAX_MATERIALES)
}

function gananciaPorLugar(realizados: TratamientoRealizado[], lugares: Lugar[]): GananciaLugar[] | null {
  const nombres = new Map(lugares.map((lugar) => [lugar.id, lugar.nombre]))
  const montos = new Map<string, number>()
  for (const r of realizados) {
    montos.set(r.lugarId, (montos.get(r.lugarId) ?? 0) + (r.gananciaEstimada ?? 0))
  }
  if (montos.size < 2) return null
  return [...montos.entries()]
    .map(([lugarId, monto]) => ({ lugarId, nombre: nombres.get(lugarId) ?? 'Lugar', monto }))
    .sort(porMontoYNombre)
}
