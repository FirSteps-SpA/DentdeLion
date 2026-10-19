import { useState, type FormEvent } from 'react'
import type { Insumo } from '../../../lib/db'
import { sugerirMateriales } from '../../insumos/lib/alta'
import { agregarItemManual, type ItemManualInput } from '../lib/itemsManuales'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { Stepper } from '../../../components/ui/Stepper'
import { TouchButton } from '../../../components/ui/TouchButton'

export interface AgregarItemManualFormProps {
  insumosActivos: Insumo[]
  /** Spec 014 FR-014 — lugar de la lista (desde "Todos"); sin él, el activo. */
  lugarId?: string
  onAgregado: () => void
  onCancelar: () => void
}

/**
 * "+ Añadir Ítem Manual" (spec 009 FR-015/FR-016): nombre obligatorio con
 * sugerencias de materiales existentes para vincularlo, cantidad numérica
 * opcional y una nota libre.
 */
export function AgregarItemManualForm({
  insumosActivos,
  lugarId,
  onAgregado,
  onCancelar,
}: AgregarItemManualFormProps) {
  const [nombre, setNombre] = useState('')
  const [cantidad, setCantidad] = useState<number | null>(null)
  const [nota, setNota] = useState('')
  const [insumoId, setInsumoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const sugerencias = insumoId === null ? sugerirMateriales(insumosActivos, nombre) : []

  function vincular(insumo: Insumo) {
    setNombre(insumo.nombre)
    setInsumoId(insumo.id)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const input: ItemManualInput = { nombre, cantidad, nota, insumoId }
    setIsPending(true)
    try {
      await agregarItemManual(input, { lugarId })
      onAgregado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <BottomSheet titulo="Añadir Ítem Manual" onClose={onCancelar}>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <IconField label="Nombre" htmlFor="item-manual-nombre">
          <input
            id="item-manual-nombre"
            type="text"
            autoFocus
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value)
              setInsumoId(null)
            }}
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
          />
        </IconField>

        {sugerencias.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
              Vincular a un material existente
            </p>
            <ul className="flex flex-col gap-1.5">
              {sugerencias.map((insumo) => (
                <li key={insumo.id}>
                  <Card
                    as="button"
                    type="button"
                    onClick={() => vincular(insumo)}
                    className="touch-target flex w-full items-center px-3.5 text-left"
                  >
                    <span className="text-sm text-text">
                      «{insumo.nombre}» · {insumo.categoria}
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Stepper
          id="item-manual-cantidad"
          label="Cantidad (opcional)"
          value={cantidad}
          onChange={setCantidad}
          min={0}
          permiteDecimales
          allowEmpty
        />

        <IconField label="Nota (opcional)" htmlFor="item-manual-nota">
          <input
            id="item-manual-nota"
            type="text"
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
          />
        </IconField>

        {error && (
          <Card className="bg-danger-bg px-3.5 py-2.5">
            <p role="alert" className="text-sm text-danger">
              {error}
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
            {isPending ? 'Guardando…' : 'Agregar'}
          </TouchButton>
        </div>
      </form>
    </BottomSheet>
  )
}
