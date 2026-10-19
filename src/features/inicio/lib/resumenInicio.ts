import type { Insumo, ItemCompra, Lote, Lugar, Movimiento } from '../../../lib/db'
import { diasEntre } from '../../../lib/dateMath'
import { computeAlertasCaducidad } from '../../alertas/lib/caducidad'
import {
  contarAlertasPendientes,
  type PreferenciasNotificacion,
} from '../../alertas/lib/resumen'
import { computeInsumosStockBajo } from '../../alertas/lib/stockBajo'
import { computeItemsSugeridos } from '../../compras/lib/sugeridos'
import { computeStockLote } from '../../insumos/lib/stock'

const MAX_ITEMS = 5

export type TipoAlertaInicio = 'caducado' | 'caducidad' | 'stock-bajo'

export interface AlertaInicio {
  insumo: Insumo
  tipo: TipoAlertaInicio
  /** Lote afectado (caducidad) — `null` para stock bajo. */
  lote: Lote | null
  diasRestantes: number | null
  /** Stock actual (stock bajo) — `null` para caducidad. */
  stockActual: number | null
  /** Spec 014 — lugar de la alerta en la vista "Todos". */
  lugar?: Lugar | null
}

export interface VencimientoInicio {
  insumo: Insumo
  lote: Lote
  diasRestantes: number
  /** Spec 014 — lugar del lote en la vista "Todos". */
  lugar?: Lugar | null
}

export interface ResumenInicio {
  bajoMinimo: number
  porVencer: number
  paraComprar: number
  alertas: number
  listaAlertas: AlertaInicio[]
  proximosVencimientos: VencimientoInicio[]
}

export interface EntradaResumenInicio {
  insumos: Insumo[]
  lotes: Lote[]
  movimientos: Movimiento[]
  itemsCompra: ItemCompra[]
  nivelesAvisoDias: number[]
  preferencias: PreferenciasNotificacion
  hoy?: Date
  /** Spec 014 — lugar de estos datos, para etiquetar las filas en "Todos". */
  lugar?: Lugar | null
}

/**
 * Resumen de Inicio (spec 013 US3, FR-022–FR-027, research.md R9): reutiliza
 * sin cambios los cálculos de Alertas, Compras y la burbuja de navegación, así
 * que cada número coincide con la sección a la que lleva. Solo datos locales
 * (Constitución I); sin persistencia nueva.
 */
export function resumenInicio({
  insumos,
  lotes,
  movimientos,
  itemsCompra,
  nivelesAvisoDias,
  preferencias,
  hoy = new Date(),
  lugar = null,
}: EntradaResumenInicio): ResumenInicio {
  return recortar(resumenCompleto({
    insumos,
    lotes,
    movimientos,
    itemsCompra,
    nivelesAvisoDias,
    preferencias,
    hoy,
    lugar,
  }))
}

/**
 * Spec 014 US3 (FR-013): Inicio en "Todos". Cada lugar se resume con sus
 * propios datos y mínimos; los KPIs se suman y las listas se mezclan, con el
 * lugar de cada fila, y se recortan después de ordenar.
 */
export function resumenInicioPorLugares(entradas: EntradaResumenInicio[]): ResumenInicio {
  const resumenes = entradas.map(resumenCompleto)
  const suma = (campo: 'bajoMinimo' | 'porVencer' | 'paraComprar' | 'alertas') =>
    resumenes.reduce((total, r) => total + r[campo], 0)
  const alertas = resumenes.flatMap((r) => r.listaAlertas)
  return recortar({
    bajoMinimo: suma('bajoMinimo'),
    porVencer: suma('porVencer'),
    paraComprar: suma('paraComprar'),
    alertas: suma('alertas'),
    listaAlertas: [
      ...alertas.filter((a) => a.tipo !== 'stock-bajo').sort(porDias),
      ...alertas.filter((a) => a.tipo === 'stock-bajo').sort(porNombre),
    ],
    proximosVencimientos: resumenes
      .flatMap((r) => r.proximosVencimientos)
      .sort((a, b) => a.diasRestantes - b.diasRestantes),
  })
}

function porDias(a: AlertaInicio, b: AlertaInicio): number {
  return (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0)
}

function porNombre(a: AlertaInicio, b: AlertaInicio): number {
  return a.insumo.nombre.localeCompare(b.insumo.nombre, 'es')
}

function recortar(resumen: ResumenInicio): ResumenInicio {
  return {
    ...resumen,
    listaAlertas: resumen.listaAlertas.slice(0, MAX_ITEMS),
    proximosVencimientos: resumen.proximosVencimientos.slice(0, MAX_ITEMS),
  }
}

/** El resumen sin recortar las listas. */
function resumenCompleto({
  insumos,
  lotes,
  movimientos,
  itemsCompra,
  nivelesAvisoDias,
  preferencias,
  hoy = new Date(),
  lugar = null,
}: EntradaResumenInicio): ResumenInicio {
  const stockBajo = computeInsumosStockBajo(insumos, lotes, movimientos)
  const caducidad = computeAlertasCaducidad(
    insumos,
    lotes,
    movimientos,
    nivelesAvisoDias,
    hoy,
  )
  const sugeridos = computeItemsSugeridos(insumos, lotes, movimientos)
  const manualesPendientes = itemsCompra.filter(
    (item) => item.estado === 'pendiente',
  )

  const alertasCaducidad: AlertaInicio[] = caducidad
    .map(({ insumo, lote, diasRestantes, nivel }) => ({
      insumo,
      tipo:
        nivel === 'caducado' ? ('caducado' as const) : ('caducidad' as const),
      lote,
      diasRestantes,
      stockActual: null,
      lugar,
    }))
    .sort(porDias)
  const alertasStock: AlertaInicio[] = stockBajo
    .map(({ insumo, stockActual }) => ({
      insumo,
      tipo: 'stock-bajo' as const,
      lote: null,
      diasRestantes: null,
      stockActual,
      lugar,
    }))
    .sort(porNombre)

  const insumosPorId = new Map(insumos.map((insumo) => [insumo.id, insumo]))
  const proximosVencimientos: VencimientoInicio[] = []
  for (const lote of lotes) {
    if (!lote.fechaCaducidad) continue
    const insumo = insumosPorId.get(lote.insumoId)
    if (!insumo) continue
    const stock = computeStockLote(
      movimientos.filter((m) => m.loteId === lote.id),
    )
    if (stock <= 0) continue
    proximosVencimientos.push({
      insumo,
      lote,
      diasRestantes: diasEntre(lote.fechaCaducidad, hoy),
      lugar,
    })
  }
  proximosVencimientos.sort((a, b) => a.diasRestantes - b.diasRestantes)

  return {
    bajoMinimo: stockBajo.length,
    porVencer: caducidad.length,
    paraComprar: sugeridos.length + manualesPendientes.length,
    alertas: contarAlertasPendientes(
      insumos,
      lotes,
      movimientos,
      nivelesAvisoDias,
      preferencias,
    ),
    // Caducadas primero (diasRestantes negativos), luego por días; stock bajo al final.
    listaAlertas: [...alertasCaducidad, ...alertasStock],
    proximosVencimientos,
  }
}
