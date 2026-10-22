import type { CSSProperties } from 'react'
import { formatearMonto, mesCorto, mesLargo, montoCompacto } from '../../lib/formato'
import type { GastoMes } from '../../lib/kpis'
import { COLOR_SERIE } from './colores'
import { Detalle } from './Detalle'
import { useSeleccion } from './seleccion'

const ANCHO = 600
const ALTO = 200
const MARGEN = { arriba: 12, abajo: 8, izquierda: 64, derecha: 16 }

/** Tope "redondo" del eje para 3 líneas de grilla. */
function tope(maximo: number): number {
  if (maximo <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(maximo))
  for (const paso of [1, 2, 2.5, 5, 10]) if (paso * potencia >= maximo) return paso * potencia
  return 10 * potencia
}

/**
 * Spec 017 (FR-010, UI §3) — Gastos mensuales: línea de 2 px con puntos y los
 * meses bajo el gráfico como botones ≥ 48 px (en filas de 6 en móvil) que
 * resaltan el punto y muestran el monto exacto.
 */
export function LineChart({ datos }: { datos: GastoMes[] }) {
  const { seleccion, alternar, hover } = useSeleccion()
  const maximo = tope(Math.max(...datos.map((d) => d.monto)))
  const plotAncho = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const plotAlto = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i: number) =>
    MARGEN.izquierda + (datos.length === 1 ? plotAncho / 2 : (i / (datos.length - 1)) * plotAncho)
  const y = (monto: number) => MARGEN.arriba + plotAlto - (monto / maximo) * plotAlto
  const puntos = datos.map((d, i) => `${x(i)},${y(d.monto)}`).join(' ')
  const elegido = seleccion === null ? null : datos[seleccion]
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="h-auto w-full" aria-hidden="true">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={MARGEN.izquierda}
              x2={ANCHO - MARGEN.derecha}
              y1={y(maximo * t)}
              y2={y(maximo * t)}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text
              x={MARGEN.izquierda - 8}
              y={y(maximo * t) + 4}
              textAnchor="end"
              className="fill-text-muted text-[12px]"
            >
              {montoCompacto(maximo * t)}
            </text>
          </g>
        ))}
        <polyline points={puntos} fill="none" stroke={COLOR_SERIE} strokeWidth={2} strokeLinejoin="round" />
        {datos.map((d, i) => (
          <circle
            key={`${d.anio}-${d.mes}`}
            cx={x(i)}
            cy={y(d.monto)}
            r={seleccion === i ? 7 : 4.5}
            fill={seleccion === i ? COLOR_SERIE : 'var(--color-surface)'}
            stroke={COLOR_SERIE}
            strokeWidth={2}
            onMouseEnter={() => hover(i)}
            onMouseLeave={() => hover(null)}
          />
        ))}
      </svg>
      {/* Botones ≥ 48 px: en móvil no caben 12 en una fila, van en filas de 6. */}
      <div
        className="grid grid-cols-[repeat(var(--cols-movil),minmax(0,1fr))] gap-1 md:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"
        style={{ '--cols': datos.length, '--cols-movil': Math.min(datos.length, 6) } as CSSProperties}
      >
        {datos.map((d, i) => (
          <button
            key={`${d.anio}-${d.mes}`}
            type="button"
            aria-pressed={seleccion === i}
            aria-label={`${mesLargo(d.anio, d.mes)}: ${formatearMonto(d.monto)}`}
            onClick={() => alternar(i)}
            className="touch-target rounded-md text-caption text-text-muted hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-bg-secondary aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-brand aria-pressed:text-text"
          >
            {mesCorto(d.mes)}
          </button>
        ))}
      </div>
      <Detalle texto={elegido ? `${mesLargo(elegido.anio, elegido.mes)}: ${formatearMonto(elegido.monto)}` : null} />
    </div>
  )
}
