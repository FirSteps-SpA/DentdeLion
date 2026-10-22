import { useState } from 'react'
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
import { porLugar, useVistasDeLugar } from '../../insumos/lib/vistaLugar'
import { ChipLugar } from '../../../app/ChipLugar'
import { ElegirLugarSheet } from '../../../app/ElegirLugarSheet'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'

// Spec 014: cada acción lleva el lugar donde se registra (el de la fila, o el
// elegido en "¿En qué lugar?" desde "Todos").
type Overlay =
  | { tipo: 'recibir'; insumoId: string; lugarId?: string; cantidadSugerida?: number }
  | { tipo: 'recibirManual'; itemId: string }
  | { tipo: 'vincularOCrear'; itemId: string }
  | { tipo: 'elegirLugarManual' }
  | { tipo: 'agregarManual'; lugarId?: string }
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
  // Spec 014: la lista del lugar activo; en "Todos", la de cada lugar con su chip.
  const { vistas, esTodos } = useVistasDeLugar()
  const lugares = useLugarStore((s) => s.lugares)
  const insumos = vistas[0]?.datos.insumos ?? []

  const [overlay, setOverlay] = useState<Overlay>(null)
  const [mensajeCompartir, setMensajeCompartir] = useState<string | null>(null)

  const sugeridos = porLugar(vistas, (d) =>
    computeItemsSugeridos(d.insumos, d.lotes, d.movimientos),
  )
  const manuales = vistas.flatMap(({ datos }) =>
    datos.itemsCompra.filter((item) => item.estado === 'pendiente'),
  )
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

  /** Stock del insumo en el lugar de la fila (`null` = la única vista). */
  function stockTotalDe(insumoId: string, lugarId: string | null): number {
    const vista = vistas.find((v) => (v.lugar?.id ?? null) === lugarId) ?? vistas[0]
    if (!vista) return 0
    const { lotes, movimientos } = vista.datos
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

  function abrirAgregarManual() {
    setOverlay(esTodos ? { tipo: 'elegirLugarManual' } : { tipo: 'agregarManual' })
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
              <li key={`${item.lugar?.id ?? ''}-${item.insumo.id}`} className="flex flex-col gap-1">
                {esTodos && item.lugar && <ChipLugar nombre={item.lugar.nombre} />}
                <ItemSugeridoCard
                  itemSugerido={item}
                  stockTotal={stockTotalDe(item.insumo.id, item.lugar?.id ?? null)}
                  onRecibir={(insumoId) =>
                    setOverlay({
                      tipo: 'recibir',
                      insumoId,
                      lugarId: item.lugar?.id,
                      cantidadSugerida: item.presentacionesSugeridas ?? undefined,
                    })
                  }
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
            onClick={abrirAgregarManual}
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
              <li key={item.id} className="flex flex-col gap-1">
                {esTodos && <ChipLugar nombre={nombreLugar(lugares, item.lugarId)} />}
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
          lugarId={overlay.lugarId}
          cantidadSugerida={overlay.cantidadSugerida}
          onRecibido={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}

      {overlay?.tipo === 'recibirManual' && itemManualOverlay && insumoDelItemManualOverlay && (
        <RecibirItemForm
          insumo={insumoDelItemManualOverlay}
          itemCompraId={itemManualOverlay.id}
          lugarId={itemManualOverlay.lugarId}
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

      {overlay?.tipo === 'elegirLugarManual' && (
        <ElegirLugarSheet
          onElegir={(lugarId) =>
            setOverlay({ tipo: 'agregarManual', lugarId: lugarId === 'todos' ? undefined : lugarId })
          }
          onClose={() => setOverlay(null)}
        />
      )}

      {overlay?.tipo === 'agregarManual' && (
        <AgregarItemManualForm
          insumosActivos={insumos}
          lugarId={overlay.lugarId}
          onAgregado={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
