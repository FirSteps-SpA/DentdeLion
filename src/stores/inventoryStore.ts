import { create } from 'zustand'
import { liveQuery } from 'dexie'
import {
  type CambioInsumo,
  type CambioLote,
  type Categoria,
  type Insumo,
  type ItemCompra,
  type Lote,
  type Marca,
  type MinimoLugar,
  type Movimiento,
  type Proveedor,
} from '../lib/db'
import { delTenant } from '../lib/tenancy'
import type { Estado, EstadoInsumo } from '../features/insumos/lib/estado'
import { claveCategoria, plegar } from '../features/insumos/lib/categorias'
import {
  normalizarMovimientos,
  type MovimientoNormalizado,
} from '../features/insumos/lib/stock'

/**
 * Reactive in-memory cache of the insumo/lote catalog (Constitution II),
 * kept in sync with Dexie via `liveQuery` — no manual invalidation needed
 * when RegistroForm/ConsumoForm write new rows. Shared by both forms'
 * search and FEFO/scan lookups (research.md), and by feature 004's alert
 * calculators, which is why `movimientos` is also subscribed here rather
 * than in a second store (research.md's "extend, don't duplicate" decision).
 *
 * `insumos` holds only **activos** (feature 007 FR-020, research.md R10):
 * insumos dados de baja are filtered here, once, so every consumer (listado,
 * alertas, SearchPicker, validación de nombres) excludes them without code
 * of its own. Their lotes stay in `lotes`, but every alert calculator skips
 * lotes whose insumo isn't in the array. `categorias` (feature 008) holds
 * only categories created by administrators — the precargadas and "Sin
 * categoría" are constants in `categorias.ts`, never rows here.
 *
 * Spec 014 (FR-004): every table holds only rows of the signed-in user's
 * tenant (`delTenant`) — pending rows another tenant left on this device stay
 * in Dexie, hidden. Filtering by lugar happens downstream
 * (`useInventarioDeLugar`), since the device keeps every lugar of the tenant.
 */
interface InventoryState {
  insumos: Insumo[]
  /** Feature 010 (FR-022) — insumos con baja lógica activa, para "Ajustes" ▸ "Insumos dados de baja". */
  insumosDadosDeBaja: Insumo[]
  lotes: Lote[]
  /**
   * Spec 015 (research.md R4) — con `cantidad` ya convertida a la unidad de
   * consumo actual de su insumo; la original queda en `cantidadOriginal` y
   * `unidad`. Así ninguna función de stock tiene que saber de conversiones.
   */
  movimientos: MovimientoNormalizado[]
  cambiosInsumo: CambioInsumo[]
  /** Spec 015 (R6) — correcciones de precio de lotes del tenant. */
  cambiosLote: CambioLote[]
  categorias: Categoria[]
  itemsCompra: ItemCompra[]
  /** Spec 014 FR-007 — mínimos por lugar del tenant. */
  minimosLugar: MinimoLugar[]
  /** Spec 021 — proveedores del tenant sin los eliminados (baja lógica, R7). */
  proveedores: Proveedor[]
  /** Spec 023 — marcas del tenant sin las eliminadas (baja lógica, R6). */
  marcas: Marca[]
  isReady: boolean
  subscribe: () => () => void
}

export const useInventoryStore = create<InventoryState>((set) => ({
  insumos: [],
  insumosDadosDeBaja: [],
  lotes: [],
  movimientos: [],
  cambiosInsumo: [],
  cambiosLote: [],
  categorias: [],
  itemsCompra: [],
  minimosLugar: [],
  proveedores: [],
  marcas: [],
  isReady: false,
  subscribe: () => {
    // Spec 015 (R4): fuentes crudas de la normalización de movimientos, que se
    // recalcula cuando cambia cualquiera de ellas.
    let fuentes: {
      insumos: Insumo[]
      lotes: Lote[]
      movimientos: Movimiento[]
      cambiosInsumo: CambioInsumo[]
    } = { insumos: [], lotes: [], movimientos: [], cambiosInsumo: [] }
    const actualizar = (cambio: Partial<typeof fuentes>) => {
      fuentes = { ...fuentes, ...cambio }
      return normalizarMovimientos(
        fuentes.movimientos,
        fuentes.lotes,
        fuentes.insumos,
        fuentes.cambiosInsumo,
      )
    }

    const insumosSub = liveQuery(() => delTenant('insumos')).subscribe({
      next: (insumos) =>
        set({
          insumos: insumos.filter((insumo) => !insumo.dadoDeBajaEn),
          insumosDadosDeBaja: insumos.filter((insumo) => !!insumo.dadoDeBajaEn),
          movimientos: actualizar({ insumos }),
          isReady: true,
        }),
    })
    const lotesSub = liveQuery(() => delTenant('lotes')).subscribe({
      next: (lotes) =>
        set({ lotes, movimientos: actualizar({ lotes }), isReady: true }),
    })
    const movimientosSub = liveQuery(() => delTenant('movimientos')).subscribe({
      next: (movimientos) =>
        set({ movimientos: actualizar({ movimientos }), isReady: true }),
    })
    const cambiosSub = liveQuery(() => delTenant('cambiosInsumo')).subscribe({
      next: (cambiosInsumo) =>
        set({ cambiosInsumo, movimientos: actualizar({ cambiosInsumo }) }),
    })
    const cambiosLoteSub = liveQuery(() => delTenant('cambiosLote')).subscribe({
      next: (cambiosLote) => set({ cambiosLote }),
    })
    const categoriasSub = liveQuery(() => delTenant('categorias')).subscribe({
      next: (categorias) => set({ categorias }),
    })
    const itemsCompraSub = liveQuery(() => delTenant('itemsCompra')).subscribe({
      next: (itemsCompra) => set({ itemsCompra }),
    })
    const minimosSub = liveQuery(() => delTenant('minimosLugar')).subscribe({
      next: (minimosLugar) => set({ minimosLugar }),
    })
    const proveedoresSub = liveQuery(() => delTenant('proveedores')).subscribe({
      next: (proveedores) =>
        set({ proveedores: proveedores.filter((proveedor) => !proveedor.eliminadoEn) }),
    })
    const marcasSub = liveQuery(() => delTenant('marcas')).subscribe({
      next: (marcas) => set({ marcas: marcas.filter((marca) => !marca.eliminadoEn) }),
    })
    return () => {
      marcasSub.unsubscribe()
      proveedoresSub.unsubscribe()
      minimosSub.unsubscribe()
      cambiosSub.unsubscribe()
      cambiosLoteSub.unsubscribe()
      insumosSub.unsubscribe()
      lotesSub.unsubscribe()
      movimientosSub.unsubscribe()
      categoriasSub.unsubscribe()
      itemsCompraSub.unsubscribe()
    }
  },
}))

/** Búsqueda por texto libre (FR-001/004/010). */
export function searchInsumosPorTexto(
  insumos: Insumo[],
  texto: string,
  marcasPorId?: ReadonlyMap<string, Marca>,
): Insumo[] {
  const q = texto.trim().toLowerCase()
  if (!q) return insumos
  // Spec 023 (FR-013, R9): también por el nombre de la marca, sin tildes. El
  // nombre del insumo se sigue comparando como antes.
  const qPlegado = plegar(texto.trim())
  return insumos.filter((insumo) => {
    if (insumo.nombre.toLowerCase().includes(q)) return true
    const marca = insumo.marcaId ? marcasPorId?.get(insumo.marcaId) : undefined
    return !!marca && !marca.eliminadoEn && plegar(marca.nombre).includes(qPlegado)
  })
}

/**
 * Búsqueda por categoría (FR-001/004/010). Compara por `claveCategoria`
 * (spec 008 research.md R2) para que "fresas" caiga bajo el chip "Fresas".
 */
export function searchInsumosPorCategoria(
  insumos: Insumo[],
  categoria: string,
): Insumo[] {
  if (!categoria) return insumos
  const clave = claveCategoria(categoria)
  return insumos.filter((insumo) => claveCategoria(insumo.categoria) === clave)
}

/** Selección rápida: los insumos dados de alta más recientemente. */
export function insumosRecientes(insumos: Insumo[], limite = 8): Insumo[] {
  return [...insumos]
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
    .slice(0, limite)
}

export function lotesDeInsumo(lotes: Lote[], insumoId: string): Lote[] {
  return lotes.filter((lote) => lote.insumoId === insumoId)
}

/**
 * Filtro por estado de salud (spec 006 FR-008): `estados.length === 0`
 * devuelve todo sin filtrar; en otro caso conserva las entradas cuyo estado
 * está incluido en `estados` — un arreglo, no un valor único, porque el
 * resumen (FR-004) puede activar `['caducado', 'proximo-a-caducar']` a la
 * vez con un solo toque (spec 006's Analysis F1/A1).
 */
export function searchInsumosPorEstado(
  estadosInsumo: EstadoInsumo[],
  estados: Estado[],
): EstadoInsumo[] {
  if (estados.length === 0) return estadosInsumo
  return estadosInsumo.filter((e) => estados.includes(e.estado))
}

/** Coincidencia por código de fabricante/lote para el flujo de escaneo (FR-010). */
export function findInsumoPorCodigo(
  insumos: Insumo[],
  codigo: string,
): Insumo | undefined {
  return insumos.find((insumo) => insumo.codigoFabricante === codigo)
}

export function findLotePorCodigo(
  lotes: Lote[],
  codigo: string,
): Lote | undefined {
  return lotes.find((lote) => lote.codigoFabricante === codigo)
}
