import { useMemo } from 'react'
import type { Insumo, ItemCompra, Lote, Lugar, MinimoLugar, Movimiento } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import {
  bodegasActivas,
  lugaresDeBodega,
  rotuloBodega,
  useLugarStore,
  type SeleccionLugar,
} from '../../../stores/lugarStore'
import { computeEstadoInsumo, type Estado } from './estado'
import { minimoEfectivoBodega } from './minimos'
import { lotesEnBodega } from './stock'

/** Lo que leen las vistas de inventario, alertas, compras e Inicio. */
export interface DatosInventario {
  insumos: Insumo[]
  lotes: Lote[]
  movimientos: Movimiento[]
  itemsCompra: ItemCompra[]
}

/**
 * Spec 014 (FR-006/FR-007, research.md R10): los datos de un lugar. En vez de
 * agregar un parámetro de lugar a cada cálculo (estado, alertas, sugeridos,
 * resumen de Inicio), se les entrega la vista del lugar:
 * - solo los movimientos del lugar, así el stock que derivan es el del lugar;
 * - los lotes visibles en el lugar (`lotesEnLugar`);
 * - cada insumo con su mínimo efectivo en el lugar como `stockMinimo`;
 * - la lista de compras del lugar.
 * El catálogo (insumos) es el mismo en todos los lugares.
 */
export function datosDeLugar(
  datos: DatosInventario,
  minimosLugar: MinimoLugar[],
  lugarId: string,
): DatosInventario {
  return datosDeBodega(datos, minimosLugar, new Set([lugarId]))
}

/**
 * Spec 033 (research.md R2): la vista de una bodega, es decir, la de un lugar
 * generalizada a un conjunto de lugares (`lugaresDeBodega`). Movimientos,
 * lotes visibles e ítems de compra de cualquiera de ellos; mínimo de la bodega
 * (`minimoEfectivoBodega`). Con un solo lugar es exactamente `datosDeLugar`
 * (FR-019).
 */
export function datosDeBodega(
  datos: DatosInventario,
  minimosLugar: MinimoLugar[],
  lugarIds: ReadonlySet<string>,
): DatosInventario {
  const movimientos = datos.movimientos.filter((movimiento) => lugarIds.has(movimiento.lugarId))
  return {
    insumos: datos.insumos.map((insumo) => {
      const stockMinimo = minimoEfectivoBodega(insumo, lugarIds, minimosLugar)
      return stockMinimo === insumo.stockMinimo ? insumo : { ...insumo, stockMinimo }
    }),
    lotes: lotesEnBodega(datos.lotes, datos.movimientos, lugarIds),
    movimientos,
    itemsCompra: datos.itemsCompra.filter((item) => lugarIds.has(item.lugarId)),
  }
}

/**
 * Vista del lugar activo para los componentes. En "Todos" (o sin lugar
 * resuelto todavía) devuelve los datos de todos los lugares: el stock que
 * derivan es el total del tenant; el desglose por lugar lo agregan las vistas
 * de "Todos" (US3).
 */
export function useInventarioDeLugar(): DatosInventario & {
  lugarActivoId: SeleccionLugar | null
} {
  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const itemsCompra = useInventoryStore((s) => s.itemsCompra)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)

  return useMemo(() => {
    const todos = { insumos, lotes, movimientos, itemsCompra }
    if (!lugarActivoId || lugarActivoId === 'todos') return { ...todos, lugarActivoId }
    // Spec 033: el lugar activo ve el stock de toda su bodega.
    const bodega = lugaresDeBodega(lugarActivoId, lugares)
    return { ...datosDeBodega(todos, minimosLugar, bodega), lugarActivoId }
  }, [insumos, lotes, movimientos, itemsCompra, minimosLugar, lugares, lugarActivoId])
}

/** Los datos de un lugar, con el lugar al que pertenecen (`null` sin lugar resuelto). */
export interface VistaLugar {
  /**
   * El lugar de la vista. Spec 033: en "Todos", una bodega compartida se
   * representa con su primer lugar (donde se registran las acciones que se
   * abren desde la fila) y el rótulo "Box 1 + Box 2" como `nombre`, que es lo
   * que muestran los chips.
   */
  lugar: Lugar | null
  /** Spec 033: los lugares activos de la bodega de la vista (vacío sin lugar resuelto). */
  lugares: Lugar[]
  datos: DatosInventario
}

/**
 * Spec 014 US3 (FR-013): en "Todos", una vista por lugar activo, para que las
 * alertas, sugeridos y resúmenes se calculen en cada lugar (cada uno con su
 * stock y su mínimo) y se muestren juntos con el lugar de cada fila. Con un
 * lugar activo, solo la de ese lugar — los mismos cálculos sirven para ambos
 * casos. Spec 033 (FR-014, research.md R7): en "Todos", una vista por bodega,
 * así un stock común no se cuenta ni se alerta dos veces.
 */
export function useVistasDeLugar(): { vistas: VistaLugar[]; esTodos: boolean } {
  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const itemsCompra = useInventoryStore((s) => s.itemsCompra)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)

  return useMemo(
    () => vistasDeLugar({ insumos, lotes, movimientos, itemsCompra }, minimosLugar, lugares, lugarActivoId),
    [insumos, lotes, movimientos, itemsCompra, minimosLugar, lugares, lugarActivoId],
  )
}

export function vistasDeLugar(
  datos: DatosInventario,
  minimosLugar: MinimoLugar[],
  lugares: Lugar[],
  lugarActivoId: SeleccionLugar | null,
): { vistas: VistaLugar[]; esTodos: boolean } {
  if (lugarActivoId === 'todos') {
    return {
      esTodos: true,
      vistas: bodegasActivas(lugares).map((grupo) => {
        const ids = new Set(grupo.map((lugar) => lugar.id))
        const lugar =
          grupo.length > 1 ? { ...grupo[0], nombre: rotuloBodega(ids, lugares) } : grupo[0]
        return { lugar, lugares: grupo, datos: datosDeBodega(datos, minimosLugar, ids) }
      }),
    }
  }
  if (!lugarActivoId) return { esTodos: false, vistas: [{ lugar: null, lugares: [], datos }] }
  // Spec 033: el stock de la bodega del lugar activo.
  const bodega = lugaresDeBodega(lugarActivoId, lugares)
  return {
    esTodos: false,
    vistas: [
      {
        lugar: lugares.find((lugar) => lugar.id === lugarActivoId) ?? null,
        lugares: lugares.filter((lugar) => bodega.has(lugar.id)),
        datos: datosDeBodega(datos, minimosLugar, bodega),
      },
    ],
  }
}

/** Aplica un cálculo a cada vista y junta los resultados, cada uno con su lugar. */
export function porLugar<T>(
  vistas: VistaLugar[],
  calcular: (datos: DatosInventario) => T[],
): (T & { lugar: Lugar | null })[] {
  return vistas.flatMap(({ lugar, datos }) =>
    calcular(datos).map((fila) => ({ ...fila, lugar })),
  )
}

const PRIORIDAD_ESTADO: Estado[] = ['caducado', 'proximo-a-caducar', 'bajo-stock', 'ok']

/**
 * "Todos" en Inventario (contracts/ui-contracts.md): por insumo, el estado del
 * peor lugar y el stock de cada lugar ("Providencia: 4 · Las Condes: 2"). Spec
 * 033: una parte por bodega ("Box 1 + Box 2: 6 · Las Condes: 2").
 */
export function resumenPorLugar(
  vistas: VistaLugar[],
  nivelesAvisoDias: number[],
): Map<string, { estado: Estado; desglose: string }> {
  const porInsumo = new Map<string, { estado: Estado; partes: string[] }>()
  for (const { lugar, datos } of vistas) {
    const estados = computeEstadoInsumo(
      datos.insumos,
      datos.lotes,
      datos.movimientos,
      nivelesAvisoDias,
    )
    for (const { insumo, estado, stockTotal } of estados) {
      const actual = porInsumo.get(insumo.id) ?? { estado: 'ok' as Estado, partes: [] }
      if (PRIORIDAD_ESTADO.indexOf(estado) < PRIORIDAD_ESTADO.indexOf(actual.estado)) {
        actual.estado = estado
      }
      // Spec 033: con dos puntos, para que "Box 1 + Box 2: 6" no se lea "Box 2 6".
      actual.partes.push(`${lugar?.nombre ?? 'Lugar'}: ${stockTotal}`)
      porInsumo.set(insumo.id, actual)
    }
  }
  return new Map(
    [...porInsumo].map(([id, { estado, partes }]) => [id, { estado, desglose: partes.join(' · ') }]),
  )
}
