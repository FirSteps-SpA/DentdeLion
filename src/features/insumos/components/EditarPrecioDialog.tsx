import { useState } from 'react'
import type { Insumo, Lote } from '../../../lib/db'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useAuthStore } from '../../../stores/authStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { compararCambios } from '../lib/proyeccion'
import {
  corregirPrecioLote,
  formatearCLP,
  precioPorUnidadCompra,
  precioVigenteLote,
  validarPrecio,
  type PrecioIngreso,
} from '../lib/precio'
import { PrecioIngresoField } from './PrecioIngresoField'

export interface EditarPrecioDialogProps {
  insumo: Insumo
  lote: Lote
  onClose: () => void
}

/** Presentación con la que se ingresó el lote (snapshot, R5). */
function presentacionDelLote(insumo: Insumo, lote: Lote) {
  const unidadCompra =
    lote.unidadIngresada && lote.unidadIngresada !== lote.unidadConsumo
      ? lote.unidadIngresada
      : lote.contenido === 1
        ? lote.unidadConsumo
        : insumo.unidadCompra
  const presentaciones =
    lote.cantidadIngresada === null
      ? 1
      : lote.unidadIngresada === unidadCompra
        ? lote.cantidadIngresada
        : lote.cantidadIngresada / (lote.contenido > 0 ? lote.contenido : 1)
  return {
    presentacion: { unidadMedida: lote.unidadConsumo, unidadCompra, contenido: lote.contenido },
    presentaciones,
  }
}

/**
 * Spec 015 US5 (contracts/ui-contracts.md §4, FR-015): agrega o corrige el
 * precio de un lote, por unidad de compra o total, o lo deja sin precio. Lo
 * puede hacer cualquier persona del equipo (Q3) y cada cambio queda en el
 * historial del lote. Controles ≥ 48 px (Constitución III).
 */
export function EditarPrecioDialog({ insumo, lote, onClose }: EditarPrecioDialogProps) {
  const cambiosLote = useInventoryStore((s) => s.cambiosLote)
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const vigente = precioVigenteLote(lote, cambiosLote)
  const { presentacion, presentaciones } = presentacionDelLote(insumo, lote)
  const [precio, setPrecio] = useState<PrecioIngreso>(
    vigente === null ? null : { modo: 'unidad', valor: vigente },
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
  const autor = (id: string) =>
    id === usuario?.id
      ? usuario.nombre
      : (conocidos.find((c) => c.id === id)?.nombre ?? 'otra persona')
  const historial = cambiosLote
    .filter((cambio) => cambio.loteId === lote.id)
    .sort(compararCambios)
    .reverse()
  const monto = (valor: number | null) => (valor === null ? 'sin precio' : formatearCLP(valor))

  async function guardar(nuevo: number | null) {
    setIsPending(true)
    setError(null)
    try {
      await corregirPrecioLote(lote.id, nuevo)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el precio.')
    } finally {
      setIsPending(false)
    }
  }

  function confirmar() {
    const errorPrecio = validarPrecio(precio)
    if (errorPrecio) {
      setError(errorPrecio)
      return
    }
    void guardar(precioPorUnidadCompra(precio, presentaciones))
  }

  return (
    <BottomSheet titulo={`Precio del lote ${lote.numeroLote}`} onClose={onClose}>
      <p className="text-sm text-text">
        Precio actual: <span className="font-bold">{monto(vigente)}</span>
      </p>
      <PrecioIngresoField
        id="editar-precio-lote"
        presentacion={presentacion}
        presentaciones={presentaciones}
        precio={precio}
        onChange={setPrecio}
        error={error ?? undefined}
      />
      <div className="flex flex-col gap-2">
        <TouchButton type="button" onClick={confirmar} disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar precio'}
        </TouchButton>
        {vigente !== null && (
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => void guardar(null)}
            disabled={isPending}
          >
            Dejar sin precio
          </TouchButton>
        )}
      </div>
      {historial.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-text">Historial de precios</h3>
          <ul className="flex flex-col gap-1 text-xs text-text-muted">
            {historial.map((cambio) => (
              <li key={cambio.id}>
                {monto(cambio.valorAnterior)} → {monto(cambio.valorNuevo)} ·{' '}
                {autor(cambio.usuarioId)} · {fecha.format(new Date(cambio.creadoEn))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </BottomSheet>
  )
}
