import { useState } from 'react'
import type { Insumo, ItemCompra } from '../../../lib/db'
import { Check, MoreVertical, Trash } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import type { ValorItem } from '../lib/pedido'
import { CasillaSeleccion, ValorDelItem } from './CasillaSeleccion'

export interface ItemManualCardProps {
  item: ItemCompra
  insumoVinculado: Insumo | null
  onRecibir: () => void
  onEliminar: () => void
  /** Spec 022: casilla de selección y, si está marcado, su monto. */
  seleccionado: boolean
  onAlternar: () => void
  etiquetaSeleccion: string
  valor: ValorItem | null
}

/**
 * Tarjeta de un ítem manual (spec 009 FR-015/FR-018). El checkbox llama
 * `onRecibir` — el padre (`ComprasView`) decide si abre `RecibirItemForm`
 * (vinculado) o `VincularOCrearDialog` (sin vincular) según
 * `insumoVinculado`. "Eliminar" no exige confirmación (FR-018 no la exige).
 */
export function ItemManualCard({
  item,
  insumoVinculado,
  onRecibir,
  onEliminar,
  seleccionado,
  onAlternar,
  etiquetaSeleccion,
  valor,
}: ItemManualCardProps) {
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <Card
      className={`flex w-full items-center gap-1 py-1.5 pr-1.5 pl-0 ${seleccionado ? 'border-primary!' : ''}`}
    >
      <CasillaSeleccion
        seleccionado={seleccionado}
        onAlternar={onAlternar}
        etiqueta={etiquetaSeleccion}
      />
      <div className="flex flex-1 flex-col gap-1 py-1">
        <Badge variant="neutral">Manual</Badge>
        <span className="text-sm font-bold text-text">{item.nombre}</span>
        {(item.cantidad !== null || item.nota) && (
          <span className="text-xs text-text-muted">
            {item.cantidad !== null ? item.cantidad : ''}
            {item.cantidad !== null && item.nota ? ' — ' : ''}
            {item.nota ?? ''}
          </span>
        )}
        {insumoVinculado && (
          <span className="text-xs text-text-muted">
            Vinculado a «{insumoVinculado.nombre}»
          </span>
        )}
        {valor && <ValorDelItem valor={valor} />}
      </div>

      <button
        type="button"
        onClick={onRecibir}
        aria-label={`Marcar ${item.nombre} como comprado o recibido`}
        className="touch-target flex shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-muted"
      >
        <Check size={20} />
      </button>

      <button
        type="button"
        onClick={() => setMenuAbierto(true)}
        aria-label={`Más opciones de ${item.nombre}`}
        aria-haspopup="dialog"
        className="touch-target flex shrink-0 items-center justify-center text-text-muted"
      >
        <MoreVertical size={20} />
      </button>

      {menuAbierto && (
        <BottomSheet titulo={item.nombre} onClose={() => setMenuAbierto(false)}>
          <button
            type="button"
            onClick={() => {
              setMenuAbierto(false)
              onEliminar()
            }}
            className="touch-target flex w-full items-center gap-3 rounded-md border border-border bg-danger-bg px-3.5 text-left text-sm font-bold text-danger"
          >
            <Trash size={18} />
            <span className="flex-1">Eliminar</span>
          </button>
        </BottomSheet>
      )}
    </Card>
  )
}
