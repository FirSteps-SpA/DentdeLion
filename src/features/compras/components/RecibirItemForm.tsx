import { useState } from 'react'
import type { Insumo } from '../../../lib/db'
import { mesesRestantes } from '../../../lib/dateMath'
import { permiteDecimales } from '../../insumos/lib/quantity'
import {
  recibirEnInsumo,
  validarRecepcion,
  type CampoRecepcion,
  type RecepcionInput,
} from '../lib/recepcion'
import { Hash, Truck, Calendar } from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { Stepper } from '../../../components/ui/Stepper'
import { TouchButton } from '../../../components/ui/TouchButton'
import { ConfirmarLoteCaducadoDialog } from '../../insumos/components/ConfirmarLoteCaducadoDialog'

export interface RecibirItemFormProps {
  insumo: Insumo
  /** El `ItemCompra` de origen (sugerido con recepción directa, o manual
   *  vinculado) que se marca `'comprado'` al confirmar; `null` si no viene
   *  de ningún ítem de Compras. */
  itemCompraId: string | null
  onRecibido: () => void
  onCancelar: () => void
}

const ENTRADA_VACIA: RecepcionInput = {
  cantidad: 1,
  numeroLote: '',
  proveedor: '',
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
  onRecibido,
  onCancelar,
}: RecibirItemFormProps) {
  const [datos, setDatos] = useState<RecepcionInput>(ENTRADA_VACIA)
  const [errores, setErrores] = useState<Partial<Record<CampoRecepcion, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [mostrarDialogoCaducado, setMostrarDialogoCaducado] = useState(false)

  const permiteDecimalesUnidad = permiteDecimales(insumo.unidadMedida)
  const vidaUtil = insumo.caduca ? mesesRestantes(datos.fechaCaducidad) : null

  async function intentarGuardar(datosParaGuardar: RecepcionInput) {
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
      await recibirEnInsumo(insumo, datosParaGuardar, itemCompraId)
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
        <Stepper
          id="recepcion-cantidad"
          label={`Cantidad (${insumo.unidadMedida})`}
          value={datos.cantidad}
          onChange={(v) => setDatos({ ...datos, cantidad: v ?? 0 })}
          min={0}
          permiteDecimales={permiteDecimalesUnidad}
          aria-invalid={Boolean(errores.cantidad)}
        />
        {errores.cantidad && (
          <p role="alert" className="text-xs text-danger">
            {errores.cantidad}
          </p>
        )}

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
          <input
            id="recepcion-proveedor"
            type="text"
            value={datos.proveedor}
            onChange={(event) => setDatos({ ...datos, proveedor: event.target.value })}
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
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
