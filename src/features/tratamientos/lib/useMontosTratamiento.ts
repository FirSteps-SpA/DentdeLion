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
import type { TratamientoProyectado } from './proyeccion'

export interface MontosTratamiento {
  costo: CostoTratamiento
  /** Precio en el lugar pedido (Q1); `null` = sin precio ahí. */
  precio: number | null
  porcentaje: number | null
  ganancia: Ganancia
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
  const porcentajes = useTratamientosStore((s) => s.porcentajes)

  return useMemo(
    () => (tratamiento, lugarId) => {
      const costo = calcularCostoTratamiento(
        tratamiento.materiales,
        insumos,
        costos,
        cambiosInsumo,
      )
      const precio = tratamiento.precios.get(lugarId) ?? null
      const porcentaje = porcentajes.get(lugarId) ?? null
      return {
        costo,
        precio,
        porcentaje,
        ganancia: calcularGanancia(precio, porcentaje, costo.costoMateriales),
      }
    },
    [insumos, costos, cambiosInsumo, porcentajes],
  )
}
