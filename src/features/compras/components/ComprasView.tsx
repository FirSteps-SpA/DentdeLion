import { useState } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { computeItemsSugeridos } from '../lib/sugeridos'
import { insumoVinculado, eliminarItemManual } from '../lib/itemsManuales'
import {
  construirTextoCompartir,
  copiarAlPortapapeles,
  puedeCompartir,
} from '../lib/compartir'
import { computeStockLote } from '../../insumos/lib/stock'
import { ItemSugeridoCard } from './ItemSugeridoCard'
import { ItemManualCard } from './ItemManualCard'
import { RecibirItemForm } from './RecibirItemForm'
import { AgregarItemManualForm } from './AgregarItemManualForm'
import { VincularOCrearDialog } from './VincularOCrearDialog'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Plus, Share, Copy } from '../../../components/icons'

type Overlay =
  | { tipo: 'recibir'; insumoId: string }
  | { tipo: 'recibirManual'; itemId: string }
  | { tipo: 'vincularOCrear'; itemId: string }
  | { tipo: 'agregarManual' }
  | null

/**
 * Vista principal de "Compras" (spec 009, reemplaza `ComprasPlaceholder`).
 * Dos secciones recalculadas en vivo desde `inventoryStore`: "Sugeridos por
 * el Sistema" (stock bajo o lote caducado con stock, FR-004/FR-005) y
 * "Agregados Manualmente" (`itemsCompra` pendientes, FR-015). Marcar un
 * sugerido, o un manual ya vinculado, como recibido abre `RecibirItemForm`
 * (spec 009 US2); un manual sin vincular abre `VincularOCrearDialog`
 * (FR-012).
 */
export function ComprasView() {
  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const itemsCompra = useInventoryStore((s) => s.itemsCompra)

  const [overlay, setOverlay] = useState<Overlay>(null)
  const [mensajeCompartir, setMensajeCompartir] = useState<string | null>(null)

  const sugeridos = computeItemsSugeridos(insumos, lotes, movimientos)
  const manuales = itemsCompra.filter((item) => item.estado === 'pendiente')
  const hayPendientes = sugeridos.length > 0 || manuales.length > 0

  // Derivado, no un efecto (mismo patrón que InventarioView): si el insumo
  // deja de existir/activo mientras el overlay está abierto, simplemente
  // deja de renderizarse.
  const insumoOverlay =
    overlay?.tipo === 'recibir'
      ? (insumos.find((insumo) => insumo.id === overlay.insumoId) ?? null)
      : null
  const itemManualOverlay =
    overlay?.tipo === 'recibirManual' || overlay?.tipo === 'vincularOCrear'
      ? (manuales.find((item) => item.id === overlay.itemId) ?? null)
      : null
  const insumoDelItemManualOverlay =
    overlay?.tipo === 'recibirManual' && itemManualOverlay
      ? insumoVinculado(itemManualOverlay, insumos)
      : null

  function stockTotalDe(insumoId: string): number {
    return lotes
      .filter((lote) => lote.insumoId === insumoId)
      .reduce(
        (total, lote) =>
          total +
          computeStockLote(
            movimientos.filter((movimiento) => movimiento.loteId === lote.id),
          ),
        0,
      )
  }

  function handleRecibirManual(item: (typeof manuales)[number]) {
    const vinculado = insumoVinculado(item, insumos)
    setOverlay(
      vinculado
        ? { tipo: 'recibirManual', itemId: item.id }
        : { tipo: 'vincularOCrear', itemId: item.id },
    )
  }

  async function handleCompartir() {
    setMensajeCompartir(null)
    const texto = construirTextoCompartir(sugeridos, manuales)
    if (puedeCompartir()) {
      await navigator.share({ text: texto })
      return
    }
    setMensajeCompartir(
      'Este dispositivo no ofrece un mecanismo de compartir. Copia la lista en su lugar.',
    )
  }

  async function handleCopiar() {
    const texto = construirTextoCompartir(sugeridos, manuales)
    const copiado = await copiarAlPortapapeles(texto)
    setMensajeCompartir(
      copiado ? 'Lista copiada al portapapeles.' : 'No se pudo copiar la lista.',
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h2 text-text">Compras</h1>
        <TouchButton
          type="button"
          variant="secondary"
          disabled={!hayPendientes}
          onClick={() => void handleCompartir()}
          className="px-3 text-xs"
        >
          <Share size={16} />
          Compartir Lista
        </TouchButton>
      </div>

      {mensajeCompartir && (
        <Card className="flex flex-col gap-2 px-3.5 py-2.5">
          <p role="status" className="text-sm text-text">
            {mensajeCompartir}
          </p>
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => void handleCopiar()}
            className="self-start px-3 text-xs"
          >
            <Copy size={16} />
            Copiar
          </TouchButton>
        </Card>
      )}

      {/* Spec 013 FR-011: sugeridos y manuales lado a lado en desktop. */}
      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2 desk:items-start desk:gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">
          Sugeridos por el Sistema
        </h2>
        {sugeridos.length === 0 ? (
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <p className="text-sm text-text-muted">
              No hay materiales sugeridos por ahora.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {sugeridos.map((item) => (
              <li key={item.insumo.id}>
                <ItemSugeridoCard
                  itemSugerido={item}
                  stockTotal={stockTotalDe(item.insumo.id)}
                  onRecibir={(insumoId) => setOverlay({ tipo: 'recibir', insumoId })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">
            Agregados Manualmente
          </h2>
          <TouchButton
            type="button"
            variant="secondary"
            onClick={() => setOverlay({ tipo: 'agregarManual' })}
            className="px-3 text-xs"
          >
            <Plus size={16} />
            Añadir Ítem Manual
          </TouchButton>
        </div>
        {manuales.length === 0 ? (
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <p className="text-sm text-text-muted">Aún no agregaste ítems.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {manuales.map((item) => (
              <li key={item.id}>
                <ItemManualCard
                  item={item}
                  insumoVinculado={insumoVinculado(item, insumos)}
                  onRecibir={() => handleRecibirManual(item)}
                  onEliminar={() => void eliminarItemManual(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      {overlay?.tipo === 'recibir' && insumoOverlay && (
        <RecibirItemForm
          insumo={insumoOverlay}
          itemCompraId={null}
          onRecibido={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}

      {overlay?.tipo === 'recibirManual' && itemManualOverlay && insumoDelItemManualOverlay && (
        <RecibirItemForm
          insumo={insumoDelItemManualOverlay}
          itemCompraId={itemManualOverlay.id}
          onRecibido={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}

      {overlay?.tipo === 'vincularOCrear' && itemManualOverlay && (
        <VincularOCrearDialog
          item={itemManualOverlay}
          onDone={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}

      {overlay?.tipo === 'agregarManual' && (
        <AgregarItemManualForm
          insumosActivos={insumos}
          onAgregado={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
