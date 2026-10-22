import { formatearCantidad } from '../../../../lib/unidades'
import { formatearMonto } from '../../lib/formato'
import type { MaterialMasUsado } from '../../lib/kpis'
import { COLOR_SERIE } from './colores'
import { Detalle } from './Detalle'
import { useSeleccion } from './seleccion'

/**
 * Spec 017 (FR-011, UI §3) — Materiales más utilizados: cada fila (nombre ·
 * cantidad, barra y monto) es un botón ≥ 48 px que la resalta; los dados de
 * baja llevan su chip.
 */
export function HorizontalBarChart({ datos }: { datos: MaterialMasUsado[] }) {
  const { seleccion, alternar, atenuado } = useSeleccion()
  const maximo = Math.max(...datos.map((d) => d.monto), 1)
  const elegido = seleccion === null ? null : datos[seleccion]
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {datos.map((d, i) => (
          <li key={d.insumoId}>
            <button
              type="button"
              aria-pressed={seleccion === i}
              onClick={() => alternar(i)}
              className="touch-target flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-bg-secondary aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-brand"
              style={{ opacity: atenuado(i) ? 0.55 : 1 }}
            >
              <span className="flex w-full items-baseline justify-between gap-2 text-body">
                <span className="text-text">
                  {d.nombre}
                  <span className="text-text-muted"> · {formatearCantidad(d.cantidad, d.unidad)}</span>
                  {d.dadoDeBaja && (
                    <span className="ml-2 rounded-pill bg-warning-30-bg px-2 py-0.5 text-caption text-warning-30-text">
                      Dado de baja
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums text-text">{formatearMonto(d.monto)}</span>
              </span>
              <span aria-hidden="true" className="block h-2.5 w-full rounded-pill bg-bg-secondary">
                <span
                  className="block h-full rounded-pill"
                  style={{ width: `${Math.max((d.monto / maximo) * 100, 1)}%`, background: COLOR_SERIE }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Detalle
        texto={
          elegido
            ? `${elegido.nombre}: ${formatearMonto(elegido.monto)} · ${formatearCantidad(elegido.cantidad, elegido.unidad)}`
            : null
        }
      />
    </div>
  )
}
