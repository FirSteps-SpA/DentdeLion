import { formatearCLP } from '../../insumos/lib/precio'
import { ETIQUETA_GANANCIA, NOTA_GANANCIA, TEXTO_MOTIVO } from '../lib/montos'
import type { MontosTratamiento as Montos } from '../lib/useMontosTratamiento'
import { textoCosto, textoGanancia } from '../lib/textos'

/**
 * Spec 016 (UI §4, DS §27) — bloque de montos: precio en el lugar, comisión
 * profesional, costo de materiales y "Ganancia estimada" con su nota (FR-010).
 */
export function MontosTratamiento({ montos }: { montos: Montos }) {
  const { ganancia, comision } = montos.ganancia
  const negativa = ganancia !== null && ganancia < 0
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm text-text">
      <dt>Precio en este lugar</dt>
      <dd className="text-right font-bold">
        {montos.precio === null ? TEXTO_MOTIVO['sin-precio'] : formatearCLP(montos.precio)}
      </dd>
      <dt>
        Comisión profesional
        {montos.porcentaje !== null && ` (${montos.porcentaje} %)`}
      </dt>
      <dd className="text-right">{comision === null ? '—' : formatearCLP(comision)}</dd>
      <dt>Costo de materiales</dt>
      <dd className="text-right">{textoCosto(montos)}</dd>
      <dt className="font-bold">{ETIQUETA_GANANCIA}</dt>
      <dd className={`text-right font-bold ${negativa ? 'text-danger' : ''}`}>
        {textoGanancia(montos)}
      </dd>
      <dd className="col-span-2 text-xs text-text-muted">
        {NOTA_GANANCIA}
        {!montos.costo.completo && ' · No incluye materiales sin precio.'}
      </dd>
    </dl>
  )
}
