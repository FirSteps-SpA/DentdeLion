import { useId, useState, type KeyboardEvent } from 'react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { TouchButton } from '../../../components/ui/TouchButton'
import { AlertTriangle, Check, Plus, Search } from '../../../components/icons'
import { useAuthStore } from '../../../stores/authStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { buscarProveedores, coincidencia } from '../lib/proveedores'
import { crearProveedor, reactivarProveedor } from '../lib/proveedoresAdmin'

export interface SelectorProveedorProps {
  /** Para el `<label htmlFor>` del campo y el foco del primer error. */
  id: string
  /** `proveedorId` elegido, o `null`. */
  valor: string | null
  onCambio: (proveedorId: string) => void
  invalido?: boolean
  describedBy?: string
}

type Opcion =
  | { tipo: 'proveedor'; id: string; nombre: string }
  | { tipo: 'agregar'; nombre: string }

/**
 * Spec 021 (research.md R8, contracts/ui-contracts.md "SelectorProveedor") —
 * campo Proveedor del alta de material y de la recepción de compras. Abre una
 * hoja con buscador (filtra sin mayúsculas ni tildes) sobre los proveedores
 * activos y, si el texto no coincide con ninguno, "Agregar proveedor «…»",
 * que cualquier miembro puede usar (Clarifications Q4). Un nombre de un
 * desactivado no crea otro: se avisa y solo administración puede reactivarlo.
 */
export function SelectorProveedor({
  id,
  valor,
  onCambio,
  invalido = false,
  describedBy,
}: SelectorProveedorProps) {
  const proveedores = useInventoryStore((s) => s.proveedores)
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
  const elegido = valor ? proveedores.find((p) => p.id === valor) : undefined

  const lista = buscarProveedores(proveedores, texto)
  const encontrado = coincidencia(proveedores, texto)
  const opciones: Opcion[] = lista.map((p) => ({
    tipo: 'proveedor',
    id: p.id,
    nombre: p.nombre,
  }))
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

  function elegir(proveedorId: string) {
    onCambio(proveedorId)
    setAbierto(false)
  }

  async function agregar(nombre: string) {
    setOcupado(true)
    setError(null)
    try {
      const proveedor = await crearProveedor({ nombre })
      elegir(proveedor.id)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo agregar el proveedor.',
      )
    } finally {
      setOcupado(false)
    }
  }

  async function reactivarYUsar(proveedorId: string) {
    setOcupado(true)
    setError(null)
    try {
      await reactivarProveedor(proveedorId)
      elegir(proveedorId)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo reactivar el proveedor.',
      )
    } finally {
      setOcupado(false)
    }
  }

  function usar(opcion: Opcion) {
    if (opcion.tipo === 'proveedor') elegir(opcion.id)
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
          elegido.nombre
        ) : (
          <span className="text-text-muted">Elige un proveedor</span>
        )}
      </button>

      {abierto && (
        <BottomSheet titulo="Proveedor" onClose={() => setAbierto(false)}>
          <label htmlFor={buscadorId} className="sr-only">
            Buscar proveedor
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
              placeholder="Buscar o escribir un proveedor nuevo"
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

          {proveedores.length === 0 && !texto.trim() && (
            <p className="py-2 text-sm text-text-muted">
              Todavía no hay proveedores. Escribe el nombre para agregar uno.
            </p>
          )}

          {encontrado.tipo === 'desactivado' && (
            <div className="flex flex-col gap-2 rounded-md bg-warning-30-bg px-3.5 py-2.5 text-sm text-warning-30-text">
              <p className="flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />«
                {encontrado.proveedor.nombre}» está desactivado.
              </p>
              {esAdministrador && (
                <TouchButton
                  type="button"
                  variant="secondary"
                  disabled={ocupado}
                  onClick={() => void reactivarYUsar(encontrado.proveedor.id)}
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
              aria-label="Proveedores"
              className="flex flex-col"
            >
              {opciones.map((opcion, indice) => {
                const seleccionado =
                  opcion.tipo === 'proveedor' && opcion.id === valor
                return (
                  <li
                    key={opcion.tipo === 'proveedor' ? opcion.id : 'agregar'}
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
                        Agregar proveedor «{opcion.nombre}»
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
