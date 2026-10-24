import { useId, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Undo } from '../../../components/icons'
import { useAlertasStore } from '../../../stores/alertasStore'
import {
  LARGO_MAXIMO_SALUDO,
  SALUDO_PEDIDO_POR_DEFECTO,
} from '../../compras/lib/pedido'
import {
  guardarSaludoPedido,
  restablecerSaludoPedido,
} from '../lib/saludoAdmin'

/**
 * Spec 022 US5 (FR-022, research.md R9): el saludo con que empieza el pedido
 * por WhatsApp, en Ajustes → Proveedores (solo administración). Se monta con
 * `key` = saludo guardado, así un cambio que llega por sincronización
 * reinicia el borrador.
 */
function Editor({ guardado }: { guardado: string }) {
  const [texto, setTexto] = useState(guardado)
  const [aviso, setAviso] = useState<{
    tipo: 'ok' | 'error'
    texto: string
  } | null>(null)
  const campo = useId()
  const ayuda = useId()

  const cambiado = texto.trim() !== guardado
  const esElDeLaClienta = guardado === SALUDO_PEDIDO_POR_DEFECTO

  async function guardar() {
    try {
      await guardarSaludoPedido(texto)
      setAviso({ tipo: 'ok', texto: 'Saludo guardado.' })
    } catch (error) {
      setAviso({ tipo: 'error', texto: (error as Error).message })
    }
  }

  async function restablecer() {
    await restablecerSaludoPedido()
    setAviso({ tipo: 'ok', texto: 'Saludo restablecido.' })
  }

  return (
    <Card className="flex flex-col gap-2 px-3.5 py-3">
      <label htmlFor={campo} className="text-sm font-bold text-text">
        Mensaje del pedido
      </label>
      <p id={ayuda} className="text-xs text-text-muted">
        Va al comienzo del pedido que se envía por WhatsApp. La lista de
        materiales se agrega sola, sin precios.
      </p>
      <textarea
        id={campo}
        rows={4}
        maxLength={LARGO_MAXIMO_SALUDO}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAviso(null)
        }}
        aria-describedby={ayuda}
        className="w-full resize-y rounded-md border border-border-input bg-surface px-3.5 py-2.5 text-sm text-text outline-brand focus:outline-2"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted" aria-live="polite">
          {texto.length}/{LARGO_MAXIMO_SALUDO}
        </span>
        <div className="flex gap-2">
          <TouchButton
            type="button"
            variant="ghost"
            disabled={esElDeLaClienta}
            onClick={() => void restablecer()}
            className="px-3"
          >
            <Undo size={16} />
            Restablecer
          </TouchButton>
          <TouchButton
            type="button"
            disabled={!cambiado}
            onClick={() => void guardar()}
            className="px-4"
          >
            Guardar
          </TouchButton>
        </div>
      </div>
      {aviso && (
        <p
          role={aviso.tipo === 'error' ? 'alert' : 'status'}
          className={`text-sm ${aviso.tipo === 'error' ? 'text-danger' : 'text-text'}`}
        >
          {aviso.texto}
        </p>
      )}
    </Card>
  )
}

export function MensajePedidoCard() {
  const guardado = useAlertasStore((s) => s.saludoPedido)
  return <Editor key={guardado} guardado={guardado} />
}
