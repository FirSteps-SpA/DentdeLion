import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from '../components/icons'
import {
  hayVariosLugares,
  lugaresActivos,
  nombreLugar,
  useLugarStore,
} from '../stores/lugarStore'
import { ElegirLugarSheet, OpcionLugar } from './ElegirLugarSheet'
import { useDisposicion } from './useDisposicion'

/**
 * Selector de lugar de trabajo (spec 014 FR-008, contracts/ui-contracts.md,
 * DS §28). Con un solo lugar activo es un chip con su nombre, sin menú —
 * como la clínica original. Con 2 o más abre un `BottomSheet` en el teléfono
 * o un menú desplegable en tablet y desktop, con "Todos los lugares" arriba.
 * `compacto` es la variante del encabezado del teléfono.
 */
export function SelectorLugar({ compacto = false }: { compacto?: boolean }) {
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const setLugarActivo = useLugarStore((s) => s.setLugarActivo)
  const disposicion = useDisposicion()
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

  const varios = hayVariosLugares(lugares)
  const etiqueta =
    lugarActivoId === 'todos'
      ? 'Todos los lugares'
      : lugarActivoId
        ? nombreLugar(lugares, lugarActivoId)
        : 'Sin lugar'

  // El desplegable de tablet/desktop se cierra con un clic fuera o Escape.
  useEffect(() => {
    if (!abierto || disposicion === 'movil') return
    function alClicFuera(event: MouseEvent) {
      if (!contenedorRef.current?.contains(event.target as Node)) setAbierto(false)
    }
    function alEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alEscape)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alEscape)
    }
  }, [abierto, disposicion])

  const chip = compacto
    ? 'rounded-pill bg-primary-soft px-2 py-px text-[11px] font-bold text-primary-text'
    : 'rounded-pill bg-primary-soft px-3 py-1 text-[13px] font-bold text-primary-text'

  if (!varios) {
    return (
      <span className={`inline-flex w-fit max-w-full min-w-0 items-center truncate ${chip}`}>
        {etiqueta}
      </span>
    )
  }

  function elegir(id: string | 'todos') {
    setAbierto(false)
    void setLugarActivo(id)
  }

  return (
    <div ref={contenedorRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup={disposicion === 'movil' ? 'dialog' : 'listbox'}
        aria-expanded={abierto}
        aria-label={`Lugar de trabajo: ${etiqueta}`}
        className={`inline-flex min-h-12 max-w-full items-center focus-visible:outline-2 focus-visible:outline-brand ${compacto ? '-my-3' : ''}`}
      >
        <span className={`inline-flex min-w-0 items-center gap-1 ${chip}`}>
          <span className="truncate">{etiqueta}</span>
          <ChevronDown size={compacto ? 12 : 14} className="shrink-0" />
        </span>
      </button>

      {abierto && disposicion === 'movil' && (
        <ElegirLugarSheet
          titulo="Lugar de trabajo"
          seleccionado={lugarActivoId}
          incluirTodos
          onElegir={elegir}
          onClose={() => setAbierto(false)}
        />
      )}
      {abierto && disposicion !== 'movil' && (
        <ul
          role="listbox"
          aria-label="Lugar de trabajo"
          className="absolute top-full left-0 z-30 mt-1 flex min-w-60 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-dropdown"
        >
          <OpcionLugar
            nombre="Todos los lugares"
            elegido={lugarActivoId === 'todos'}
            onClick={() => elegir('todos')}
          />
          <li role="separator" className="my-1 border-t border-border" />
          {lugaresActivos(lugares).map((lugar) => (
            <OpcionLugar
              key={lugar.id}
              nombre={lugar.nombre}
              elegido={lugarActivoId === lugar.id}
              onClick={() => elegir(lugar.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
