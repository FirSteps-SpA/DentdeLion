import { useMemo } from 'react'
import { useInventoryStore } from '../../stores/inventoryStore'
import { useLugarStore } from '../../stores/lugarStore'
import { useTratamientosStore } from '../../stores/tratamientosStore'
import { consumosValorizados, indiceCostos, type FiltroLugar, type IndiceCostos } from './lib/gasto'
import { resumenReportes, type ResumenReportes } from './lib/kpis'
import { clavePeriodo, type Periodo } from './lib/periodos'
import { valorInventarioConVariacion, type ValorInventario } from './lib/valorInventario'

/** Día local de hoy: los cálculos se rehacen al cambiar de día, no en cada render. */
const hoy = () => new Date().toDateString()

/**
 * Spec 017 (research.md R1, R12) — índice de costos de los lotes del tenant,
 * desde `inventoryStore` (Constitución II). Incluye los insumos dados de baja
 * para que sus consumos pasados sigan valorizados.
 */
function useIndiceCostos(): IndiceCostos {
  const insumos = useInventoryStore((s) => s.insumos)
  const dadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const lotes = useInventoryStore((s) => s.lotes)
  const cambiosLote = useInventoryStore((s) => s.cambiosLote)
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  return useMemo(
    () => indiceCostos(lotes, [...insumos, ...dadosDeBaja], cambiosLote, cambiosInsumo),
    [lotes, insumos, dadosDeBaja, cambiosLote, cambiosInsumo],
  )
}

/** Filtro de Reportes: el lugar activo del selector (spec 014) o "Todos". */
export function useFiltroLugar(): FiltroLugar | null {
  return useLugarStore((s) => s.lugarActivoId)
}

/**
 * Spec 017 (lib § Hook) — KPIs y gráficos del período en el lugar activo.
 * Lee los movimientos ya normalizados de `inventoryStore`, nunca
 * `db.movimientos` (prueba `lecturas-movimientos`). `null` mientras no hay
 * lugar resuelto.
 */
export function useReportes(periodo: Periodo): ResumenReportes | null {
  const indice = useIndiceCostos()
  const movimientos = useInventoryStore((s) => s.movimientos)
  const insumos = useInventoryStore((s) => s.insumos)
  const dadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const realizados = useTratamientosStore((s) => s.realizados)
  const lugares = useLugarStore((s) => s.lugares)
  const filtro = useFiltroLugar()
  const consumos = useMemo(
    () => consumosValorizados(movimientos, indice, 'todos'),
    [movimientos, indice],
  )
  const dia = hoy()
  const clave = clavePeriodo(periodo)
  return useMemo(
    () =>
      filtro === null
        ? null
        : resumenReportes(
            { realizados, consumos, insumos: [...insumos, ...dadosDeBaja], lugares },
            periodo,
            filtro,
            new Date(),
          ),
    // `periodo` entra por su clave; `dia` rehace el cálculo al cambiar de día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [realizados, consumos, insumos, dadosDeBaja, lugares, filtro, clave, dia],
  )
}

/** Spec 017 (FR-015, research.md R8) — Valor de inventario del lugar activo para Inicio. */
export function useValorInventario(): ValorInventario | null {
  const indice = useIndiceCostos()
  const movimientos = useInventoryStore((s) => s.movimientos)
  const lotes = useInventoryStore((s) => s.lotes)
  const filtro = useFiltroLugar()
  const dia = hoy()
  return useMemo(
    () =>
      filtro === null
        ? null
        : valorInventarioConVariacion(movimientos, lotes, indice, filtro, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movimientos, lotes, indice, filtro, dia],
  )
}
