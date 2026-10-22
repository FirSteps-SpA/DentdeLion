import { formatearMonto, montoCompacto } from '../../lib/formato'
import type { GananciaLugar } from '../../lib/kpis'
import { COLOR_NEGATIVO, COLOR_SERIE } from './colores'
import { Detalle } from './Detalle'
import { useSeleccion } from './seleccion'

const ALTO = 180
const ANCHO_BARRA = 40

/**
 * Spec 017 (FR-012, UI §3) — Ganancia por lugar: barras verticales con línea
 * de cero; las negativas crecen hacia abajo en rojo. La etiqueta de cada lugar
 * es un botón ≥ 48 px que resalta su barra y muestra el monto exacto.
 */
export function BarChart({ datos }: { datos: GananciaLugar[] }) {
  const { seleccion, alternar, hover, atenuado } = useSeleccion()
  const maximo = Math.max(...datos.map((d) => d.monto), 0)
  const minimo = Math.min(...datos.map((d) => d.monto), 0)
  const rango = maximo - minimo || 1
  const y = (monto: number) => 16 + ((maximo - monto) / rango) * (ALTO - 32)
  const ancho = datos.length * 100
  const elegido = seleccion === null ? null : datos[seleccion]
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${ancho} ${ALTO}`} className="h-48 w-full" preserveAspectRatio="none" aria-hidden="true">
        {datos.map((d, i) => {
          const cx = i * 100 + 50
          const arriba = Math.min(y(d.monto), y(0))
          const alto = Math.max(Math.abs(y(d.monto) - y(0)), 2)
          return (
            <g key={d.lugarId} opacity={atenuado(i) ? 0.35 : 1}>
              <rect
                x={cx - ANCHO_BARRA / 2}
                y={arriba}
                width={ANCHO_BARRA}
                height={alto}
                rx={4}
                fill={d.monto < 0 ? COLOR_NEGATIVO : COLOR_SERIE}
                onClick={() => alternar(i)}
                onMouseEnter={() => hover(i)}
                onMouseLeave={() => hover(null)}
              />
            </g>
          )
        })}
        <line x1={0} x2={ancho} y1={y(0)} y2={y(0)} stroke="var(--color-text-muted)" strokeWidth={1} />
      </svg>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0, 1fr))` }}>
        {datos.map((d, i) => (
          <button
            key={d.lugarId}
            type="button"
            aria-pressed={seleccion === i}
            onClick={() => alternar(i)}
            className="touch-target flex flex-col items-center justify-center rounded-md px-1 text-center hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-bg-secondary aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-brand"
          >
            <span className="text-caption text-text-muted">{d.nombre}</span>
            <span className={`text-body font-semibold tabular-nums ${d.monto < 0 ? 'text-danger' : 'text-text'}`}>
              {montoCompacto(d.monto)}
            </span>
          </button>
        ))}
      </div>
      <Detalle texto={elegido ? `${elegido.nombre}: ${formatearMonto(elegido.monto)}` : null} />
    </div>
  )
}
