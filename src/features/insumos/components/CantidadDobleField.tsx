import { useId } from 'react'
import { etiquetaUnidad, formatearCantidad, unidadAdmiteDecimales } from '../../../lib/unidades'
import {
  contenidoValido,
  equivalente,
  esDoble,
  unidadEfectiva,
  type CantidadTecleada,
  type PresentacionDoble,
} from '../lib/cantidadDoble'
import { NumeroInput } from '../../../components/ui/NumeroInput'
import { Stepper } from '../../../components/ui/Stepper'

export interface CantidadDobleFieldProps {
  /** `id` del campo en unidad de consumo; el de compra es `<id>-compra`. */
  id: string
  label: string
  /** Ayuda de una línea bajo el campo (p. ej. qué hace el stock mínimo). */
  ayuda?: string
  presentacion: PresentacionDoble
  valor: CantidadTecleada
  onChange: (valor: CantidadTecleada) => void
  /** Se puede dejar vacío (`cantidad: null`); si no, vacío es 0. */
  opcional?: boolean
  /** Agrega "(opcional)" al rótulo de un campo opcional (por defecto, sí). */
  marcarOpcional?: boolean
  placeholder?: string
  error?: string
  /** `id` del mensaje de error, para `aria-describedby`. */
  errorId?: string
}

const CAMPO_CLASS =
  'touch-target flex min-w-0 items-center gap-1.5 rounded-md border border-border-input bg-surface px-3 focus-within:outline-2 focus-within:outline-brand'

/** "jeringas" → "Jeringas"; los símbolos ("mL", "g", "cm") quedan igual. */
function capitalizar(texto: string): string {
  return /^[a-záéíóúñ]{3,}/.test(texto)
    ? texto.replace(/^./, (c) => c.toLocaleUpperCase('es'))
    : texto
}

/**
 * Spec 032 US1 (contracts/ui-contracts.md §3): cantidad que se puede escribir
 * en la unidad de compra o en la de consumo, lado a lado, con la conversión en
 * vivo. Lo escrito se conserva en su unidad y el otro campo se calcula (≤ 2
 * decimales, "≈" si no es exacto, nunca redondeado a entero). Con unidades
 * iguales es el `Stepper` de siempre. Usa `step="any"`: un `step` entero con
 * un valor calculado decimal bloquearía el envío del formulario. Los decimales
 * no permitidos se rechazan al escribir.
 */
export function CantidadDobleField({
  id,
  label,
  ayuda,
  presentacion,
  valor,
  onChange,
  opcional = false,
  marcarOpcional = true,
  placeholder,
  error,
  errorId,
}: CantidadDobleFieldProps) {
  const labelId = useId()
  const ayudaId = useId()
  const etiqueta = opcional && marcarOpcional ? `${label} (opcional)` : label
  const describedBy = [ayuda ? ayudaId : null, error && errorId ? errorId : null]
    .filter(Boolean)
    .join(' ')
  const aria = {
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true } : {}),
  }
  const textoAyuda = ayuda ? (
    <p id={ayudaId} className="text-xs font-normal text-text-muted">
      {ayuda}
    </p>
  ) : null

  if (!esDoble(presentacion)) {
    return (
      <div className="flex flex-col gap-1">
        <Stepper
          id={id}
          label={etiqueta}
          value={valor.cantidad}
          onChange={(cantidad) => onChange({ cantidad, unidad: presentacion.unidadMedida })}
          min={0}
          permiteDecimales={unidadAdmiteDecimales(presentacion.unidadMedida)}
          allowEmpty={opcional}
          {...aria}
        />
        {textoAyuda}
      </div>
    )
  }

  const escrita = unidadEfectiva(valor, presentacion)
  const hayContenido = contenidoValido(presentacion)
  const unidades = [presentacion.unidadCompra, presentacion.unidadMedida]

  function escribir(unidad: string, texto: string) {
    if (texto.trim() === '') {
      onChange({ cantidad: opcional ? null : 0, unidad })
      return
    }
    const numero = Number(texto)
    if (Number.isNaN(numero) || numero < 0) return
    if (!unidadAdmiteDecimales(unidad) && !Number.isInteger(numero)) return
    onChange({ cantidad: numero, unidad })
  }

  const enCompra = equivalente(valor, presentacion, presentacion.unidadCompra)
  const enConsumo = equivalente(valor, presentacion, presentacion.unidadMedida)
  const resumen =
    enCompra && enConsumo
      ? `${formatearCantidad(enCompra.valor, presentacion.unidadCompra)} ${
          enCompra.exacto && enConsumo.exacto ? '=' : '≈'
        } ${formatearCantidad(enConsumo.valor, presentacion.unidadMedida)}`
      : ''

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-semibold text-text">
        {etiqueta}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {unidades.map((unidad) => {
          const esCompra = unidad === presentacion.unidadCompra
          const deshabilitado = esCompra && !hayContenido
          const eq = esCompra ? enCompra : enConsumo
          const calculado = unidad !== escrita
          return (
            <div key={unidad} className="flex min-w-0 flex-col gap-1">
              <div className={`${CAMPO_CLASS} ${deshabilitado ? 'opacity-60' : ''}`}>
                {calculado && eq && !eq.exacto && (
                  <span aria-hidden="true" className="text-sm text-text-muted">
                    ≈
                  </span>
                )}
                <NumeroInput
                  id={esCompra ? `${id}-compra` : id}
                  step="any"
                  min={0}
                  inputMode={unidadAdmiteDecimales(unidad) ? 'decimal' : 'numeric'}
                  aria-label={`${label} en ${etiquetaUnidad(unidad, 2)}`}
                  disabled={deshabilitado}
                  placeholder={esCompra ? undefined : placeholder}
                  value={deshabilitado || !eq ? (calculado ? '' : (valor.cantidad ?? '')) : eq.valor}
                  onChange={(event) => escribir(unidad, event.target.value)}
                  className="w-full min-w-0 border-none bg-transparent text-[15px] font-extrabold text-text outline-none"
                  {...aria}
                />
              </div>
              <span className="text-xs font-normal text-text-muted">
                {capitalizar(etiquetaUnidad(unidad, 2))}
              </span>
            </div>
          )
        })}
      </div>
      {!hayContenido && (
        <p className="text-xs font-normal text-text-muted">
          Completa cuánto trae cada {etiquetaUnidad(presentacion.unidadCompra, 1)} para convertir.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {resumen}
      </p>
      {textoAyuda}
    </div>
  )
}
