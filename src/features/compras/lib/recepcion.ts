import { db, type Insumo, type Lote } from '../../../lib/db'
import { getUsuarioActualId, tenantActualOFallar } from '../../../stores/authStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'
import { crearMovimiento } from '../../insumos/lib/movements'
import {
  convertirIngreso,
  snapshotIngreso,
  type CantidadIngreso,
} from '../../insumos/lib/ingreso'
import {
  MENSAJE_FALTA_PROVEEDOR,
  proveedorParaLote,
} from '../../proveedores/lib/proveedores'
import {
  precioPorUnidadCompra,
  validarPrecio,
  type PrecioIngreso,
} from '../../insumos/lib/precio'

/** Formulario de recepción de un ítem de Compras (spec 009 contracts/ui-contracts.md). */
export interface RecepcionInput {
  cantidad: number
  /**
   * Spec 015 (FR-009) — unidad de `cantidad`: la de compra del insumo (por
   * defecto) o la de consumo. Se convierte a unidades de consumo al guardar.
   */
  unidadIngreso?: string
  /** Spec 015 (FR-013/FR-014) — opcional: por unidad de compra o total pagado. */
  precio?: PrecioIngreso
  numeroLote: string
  /** Spec 021 — proveedor del catálogo, elegido con `SelectorProveedor`. */
  proveedorId: string | null
  /** Ignorada si `insumo.caduca === false`. */
  fechaCaducidad: string
  confirmarCaducado: boolean
}

export type CampoRecepcion =
  | 'cantidad'
  | 'precio'
  | 'numeroLote'
  | 'proveedor'
  | 'fechaCaducidad'

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

  const conversion = convertirIngreso(insumo, ingresoDe(input, insumo))
  if (conversion.error) {
    errores.cantidad = conversion.error
  }
  const errorPrecio = validarPrecio(input.precio ?? null)
  if (errorPrecio) errores.precio = errorPrecio
  if (!input.numeroLote.trim()) {
    errores.numeroLote = 'Ingresa el número de lote.'
  }
  if (!input.proveedorId) {
    errores.proveedor = MENSAJE_FALTA_PROVEEDOR
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
/** Spec 015 — la cantidad de la recepción con su unidad (por defecto, la de compra). */
export function ingresoDe(input: RecepcionInput, insumo: Insumo): CantidadIngreso {
  return { cantidad: input.cantidad, unidad: input.unidadIngreso ?? insumo.unidadCompra }
}

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
  const ingreso = ingresoDe(input, insumo)
  const { cantidadConsumo, presentaciones } = convertirIngreso(insumo, ingreso)
  return db.transaction(
    'rw',
    db.lotes,
    db.movimientos,
    db.itemsCompra,
    db.proveedores,
    async () => {
      const proveedor = await proveedorParaLote(input.proveedorId)
      const lote: Lote = {
        id: crypto.randomUUID(),
        tenantId,
        lugarId,
        insumoId: insumo.id,
        numeroLote: input.numeroLote.trim(),
        proveedor: proveedor.nombre,
        proveedorId: proveedor.id,
        fechaCaducidad: insumo.caduca ? input.fechaCaducidad : null,
        codigoFabricante: insumo.codigoFabricante,
        estado: 'activo',
        creadoEn: new Date().toISOString(),
        ...snapshotIngreso(insumo, ingreso),
        precioCompra: precioPorUnidadCompra(input.precio ?? null, presentaciones),
      }
      await db.lotes.add(lote)
      await crearMovimiento({
        tipo: 'ingreso',
        loteId: lote.id,
        cantidad: cantidadConsumo,
        lugarId,
        unidad: insumo.unidadMedida,
      })

      if (itemCompraId !== null) {
        await db.itemsCompra.update(itemCompraId, {
          estado: 'comprado',
          compradoPor: usuarioId,
          compradoEn: new Date().toISOString(),
          // Spec 022 R6: puede ser de otra persona; se sube por UPDATE.
          cambioLocal: true,
        })
      }

      return { lote }
    },
  )
}
