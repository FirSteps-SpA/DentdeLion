import { useId, useMemo, useState } from 'react'
import type { Proveedor } from '../../../lib/db'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Copy, MessageCircle, Search } from '../../../components/icons'
import { activos, buscarProveedores } from '../../proveedores/lib/proveedores'
import { formatearWhatsapp } from '../../proveedores/lib/whatsapp'
import { LARGO_MAXIMO_ENLACE, enlaceWhatsApp } from '../lib/pedido'

/** Con más proveedores que esto, la lista trae buscador (research.md R7). */
const CON_BUSCADOR = 8
const LINEAS_VISTA_PREVIA = 8
const SIN_PROVEEDOR = ''

export interface EnviarPedidoSheetProps {
  mensaje: string
  proveedores: Proveedor[]
  /** El predeterminado del lugar, ya elegido (FR-013). */
  predeterminadoId: string | null
  onCopiar: () => void
  onClose: () => void
}

/**
 * Spec 022 US2 (FR-013–FR-017; research.md R4, R7): elegir a quién va el
 * pedido y abrir WhatsApp con el mensaje escrito. La acción es un `<a>` real:
 * un toque directo de la persona, que ningún navegador bloquea y que el
 * sistema entrega a la aplicación de WhatsApp (o a WhatsApp Web). La
 * aplicación nunca envía el mensaje; tampoco cambia la lista ni la selección.
 */
export function EnviarPedidoSheet({
  mensaje,
  proveedores,
  predeterminadoId,
  onCopiar,
  onClose,
}: EnviarPedidoSheetProps) {
  const disponibles = useMemo(() => activos(proveedores), [proveedores])
  const [elegidoId, setElegidoId] = useState<string>(() =>
    disponibles.some((p) => p.id === predeterminadoId)
      ? (predeterminadoId as string)
      : SIN_PROVEEDOR,
  )
  const [busqueda, setBusqueda] = useState('')
  const grupo = useId()

  const visibles = busqueda
    ? buscarProveedores(disponibles, busqueda)
    : disponibles
  const elegido = disponibles.find((p) => p.id === elegidoId) ?? null
  const enlace = enlaceWhatsApp(elegido?.whatsapp ?? null, mensaje)
  const muyLargo = enlace.length > LARGO_MAXIMO_ENLACE

  const lineas = mensaje.split('\n')
  const vistaPrevia =
    lineas.length > LINEAS_VISTA_PREVIA
      ? [...lineas.slice(0, LINEAS_VISTA_PREVIA), '…'].join('\n')
      : mensaje

  let aviso: string | null = null
  if (!elegido) aviso = 'Elige el contacto en WhatsApp.'
  else if (!elegido.whatsapp)
    aviso = `${elegido.nombre} no tiene WhatsApp: elige el contacto en WhatsApp.`

  return (
    <BottomSheet titulo="Enviar pedido" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {disponibles.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-text">
              ¿A quién se lo envías?
            </legend>
            {disponibles.length > CON_BUSCADOR && (
              <label className="flex min-h-12 items-center gap-2 rounded-md border border-border-input bg-surface px-3">
                <Search size={18} className="text-text-muted" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar proveedor"
                  aria-label="Buscar proveedor"
                  className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none"
                />
              </label>
            )}
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {[...visibles, null].map((proveedor) => {
                const valor = proveedor?.id ?? SIN_PROVEEDOR
                return (
                  <label
                    key={valor || 'otro'}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 ${
                      elegidoId === valor
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <input
                      type="radio"
                      name={grupo}
                      value={valor}
                      checked={elegidoId === valor}
                      onChange={() => setElegidoId(valor)}
                      className="h-5 w-5 accent-primary"
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-bold text-text">
                        {proveedor ? proveedor.nombre : 'Otro contacto'}
                      </span>
                      <span className="text-xs text-text-muted">
                        {proveedor
                          ? proveedor.whatsapp
                            ? formatearWhatsapp(proveedor.whatsapp)
                            : 'Sin WhatsApp'
                          : 'Lo eliges en WhatsApp'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
            Mensaje
          </span>
          <pre
            aria-label="Vista previa del mensaje"
            className="whitespace-pre-wrap rounded-md border border-border bg-bg p-3 font-sans text-sm text-text"
          >
            {vistaPrevia}
          </pre>
        </div>

        {muyLargo ? (
          <>
            <p role="status" className="text-sm text-text">
              La lista es muy larga para WhatsApp. Cópiala y pégala en el chat.
            </p>
            <TouchButton type="button" onClick={onCopiar}>
              <Copy size={18} />
              Copiar
            </TouchButton>
          </>
        ) : (
          <>
            {aviso && (
              <p role="status" className="text-sm text-text-muted">
                {aviso}
              </p>
            )}
            <a
              href={enlace}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="touch-target flex items-center justify-center gap-2 rounded-md bg-primary px-[18px] text-sm font-bold text-white hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <MessageCircle size={18} />
              Abrir WhatsApp
            </a>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
