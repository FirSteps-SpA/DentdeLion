import { BottomSheet } from '../components/ui/BottomSheet'
import { CircleCheck, MapPin } from '../components/icons'
import { lugaresActivos, useLugarStore } from '../stores/lugarStore'

export interface ElegirLugarSheetProps {
  titulo?: string
  /** Lugar marcado como elegido (`'todos'` marca "Todos los lugares"). */
  seleccionado?: string | 'todos' | null
  /** Ofrece "Todos los lugares" (solo el selector de la barra; spec 014 FR-013). */
  incluirTodos?: boolean
  /** Lugares que no se ofrecen (p. ej. el origen de un traslado). */
  excluir?: string[]
  onElegir: (lugarId: string | 'todos') => void
  onClose: () => void
}

/**
 * Lista de lugares activos del tenant en un `BottomSheet` (spec 014,
 * contracts/ui-contracts.md): el menú del selector en el teléfono y el
 * "¿En qué lugar?" que piden las acciones de stock desde "Todos" (FR-014).
 */
export function ElegirLugarSheet({
  titulo = '¿En qué lugar?',
  seleccionado = null,
  incluirTodos = false,
  excluir = [],
  onElegir,
  onClose,
}: ElegirLugarSheetProps) {
  const lugares = useLugarStore((s) => s.lugares)
  const opciones = lugaresActivos(lugares).filter((lugar) => !excluir.includes(lugar.id))

  return (
    <BottomSheet titulo={titulo} onClose={onClose}>
      <ul data-sheet-body className="flex flex-col gap-1">
        {incluirTodos && (
          <>
            <OpcionLugar
              nombre="Todos los lugares"
              elegido={seleccionado === 'todos'}
              onClick={() => onElegir('todos')}
            />
            <li role="separator" className="my-1 border-t border-border" />
          </>
        )}
        {opciones.map((lugar) => (
          <OpcionLugar
            key={lugar.id}
            nombre={lugar.nombre}
            elegido={seleccionado === lugar.id}
            onClick={() => onElegir(lugar.id)}
          />
        ))}
      </ul>
    </BottomSheet>
  )
}

export function OpcionLugar({
  nombre,
  elegido,
  onClick,
}: {
  nombre: string
  elegido: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={elegido ? 'true' : undefined}
        className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-left text-body text-text hover:bg-bg focus-visible:outline-2 focus-visible:outline-brand"
      >
        <MapPin size={18} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1 truncate">{nombre}</span>
        {elegido && <CircleCheck size={18} className="shrink-0 text-brand" />}
      </button>
    </li>
  )
}
