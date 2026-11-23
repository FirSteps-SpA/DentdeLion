import { useCallback, useState } from 'react'
import type { Vista } from '../../../app/navegacion'
import {
  Bell,
  Calendar,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Package,
  ShoppingCart,
  Wallet,
} from '../../../components/icons'
import { EncabezadoVista } from '../../../components/ui/EncabezadoVista'
import { EncabezadoSeccion } from '../../../components/ui/EncabezadoSeccion'
import { EstadoVacio } from '../../../components/ui/EstadoVacio'
import { Badge } from '../../../components/ui/Badge'
import { Card, KpiCard } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useAlertasStore } from '../../../stores/alertasStore'
import { useAuthStore } from '../../../stores/authStore'
import { resumenInicioPorLugares, type AlertaInicio } from '../lib/resumenInicio'
import { useVistasDeLugar } from '../../insumos/lib/vistaLugar'
import { ChipLugar } from '../../../app/ChipLugar'
import { useValorInventario } from '../../reportes/useReportes'
import { formatearMonto, textoVariacion } from '../../reportes/lib/formato'
import type { ValorInventario } from '../../reportes/lib/valorInventario'
import { etiquetaStockBajo } from '../../alertas/lib/etiquetaStock'
import { formatearFechaCaducidad, textoTiempoCaducidad } from '../../alertas/lib/textoCaducidad'
import { RenglonAlerta } from '../../alertas/components/RenglonAlerta'
import {
  DetalleDesdeAlerta,
  type DetalleAbierto,
} from '../../alertas/components/DetalleDesdeAlerta'

export interface InicioViewProps {
  onNavegar: (vista: Vista) => void
}

const fecha = new Intl.DateTimeFormat('es-CL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** Spec 018 FR-006/FR-007: fecha legible y tiempo restante, sin lote. */
function textoVencimiento(fechaCaducidad: string | null | undefined, dias: number): string {
  return `${formatearFechaCaducidad(fechaCaducidad ?? '')} · ${textoTiempoCaducidad(dias)}`
}

function FilaAlerta({
  alerta,
  conLugar,
  onAbrir,
}: {
  alerta: AlertaInicio
  conLugar: boolean
  onAbrir: () => void
}) {
  const { insumo, tipo, lote, diasRestantes, stockActual, lugar } = alerta
  const chip = conLugar && lugar ? <ChipLugar nombre={lugar.nombre} /> : null
  if (tipo === 'stock-bajo') {
    // Spec 018 FR-012: la misma etiqueta que en Alertas ("Sin stock" / "Bajo mínimo").
    const etiqueta = etiquetaStockBajo(stockActual ?? 0)
    return (
      <li>
        <RenglonAlerta
          variante="lista"
          onAbrir={onAbrir}
          icono={
            <etiqueta.icono
              size={18}
              className={`shrink-0 ${etiqueta.variante === 'danger' ? 'text-danger' : 'text-warning-icon'}`}
            />
          }
          titulo={insumo.nombre}
          detalle={
            <>
              Stock: {stockActual} (mínimo {insumo.stockMinimo}) {chip}
            </>
          }
          badge={<Badge variant={etiqueta.variante}>{etiqueta.texto}</Badge>}
        />
      </li>
    )
  }
  const caducado = tipo === 'caducado'
  return (
    <li>
      <RenglonAlerta
        variante="lista"
        onAbrir={onAbrir}
        icono={
          caducado ? (
            <CircleAlert size={18} className="shrink-0 text-danger" />
          ) : (
            <Clock size={18} className="shrink-0 text-warning-icon" />
          )
        }
        titulo={insumo.nombre}
        detalle={
          <>
            {textoVencimiento(lote?.fechaCaducidad, diasRestantes ?? 0)} {chip}
          </>
        }
        badge={
          <Badge variant={caducado ? 'danger' : 'urgent-7'}>
            {caducado ? 'Caducado' : 'Por vencer'}
          </Badge>
        }
      />
    </li>
  )
}

function puntoVencimiento(dias: number): string {
  if (dias <= 30) return 'bg-warning-icon'
  return 'bg-brand-icon'
}

/** Spec 027 (FR-009): "Ver todas →" de las tarjetas de sección. */
function VerTodas({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <TouchButton
      type="button"
      variant="ghost"
      className="shrink-0 border-none px-2 whitespace-nowrap text-primary-text"
      onClick={onClick}
    >
      {texto} <ChevronRight size={16} />
    </TouchButton>
  )
}

/**
 * Inicio (spec 013 US3, DS §17/§20/§41.3): saludo, 4 KPIs y las listas de
 * alertas y próximos vencimientos, calculados con `resumenInicio` sobre los
 * datos locales. Cada tarjeta y enlace solo lleva a la sección donde se
 * resuelve el tema — Inicio no agrega acciones ni datos (FR-024/FR-026). La
 * spec 018 (FR-009) solo suma abrir el detalle del insumo desde una alerta o
 * un vencimiento, de solo lectura.
 *
 * Spec 027 (US2, FR-006..FR-010): encabezado con el diente y destellos,
 * KPI con tinte, ícono de fondo y "Ver detalle", "Valor de inventario"
 * destacada, secciones con ícono, vencimientos en línea de tiempo y sin la
 * tarjeta "¿Qué necesitas comprar?".
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

  const valorInventario = useValorInventario()

  const [detalle, setDetalle] = useState<DetalleAbierto | null>(null)
  const cerrarDetalle = useCallback(() => setDetalle(null), [])
  const abrir = (insumoId: string, lugar: { id: string } | null | undefined) => () =>
    setDetalle({ insumoId, lugarId: lugar?.id ?? null })

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
      <EncabezadoVista
        titulo={`¡Hola, ${primerNombre}!`}
        subtitulo={<span className="inline-block first-letter:uppercase">{hoy}</span>}
        ilustracion="diente"
        ayuda="inicio"
      />

      <section
        aria-label="Resumen"
        className="grid grid-cols-2 gap-3 desk:grid-cols-5 desk:gap-6"
      >
        {valorInventario && (
          <div className="col-span-2 grid desk:col-span-1">
            <TarjetaValorInventario
              valor={valorInventario}
              onClick={() => onNavegar('reportes')}
            />
          </div>
        )}
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
          className="flex flex-col gap-2 px-5 py-4"
        >
          <EncabezadoSeccion
            Icono={Bell}
            titulo="Alertas"
            id="inicio-alertas"
            accion={<VerTodas texto="Ver todas" onClick={() => onNavegar('alertas')} />}
          />
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
                  onAbrir={abrir(alerta.insumo.id, alerta.lugar)}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card
          as="section"
          aria-labelledby="inicio-vencimientos"
          className="flex flex-col gap-2 px-5 py-4"
        >
          <EncabezadoSeccion
            Icono={Calendar}
            titulo="Próximos vencimientos"
            id="inicio-vencimientos"
            accion={<VerTodas texto="Ver todos" onClick={() => onNavegar('alertas')} />}
          />
          {resumen.proximosVencimientos.length === 0 ? (
            <EstadoVacio Icono={Calendar} texto="Sin vencimientos próximos" compacto />
          ) : (
            // Línea de tiempo (FR-009): puntos unidos por una línea vertical.
            <ol className="relative flex flex-col">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-6 bottom-6 left-[4.5px] w-px bg-primary-soft"
              />
              {resumen.proximosVencimientos.map(
                ({ insumo, lote, diasRestantes, lugar }) => (
                  <li key={`${lugar?.id ?? ''}-${lote.id}`} className="relative">
                    <RenglonAlerta
                      variante="lista"
                      onAbrir={abrir(insumo.id, lugar)}
                      icono={
                        <span
                          aria-hidden="true"
                          className={`relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface ${puntoVencimiento(diasRestantes)}`}
                        />
                      }
                      titulo={insumo.nombre}
                      detalle={
                        <>
                          {textoVencimiento(lote.fechaCaducidad, diasRestantes)}{' '}
                          {esTodos && lugar && <ChipLugar nombre={lugar.nombre} />}
                        </>
                      }
                    />
                  </li>
                ),
              )}
            </ol>
          )}
        </Card>
      </div>

      {detalle && (
        <DetalleDesdeAlerta abierto={detalle} vistas={vistas} onClose={cerrarDetalle} />
      )}
    </div>
  )
}

/**
 * Spec 017 (US4, FR-015, UI §4) — Valor de inventario (DS §20): Σ stock ×
 * costo de los lotes no caducados del lugar activo, con su variación frente al
 * cierre del mes anterior en tono neutro (subir o bajar no es bueno ni malo
 * por sí mismo). Lleva a Reportes.
 */
function TarjetaValorInventario({
  valor,
  onClick,
}: {
  valor: ValorInventario
  onClick: () => void
}) {
  const sinPrecios = valor.lotesSinPrecio > 0 && valor.valor === 0
  const monto = sinPrecios
    ? 'Sin precios'
    : valor.lotesSinPrecio > 0
      ? `desde ${formatearMonto(valor.valor)}`
      : formatearMonto(valor.valor)
  const nota = sinPrecios
    ? 'Ingresa el precio al recibir compras'
    : valor.lotesSinPrecio > 0
      ? `${valor.lotesSinPrecio} ${valor.lotesSinPrecio === 1 ? 'lote sin precio' : 'lotes sin precio'}`
      : undefined
  const variacion = sinPrecios ? null : textoVariacion(valor.variacion, 'vs. mes anterior')
  return (
    <KpiCard
      titulo="Valor de inventario"
      valor={monto}
      Icono={Wallet}
      variante="destacada"
      variacion={variacion ? { texto: variacion, tono: 'muted' } : undefined}
      nota={nota}
      ariaLabel={[`Valor de inventario: ${monto}`, variacion, nota, 'Ver Reportes']
        .filter(Boolean)
        .join('. ')}
      onClick={onClick}
    />
  )
}
