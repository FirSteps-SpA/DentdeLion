import type { Vista } from '../../../app/navegacion'
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Package,
  ShoppingCart,
} from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { Card, KpiCard } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useAlertasStore } from '../../../stores/alertasStore'
import { useAuthStore } from '../../../stores/authStore'
import { resumenInicioPorLugares, type AlertaInicio } from '../lib/resumenInicio'
import { useVistasDeLugar } from '../../insumos/lib/vistaLugar'
import { ChipLugar } from '../../../app/ChipLugar'

export interface InicioViewProps {
  onNavegar: (vista: Vista) => void
}

const fecha = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function textoDias(dias: number): string {
  if (dias < 0)
    return `venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'vence hoy'
  return `vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

function FilaAlerta({ alerta, conLugar }: { alerta: AlertaInicio; conLugar: boolean }) {
  const { insumo, tipo, lote, diasRestantes, stockActual, lugar } = alerta
  const chip = conLugar && lugar ? <ChipLugar nombre={lugar.nombre} /> : null
  if (tipo === 'stock-bajo') {
    const critico = stockActual === 0
    return (
      <li className="flex items-center gap-3 py-2.5">
        {critico ? (
          <CircleAlert size={18} className="shrink-0 text-danger" />
        ) : (
          <AlertTriangle size={18} className="shrink-0 text-warning-icon" />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-text">
            {insumo.nombre}
          </span>
          <span className="text-caption text-text-muted">
            Stock: {stockActual} (mínimo {insumo.stockMinimo}) {chip}
          </span>
        </span>
        <Badge variant={critico ? 'danger' : 'warning-30'}>
          {critico ? 'Stock crítico' : 'Bajo mínimo'}
        </Badge>
      </li>
    )
  }
  const caducado = tipo === 'caducado'
  return (
    <li className="flex items-center gap-3 py-2.5">
      {caducado ? (
        <CircleAlert size={18} className="shrink-0 text-danger" />
      ) : (
        <Clock size={18} className="shrink-0 text-warning-icon" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-bold text-text">
          {insumo.nombre}
        </span>
        <span className="text-caption text-text-muted">
          Lote {lote?.numeroLote} · {textoDias(diasRestantes ?? 0)} {chip}
        </span>
      </span>
      <Badge variant={caducado ? 'danger' : 'urgent-7'}>
        {caducado ? 'Caducado' : 'Por vencer'}
      </Badge>
    </li>
  )
}

function puntoVencimiento(dias: number): string {
  if (dias < 0) return 'bg-danger'
  if (dias <= 30) return 'bg-warning-icon'
  return 'bg-success-icon'
}

/**
 * Inicio (spec 013 US3, DS §17/§20/§41.3): saludo, 4 KPIs y las listas de
 * alertas y próximos vencimientos, calculados con `resumenInicio` sobre los
 * datos locales. Cada tarjeta y enlace solo lleva a la sección donde se
 * resuelve el tema — Inicio no agrega acciones ni datos (FR-024/FR-026).
 */
export function InicioView({ onNavegar }: InicioViewProps) {
  const usuario = useAuthStore((s) => s.usuario)
  // Spec 014: el lugar activo; en "Todos", la suma de los lugares (FR-013).
  const { vistas, esTodos } = useVistasDeLugar()
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const preferenciaStockBajo = useAlertasStore((s) => s.preferenciaStockBajo)
  const preferenciaCaducidad = useAlertasStore((s) => s.preferenciaCaducidad)

  const preferencias = {
    stockBajo: preferenciaStockBajo,
    caducidad: preferenciaCaducidad,
  }
  const resumen = resumenInicioPorLugares(
    vistas.map(({ lugar, datos }) => ({ ...datos, nivelesAvisoDias, preferencias, lugar })),
  )
  const primerNombre = usuario?.nombre.trim().split(/\s+/)[0] ?? ''
  const hoy = fecha.format(new Date())

  const kpis = [
    {
      titulo: 'Productos bajo mínimo',
      valor: resumen.bajoMinimo,
      Icono: Package,
      tono: 'danger' as const,
      destino: 'alertas' as const,
      seccion: 'Alertas',
    },
    {
      titulo: 'Próximos a vencer',
      valor: resumen.porVencer,
      Icono: Clock,
      tono: 'warning' as const,
      destino: 'alertas' as const,
      seccion: 'Alertas',
    },
    {
      titulo: 'Para comprar',
      valor: resumen.paraComprar,
      Icono: ShoppingCart,
      tono: 'neutro' as const,
      destino: 'compras' as const,
      seccion: 'Compras',
    },
    {
      titulo: 'Alertas',
      valor: resumen.alertas,
      Icono: Bell,
      tono: 'neutro' as const,
      destino: 'alertas' as const,
      seccion: 'Alertas',
    },
  ]

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-text">¡Hola, {primerNombre}!</h1>
        <p className="text-body text-text-muted first-letter:uppercase">
          {hoy}
        </p>
      </header>

      <section
        aria-label="Resumen"
        className="grid grid-cols-2 gap-3 desk:grid-cols-4 desk:gap-6"
      >
        {kpis.map(({ titulo, valor, Icono, tono, destino, seccion }) => (
          <KpiCard
            key={titulo}
            titulo={titulo}
            valor={valor}
            Icono={Icono}
            tono={valor > 0 ? tono : 'neutro'}
            ariaLabel={`${titulo}: ${valor}. Ver ${seccion}`}
            onClick={() => onNavegar(destino)}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2 desk:gap-6">
        <Card
          as="section"
          aria-labelledby="inicio-alertas"
          className="flex flex-col px-5 py-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="inicio-alertas" className="text-h3 text-text">
              Alertas
            </h2>
            <TouchButton
              type="button"
              variant="ghost"
              className="shrink-0 border-none px-2 whitespace-nowrap text-primary-text"
              onClick={() => onNavegar('alertas')}
            >
              Ver todas <ChevronRight size={16} />
            </TouchButton>
          </div>
          {resumen.listaAlertas.length === 0 ? (
            <p className="flex items-center gap-2 py-3 text-sm text-success-text">
              <CircleCheck size={18} /> Todo en orden
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {resumen.listaAlertas.map((alerta) => (
                <FilaAlerta
                  key={`${alerta.lugar?.id ?? ''}-${alerta.tipo}-${alerta.lote?.id ?? alerta.insumo.id}`}
                  alerta={alerta}
                  conLugar={esTodos}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card
          as="section"
          aria-labelledby="inicio-vencimientos"
          className="flex flex-col px-5 py-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="inicio-vencimientos" className="text-h3 text-text">
              Próximos vencimientos
            </h2>
            <TouchButton
              type="button"
              variant="ghost"
              className="shrink-0 border-none px-2 whitespace-nowrap text-primary-text"
              onClick={() => onNavegar('alertas')}
            >
              Ver todos <ChevronRight size={16} />
            </TouchButton>
          </div>
          {resumen.proximosVencimientos.length === 0 ? (
            <p className="py-3 text-sm text-text-muted">
              Sin vencimientos próximos
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {resumen.proximosVencimientos.map(
                ({ insumo, lote, diasRestantes, lugar }) => (
                  <li key={`${lugar?.id ?? ''}-${lote.id}`} className="flex items-center gap-3 py-2.5">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${puntoVencimiento(diasRestantes)}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold text-text">
                        {insumo.nombre}
                      </span>
                      <span className="text-caption text-text-muted">
                        Lote {lote.numeroLote} · {textoDias(diasRestantes)}{' '}
                        {esTodos && lugar && <ChipLugar nombre={lugar.nombre} />}
                      </span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </Card>
      </div>

      {resumen.paraComprar > 0 && (
        <Card className="flex flex-col gap-3 bg-bg-secondary px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 text-text">¿Qué necesitas comprar?</h2>
            <p className="text-body text-text-muted">
              Te{' '}
              {resumen.paraComprar === 1
                ? 'falta 1 producto'
                : `faltan ${resumen.paraComprar} productos`}
              .
            </p>
          </div>
          <TouchButton type="button" onClick={() => onNavegar('compras')}>
            Ver lista de compra
          </TouchButton>
        </Card>
      )}
    </div>
  )
}
