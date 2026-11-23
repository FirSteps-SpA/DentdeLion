import { useMemo } from 'react'
import type { Insumo } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { useCostosUnitarios } from '../../insumos/lib/useCostosUnitarios'
import {
  calcularCostoTratamiento,
  calcularGanancia,
  type CostoTratamiento,
  type Ganancia,
} from './montos'
import { porcentajeAplicable, type TratamientoProyectado } from './proyeccion'

export interface MontosTratamiento {
  costo: CostoTratamiento
  /** Precio en el lugar pedido (Q1); `null` = sin precio ahí. */
  precio: number | null
  porcentaje: number | null
  /** Spec 026 (FR-012): de dónde viene el % ("50 % · Evaluación"). */
  origenPorcentaje: PorcentajeConOrigen
  ganancia: Ganancia
}

export interface PorcentajeConOrigen {
  valor: number | null
  origen: 'categoria' | 'lugar' | null
  /** Nombre de la categoría cuando `origen === 'categoria'`. */
  categoriaNombre: string | null
}

/**
 * Spec 026 (R5, FR-010/FR-012) — % que aplicaría a un tratamiento en un lugar,
 * con su origen, desde el store (la misma regla que guarda el registro).
 */
export function usePorcentajeAplicable(): (
  tratamiento: Pick<TratamientoProyectado, 'categoriaId'>,
  lugarId: string,
) => PorcentajeConOrigen {
  const porcentajesLugar = useTratamientosStore((s) => s.porcentajes)
  const porcentajesCategoria = useTratamientosStore((s) => s.porcentajesCategoria)
  const categorias = useTratamientosStore((s) => s.categorias)
  return useMemo(
    () => (tratamiento, lugarId) => {
      const { valor, origen } = porcentajeAplicable({
        categoriaId: tratamiento.categoriaId,
        lugarId,
        porcentajesLugar,
        porcentajesCategoria,
      })
      const categoriaNombre =
        origen === 'categoria'
          ? (categorias.find((c) => c.id === tratamiento.categoriaId)?.nombre ?? null)
          : null
      return { valor, origen, categoriaNombre }
    },
    [porcentajesLugar, porcentajesCategoria, categorias],
  )
}

/**
 * Spec 016 (T027, R3) — insumos (activos y dados de baja) por id, para
 * resolver los materiales de las recetas.
 */
export function useInsumosPorId(): Map<string, Insumo> {
  const activos = useInventoryStore((s) => s.insumos)
  const dadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  return useMemo(
    () => new Map([...activos, ...dadosDeBaja].map((insumo) => [insumo.id, insumo])),
    [activos, dadosDeBaja],
  )
}

/**
 * Montos de un tratamiento en un lugar: costo de materiales con los costos
 * unitarios de la 015, precio del lugar y % profesional del lugar (Q2).
 * Devuelve una función para calcularlos en cualquier lugar (vista "Todos").
 */
export function useMontosTratamiento(): (
  tratamiento: TratamientoProyectado,
  lugarId: string,
) => MontosTratamiento {
  const insumos = useInsumosPorId()
  const costos = useCostosUnitarios()
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  const porcentajeDe = usePorcentajeAplicable()

  return useMemo(
    () => (tratamiento, lugarId) => {
      const costo = calcularCostoTratamiento(
        tratamiento.materiales,
        insumos,
        costos,
        cambiosInsumo,
      )
      const precio = tratamiento.precios.get(lugarId) ?? null
      const origenPorcentaje = porcentajeDe(tratamiento, lugarId)
      const porcentaje = origenPorcentaje.valor
      return {
        costo,
        precio,
        porcentaje,
        origenPorcentaje,
        ganancia: calcularGanancia(precio, porcentaje, costo.costoMateriales),
      }
    },
    [insumos, costos, cambiosInsumo, porcentajeDe],
  )
}
