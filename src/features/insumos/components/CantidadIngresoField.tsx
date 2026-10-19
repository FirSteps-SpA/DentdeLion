import { Stepper } from '../../../components/ui/Stepper'
import { TouchButton } from '../../../components/ui/TouchButton'
import { etiquetaUnidad, unidadAdmiteDecimales } from '../../../lib/unidades'
import { textoEquivalenciaIngreso } from '../lib/ingreso'

export interface CantidadIngresoFieldProps {
  id: string
  label: string
  presentacion: { unidadMedida: string; unidadCompra: string; contenido: number }
  cantidad: number
  unidad: string
  onChange: (cambio: { cantidad?: number; unidad?: string }) => void
  error?: string
}

/**
 * Spec 015 (contracts/ui-contracts.md §2, FR-009): cantidad de un ingreso con
 * el selector `[Cajas | Cartuchos]` cuando el insumo se compra en otra unidad,
 * y la equivalencia en vivo "2 cajas = 100 cartuchos". Por defecto, en unidad
 * de compra. Controles ≥ 48 px (Constitución III).
 */
export function CantidadIngresoField({
  id,
  label,
  presentacion,
  cantidad,
  unidad,
  onChange,
  error,
}: CantidadIngresoFieldProps) {
  const distinta = presentacion.unidadCompra !== presentacion.unidadMedida
  const equivalencia = textoEquivalenciaIngreso(presentacion, { cantidad, unidad })
  const opciones = [presentacion.unidadCompra, presentacion.unidadMedida]

  return (
    <div className="flex flex-col gap-1.5">
      {distinta && (
        <div
          role="group"
          aria-label="Unidad del ingreso"
          className="grid grid-cols-2 gap-2"
        >
          {opciones.map((opcion) => (
            <TouchButton
              key={opcion}
              type="button"
              variant={unidad === opcion ? 'primary' : 'ghost'}
              aria-pressed={unidad === opcion}
              onClick={() => onChange({ unidad: opcion })}
            >
              {etiquetaUnidad(opcion, 2).replace(/^./, (c) => c.toLocaleUpperCase('es'))}
            </TouchButton>
          ))}
        </div>
      )}
      <Stepper
        id={id}
        label={`${label} (${etiquetaUnidad(unidad, 2)})`}
        value={cantidad}
        onChange={(valor) => onChange({ cantidad: valor ?? 0 })}
        min={0}
        permiteDecimales={unidadAdmiteDecimales(presentacion.unidadMedida)}
        aria-invalid={Boolean(error)}
        {...(error ? { 'aria-describedby': `error-${id}` } : {})}
      />
      {equivalencia && (
        <p className="text-sm font-bold text-text" aria-live="polite">
          {equivalencia}
        </p>
      )}
      {error && (
        <p id={`error-${id}`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
