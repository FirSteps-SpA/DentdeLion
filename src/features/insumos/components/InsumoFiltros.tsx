import type { Estado } from '../lib/estado'
import { AlertTriangle, CircleAlert, CircleCheck, Clock, Search } from '../../../components/icons'
import { IconField } from '../../../components/ui/IconField'

export interface InsumoFiltrosProps {
  texto: string
  onTextoChange: (valor: string) => void
  categorias: string[]
  categoria: string
  onCategoriaChange: (valor: string) => void
  estado: Estado[]
  onEstadoChange: (valor: Estado[]) => void
}

const ESTADOS: { estado: Estado; label: string; Icon: typeof CircleCheck }[] = [
  { estado: 'ok', label: 'Ok', Icon: CircleCheck },
  { estado: 'bajo-stock', label: 'Bajo Stock', Icon: AlertTriangle },
  { estado: 'proximo-a-caducar', label: 'Próximo a caducar', Icon: Clock },
  { estado: 'caducado', label: 'Caducado', Icon: CircleAlert },
]

/** Chip de filtro del DS (radio pill): activo en menta, inactivo outline. */
function claseChip(activo: boolean): string {
  return `touch-target flex shrink-0 items-center gap-1.5 rounded-pill px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-brand ${
    activo
      ? 'bg-primary-soft text-primary-text'
      : 'border border-border-input bg-surface text-text-muted'
  }`
}

/**
 * Búsqueda + filtros del listado (spec 006 FR-005..FR-008). La búsqueda solo
 * indexa el nombre comercial del insumo (spec Clarifications) — nunca código
 * de fabricante ni número de lote. Los badges de estado son single-select
 * desde esta UI (cada toque reemplaza `estado` por `[esa estado]`, o `[]` si
 * se desactiva el único activo), aunque el tipo subyacente es un arreglo para
 * que el resumen (User Story 1) pueda activar dos a la vez (spec 006
 * Analysis F1/A1).
 */
export function InsumoFiltros({
  texto,
  onTextoChange,
  categorias,
  categoria,
  onCategoriaChange,
  estado,
  onEstadoChange,
}: InsumoFiltrosProps) {
  const estadoActivo = estado.length === 1 ? estado[0] : null

  function toggleEstado(valor: Estado) {
    onEstadoChange(estadoActivo === valor ? [] : [valor])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <IconField
            label="Buscar insumo"
            icon={<Search size={18} />}
            htmlFor="inventario-buscar"
          >
            <input
              id="inventario-buscar"
              type="text"
              value={texto}
              onChange={(event) => onTextoChange(event.target.value)}
              placeholder="Nombre del insumo"
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </IconField>
        </div>
      </div>

      {categorias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => onCategoriaChange('')}
            aria-pressed={categoria === ''}
            className={claseChip(categoria === '')}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCategoriaChange(c)}
              aria-pressed={categoria === c}
              className={claseChip(categoria === c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {ESTADOS.map(({ estado: valor, label, Icon }) => (
          <button
            key={valor}
            type="button"
            onClick={() => toggleEstado(valor)}
            aria-pressed={estadoActivo === valor}
            className={claseChip(estadoActivo === valor)}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
