import { db, type Insumo, type Lote } from '../../../lib/db'
import { getUsuarioActualId, tenantActualOFallar } from '../../../stores/authStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'
import { crearMovimiento } from '../../insumos/lib/movements'
import { validateQuantity } from '../../insumos/lib/quantity'

/** Formulario de recepción de un ítem de Compras (spec 009 contracts/ui-contracts.md). */
export interface RecepcionInput {
  cantidad: number
  numeroLote: string
  proveedor: string
  /** Ignorada si `insumo.caduca === false`. */
  fechaCaducidad: string
  confirmarCaducado: boolean
}

export type CampoRecepcion = 'cantidad' | 'numeroLote' | 'proveedor' | 'fechaCaducidad'

export type ValidacionRecepcion =
  | { valido: true; advertencias: { loteCaducado: boolean } }
  | {
      valido: false
      errores: Partial<Record<CampoRecepcion, string>>
      advertencias: { loteCaducado: boolean }
    }

/**
 * Valida el flujo de recepción de un ítem (spec 009 FR-009/FR-010). `hoy` es
 * la fecha local `YYYY-MM-DD` de quien recibe, para comparar contra
 * `fechaCaducidad` sin ambigüedad de huso horario (mismo criterio que
 * `validarAltaMaterial`, spec 008).
 */
export function validarRecepcion(
  input: RecepcionInput,
  insumo: Insumo,
  hoy: string,
): ValidacionRecepcion {
  const errores: Partial<Record<CampoRecepcion, string>> = {}

  const cantidad = validateQuantity(input.cantidad, insumo.unidadMedida)
  if (!cantidad.valid) {
    errores.cantidad = cantidad.error ?? 'Cantidad inválida.'
  }
  if (!input.numeroLote.trim()) {
    errores.numeroLote = 'Ingresa el número de lote.'
  }
  if (!input.proveedor.trim()) {
    errores.proveedor = 'Ingresa el proveedor.'
  }

  let loteCaducado = false
  if (insumo.caduca) {
    if (!input.fechaCaducidad) {
      errores.fechaCaducidad = 'Ingresa la fecha de vencimiento.'
    } else {
      loteCaducado = input.fechaCaducidad < hoy
    }
  }

  const advertencias = { loteCaducado }
  return Object.keys(errores).length === 0
    ? { valido: true, advertencias }
    : { valido: false, errores, advertencias }
}

/**
 * Recibe un ítem de Compras en un insumo existente (spec 009 FR-009/FR-010,
 * research.md R3/R4): valida, y en **una** transacción Dexie crea el lote y
 * su movimiento de ingreso y, si viene de un `ItemCompra` (sugerido con
 * recepción directa o manual vinculado), lo marca `'comprado'`. Un único
 * lote por llamada — un pedido con varios lotes repite la acción
 * (research.md R4). Cualquier excepción aborta todo.
 */
export async function recibirEnInsumo(
  insumo: Insumo,
  input: RecepcionInput,
  itemCompraId: string | null,
  /** Spec 014 FR-014 — lugar elegido en "¿En qué lugar?" desde "Todos". */
  opciones: { lugarId?: string } = {},
): Promise<{ lote: Lote }> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error(
      'No hay un usuario autenticado local — no se puede registrar la recepción.',
    )
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const validacion = validarRecepcion(input, insumo, hoy)
  if (!validacion.valido) {
    throw new Error(Object.values(validacion.errores).join(' '))
  }
  if (validacion.advertencias.loteCaducado && !input.confirmarCaducado) {
    throw new Error('Confirma el ingreso de un lote ya caducado.')
  }

  const tenantId = tenantActualOFallar()
  const lugarId = lugarParaEscribirOFallar(opciones.lugarId)
  return db.transaction(
    'rw',
    db.lotes,
    db.movimientos,
    db.itemsCompra,
    async () => {
      const lote: Lote = {
        id: crypto.randomUUID(),
        tenantId,
        lugarId,
        insumoId: insumo.id,
        numeroLote: input.numeroLote.trim(),
        proveedor: input.proveedor.trim(),
        fechaCaducidad: insumo.caduca ? input.fechaCaducidad : null,
        codigoFabricante: insumo.codigoFabricante,
        estado: 'activo',
        creadoEn: new Date().toISOString(),
      }
      await db.lotes.add(lote)
      await crearMovimiento({
        tipo: 'ingreso',
        loteId: lote.id,
        cantidad: input.cantidad,
        lugarId,
      })

      if (itemCompraId !== null) {
        await db.itemsCompra.update(itemCompraId, {
          estado: 'comprado',
          compradoPor: usuarioId,
          compradoEn: new Date().toISOString(),
        })
      }

      return { lote }
    },
  )
}
