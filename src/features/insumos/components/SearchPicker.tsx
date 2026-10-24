import { useState } from 'react'
import type { Insumo } from '../../../lib/db'
import {
  insumosRecientes,
  searchInsumosPorCategoria,
  searchInsumosPorTexto,
  useInventoryStore,
} from '../../../stores/inventoryStore'
import { categoriasEnUso } from '../lib/categorias'
import { mapaMarcas } from '../../marcas/lib/marcas'
import { Search } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { AltaMaterialView } from './AltaMaterialView'

interface SearchPickerProps {
  /**
   * Búsqueda manual ágil como flujo primario (Constitution V) — nunca
   * requiere la cámara. `opciones.conLoteInicial` llega solo cuando el
   * material se creó con stock inicial (spec 008 R7).
   */
  onSelect: (insumo: Insumo, opciones?: { conLoteInicial: boolean }) => void
}

/**
 * Búsqueda por texto, categoría, y selección rápida (FR-001/FR-004/FR-010),
 * con el formulario unificado "Nuevo Material" (spec 008) cuando la
 * búsqueda no encuentra coincidencias (FR-003, FR-004). Todos los objetivos
 * táctiles cumplen ≥48x48px (Constitution III).
 */
export function SearchPicker({ onSelect }: SearchPickerProps) {
  const insumos = useInventoryStore((s) => s.insumos)
  const categoriasRows = useInventoryStore((s) => s.categorias)
  const marcas = useInventoryStore((s) => s.marcas)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [mostrarCrearInsumo, setMostrarCrearInsumo] = useState(false)

  const categorias = categoriasEnUso(categoriasRows, insumos).map((c) => c.nombre)
  const resultados = categoria
    ? searchInsumosPorCategoria(insumos, categoria)
    : texto.trim()
      ? searchInsumosPorTexto(insumos, texto, mapaMarcas(marcas))
      : insumosRecientes(insumos)

  const sinCoincidencias = texto.trim() !== '' && resultados.length === 0

  return (
    <div className="flex flex-col gap-4">
      <IconField
        label="Buscar insumo"
        icon={<Search size={18} />}
        htmlFor="buscar-insumo"
      >
        <input
          id="buscar-insumo"
          type="text"
          value={texto}
          onChange={(event) => {
            setTexto(event.target.value)
            setMostrarCrearInsumo(false)
          }}
          placeholder="Nombre del insumo"
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>

      {categorias.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoria('')}
            aria-pressed={categoria === ''}
            className={`touch-target shrink-0 rounded-full px-4 text-sm font-bold ${
              categoria === '' ? 'bg-primary text-white' : 'border border-border text-text-muted'
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              aria-pressed={categoria === c}
              className={`touch-target shrink-0 rounded-full px-4 text-sm font-bold ${
                categoria === c ? 'bg-primary text-white' : 'border border-border text-text-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {!categoria && !texto.trim() && resultados.length > 0 && (
        <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
          Selección rápida
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {resultados.map((insumo) => (
          <li key={insumo.id}>
            <Card
              as="button"
              type="button"
              onClick={() => onSelect(insumo)}
              className="touch-target flex w-full items-center gap-3 px-3.5 text-left"
            >
              <span className="text-sm font-bold text-text">{insumo.nombre}</span>
              <span className="text-xs text-text-muted">({insumo.categoria})</span>
            </Card>
          </li>
        ))}
      </ul>

      {sinCoincidencias && !mostrarCrearInsumo && (
        <Card className="flex flex-col gap-2 p-3.5">
          <p className="text-sm text-text-muted">
            No se encontraron insumos para &quot;{texto}&quot;.
          </p>
          <TouchButton
            type="button"
            variant="secondary"
            onClick={() => setMostrarCrearInsumo(true)}
          >
            Crear insumo nuevo
          </TouchButton>
        </Card>
      )}

      {mostrarCrearInsumo && (
        <AltaMaterialView
          nombreInicial={texto.trim()}
          onCreated={({ insumo, conLoteInicial }) => {
            setMostrarCrearInsumo(false)
            onSelect(insumo, { conLoteInicial })
          }}
          onCancel={() => setMostrarCrearInsumo(false)}
          onAbrirExistente={(insumo) => {
            setMostrarCrearInsumo(false)
            onSelect(insumo)
          }}
        />
      )}
    </div>
  )
}
