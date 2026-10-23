import { useState } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { catalogoCategoriasCompleto } from '../../insumos/lib/categorias'
import {
  crearCategoriaDesdeAjustes,
  renombrarCategoria,
  desactivarCategoria,
  reactivarCategoria,
} from '../lib/categoriasAdmin'
import { Tag, Plus, Pencil, Trash, Undo } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { TouchButton } from '../../../components/ui/TouchButton'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { IconField } from '../../../components/ui/IconField'

/**
 * Sección "Categorías" (spec 010 FR-013..019): listar, crear, renombrar/
 * fusionar y (des)activar categorías. Solo administradores (montada
 * condicionalmente por `AjustesView`).
 */
export function CategoriasSection({ sinTitulo = false }: { sinTitulo?: boolean } = {}) {
  const insumos = useInventoryStore((s) => s.insumos)
  const categorias = useInventoryStore((s) => s.categorias)
  const catalogo = catalogoCategoriasCompleto(categorias, insumos)

  const [modo, setModo] = useState<'crear' | 'renombrar' | null>(null)
  const [categoriaIdEnEdicion, setCategoriaIdEnEdicion] = useState<string | null>(
    null,
  )
  const [nombreInput, setNombreInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function abrirCrear() {
    setModo('crear')
    setNombreInput('')
    setError(null)
  }

  function abrirRenombrar(id: string, nombreActual: string) {
    setModo('renombrar')
    setCategoriaIdEnEdicion(id)
    setNombreInput(nombreActual)
    setError(null)
  }

  function cerrar() {
    setModo(null)
    setCategoriaIdEnEdicion(null)
  }

  async function confirmar() {
    setOcupado(true)
    setError(null)
    try {
      if (modo === 'crear') {
        await crearCategoriaDesdeAjustes(nombreInput)
      } else if (modo === 'renombrar' && categoriaIdEnEdicion) {
        await renombrarCategoria(categoriaIdEnEdicion, nombreInput)
      }
      cerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setOcupado(false)
    }
  }

  async function alternar(id: string, activa: boolean) {
    setError(null)
    try {
      if (activa) {
        await desactivarCategoria(id)
      } else {
        await reactivarCategoria(id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <section className="flex flex-col gap-2">
      {/* Spec 019: dentro de su subpantalla, el título lo pone la pantalla. */}
      <div
        className={`flex items-center gap-2 ${sinTitulo ? 'justify-end' : 'justify-between'}`}
      >
        {!sinTitulo && (
          <h2 className="flex items-center gap-2 text-h3 text-text">
            <Tag size={18} className="text-primary" />
            Categorías
          </h2>
        )}
        <TouchButton
          type="button"
          variant="secondary"
          onClick={abrirCrear}
          className="text-sm"
        >
          <Plus size={16} />
          Nueva categoría
        </TouchButton>
      </div>

      {error && !modo && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}

      <Card className="flex flex-col divide-y divide-border px-3.5">
        {catalogo.map((entrada) => (
          <div
            key={entrada.clave}
            className="flex items-center justify-between gap-2 py-2.5 text-sm text-text"
          >
            <span className="flex items-center gap-2">
              {entrada.nombre}
              {!entrada.activa && <Badge variant="neutral">Desactivada</Badge>}
              {entrada.origen === 'precargada' && (
                <Badge variant="neutral">Precargada</Badge>
              )}
            </span>
            {entrada.origen === 'creada' && entrada.id && (
              <span className="flex items-center gap-1">
                <TouchButton
                  type="button"
                  variant="ghost"
                  aria-label={`Renombrar ${entrada.nombre}`}
                  onClick={() => abrirRenombrar(entrada.id!, entrada.nombre)}
                  className="px-2 text-xs"
                >
                  <Pencil size={16} />
                </TouchButton>
                <TouchButton
                  type="button"
                  variant="ghost"
                  aria-label={
                    entrada.activa
                      ? `Desactivar ${entrada.nombre}`
                      : `Reactivar ${entrada.nombre}`
                  }
                  onClick={() => void alternar(entrada.id!, entrada.activa)}
                  className="px-2 text-xs"
                >
                  {entrada.activa ? <Trash size={16} /> : <Undo size={16} />}
                </TouchButton>
              </span>
            )}
          </div>
        ))}
      </Card>

      {modo && (
        <BottomSheet
          titulo={modo === 'crear' ? 'Nueva categoría' : 'Renombrar categoría'}
          onClose={cerrar}
        >
          {error && (
            <Card className="bg-danger-bg px-3.5 py-2.5">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            </Card>
          )}
          <IconField label="Nombre" htmlFor="categoria-nombre">
            <input
              id="categoria-nombre"
              type="text"
              value={nombreInput}
              onChange={(event) => setNombreInput(event.target.value)}
              maxLength={40}
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </IconField>
          <TouchButton
            type="button"
            onClick={() => void confirmar()}
            disabled={ocupado || !nombreInput.trim()}
          >
            Guardar
          </TouchButton>
        </BottomSheet>
      )}
    </section>
  )
}
