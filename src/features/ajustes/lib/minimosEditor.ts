import type { Insumo, Lugar, MinimoLugar } from '../../../lib/db'
import {
  bodegasActivas,
  hayVariosLugares,
  lugaresDeBodega,
  rotuloBodega,
  type SeleccionLugar,
} from '../../../stores/lugarStore'
import { plegar } from '../../insumos/lib/categorias'
import { minimoEfectivoBodega } from '../../insumos/lib/minimos'

export type OrigenMinimo = 'lugar' | 'catalogo'

/**
 * Fila del editor de stock mínimo (spec 019, research.md R4, data-model.md):
 * la misma regla que `EditarInsumoForm` — con un solo lugar se edita el
 * mínimo del catálogo; con varios, el del lugar activo; en "Todos" solo se
 * mira el de cada lugar. Spec 033 (R4): el de la bodega del lugar; en
 * "Todos", uno por bodega ("Box 1 + Box 2").
 */
export type FilaMinimo =
  | { insumo: Insumo; modo: 'catalogo'; minimo: number | null }
  | { insumo: Insumo; modo: 'lugar'; minimo: number | null; origen: OrigenMinimo }
  | {
      insumo: Insumo
      modo: 'todos'
      porLugar: { lugar: Lugar; minimo: number | null; origen: OrigenMinimo }[]
    }

function origen(
  insumo: Insumo,
  lugarIds: ReadonlySet<string>,
  minimosLugar: MinimoLugar[],
): OrigenMinimo {
  return minimosLugar.some(
    (m) => m.insumoId === insumo.id && lugarIds.has(m.lugarId) && m.stockMinimo !== null,
  )
    ? 'lugar'
    : 'catalogo'
}

export function modoEditorMinimos(
  lugares: Lugar[],
  seleccion: SeleccionLugar | null,
): FilaMinimo['modo'] {
  if (!hayVariosLugares(lugares)) return 'catalogo'
  return seleccion === 'todos' ? 'todos' : 'lugar'
}

export function filasMinimos(
  insumos: Insumo[],
  minimosLugar: MinimoLugar[],
  seleccion: SeleccionLugar | null,
  lugares: Lugar[],
  busqueda: string,
): FilaMinimo[] {
  const texto = plegar(busqueda.trim())
  const modo = modoEditorMinimos(lugares, seleccion)
  const bodegas = bodegasActivas(lugares).map((grupo) => {
    const ids = new Set(grupo.map((lugar) => lugar.id))
    const lugar = grupo.length > 1 ? { ...grupo[0], nombre: rotuloBodega(ids, lugares) } : grupo[0]
    return { lugar, ids }
  })

  return insumos
    .filter((insumo) => !insumo.dadoDeBajaEn)
    .filter((insumo) => texto === '' || plegar(insumo.nombre).includes(texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map((insumo): FilaMinimo => {
      if (modo === 'catalogo') return { insumo, modo, minimo: insumo.stockMinimo }
      if (modo === 'todos') {
        return {
          insumo,
          modo,
          porLugar: bodegas.map(({ lugar, ids }) => ({
            lugar,
            minimo: minimoEfectivoBodega(insumo, ids, minimosLugar),
            origen: origen(insumo, ids, minimosLugar),
          })),
        }
      }
      const bodega = lugaresDeBodega(seleccion as string, lugares)
      return {
        insumo,
        modo,
        minimo: minimoEfectivoBodega(insumo, bodega, minimosLugar),
        origen: origen(insumo, bodega, minimosLugar),
      }
    })
}
