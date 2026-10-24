import { useCallback, useState } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { useAlertasStore } from '../../../stores/alertasStore'
import { computeInsumosStockBajo } from '../lib/stockBajo'
import { computeAlertasCaducidad } from '../lib/caducidad'
import { lotesEnRevision, marcarLoteResuelto } from '../lib/revision'
import { AlertTriangle, CircleAlert, Clock } from '../../../components/icons'
import { Badge, type BadgeVariant } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { porLugar, useVistasDeLugar } from '../../insumos/lib/vistaLugar'
import { ChipLugar } from '../../../app/ChipLugar'
import { etiquetaStockBajo } from '../lib/etiquetaStock'
import { formatearFechaCaducidad, textoTiempoCaducidad } from '../lib/textoCaducidad'
import { RenglonAlerta } from './RenglonAlerta'
import { DetalleDesdeAlerta, type DetalleAbierto } from './DetalleDesdeAlerta'

function badgeVariantParaNivel(nivel: number | 'caducado'): BadgeVariant {
  if (nivel === 'caducado') return 'danger'
  if (nivel === 30) return 'warning-30'
  if (nivel === 7) return 'urgent-7'
  return 'urgent-1'
}

/**
 * Dedicated alerts screen (FR-013): consolidates stock-bajo, caducidad, and
 * revisión-manual alerts in one place. Spec 013: cada alerta en una tarjeta
 * blanca con ícono y badge de su estado (DS §21) — los niveles se distinguen
 * por color, ícono y etiqueta, nunca solo por el fondo (Constitución IV). Visible to every authenticated user.
 * The stock-mínimo/niveles-de-aviso configuration controls that used to live
 * here moved to "Ajustes" ▸ Configuración de Alertas (spec 010 FR-006/007/
 * 008) — this view is now dedicated exclusively to displaying alerts.
 */
export function AlertasView() {
  const usuario = useAuthStore((s) => s.usuario)
  const esAdministrador = usuario?.rol === 'administrador'

  // Spec 014: alertas del lugar activo; en "Todos", las de cada lugar, con su chip.
  const { vistas, esTodos } = useVistasDeLugar()
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)

  const [errorRevision, setErrorRevision] = useState<string | null>(null)
  // Spec 018 FR-009: el detalle del insumo se abre encima de Alertas.
  const [detalle, setDetalle] = useState<DetalleAbierto | null>(null)
  const cerrarDetalle = useCallback(() => setDetalle(null), [])
  const abrir = (insumoId: string, lugar: { id: string } | null) => () =>
    setDetalle({ insumoId, lugarId: lugar?.id ?? null })

  const alertasStockBajo = porLugar(vistas, (d) =>
    computeInsumosStockBajo(d.insumos, d.lotes, d.movimientos),
  )
  const alertasCaducidad = porLugar(vistas, (d) =>
    computeAlertasCaducidad(d.insumos, d.lotes, d.movimientos, nivelesAvisoDias),
  )
  const alertasRevision = porLugar(vistas, (d) =>
    lotesEnRevision(d.insumos, d.lotes, d.movimientos),
  )
  const chip = (lugar: { nombre: string } | null) =>
    esTodos && lugar ? <ChipLugar nombre={lugar.nombre} /> : null

  async function handleMarcarResuelto(loteId: string) {
    setErrorRevision(null)
    try {
      await marcarLoteResuelto(loteId)
    } catch (err) {
      setErrorRevision(
        err instanceof Error ? err.message : 'No se pudo marcar como resuelto.',
      )
    }
  }

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      {/* Spec 013 FR-011: stock bajo y caducidad lado a lado en desktop. */}
      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2 desk:items-start desk:gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-h3 text-text">Stock bajo</h2>
        {alertasStockBajo.length === 0 ? (
          <Card className="px-3.5 py-2.5">
            <p className="text-sm text-text-muted">
              Ningún insumo está por debajo de su stock mínimo.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {alertasStockBajo.map(({ insumo, stockActual, lugar }) => {
              // Spec 018 FR-011: "Sin stock" si no queda nada.
              const etiqueta = etiquetaStockBajo(stockActual)
              return (
                <li key={`${lugar?.id ?? ''}-${insumo.id}`}>
                  <RenglonAlerta
                    variante="tarjeta"
                    onAbrir={abrir(insumo.id, lugar)}
                    icono={
                      <etiqueta.icono
                        size={18}
                        className={`shrink-0 ${stockActual <= 0 ? 'text-danger' : 'text-warning-icon'}`}
                      />
                    }
                    titulo={insumo.nombre}
                    detalle={
                      <>
                        {stockActual} {insumo.unidadMedida} disponibles (mínimo{' '}
                        {insumo.stockMinimo} {insumo.unidadMedida}) {chip(lugar)}
                      </>
                    }
                    badge={
                      <Badge variant={etiqueta.variante} icono={etiqueta.icono}>
                        {etiqueta.texto}
                      </Badge>
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3 text-text">Próximos a caducar</h2>
        {alertasCaducidad.length === 0 ? (
          <Card className="px-3.5 py-2.5">
            <p className="text-sm text-text-muted">
              Ningún lote está próximo a caducar ni caducado.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {alertasCaducidad.map(({ lote, insumo, diasRestantes, nivel, lugar }) => (
              <li key={`${lugar?.id ?? ''}-${lote.id}`}>
                {/* Spec 018 FR-006–FR-008: nombre, fecha y tiempo; el lote, en el detalle. */}
                <RenglonAlerta
                  variante="tarjeta"
                  onAbrir={abrir(insumo.id, lugar)}
                  icono={
                    nivel === 'caducado' ? (
                      <CircleAlert size={18} className="shrink-0 text-danger" />
                    ) : (
                      <Clock size={18} className="shrink-0 text-warning-icon" />
                    )
                  }
                  titulo={insumo.nombre}
                  detalle={
                    <>
                      {formatearFechaCaducidad(lote.fechaCaducidad ?? '')} ·{' '}
                      {textoTiempoCaducidad(diasRestantes)} {chip(lugar)}
                    </>
                  }
                  badge={
                    <Badge
                      variant={badgeVariantParaNivel(nivel)}
                      icono={nivel === 'caducado' ? CircleAlert : Clock}
                    >
                      {nivel === 'caducado'
                        ? 'Caducado'
                        : `${nivel} ${nivel === 1 ? 'día' : 'días'}`}
                    </Badge>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3 text-text">Lotes en revisión</h2>
        {errorRevision && (
          <Card className="bg-danger-bg px-3.5 py-2.5">
            <p role="alert" className="text-sm text-danger">
              {errorRevision}
            </p>
          </Card>
        )}
        {alertasRevision.length === 0 ? (
          <Card className="px-3.5 py-2.5">
            <p className="text-sm text-text-muted">
              Ningún lote está marcado para revisión manual.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {alertasRevision.map(({ lote, insumo, stockDerivado, lugar }) => (
              <li key={`${lugar?.id ?? ''}-${lote.id}`}>
                <Card className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                  <span className="flex items-start gap-2 text-sm text-text">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
                    <span>
                      <span className="font-bold">{insumo.nombre}</span> — lote{' '}
                      {lote.numeroLote}: stock {stockDerivado} {insumo.unidadMedida}{' '}
                      {chip(lugar)}
                    </span>
                  </span>
                  {esAdministrador && (
                    <TouchButton
                      type="button"
                      variant="ghost"
                      onClick={() => void handleMarcarResuelto(lote.id)}
                      className="text-sm"
                    >
                      Marcar como resuelto
                    </TouchButton>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detalle && (
        <DetalleDesdeAlerta abierto={detalle} vistas={vistas} onClose={cerrarDetalle} />
      )}
    </div>
  )
}
