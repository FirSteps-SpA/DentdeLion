import type { ConfiguracionAlertas, Insumo, ItemCompra } from '../../../lib/db'
import { formatearCantidad } from '../../../lib/unidades'
import type { CostoUnitario } from '../../insumos/lib/precio'
import type { ItemSugerido } from './sugeridos'

/** Spec 022 FR-021 — el saludo que pidió la clienta; vale mientras el tenant no guarde otro. */
export const SALUDO_PEDIDO_POR_DEFECTO =
  'Hola, ¿cómo están? Me gustaría saber si tienen los siguientes materiales, fechas de vencimiento y sus precios, por favor'

export const LARGO_MAXIMO_SALUDO = 500

/** Spec 022 R4 — sobre este largo, el enlace a WhatsApp falla en algunos navegadores. */
export const LARGO_MAXIMO_ENLACE = 4000

/** Spec 022 data-model.md — `null`, vacío o sin fila: el saludo de la clienta. */
export function saludoEfectivo(
  config: ConfiguracionAlertas | undefined,
): string {
  return config?.saludoPedido?.trim() || SALUDO_PEDIDO_POR_DEFECTO
}

/** Spec 022 data-model.md — un renglón de la lista de compras, sugerido o manual. */
export interface ItemPedido {
  /** Clave de selección (research.md R2). */
  clave: string
  origen: 'sugerido' | 'manual'
  nombre: string
  lugarId: string
  /** Sugerido: siempre; manual: el vinculado, si sigue activo. */
  insumo: Insumo | null
  /** En unidades de compra; `null` sin cantidad. */
  cantidad: number | null
  /** `null` en un manual sin insumo. */
  unidadCompra: string | null
}

export type ValorItem =
  | { tipo: 'monto'; monto: number }
  | { tipo: 'sin-precio' }
  | { tipo: 'sin-cantidad' }

export interface ResumenSeleccion {
  seleccionados: number
  /** Sin redondear: se redondea solo al mostrar (FR-008). */
  subtotal: number
  sinPrecio: number
  sinCantidad: number
}

/** Un sugerido no tiene id propio: se recalcula por lugar (R2). */
export function claveSugerido(lugarId: string, insumoId: string): string {
  return `s:${lugarId}:${insumoId}`
}

export function claveManual(itemId: string): string {
  return `m:${itemId}`
}

/**
 * Spec 022 (R2, R5): los renglones de una vista en el orden de la pantalla,
 * sugeridos y luego manuales. `insumos` son los activos, así un manual
 * vinculado a un insumo dado de baja queda sin insumo ("Sin precio").
 */
export function itemsDelPedido(
  sugeridos: { item: ItemSugerido; lugarId: string }[],
  manuales: ItemCompra[],
  insumos: Insumo[],
): ItemPedido[] {
  const porId = new Map(insumos.map((insumo) => [insumo.id, insumo]))
  const items: ItemPedido[] = sugeridos.map(({ item, lugarId }) => ({
    clave: claveSugerido(lugarId, item.insumo.id),
    origen: 'sugerido',
    nombre: item.insumo.nombre,
    lugarId,
    insumo: item.insumo,
    cantidad: item.presentacionesSugeridas,
    unidadCompra: item.insumo.unidadCompra,
  }))
  for (const manual of manuales) {
    const insumo = manual.insumoId ? (porId.get(manual.insumoId) ?? null) : null
    items.push({
      clave: claveManual(manual.id),
      origen: 'manual',
      nombre: manual.nombre,
      lugarId: manual.lugarId,
      insumo,
      cantidad: manual.cantidad,
      unidadCompra: insumo?.unidadCompra ?? null,
    })
  }
  return items
}

/**
 * Spec 022 R3: cantidad × precio por unidad de compra, que es el costo
 * unitario de la 015 (último ingreso con precio, por unidad de consumo) por
 * el contenido **actual** de la presentación, para que un cambio de caja no
 * use el precio de la caja vieja.
 */
export function valorItem(
  item: ItemPedido,
  costos: Map<string, CostoUnitario>,
): ValorItem {
  const costo = item.insumo ? costos.get(item.insumo.id) : undefined
  if (!item.insumo || !costo) return { tipo: 'sin-precio' }
  if (item.cantidad === null) return { tipo: 'sin-cantidad' }
  const contenido = item.insumo.contenido > 0 ? item.insumo.contenido : 1
  return { tipo: 'monto', monto: item.cantidad * costo.costo * contenido }
}

export function resumirSeleccion(
  items: ItemPedido[],
  seleccion: ReadonlySet<string>,
  costos: Map<string, CostoUnitario>,
): ResumenSeleccion {
  const resumen: ResumenSeleccion = {
    seleccionados: 0,
    subtotal: 0,
    sinPrecio: 0,
    sinCantidad: 0,
  }
  for (const item of items) {
    if (!seleccion.has(item.clave)) continue
    resumen.seleccionados += 1
    const valor = valorItem(item, costos)
    if (valor.tipo === 'monto') resumen.subtotal += valor.monto
    else if (valor.tipo === 'sin-precio') resumen.sinPrecio += 1
    else resumen.sinCantidad += 1
  }
  return resumen
}

function cantidadDelRenglon(item: ItemPedido): string | null {
  if (item.cantidad === null) return null
  if (item.unidadCompra === null) return String(item.cantidad)
  return formatearCantidad(item.cantidad, item.unidadCompra)
}

/**
 * Spec 022 R5 (FR-009–FR-011): el saludo, una línea en blanco y un renglón
 * por ítem, sin precios, sin "Sugerido"/"Manual" y sin la nota (es interna).
 * `nombresLugar` solo en la vista "Todos".
 */
export function construirMensajePedido(
  saludo: string,
  items: ItemPedido[],
  nombresLugar?: Map<string, string>,
): string {
  const renglones = items.map((item) => {
    const cantidad = cantidadDelRenglon(item)
    const lugar = nombresLugar?.get(item.lugarId)
    return `- ${item.nombre}${cantidad ? ` — ${cantidad}` : ''}${lugar ? ` (${lugar})` : ''}`
  })
  return [saludo.trim(), '', ...renglones].join('\n')
}

/** Spec 022 R4: sin número, WhatsApp pide elegir el chat. */
export function enlaceWhatsApp(
  whatsapp: string | null,
  mensaje: string,
): string {
  return `https://wa.me/${whatsapp ?? ''}?text=${encodeURIComponent(mensaje)}`
}
