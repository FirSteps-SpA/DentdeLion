import { TouchButton } from '../../../components/ui/TouchButton'
import { Copy, MessageCircle, Share } from '../../../components/icons'
import { formatearCLP } from '../../insumos/lib/precio'
import type { ResumenSeleccion as Resumen } from '../lib/pedido'

export interface ResumenSeleccionProps {
  resumen: Resumen
  onEnviarWhatsApp: () => void
  onCopiar: () => void
  onCompartir: () => void
  puedeCompartir: boolean
}

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`
}

/**
 * Spec 022 (FR-004, FR-012; research.md R8): lo seleccionado, el subtotal
 * estimado y las acciones del pedido, al pie de Compras. Es `sticky`: ocupa
 * su lugar al final de la lista (no tapa la última tarjeta) y se queda
 * visible al desplazarse, sobre la barra inferior en el teléfono.
 */
export function ResumenSeleccion({
  resumen,
  onEnviarWhatsApp,
  onCopiar,
  onCompartir,
  puedeCompartir,
}: ResumenSeleccionProps) {
  const vacio = resumen.seleccionados === 0
  const sinSumar = [
    resumen.sinPrecio > 0 ? `${resumen.sinPrecio} sin precio` : null,
    resumen.sinCantidad > 0 ? `${resumen.sinCantidad} sin cantidad` : null,
  ].filter(Boolean)

  return (
    <section
      aria-label="Pedido"
      className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom)+0.5rem)] z-10 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-card md:bottom-4"
    >
      <div
        aria-live="polite"
        className="flex items-start justify-between gap-3"
      >
        {vacio ? (
          <p className="text-sm text-text-muted">
            Selecciona lo que vas a pedir
          </p>
        ) : (
          <>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text">
                {plural(resumen.seleccionados, 'seleccionado', 'seleccionados')}
              </span>
              {sinSumar.length > 0 && (
                <span className="text-xs text-text-muted">
                  {sinSumar.join(' · ')}
                </span>
              )}
            </div>
            <div
              role="group"
              className="flex flex-col items-end"
              aria-label={`Subtotal estimado (precios de la última compra): ${formatearCLP(resumen.subtotal)}`}
            >
              <span className="text-xs text-text-muted">
                Subtotal estimado
                <span className="hidden md:inline">
                  {' '}
                  (precios de la última compra)
                </span>
              </span>
              <span className="text-lg font-bold text-text">
                {formatearCLP(resumen.subtotal)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* En el teléfono, Copiar y Compartir quedan como íconos en la misma fila. */}
      <div className="flex gap-2">
        <TouchButton
          type="button"
          disabled={vacio}
          onClick={onEnviarWhatsApp}
          className="flex-1"
        >
          <MessageCircle size={18} />
          Enviar por WhatsApp
        </TouchButton>
        <TouchButton
          type="button"
          variant="ghost"
          disabled={vacio}
          onClick={onCopiar}
          aria-label="Copiar"
          className="px-3 md:flex-1"
        >
          <Copy size={18} />
          <span className="hidden md:inline">Copiar</span>
        </TouchButton>
        {puedeCompartir && (
          <TouchButton
            type="button"
            variant="ghost"
            disabled={vacio}
            onClick={onCompartir}
            aria-label="Compartir"
            className="px-3 md:flex-1"
          >
            <Share size={18} />
            <span className="hidden md:inline">Compartir</span>
          </TouchButton>
        )}
      </div>
    </section>
  )
}
