import { useId, useState, type KeyboardEvent } from 'react'
import { BottomSheet } from './BottomSheet'
import { TouchButton } from './TouchButton'
import { AlertTriangle, Check, Plus, Search } from '../icons'
import { useAuthStore } from '../../stores/authStore'
import {
  buscarEnCatalogo,
  coincidenciaEn,
  type ItemCatalogo,
} from '../../lib/catalogo'

export interface TextosSelectorCatalogo {
  /** Título de la hoja ("Proveedor"). */
  titulo: string
  /** Campo sin valor ("Elige un proveedor"). */
  placeholderCampo: string
  /** Etiqueta del buscador ("Buscar proveedor"). */
  buscar: string
  placeholderBuscar: string
  /** `aria-label` de la lista ("Proveedores"). */
  lista: string
  agregar: (nombre: string) => string
  /** Catálogo vacío y buscador vacío. */
  vacio: string
  desactivado: (nombre: string) => string
  errorAgregar: string
  errorReactivar: string
  /** Con `permitirNinguno`: la opción que elige `null` ("Sin marca"). */
  ninguno?: string
  /** Cómo se muestra en el campo el ítem elegido (p. ej. "«X» (desactivada)"). */
  elegido?: (item: ItemCatalogo) => string
}

export interface SelectorCatalogoProps {
  /** Para el `<label htmlFor>` del campo y el foco del primer error. */
  id: string
  /** Id elegido, o `null`. */
  valor: string | null
  onCambio: (id: string | null) => void
  /** El catálogo del tenant sin los eliminados (de `inventoryStore`). */
  items: readonly ItemCatalogo[]
  textos: TextosSelectorCatalogo
  crear: (nombre: string) => Promise<{ id: string }>
  /** Solo se ofrece a administración. */
  reactivar?: (id: string) => Promise<void>
  /** Opción `textos.ninguno` arriba, que elige `null`. */
  permitirNinguno?: boolean
  invalido?: boolean
  describedBy?: string
}

type Opcion =
  | { tipo: 'item'; id: string; nombre: string }
  | { tipo: 'ninguno'; nombre: string }
  | { tipo: 'agregar'; nombre: string }

/**
 * Spec 023 (research.md R7, contracts/ui-contracts.md "SelectorCatalogo") —
 * extraído del selector de proveedores de la 021. Abre una hoja con buscador
 * (filtra sin mayúsculas ni tildes) sobre los ítems activos y, si el texto no
 * coincide con ninguno, "Agregar «…»", que cualquier miembro puede usar. Un
 * nombre de un desactivado no crea otro: se avisa y solo administración puede
 * reactivarlo.
 */
export function SelectorCatalogo({
  id,
  valor,
  onCambio,
  items,
  textos,
  crear,
  reactivar,
  permitirNinguno = false,
  invalido = false,
  describedBy,
}: SelectorCatalogoProps) {
  const esAdministrador = useAuthStore(
    (s) => s.usuario?.rol === 'administrador',
  )
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const listaId = useId()
  const buscadorId = useId()

  // Uno desactivado mientras el formulario estaba abierto se sigue mostrando.
  const elegido = valor ? items.find((item) => item.id === valor) : undefined

  const lista = buscarEnCatalogo(items, texto)
  const encontrado = coincidenciaEn(items, texto)
  const opciones: Opcion[] = []
  if (permitirNinguno && textos.ninguno && !texto.trim()) {
    opciones.push({ tipo: 'ninguno', nombre: textos.ninguno })
  }
  for (const item of lista) {
    opciones.push({ tipo: 'item', id: item.id, nombre: item.nombre })
  }
  if (texto.trim() && encontrado.tipo === 'ninguna') {
    opciones.push({
      tipo: 'agregar',
      nombre: texto.trim().replace(/\s+/g, ' '),
    })
  }
  const indiceActivo = Math.min(activo, opciones.length - 1)
  const idOpcion = (indice: number) => `${listaId}-opcion-${indice}`

  function abrir() {
    setTexto('')
    setActivo(0)
    setError(null)
    setAbierto(true)
  }

  function elegir(itemId: string | null) {
    onCambio(itemId)
    setAbierto(false)
  }

  async function agregar(nombre: string) {
    setOcupado(true)
    setError(null)
    try {
      const creado = await crear(nombre)
      elegir(creado.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : textos.errorAgregar)
    } finally {
      setOcupado(false)
    }
  }

  async function reactivarYUsar(itemId: string) {
    if (!reactivar) return
    setOcupado(true)
    setError(null)
    try {
      await reactivar(itemId)
      elegir(itemId)
    } catch (e) {
      setError(e instanceof Error ? e.message : textos.errorReactivar)
    } finally {
      setOcupado(false)
    }
  }

  function usar(opcion: Opcion) {
    if (opcion.tipo === 'item') elegir(opcion.id)
    else if (opcion.tipo === 'ninguno') elegir(null)
    else void agregar(opcion.nombre)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActivo(Math.min(indiceActivo + 1, opciones.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActivo(Math.max(indiceActivo - 1, 0))
    } else if (event.key === 'Enter') {
      // Dentro de un <form>: Enter nunca envía el formulario de fondo.
      event.preventDefault()
      const opcion = opciones[indiceActivo]
      if (opcion && !ocupado) usar(opcion)
    }
  }

  const sinValor = permitirNinguno && textos.ninguno ? textos.ninguno : textos.placeholderCampo

  return (
    <>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-invalid={invalido || undefined}
        aria-describedby={describedBy}
        onClick={abrir}
        className="h-full min-h-12 w-full border-none bg-transparent text-left text-sm text-text outline-none"
      >
        {elegido ? (
          (textos.elegido?.(elegido) ?? elegido.nombre)
        ) : (
          <span className="text-text-muted">{sinValor}</span>
        )}
      </button>

      {abierto && (
        <BottomSheet titulo={textos.titulo} onClose={() => setAbierto(false)}>
          <label htmlFor={buscadorId} className="sr-only">
            {textos.buscar}
          </label>
          <div className="touch-target flex items-center gap-2.5 rounded-md border border-border-input bg-surface px-3.5 focus-within:outline-2 focus-within:outline-brand">
            <Search size={18} className="shrink-0 text-text-muted" />
            <input
              id={buscadorId}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={listaId}
              aria-autocomplete="list"
              aria-activedescendant={
                opciones.length > 0 ? idOpcion(indiceActivo) : undefined
              }
              placeholder={textos.placeholderBuscar}
              autoComplete="off"
              value={texto}
              onChange={(event) => {
                setTexto(event.target.value)
                setActivo(0)
                setError(null)
              }}
              onKeyDown={onKeyDown}
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </div>

          {items.length === 0 && !texto.trim() && (
            <p className="py-2 text-sm text-text-muted">{textos.vacio}</p>
          )}

          {encontrado.tipo === 'desactivado' && (
            <div className="flex flex-col gap-2 rounded-md bg-warning-30-bg px-3.5 py-2.5 text-sm text-warning-30-text">
              <p className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                {textos.desactivado(encontrado.item.nombre)}
              </p>
              {esAdministrador && reactivar && (
                <TouchButton
                  type="button"
                  variant="secondary"
                  disabled={ocupado}
                  onClick={() => void reactivarYUsar(encontrado.item.id)}
                >
                  Reactivar y usar
                </TouchButton>
              )}
            </div>
          )}

          {opciones.length > 0 && (
            <ul
              id={listaId}
              role="listbox"
              aria-label={textos.lista}
              className="flex flex-col"
            >
              {opciones.map((opcion, indice) => {
                const seleccionado =
                  (opcion.tipo === 'item' && opcion.id === valor) ||
                  (opcion.tipo === 'ninguno' && valor === null)
                return (
                  <li
                    key={opcion.tipo === 'item' ? opcion.id : opcion.tipo}
                    id={idOpcion(indice)}
                    role="option"
                    aria-selected={seleccionado}
                    onClick={() => !ocupado && usar(opcion)}
                    onMouseEnter={() => setActivo(indice)}
                    className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm ${
                      indice === indiceActivo ? 'bg-primary-soft' : ''
                    } ${opcion.tipo === 'agregar' ? 'font-semibold text-primary-text' : 'text-text'}`}
                  >
                    {opcion.tipo === 'agregar' ? (
                      <>
                        <Plus size={16} className="shrink-0" />
                        {textos.agregar(opcion.nombre)}
                      </>
                    ) : (
                      <>
                        <span className="flex-1">{opcion.nombre}</span>
                        {seleccionado && (
                          <Check size={16} className="shrink-0 text-brand" />
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </BottomSheet>
      )}
    </>
  )
}
