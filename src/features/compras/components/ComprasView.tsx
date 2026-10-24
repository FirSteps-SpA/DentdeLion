import { useEffect, useMemo, useRef, useState } from 'react'
import { computeItemsSugeridos } from '../lib/sugeridos'
import { insumoVinculado, eliminarItemManual } from '../lib/itemsManuales'
import { copiarAlPortapapeles, puedeCompartir } from '../lib/compartir'
import {
  claveManual,
  claveSugerido,
  construirMensajePedido,
  itemsDelPedido,
  resumirSeleccion,
  valorItem,
  type ItemPedido,
} from '../lib/pedido'
import { useSeleccionCompras } from '../lib/useSeleccionCompras'
import { costosUnitariosPorInsumo } from '../../insumos/lib/precio'
import { computeStockLote } from '../../insumos/lib/stock'
import { ItemSugeridoCard } from './ItemSugeridoCard'
import { ItemManualCard } from './ItemManualCard'
import { ResumenSeleccion } from './ResumenSeleccion'
import { EnviarPedidoSheet } from './EnviarPedidoSheet'
import { RecibirItemForm } from './RecibirItemForm'
import { AgregarItemManualForm } from './AgregarItemManualForm'
import { VincularOCrearDialog } from './VincularOCrearDialog'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Plus } from '../../../components/icons'
import { porLugar, useVistasDeLugar, vistasDeLugar } from '../../insumos/lib/vistaLugar'
import { ChipLugar } from '../../../app/ChipLugar'
import { ElegirLugarSheet } from '../../../app/ElegirLugarSheet'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { mapaMarcas } from '../../marcas/lib/marcas'
import { useAlertasStore } from '../../../stores/alertasStore'
import { usePredeterminado } from '../../proveedores/lib/usePredeterminado'

// Spec 014: cada acción lleva el lugar donde se registra (el de la fila, o el
// elegido en "¿En qué lugar?" desde "Todos").
type Overlay =
  | { tipo: 'recibir'; insumoId: string; lugarId?: string; cantidadSugerida?: number }
  | { tipo: 'recibirManual'; itemId: string }
  | { tipo: 'vincularOCrear'; itemId: string }
  | { tipo: 'elegirLugarManual' }
  | { tipo: 'agregarManual'; lugarId?: string }
  | { tipo: 'enviarWhatsApp' }
  | null

/**
 * Vista principal de "Compras" (spec 009, reemplaza `ComprasPlaceholder`).
 * Dos secciones recalculadas en vivo desde `inventoryStore`: "Sugeridos por
 * el Sistema" (stock bajo o lote caducado con stock, FR-004/FR-005) y
 * "Agregados Manualmente" (`itemsCompra` pendientes, FR-015). Marcar un
 * sugerido, o un manual ya vinculado, como recibido abre `RecibirItemForm`
 * (spec 009 US2); un manual sin vincular abre `VincularOCrearDialog`
 * (FR-012).
 *
 * Spec 022: cada ítem se puede marcar; la barra del pie suma lo marcado y
 * arma el pedido (WhatsApp, Copiar, Compartir) solo con eso.
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

  // Spec 022 (research.md R2, R3): renglones con su clave, la selección
  // guardada en el dispositivo y el precio de la última compra de cada insumo.
  const todosLosInsumos = useInventoryStore((s) => s.insumos)
  const lotesTenant = useInventoryStore((s) => s.lotes)
  const marcas = useInventoryStore((s) => s.marcas)
  const movimientosTenant = useInventoryStore((s) => s.movimientos)
  const itemsCompraTenant = useInventoryStore((s) => s.itemsCompra)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  const cambiosLote = useInventoryStore((s) => s.cambiosLote)
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  const inventarioListo = useInventoryStore((s) => s.isReady)
  const proveedores = useInventoryStore((s) => s.proveedores)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const saludo = useAlertasStore((s) => s.saludoPedido)

  const costos = useMemo(
    () => costosUnitariosPorInsumo(todosLosInsumos, lotesTenant, cambiosLote, cambiosInsumo),
    [todosLosInsumos, lotesTenant, cambiosLote, cambiosInsumo],
  )

  const items: ItemPedido[] = itemsDelPedido(
    sugeridos.map((item) => ({ item, lugarId: item.lugar?.id ?? '' })),
    manuales,
    insumos,
  )
  const itemPorClave = new Map(items.map((item) => [item.clave, item]))

  // Lo pendiente en **todos** los lugares, para podar la selección sin perder
  // lo marcado en otro lugar al cambiar de vista. `null` mientras carga.
  const clavesPendientes = useMemo(() => {
    if (!inventarioListo || !lugarActivoId) return null
    const todas = vistasDeLugar(
      {
        insumos: todosLosInsumos,
        lotes: lotesTenant,
        movimientos: movimientosTenant,
        itemsCompra: itemsCompraTenant,
      },
      minimosLugar,
      lugares,
      'todos',
    ).vistas
    const pendientes = itemsDelPedido(
      porLugar(todas, (d) => computeItemsSugeridos(d.insumos, d.lotes, d.movimientos)).map(
        (item) => ({ item, lugarId: item.lugar?.id ?? '' }),
      ),
      itemsCompraTenant.filter((item) => item.estado === 'pendiente'),
      todosLosInsumos,
    )
    return new Set(pendientes.map((item) => item.clave))
  }, [
    inventarioListo,
    lugarActivoId,
    todosLosInsumos,
    lotesTenant,
    movimientosTenant,
    itemsCompraTenant,
    minimosLugar,
    lugares,
  ])

  const { seleccion, alternar, marcarTodos } = useSeleccionCompras(clavesPendientes)
  const seleccionados = items.filter((item) => seleccion.has(item.clave))
  const resumen = resumirSeleccion(items, seleccion, costos)
  const clavesVisibles = items.map((item) => item.clave)
  const todosMarcados = items.length > 0 && seleccionados.length === items.length
  const algunosMarcados = seleccionados.length > 0 && !todosMarcados

  const seleccionarTodoRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (seleccionarTodoRef.current) seleccionarTodoRef.current.indeterminate = algunosMarcados
  }, [algunosMarcados])

  const mensajePedido = construirMensajePedido(
    saludo,
    seleccionados,
    esTodos ? new Map(lugares.map((lugar) => [lugar.id, lugar.nombre])) : undefined,
    mapaMarcas(marcas),
  )

  // FR-013: el predeterminado del lugar del pedido. En "Todos", solo si todo
  // lo marcado es de un mismo lugar.
  const lugaresDelPedido = new Set(seleccionados.map((item) => item.lugarId))
  const predeterminadoId = usePredeterminado(
    lugaresDelPedido.size === 1 ? [...lugaresDelPedido][0] || undefined : undefined,
  )

  function claveDe(item: (typeof sugeridos)[number]): string {
    return claveSugerido(item.lugar?.id ?? '', item.insumo.id)
  }

  function etiquetaSeleccion(nombre: string, lugarId: string): string {
    return esTodos ? `Seleccionar ${nombre} en ${nombreLugar(lugares, lugarId)}` : `Seleccionar ${nombre}`
  }

  function valorDe(clave: string) {
    const item = itemPorClave.get(clave)
    return item && seleccion.has(clave) ? valorItem(item, costos) : null
  }

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

  // Spec 022 FR-012/FR-018/FR-019: el mismo mensaje que va por WhatsApp.
  async function handleCompartir() {
    setMensajeCompartir(null)
    if (puedeCompartir()) {
      await navigator.share({ text: mensajePedido })
      return
    }
    setMensajeCompartir(
      'Este dispositivo no ofrece un mecanismo de compartir. Copia la lista en su lugar.',
    )
  }

  async function handleCopiar() {
    const copiado = await copiarAlPortapapeles(mensajePedido)
    setMensajeCompartir(
      copiado ? 'Lista copiada al portapapeles.' : 'No se pudo copiar la lista.',
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h2 text-text">Compras</h1>
        {items.length > 0 && (
          // FR-002: sobre los ítems visibles; "mixed" con algunos marcados.
          <label className="touch-target flex cursor-pointer items-center gap-2 px-2 text-sm font-bold text-text">
            <input
              ref={seleccionarTodoRef}
              type="checkbox"
              checked={todosMarcados}
              onChange={() => marcarTodos(clavesVisibles)}
              className="h-5 w-5 cursor-pointer accent-primary"
            />
            Seleccionar todo
          </label>
        )}
      </div>

      {mensajeCompartir && (
        <Card className="flex flex-col gap-2 px-3.5 py-2.5">
          <p role="status" className="text-sm text-text">
            {mensajeCompartir}
          </p>
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
                  seleccionado={seleccion.has(claveDe(item))}
                  onAlternar={() => alternar(claveDe(item))}
                  etiquetaSeleccion={etiquetaSeleccion(item.insumo.nombre, item.lugar?.id ?? '')}
                  valor={valorDe(claveDe(item))}
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
                  seleccionado={seleccion.has(claveManual(item.id))}
                  onAlternar={() => alternar(claveManual(item.id))}
                  etiquetaSeleccion={etiquetaSeleccion(item.nombre, item.lugarId)}
                  valor={valorDe(claveManual(item.id))}
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

      <ResumenSeleccion
        resumen={resumen}
        onEnviarWhatsApp={() => setOverlay({ tipo: 'enviarWhatsApp' })}
        onCopiar={() => void handleCopiar()}
        onCompartir={() => void handleCompartir()}
        puedeCompartir={puedeCompartir()}
      />

      {overlay?.tipo === 'enviarWhatsApp' && (
        <EnviarPedidoSheet
          mensaje={mensajePedido}
          proveedores={proveedores}
          predeterminadoId={predeterminadoId}
          onCopiar={() => {
            setOverlay(null)
            void handleCopiar()
          }}
          onClose={() => setOverlay(null)}
        />
      )}

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
