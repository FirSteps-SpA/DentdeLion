import { formatearMonto, porcentaje } from '../../lib/formato'
import type { CategoriaGasto } from '../../lib/kpis'
import { COLOR_HUECO, colorCategoria } from './colores'
import { Detalle } from './Detalle'
import { botonEntrada, useSeleccion } from './seleccion'

const R = 80
const GROSOR = 28
const C = 100

function arco(desde: number, hasta: number): string {
  // Un sector del 100 % se dibuja como dos mitades.
  if (hasta - desde >= 0.9999) return `${arco(0, 0.5)} ${arco(0.5, 1)}`
  const punto = (t: number, r: number) => {
    const angulo = t * 2 * Math.PI - Math.PI / 2
    return `${C + r * Math.cos(angulo)} ${C + r * Math.sin(angulo)}`
  }
  const grande = hasta - desde > 0.5 ? 1 : 0
  const ri = R - GROSOR
  return [
    `M ${punto(desde, R)}`,
    `A ${R} ${R} 0 ${grande} 1 ${punto(hasta, R)}`,
    `L ${punto(hasta, ri)}`,
    `A ${ri} ${ri} 0 ${grande} 0 ${punto(desde, ri)}`,
    'Z',
  ].join(' ')
}

/**
 * Spec 017 (FR-009, UI §3) — Consumo por categoría: donut SVG con hueco de
 * 2 px entre sectores, total al centro y leyenda en filas-botón con monto y %.
 */
export function DonutChart({ datos }: { datos: CategoriaGasto[] }) {
  const { seleccion, alternar, hover, atenuado } = useSeleccion()
  const total = datos.reduce((suma, d) => suma + d.monto, 0)
  const sectores = datos.map((d, i) => {
    const desde = datos.slice(0, i).reduce((suma, previo) => suma + previo.monto, 0) / total
    return { d, i, desde, hasta: desde + d.monto / total }
  })
  const elegido = seleccion === null ? null : datos[seleccion]
  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
      <svg viewBox="0 0 200 200" className="h-48 w-48 shrink-0" aria-hidden="true">
        {sectores.map(({ d, i, desde, hasta }) => (
          <path
            key={d.clave}
            d={arco(desde, hasta)}
            fill={colorCategoria(d, i)}
            stroke={COLOR_HUECO}
            strokeWidth={2}
            opacity={atenuado(i) ? 0.35 : 1}
            onClick={() => alternar(i)}
            onMouseEnter={() => hover(i)}
            onMouseLeave={() => hover(null)}
          />
        ))}
        <text x={C} y={C - 4} textAnchor="middle" className="fill-text-muted text-[11px]">
          Total
        </text>
        <text x={C} y={C + 14} textAnchor="middle" className="fill-text text-[15px] font-extrabold">
          {formatearMonto(total)}
        </text>
      </svg>
      <div className="flex w-full flex-col gap-1">
        <ul className="flex flex-col">
          {datos.map((d, i) => (
            <li key={d.clave}>
              <button
                type="button"
                aria-pressed={seleccion === i}
                className={botonEntrada}
                onClick={() => alternar(i)}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-sm border border-border"
                  style={{ background: colorCategoria(d, i) }}
                />
                <span className="flex-1">{d.nombre}</span>
                <span className="tabular-nums text-text-muted">{porcentaje(d.porcentaje)}</span>
                <span className="w-24 text-right font-semibold tabular-nums">{formatearMonto(d.monto)}</span>
              </button>
            </li>
          ))}
        </ul>
        <Detalle
          texto={
            elegido
              ? `${elegido.nombre}: ${formatearMonto(elegido.monto)} (${porcentaje(elegido.porcentaje)})`
              : null
          }
        />
      </div>
    </div>
  )
}
