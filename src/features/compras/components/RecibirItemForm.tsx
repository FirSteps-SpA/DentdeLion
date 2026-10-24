import { useState } from 'react'
import type { Insumo } from '../../../lib/db'
import { mesesRestantes } from '../../../lib/dateMath'
import {
  ingresoDe,
  recibirEnInsumo,
  validarRecepcion,
  type CampoRecepcion,
  type RecepcionInput,
} from '../lib/recepcion'
import { Hash, Truck, Calendar } from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { ConfirmarLoteCaducadoDialog } from '../../insumos/components/ConfirmarLoteCaducadoDialog'
import { CantidadIngresoField } from '../../insumos/components/CantidadIngresoField'
import { PrecioIngresoField } from '../../insumos/components/PrecioIngresoField'
import { convertirIngreso } from '../../insumos/lib/ingreso'
import { SelectorProveedor } from '../../proveedores/components/SelectorProveedor'
import { usePredeterminado } from '../../proveedores/lib/usePredeterminado'

export interface RecibirItemFormProps {
  insumo: Insumo
  /** El `ItemCompra` de origen (sugerido con recepción directa, o manual
   *  vinculado) que se marca `'comprado'` al confirmar; `null` si no viene
   *  de ningún ítem de Compras. */
  itemCompraId: string | null
  /** Spec 014 FR-014 — lugar donde se recibe (desde "Todos"); sin él, el activo. */
  lugarId?: string
  /**
   * Spec 015 (FR-020, UI §6) — presentaciones sugeridas para salir del stock
   * bajo; se proponen como cantidad en unidad de compra.
   */
  cantidadSugerida?: number
  onRecibido: () => void
  onCancelar: () => void
}

const ENTRADA_VACIA: RecepcionInput = {
  cantidad: 1,
  numeroLote: '',
  proveedorId: null,
  fechaCaducidad: '',
  confirmarCaducado: false,
}

/**
 * Flujo de recepción de un único lote (spec 009 FR-009/FR-010): cantidad,
 * número de lote, proveedor y fecha de vencimiento solo si el insumo caduca.
 * Reutiliza `ConfirmarLoteCaducadoDialog` (spec 008) sin cambios para la
 * advertencia de un lote ya vencido.
 */
export function RecibirItemForm({
  insumo,
  itemCompraId,
  lugarId,
  cantidadSugerida,
  onRecibido,
  onCancelar,
}: RecibirItemFormProps) {
  // Spec 015 FR-009: por defecto, en unidad de compra.
  const [datos, setDatos] = useState<RecepcionInput>(() => ({
    ...ENTRADA_VACIA,
    cantidad: cantidadSugerida ?? ENTRADA_VACIA.cantidad,
    unidadIngreso: insumo.unidadCompra,
  }))
  const [errores, setErrores] = useState<Partial<Record<CampoRecepcion, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [mostrarDialogoCaducado, setMostrarDialogoCaducado] = useState(false)

  const vidaUtil = insumo.caduca ? mesesRestantes(datos.fechaCaducidad) : null
  // Spec 021 (FR-006): sin elección a mano, el predeterminado del lugar del ítem.
  const proveedorPredeterminado = usePredeterminado(lugarId)
  const proveedorEfectivo = datos.proveedorId ?? proveedorPredeterminado

  async function intentarGuardar(datosSinProveedor: RecepcionInput) {
    const datosParaGuardar = { ...datosSinProveedor, proveedorId: proveedorEfectivo }
    const hoy = new Date().toISOString().slice(0, 10)
    const validacion = validarRecepcion(datosParaGuardar, insumo, hoy)
    if (!validacion.valido) {
      setErrores(validacion.errores)
      setErrorGeneral(null)
      return
    }
    setErrores({})
    if (validacion.advertencias.loteCaducado && !datosParaGuardar.confirmarCaducado) {
      setMostrarDialogoCaducado(true)
      return
    }

    setIsPending(true)
    setErrorGeneral(null)
    try {
      await recibirEnInsumo(insumo, datosParaGuardar, itemCompraId, { lugarId })
      onRecibido()
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setIsPending(false)
    }
  }

  async function confirmarLoteCaducado() {
    setMostrarDialogoCaducado(false)
    await intentarGuardar({ ...datos, confirmarCaducado: true })
  }

  return (
    <BottomSheet titulo={`Recibir ${insumo.nombre}`} onClose={onCancelar}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void intentarGuardar(datos)
        }}
        className="flex flex-col gap-4"
      >
        <CantidadIngresoField
          id="recepcion-cantidad"
          label="Cantidad"
          presentacion={insumo}
          cantidad={datos.cantidad}
          unidad={datos.unidadIngreso ?? insumo.unidadCompra}
          onChange={(cambio) =>
            setDatos({
              ...datos,
              ...(cambio.cantidad !== undefined ? { cantidad: cambio.cantidad } : {}),
              ...(cambio.unidad !== undefined ? { unidadIngreso: cambio.unidad } : {}),
            })
          }
          error={errores.cantidad}
        />

        <PrecioIngresoField
          id="recepcion-precio"
          presentacion={insumo}
          presentaciones={convertirIngreso(insumo, ingresoDe(datos, insumo)).presentaciones}
          precio={datos.precio ?? null}
          onChange={(precio) => setDatos({ ...datos, precio })}
          error={errores.precio}
        />

        <IconField
          label="Número de lote"
          icon={<Hash size={18} />}
          htmlFor="recepcion-lote"
          error={errores.numeroLote}
        >
          <input
            id="recepcion-lote"
            type="text"
            value={datos.numeroLote}
            onChange={(event) => setDatos({ ...datos, numeroLote: event.target.value })}
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
          />
        </IconField>

        <IconField
          label="Proveedor"
          icon={<Truck size={18} />}
          htmlFor="recepcion-proveedor"
          error={errores.proveedor}
        >
          <SelectorProveedor
            id="recepcion-proveedor"
            valor={proveedorEfectivo}
            onCambio={(proveedorId) => setDatos({ ...datos, proveedorId })}
            invalido={!!errores.proveedor}
          />
        </IconField>

        {insumo.caduca && (
          <IconField
            label="Fecha de vencimiento"
            icon={<Calendar size={18} />}
            htmlFor="recepcion-fecha"
            error={errores.fechaCaducidad}
            hint={
              vidaUtil !== null
                ? `Vida útil restante estimada: ${vidaUtil} ${vidaUtil === 1 ? 'mes' : 'meses'}`
                : undefined
            }
          >
            <input
              id="recepcion-fecha"
              type="date"
              value={datos.fechaCaducidad}
              onChange={(event) =>
                setDatos({ ...datos, fechaCaducidad: event.target.value })
              }
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </IconField>
        )}

        {errorGeneral && (
          <Card className="bg-danger-bg px-3.5 py-2.5">
            <p role="alert" className="text-sm text-danger">
              {errorGeneral}
            </p>
          </Card>
        )}

        <div className="flex gap-2">
          <TouchButton
            type="button"
            variant="ghost"
            onClick={onCancelar}
            className="flex-1"
          >
            Cancelar
          </TouchButton>
          <TouchButton type="submit" disabled={isPending} className="flex-1">
            {isPending ? 'Guardando…' : 'Confirmar recepción'}
          </TouchButton>
        </div>
      </form>

      {mostrarDialogoCaducado && (
        <ConfirmarLoteCaducadoDialog
          fechaCaducidad={datos.fechaCaducidad}
          onConfirmar={() => void confirmarLoteCaducado()}
          onCancelar={() => setMostrarDialogoCaducado(false)}
        />
      )}
    </BottomSheet>
  )
}
