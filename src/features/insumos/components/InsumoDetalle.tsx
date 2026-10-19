import type { Insumo, Lote, Movimiento } from '../../../lib/db'
import { computeStockLote } from '../lib/stock'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { useAuthStore } from '../../../stores/authStore'
import { X } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'

export interface InsumoDetalleProps {
  insumo: Insumo
  lotes: Lote[]
  movimientos: Movimiento[]
  onClose: () => void
}

/**
 * Vista de detalle de solo lectura (spec 006 FR-010): todos los lotes del
 * insumo, su fecha de vencimiento (o "No caduca") y su stock individual, más
 * el stock total agregado. Sin acciones de consumo/edición/eliminación —
 * llegan en la spec 007 (Assumptions).
 */
export function InsumoDetalle({
  insumo,
  lotes,
  movimientos,
  onClose,
}: InsumoDetalleProps) {
  // Spec 014 US6-3: los traslados del lote, con el lugar del otro lado del par.
  const todosLosMovimientos = useInventoryStore((s) => s.movimientos)
  const lugares = useLugarStore((s) => s.lugares)
  // Autor: los nombres que el dispositivo conoce (spec 012 R7; `perfiles` no
  // deja leer los de otros).
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const autor = (id: string) =>
    id === usuario?.id ? usuario.nombre : conocidos.find((c) => c.id === id)?.nombre
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })
  function trasladosDe(loteId: string) {
    return movimientos
      .filter(
        (m) =>
          m.loteId === loteId &&
          (m.tipo === 'traslado_salida' || m.tipo === 'traslado_entrada'),
      )
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .map((m) => {
        const pareja = todosLosMovimientos.find(
          (otro) => otro.trasladoId === m.trasladoId && otro.id !== m.id,
        )
        const otroLugar = pareja ? nombreLugar(lugares, pareja.lugarId) : 'otro lugar'
        return {
          id: m.id,
          texto:
            m.tipo === 'traslado_salida' ? `Traslado → ${otroLugar}` : `Traslado ← ${otroLugar}`,
          cantidad: m.cantidad,
          creadoEn: m.creadoEn,
          autor: autor(m.usuarioId),
        }
      })
  }

  const lotesConStock = lotes.map((lote) => ({
    lote,
    stock: computeStockLote(
      movimientos.filter((movimiento) => movimiento.loteId === lote.id),
    ),
  }))
  const stockTotal = lotesConStock.reduce((total, { stock }) => total + stock, 0)

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">{insumo.categoria}</span>
          <h3 className="text-h3 text-text">{insumo.nombre}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="touch-target flex items-center justify-center rounded-full text-text-muted"
        >
          <X size={20} />
        </button>
      </div>

      <p className="text-sm font-bold text-text">
        Stock total: {stockTotal} {insumo.unidadMedida}
      </p>

      <ul className="flex flex-col divide-y divide-border">
        {lotesConStock.map(({ lote, stock }) => (
          <li key={lote.id} className="flex flex-col gap-1 py-2 text-sm">
            <span className="flex items-center justify-between gap-2">
              <span className="text-text">
                Lote {lote.numeroLote} —{' '}
                {lote.fechaCaducidad
                  ? `vence ${lote.fechaCaducidad}`
                  : 'No caduca'}
              </span>
              <span className="font-bold text-text-muted">
                {stock} {insumo.unidadMedida}
              </span>
            </span>
            {trasladosDe(lote.id).map((traslado) => (
              <span key={traslado.id} className="text-xs text-text-muted">
                {traslado.texto}: {traslado.cantidad} {insumo.unidadMedida} ·{' '}
                {fecha.format(new Date(traslado.creadoEn))}
                {traslado.autor && ` · ${traslado.autor}`}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <TouchButton type="button" variant="ghost" onClick={onClose}>
        Volver
      </TouchButton>
    </Card>
  )
}
