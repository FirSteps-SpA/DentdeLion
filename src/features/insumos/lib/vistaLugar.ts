import { useMemo } from 'react'
import type { Insumo, ItemCompra, Lote, Lugar, MinimoLugar, Movimiento } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import {
  lugaresActivos,
  useLugarStore,
  type SeleccionLugar,
} from '../../../stores/lugarStore'
import { computeEstadoInsumo, type Estado } from './estado'
import { minimoEfectivo } from './minimos'
import { lotesEnLugar } from './stock'

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
  const movimientos = datos.movimientos.filter((movimiento) => movimiento.lugarId === lugarId)
  return {
    insumos: datos.insumos.map((insumo) => {
      const stockMinimo = minimoEfectivo(insumo, lugarId, minimosLugar)
      return stockMinimo === insumo.stockMinimo ? insumo : { ...insumo, stockMinimo }
    }),
    lotes: lotesEnLugar(datos.lotes, datos.movimientos, lugarId),
    movimientos,
    itemsCompra: datos.itemsCompra.filter((item) => item.lugarId === lugarId),
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
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)

  return useMemo(() => {
    const todos = { insumos, lotes, movimientos, itemsCompra }
    if (!lugarActivoId || lugarActivoId === 'todos') return { ...todos, lugarActivoId }
    return { ...datosDeLugar(todos, minimosLugar, lugarActivoId), lugarActivoId }
  }, [insumos, lotes, movimientos, itemsCompra, minimosLugar, lugarActivoId])
}

/** Los datos de un lugar, con el lugar al que pertenecen (`null` sin lugar resuelto). */
export interface VistaLugar {
  lugar: Lugar | null
  datos: DatosInventario
}

/**
 * Spec 014 US3 (FR-013): en "Todos", una vista por lugar activo, para que las
 * alertas, sugeridos y resúmenes se calculen en cada lugar (cada uno con su
 * stock y su mínimo) y se muestren juntos con el lugar de cada fila. Con un
 * lugar activo, solo la de ese lugar — los mismos cálculos sirven para ambos
 * casos.
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
      vistas: lugaresActivos(lugares).map((lugar) => ({
        lugar,
        datos: datosDeLugar(datos, minimosLugar, lugar.id),
      })),
    }
  }
  if (!lugarActivoId) return { esTodos: false, vistas: [{ lugar: null, datos }] }
  return {
    esTodos: false,
    vistas: [
      {
        lugar: lugares.find((lugar) => lugar.id === lugarActivoId) ?? null,
        datos: datosDeLugar(datos, minimosLugar, lugarActivoId),
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
 * peor lugar y el stock de cada lugar ("Providencia 4 · Las Condes 2").
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
      actual.partes.push(`${lugar?.nombre ?? 'Lugar'} ${stockTotal}`)
      porInsumo.set(insumo.id, actual)
    }
  }
  return new Map(
    [...porInsumo].map(([id, { estado, partes }]) => [id, { estado, desglose: partes.join(' · ') }]),
  )
}
