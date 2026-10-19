import type { ReactNode } from 'react'
import { Stepper } from '../../../components/ui/Stepper'
import { UNIDADES, etiquetaUnidad, unidadAdmiteDecimales } from '../../../lib/unidades'
import { formatearPresentacion, normalizarPresentacion } from '../lib/presentacion'

const SELECT_CLASS =
  'touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text'

export interface ValorPresentacion {
  unidadMedida: string
  /** `null` = "Igual que la de consumo" (FR-004). */
  unidadCompra: string | null
  contenido: number | null
}

export interface PresentacionFieldsProps {
  /** Prefijo de los `id` (p. ej. `alta`, `editar`). */
  idPrefix: string
  valor: ValorPresentacion
  onChange: (cambio: Partial<ValorPresentacion>) => void
  errores?: Partial<Record<'unidadMedida' | 'unidadCompra' | 'contenido', string>>
  /**
   * Spec 015 FR-007a — con movimientos, la unidad de consumo no se edita aquí:
   * se muestra como texto con esta acción (p. ej. "Convertir unidad").
   */
  accionUnidadConsumo?: ReactNode
}

function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null
  return (
    <p id={id} role="alert" className="text-xs text-danger">
      {mensaje}
    </p>
  )
}

/**
 * Sección "Unidades" del alta y la edición de insumos (spec 015
 * contracts/ui-contracts.md §1): unidad de consumo, "Se compra por",
 * contenido y la vista previa "Caja × 50 cartuchos". Controles ≥ 48 px
 * (Constitución III).
 */
export function PresentacionFields({
  idPrefix,
  valor,
  onChange,
  errores = {},
  accionUnidadConsumo,
}: PresentacionFieldsProps) {
  const distinta = valor.unidadCompra !== null && valor.unidadCompra !== valor.unidadMedida
  const contenidoValido = valor.contenido !== null && valor.contenido > 0
  const vistaPrevia =
    distinta && !contenidoValido
      ? `${etiquetaUnidad(valor.unidadCompra ?? '')} × ? ${etiquetaUnidad(valor.unidadMedida, 2)}`
      : formatearPresentacion({
          ...normalizarPresentacion({
            unidadMedida: valor.unidadMedida,
            unidadCompra: valor.unidadCompra ?? valor.unidadMedida,
            contenido: valor.contenido,
          }),
          contenido: distinta ? (valor.contenido ?? 1) : 1,
        })
  const errorProps = (campo: 'unidadMedida' | 'unidadCompra' | 'contenido') =>
    errores[campo]
      ? { 'aria-invalid': true, 'aria-describedby': `error-${idPrefix}-${campo}` }
      : {}

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-bold text-text">Unidades</legend>

      <div className="flex flex-col gap-1">
        {accionUnidadConsumo ? (
          <div className="flex flex-col gap-1.5 text-sm font-bold text-text">
            <span>Unidad de consumo</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-normal">{etiquetaUnidad(valor.unidadMedida)}</span>
              {accionUnidadConsumo}
            </div>
          </div>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
            Unidad de consumo
            <select
              id={`${idPrefix}-unidad-consumo`}
              value={valor.unidadMedida}
              onChange={(event) => onChange({ unidadMedida: event.target.value })}
              className={SELECT_CLASS}
              {...errorProps('unidadMedida')}
            >
              {UNIDADES.map((u) => (
                <option key={u.clave} value={u.clave}>
                  {u.singular}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-xs text-text-muted">
          Stock, mínimo y consumos se cuentan en esta unidad. Admite decimales:{' '}
          {unidadAdmiteDecimales(valor.unidadMedida) ? 'Sí' : 'No'}
        </p>
        <ErrorCampo id={`error-${idPrefix}-unidadMedida`} mensaje={errores.unidadMedida} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
          Se compra por
          <select
            id={`${idPrefix}-unidad-compra`}
            value={distinta ? (valor.unidadCompra ?? '') : ''}
            onChange={(event) =>
              onChange({ unidadCompra: event.target.value === '' ? null : event.target.value })
            }
            className={SELECT_CLASS}
            {...errorProps('unidadCompra')}
          >
            <option value="">Igual que la de consumo</option>
            {UNIDADES.filter((u) => u.clave !== valor.unidadMedida).map((u) => (
              <option key={u.clave} value={u.clave}>
                {u.singular}
              </option>
            ))}
          </select>
        </label>
        <ErrorCampo id={`error-${idPrefix}-unidadCompra`} mensaje={errores.unidadCompra} />
      </div>

      {distinta && (
        <div className="flex flex-col gap-1">
          <Stepper
            id={`${idPrefix}-contenido`}
            label={`Contenido: ${etiquetaUnidad(valor.unidadMedida, 2)} por ${etiquetaUnidad(
              valor.unidadCompra ?? valor.unidadMedida,
              1,
            )}`}
            value={valor.contenido}
            onChange={(contenido) => onChange({ contenido })}
            min={0}
            permiteDecimales={unidadAdmiteDecimales(valor.unidadMedida)}
            allowEmpty
            {...errorProps('contenido')}
          />
          <ErrorCampo id={`error-${idPrefix}-contenido`} mensaje={errores.contenido} />
        </div>
      )}

      <p className="text-sm text-text-muted" aria-live="polite">
        Presentación: <span className="font-bold text-text">{vistaPrevia}</span>
      </p>
    </fieldset>
  )
}
