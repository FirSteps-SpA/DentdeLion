import { Minus, Plus } from '../icons'
import { TouchButton } from './TouchButton'
import { NumeroInput } from './NumeroInput'

export interface StepperProps {
  id: string
  label: string
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  permiteDecimales: boolean
  allowEmpty?: boolean
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/**
 * Control numérico táctil −/+ (spec 008 contracts/ui-contracts.md), extraído
 * del patrón de cantidad de `RegistroForm`/`EditarInsumoForm`. "+" sobre
 * vacío empieza en `min + 1`; "−" sobre vacío no hace nada; "−" nunca baja
 * de `min`. Borrar el input da `null` solo si `allowEmpty`, si no vuelve a
 * `min`.
 */
export function Stepper({
  id,
  label,
  value,
  onChange,
  min = 0,
  permiteDecimales,
  allowEmpty = false,
  ...ariaProps
}: StepperProps) {
  function restar() {
    if (value === null) return
    onChange(Math.max(min, value - 1))
  }

  function sumar() {
    onChange(value === null ? Math.max(min, min + 1) : value + 1)
  }

  function onInputChange(texto: string) {
    if (texto.trim() === '') {
      onChange(allowEmpty ? null : min)
      return
    }
    const numero = Number(texto)
    if (Number.isNaN(numero)) return
    onChange(numero)
  }

  return (
    <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-text">
      <label htmlFor={id}>{label}</label>
      <div className="flex items-stretch gap-2">
        <TouchButton
          type="button"
          variant="ghost"
          onClick={restar}
          aria-label="Restar uno"
        >
          <Minus size={16} />
        </TouchButton>
        <div className="touch-target flex flex-1 items-center justify-center rounded-md border border-border-input bg-surface focus-within:outline-2 focus-within:outline-brand">
          <NumeroInput
            id={id}
            step={permiteDecimales ? 'any' : 1}
            value={value === null ? '' : value}
            onChange={(event) => onInputChange(event.target.value)}
            className="w-full border-none bg-transparent text-center text-[15px] font-extrabold text-text outline-none"
            {...ariaProps}
          />
        </div>
        <TouchButton
          type="button"
          variant="ghost"
          onClick={sumar}
          aria-label="Sumar uno"
        >
          <Plus size={16} />
        </TouchButton>
      </div>
    </div>
  )
}
