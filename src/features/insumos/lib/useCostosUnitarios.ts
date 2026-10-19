import { useMemo } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { costosUnitariosPorInsumo, type CostoUnitario } from './precio'

/**
 * Spec 015 (T048, FR-012/FR-017) — costo unitario de cada insumo, derivado en
 * memoria de `inventoryStore` (Constitución II). Incluye los dados de baja
 * para que su historial siga mostrando costos.
 */
export function useCostosUnitarios(): Map<string, CostoUnitario> {
  const insumos = useInventoryStore((s) => s.insumos)
  const dadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const lotes = useInventoryStore((s) => s.lotes)
  const cambiosLote = useInventoryStore((s) => s.cambiosLote)
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  return useMemo(
    () =>
      costosUnitariosPorInsumo(
        [...insumos, ...dadosDeBaja],
        lotes,
        cambiosLote,
        cambiosInsumo,
      ),
    [insumos, dadosDeBaja, lotes, cambiosLote, cambiosInsumo],
  )
}
