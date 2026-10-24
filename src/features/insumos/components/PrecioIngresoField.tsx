import { useState } from 'react'
import { TouchButton } from '../../../components/ui/TouchButton'
import { etiquetaUnidad, formatearNumero } from '../../../lib/unidades'
import { formatearCLP, precioPorUnidadCompra, type PrecioIngreso } from '../lib/precio'
import { NumeroInput } from '../../../components/ui/NumeroInput'

export interface PrecioIngresoFieldProps {
  id: string
  presentacion: { unidadMedida: string; unidadCompra: string; contenido: number }
  /** Cuántas unidades de compra son el ingreso (para el total y el costo). */
  presentaciones: number
  precio: PrecioIngreso
  onChange: (precio: PrecioIngreso) => void
  error?: string
}

/**
 * Spec 015 (contracts/ui-contracts.md §2, FR-013/FR-014): precio opcional del
 * ingreso, por unidad de compra o total pagado, con la vista previa
 * "2 × $32.500 = $65.000 · $650 por cartucho". Vacío = sin precio; 0 se
 * acepta. Controles ≥ 48 px (Constitución III).
 */
export function PrecioIngresoField({
  id,
  presentacion,
  presentaciones,
  precio,
  onChange,
  error,
}: PrecioIngresoFieldProps) {
  // El modo se recuerda aunque el campo esté vacío (sin precio).
  const [modoLocal, setModoLocal] = useState<'unidad' | 'total'>(precio?.modo ?? 'unidad')
  const modo = precio?.modo ?? modoLocal
  const porUnidad = precioPorUnidadCompra(precio, presentaciones)
  const contenido = presentacion.contenido > 0 ? presentacion.contenido : 1
  const unidadCompra = etiquetaUnidad(presentacion.unidadCompra, 1)
  const vistaPrevia =
    porUnidad === null || !(presentaciones > 0)
      ? null
      : `${formatearNumero(presentaciones)} × ${formatearCLP(porUnidad)} = ${formatearCLP(
          porUnidad * presentaciones,
        )} · ${formatearCLP(porUnidad / contenido)} por ${etiquetaUnidad(
          presentacion.unidadMedida,
          1,
        )}`

  function cambiarValor(texto: string) {
    if (texto.trim() === '') {
      onChange(null)
      return
    }
    const valor = Number(texto)
    if (Number.isNaN(valor)) return
    onChange({ modo, valor })
  }

  return (
    <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-text">
      <span id={`${id}-titulo`}>Precio (opcional)</span>
      <div role="group" aria-labelledby={`${id}-titulo`} className="grid grid-cols-2 gap-2">
        {(['unidad', 'total'] as const).map((opcion) => (
          <TouchButton
            key={opcion}
            type="button"
            variant={modo === opcion ? 'primary' : 'ghost'}
            aria-pressed={modo === opcion}
            onClick={() => {
              setModoLocal(opcion)
              if (precio !== null) onChange({ modo: opcion, valor: precio.valor })
            }}
          >
            {opcion === 'unidad' ? `Por ${unidadCompra}` : 'Total'}
          </TouchButton>
        ))}
      </div>
      <label htmlFor={id} className="sr-only">
        {modo === 'unidad' ? `Precio por ${unidadCompra}` : 'Total pagado'}
      </label>
      <div className="touch-target flex items-center gap-2 rounded-md border border-border-input bg-surface px-3.5 focus-within:outline-2 focus-within:outline-brand">
        <span aria-hidden className="text-text-muted">
          $
        </span>
        <NumeroInput
          id={id}
          inputMode="numeric"
          min={0}
          step="any"
          placeholder={modo === 'unidad' ? `Precio por ${unidadCompra}` : 'Total pagado'}
          value={precio === null ? '' : precio.valor}
          onChange={(event) => cambiarValor(event.target.value)}
          className="w-full border-none bg-transparent text-[15px] font-normal text-text outline-none"
          {...(error ? { 'aria-invalid': true, 'aria-describedby': `error-${id}` } : {})}
        />
      </div>
      {vistaPrevia && (
        <p className="text-sm font-bold text-text" aria-live="polite">
          {vistaPrevia}
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
