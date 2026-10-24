import type { Insumo, Lugar, MinimoLugar } from '../../../lib/db'
import { hayVariosLugares, lugaresActivos, type SeleccionLugar } from '../../../stores/lugarStore'
import { plegar } from '../../insumos/lib/categorias'
import { minimoEfectivo } from '../../insumos/lib/minimos'

export type OrigenMinimo = 'lugar' | 'catalogo'

/**
 * Fila del editor de stock mínimo (spec 019, research.md R4, data-model.md):
 * la misma regla que `EditarInsumoForm` — con un solo lugar se edita el
 * mínimo del catálogo; con varios, el del lugar activo; en "Todos" solo se
 * mira el de cada lugar.
 */
export type FilaMinimo =
  | { insumo: Insumo; modo: 'catalogo'; minimo: number | null }
  | { insumo: Insumo; modo: 'lugar'; minimo: number | null; origen: OrigenMinimo }
  | {
      insumo: Insumo
      modo: 'todos'
      porLugar: { lugar: Lugar; minimo: number | null; origen: OrigenMinimo }[]
    }

function origen(insumo: Insumo, lugarId: string, minimosLugar: MinimoLugar[]): OrigenMinimo {
  const propio = minimosLugar.find((m) => m.insumoId === insumo.id && m.lugarId === lugarId)
  return propio && propio.stockMinimo !== null ? 'lugar' : 'catalogo'
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
  const activos = lugaresActivos(lugares)

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
          porLugar: activos.map((lugar) => ({
            lugar,
            minimo: minimoEfectivo(insumo, lugar.id, minimosLugar),
            origen: origen(insumo, lugar.id, minimosLugar),
          })),
        }
      }
      const lugarId = seleccion as string
      return {
        insumo,
        modo,
        minimo: minimoEfectivo(insumo, lugarId, minimosLugar),
        origen: origen(insumo, lugarId, minimosLugar),
      }
    })
}
