import { useState } from 'react'
import type { Vista } from '../../../app/navegacion'
import { CircleAlert, Package, Stethoscope, Wallet } from '../../../components/icons'
import { formatearCantidad } from '../../../lib/unidades'
import { useLugarStore } from '../../../stores/lugarStore'
import { useSyncStore } from '../../../stores/syncStore'
import { ETIQUETA_GANANCIA_PROFESIONAL, ETIQUETA_NETO } from '../../tratamientos/lib/montos'
import {
  NOTAS_GANANCIA,
  NOTAS_GASTO,
  formatearMonto,
  mesLargo,
  montoKpi,
  notasIncompleto,
  porcentaje,
} from '../lib/formato'
import type { Periodo } from '../lib/periodos'
import { useReportes } from '../useReportes'
import { BarChart } from './charts/BarChart'
import { DonutChart } from './charts/DonutChart'
import { HorizontalBarChart } from './charts/HorizontalBarChart'
import { LineChart } from './charts/LineChart'
import { TarjetaGrafico } from './charts/TarjetaGrafico'
import { EstadoVacioReportes } from './EstadoVacioReportes'
import { SelectorPeriodo } from './SelectorPeriodo'
import { TarjetaKpiReporte } from './TarjetaKpiReporte'

/**
 * Spec 017 (US1–US3, UI §2) — sección Reportes: Producción, Gasto en
 * materiales y Ganancia del profesional (con el neto tras materiales) del período en el lugar activo (o "Todos"),
 * y los gráficos del DS §34. Todo se calcula en el dispositivo (FR-018).
 */
export function ReportesView({ onNavegar }: { onNavegar?: (vista: Vista) => void } = {}) {
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: 'esteMes' })
  const resumen = useReportes(periodo)
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  // R10: el aviso se decide al abrir Reportes, no parpadea con cada ciclo.
  const [puedeFaltar] = useState(() => {
    const sync = useSyncStore.getState()
    return sync.ultimaExitosaEn === null || sync.fase === 'sincronizando'
  })

  const nombreLugar =
    lugarActivoId === 'todos'
      ? 'Todos los lugares'
      : (lugares.find((lugar) => lugar.id === lugarActivoId)?.nombre ?? '')

  return (
    <div className="flex w-full flex-col gap-6 text-left desk:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 text-text">Reportes</h1>
          {nombreLugar && <p className="text-body text-text-muted">{nombreLugar}</p>}
        </div>
        <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />
      </header>

      {puedeFaltar && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-info-bg p-3 text-body text-text">
          <CircleAlert size={18} />
          Puede faltar información hasta terminar la sincronización.
        </p>
      )}

      {resumen === null ? null : resumen.vacio ? (
        <EstadoVacioReportes onNavegar={onNavegar} />
      ) : (
        <>
          <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 md:grid-cols-3 desk:gap-6">
            <TarjetaKpiReporte
              titulo="Producción"
              Icono={Stethoscope}
              kpi={resumen.produccion}
              comparacion={resumen.rango.etiquetaComparacion}
            />
            <TarjetaKpiReporte
              titulo="Gasto en materiales"
              Icono={Package}
              kpi={resumen.gasto}
              comparacion={resumen.rango.etiquetaComparacion}
              notasFijas={NOTAS_GASTO}
            />
            <TarjetaKpiReporte
              titulo={ETIQUETA_GANANCIA_PROFESIONAL}
              Icono={Wallet}
              kpi={resumen.gananciaProfesional}
              comparacion={resumen.rango.etiquetaComparacion}
              notasFijas={[
                `${ETIQUETA_NETO}: ${montoKpi(resumen.ganancia.valor, resumen.ganancia.incompleto)}`,
                ...NOTAS_GANANCIA,
              ]}
            />
          </section>

          <section aria-label="Gráficos" className="grid grid-cols-1 gap-3 desk:grid-cols-2 desk:gap-6">
            <TarjetaGrafico
              titulo="Consumo por categoría"
              vacio={resumen.porCategoria.length === 0}
              nota={notaSinPrecio(resumen.gasto.incompleto?.materialesSinPrecio)}
              tabla={{
                columnas: ['Categoría', 'Gasto', '%'],
                filas: resumen.porCategoria.map((c) => [c.nombre, formatearMonto(c.monto), porcentaje(c.porcentaje)]),
              }}
            >
              <DonutChart datos={resumen.porCategoria} />
            </TarjetaGrafico>
            <TarjetaGrafico
              titulo="Gastos mensuales"
              vacio={resumen.gastosMensuales.every((m) => m.monto === 0)}
              tabla={{
                columnas: ['Mes', 'Gasto'],
                filas: resumen.gastosMensuales.map((m) => [mesLargo(m.anio, m.mes), formatearMonto(m.monto)]),
              }}
            >
              <LineChart datos={resumen.gastosMensuales} />
            </TarjetaGrafico>
            <TarjetaGrafico
              titulo="Materiales más utilizados"
              vacio={resumen.masUtilizados.length === 0}
              nota={notaSinPrecio(resumen.gasto.incompleto?.materialesSinPrecio)}
              tabla={{
                columnas: ['Material', 'Cantidad', 'Gasto'],
                filas: resumen.masUtilizados.map((m) => [
                  m.dadoDeBaja ? `${m.nombre} (dado de baja)` : m.nombre,
                  formatearCantidad(m.cantidad, m.unidad),
                  formatearMonto(m.monto),
                ]),
              }}
            >
              <HorizontalBarChart
                datos={resumen.masUtilizados.map((m) => ({
                  id: m.insumoId,
                  nombre: m.nombre,
                  monto: m.monto,
                  detalle: formatearCantidad(m.cantidad, m.unidad),
                  dadoDeBaja: m.dadoDeBaja,
                }))}
              />
            </TarjetaGrafico>
            {/* Spec 026 (FR-015): producción y ganancia del profesional por categoría. */}
            <TarjetaGrafico
              titulo="Por categoría de tratamiento"
              vacio={resumen.porCategoriaTratamiento.length === 0}
              nota={notasIncompleto(resumen.produccion.incompleto).join(' · ') || undefined}
              tabla={{
                columnas: ['Categoría', 'Producción', ETIQUETA_GANANCIA_PROFESIONAL],
                filas: resumen.porCategoriaTratamiento.map((c) => [
                  c.nombre,
                  formatearMonto(c.produccion),
                  formatearMonto(c.gananciaProfesional),
                ]),
              }}
            >
              <HorizontalBarChart
                datos={resumen.porCategoriaTratamiento.map((c) => ({
                  id: c.id ?? 'sin-categoria',
                  nombre: c.nombre,
                  monto: c.produccion,
                  detalle: `${ETIQUETA_GANANCIA_PROFESIONAL.toLocaleLowerCase('es')} ${formatearMonto(c.gananciaProfesional)}`,
                }))}
              />
            </TarjetaGrafico>
            {resumen.gananciaPorLugar && (
              <TarjetaGrafico
                titulo="Ganancia del profesional por lugar"
                vacio={false}
                nota={notasIncompleto(resumen.gananciaProfesional.incompleto).join(' · ') || undefined}
                tabla={{
                  columnas: ['Lugar', ETIQUETA_GANANCIA_PROFESIONAL],
                  filas: resumen.gananciaPorLugar.map((g) => [g.nombre, formatearMonto(g.monto)]),
                }}
              >
                <BarChart datos={resumen.gananciaPorLugar} />
              </TarjetaGrafico>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function notaSinPrecio(n: number | undefined): string | undefined {
  if (!n) return undefined
  return `Incluye ${n} ${n === 1 ? 'material sin precio, no valorizado' : 'materiales sin precio, no valorizados'}.`
}
