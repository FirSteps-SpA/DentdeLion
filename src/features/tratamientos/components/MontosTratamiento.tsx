import { formatearCLP } from '../../insumos/lib/precio'
import {
  ETIQUETA_GANANCIA_PROFESIONAL,
  ETIQUETA_NETO,
  NOTA_GANANCIA,
  TEXTO_MOTIVO,
} from '../lib/montos'
import type { MontosTratamiento as Montos } from '../lib/useMontosTratamiento'
import { textoComision, textoCosto, textoGanancia } from '../lib/textos'

/**
 * Spec 016 (UI §4, DS §27) — bloque de montos: precio en el lugar y, como
 * dato principal, la ganancia del profesional (precio × su %); el costo de
 * materiales y el neto tras materiales van aparte, como dato adicional (FR-010).
 */
export function MontosTratamiento({ montos }: { montos: Montos }) {
  const { ganancia } = montos.ganancia
  const negativa = ganancia !== null && ganancia < 0
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm text-text">
      <dt>Precio en este lugar</dt>
      <dd className="text-right">
        {montos.precio === null ? TEXTO_MOTIVO['sin-precio'] : formatearCLP(montos.precio)}
      </dd>
      <dt className="font-bold">
        {ETIQUETA_GANANCIA_PROFESIONAL}
        {montos.porcentaje !== null && ` (${montos.porcentaje} %)`}
      </dt>
      <dd className="text-right text-base font-bold">{textoComision(montos)}</dd>
      <dt className="mt-2 text-text-muted">Costo de materiales</dt>
      <dd className="mt-2 text-right text-text-muted">{textoCosto(montos)}</dd>
      <dt className="text-text-muted">{ETIQUETA_NETO}</dt>
      <dd className={`text-right ${negativa ? 'text-danger' : 'text-text-muted'}`}>
        {textoGanancia(montos)}
      </dd>
      <dd className="col-span-2 text-xs text-text-muted">
        {NOTA_GANANCIA}
        {!montos.costo.completo && ' · No incluye materiales sin precio.'}
      </dd>
    </dl>
  )
}
