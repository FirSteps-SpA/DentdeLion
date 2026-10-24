import { useState } from 'react'
import type { Marca } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { activosDe, desactivadosDe } from '../../../lib/catalogo'
import { usosPorMarca } from '../../marcas/lib/marcas'
import {
  crearMarca,
  desactivarMarca,
  eliminarMarca,
  reactivarMarca,
  renombrarMarca,
  MarcaDesactivada,
} from '../../marcas/lib/marcasAdmin'
import { ChevronDown, Plus, Undo } from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { VerMas } from '../../../components/ui/VerMas'
import { useListaPaginada } from '../../../lib/paginacion'

const INPUT_CLASS =
  'h-full w-full border-none bg-transparent text-sm text-text outline-none'

interface Formulario {
  /** `null` = nueva. */
  id: string | null
  nombre: string
}

function textoUsos(usos: number): string {
  if (usos === 0) return 'Sin insumos'
  return usos === 1 ? '1 insumo' : `${usos} insumos`
}

/**
 * Spec 023 (FR-015..FR-019, research.md R11, contracts/ui-contracts.md
 * "Ajustes") — catálogo de marcas en Ajustes, solo para administración (la
 * sección no existe para `personal`). Crear, renombrar, desactivar o
 * reactivar, y eliminar solo si ningún insumo la usa (contando los dados de
 * baja). Molde: `ProveedoresSection`, sin contacto ni predeterminado.
 */
export function MarcasSection() {
  const marcas = useInventoryStore((s) => s.marcas)
  const insumos = useInventoryStore((s) => s.insumos)
  const insumosDadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const usos = usosPorMarca([...insumos, ...insumosDadosDeBaja])

  const lista = useListaPaginada(activosDe(marcas), { clave: '', modo: 'ver-mas' })
  const listaDesactivadas = desactivadosDe(marcas)

  const [form, setForm] = useState<Formulario | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [verDesactivadas, setVerDesactivadas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  function abrir(marca: Marca | null) {
    setForm(marca ? { id: marca.id, nombre: marca.nombre } : { id: null, nombre: '' })
    setConfirmarEliminar(false)
    setError(null)
  }

  function cerrar() {
    setForm(null)
    setConfirmarEliminar(false)
  }

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
    } catch (e) {
      setError(
        e instanceof MarcaDesactivada
          ? `${e.message} Reactívala desde "Desactivadas".`
          : e instanceof Error
            ? e.message
            : 'No se pudo guardar.',
      )
    } finally {
      setOcupado(false)
    }
  }

  function guardar() {
    if (!form) return
    void ejecutar(async () => {
      if (form.id) await renombrarMarca(form.id, form.nombre)
      else await crearMarca({ nombre: form.nombre }, { estricto: true })
      cerrar()
    })
  }

  const enEdicion = form?.id ? marcas.find((m) => m.id === form.id) : undefined
  const usosEnEdicion = enEdicion ? (usos.get(enEdicion.id) ?? 0) : 0

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <TouchButton
          type="button"
          variant="secondary"
          onClick={() => abrir(null)}
          className="text-sm"
        >
          <Plus size={16} />
          Agregar marca
        </TouchButton>
      </div>

      {error && !form && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}

      {lista.total === 0 ? (
        <Card className="px-3.5 py-4">
          <p className="text-sm text-text-muted">Todavía no hay marcas.</p>
        </Card>
      ) : (
        <Card className="flex flex-col divide-y divide-border px-1.5">
          {lista.visibles.map((marca) => (
            <button
              key={marca.id}
              type="button"
              onClick={() => abrir(marca)}
              aria-label={`Editar ${marca.nombre}`}
              className="flex min-h-12 flex-col items-start gap-1 rounded-md px-2 py-2.5 text-left hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="text-sm font-semibold break-words text-text">
                {marca.nombre}
              </span>
              <span className="text-xs text-text-muted">
                {textoUsos(usos.get(marca.id) ?? 0)}
              </span>
            </button>
          ))}
        </Card>
      )}
      <VerMas
        quedan={lista.quedan}
        mostrados={lista.visibles.length}
        total={lista.total}
        onVerMas={lista.verMas}
      />

      {listaDesactivadas.length > 0 && (
        <div className="flex flex-col gap-2">
          <TouchButton
            type="button"
            variant="ghost"
            aria-expanded={verDesactivadas}
            onClick={() => setVerDesactivadas(!verDesactivadas)}
            className="self-start text-sm"
          >
            <ChevronDown
              size={16}
              className={verDesactivadas ? 'rotate-180 motion-safe:transition-transform' : ''}
            />
            Desactivadas ({listaDesactivadas.length})
          </TouchButton>
          {verDesactivadas && (
            <Card className="flex flex-col divide-y divide-border px-3.5">
              {listaDesactivadas.map((marca) => (
                <div
                  key={marca.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm text-text-muted"
                >
                  {marca.nombre}
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => void ejecutar(() => reactivarMarca(marca.id))}
                    aria-label={`Reactivar ${marca.nombre}`}
                    className="text-sm"
                  >
                    <Undo size={16} />
                    Reactivar
                  </TouchButton>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {form && (
        <BottomSheet titulo={form.id ? 'Editar marca' : 'Nueva marca'} onClose={cerrar}>
          {error && (
            <Card className="bg-danger-bg px-3.5 py-2.5">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            </Card>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              guardar()
            }}
            className="flex flex-col gap-4"
          >
            <IconField label="Nombre" htmlFor="marca-nombre">
              <input
                id="marca-nombre"
                type="text"
                value={form.nombre}
                maxLength={60}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                className={INPUT_CLASS}
              />
            </IconField>
            <TouchButton type="submit" disabled={ocupado || !form.nombre.trim()}>
              Guardar
            </TouchButton>
          </form>

          {enEdicion && !confirmarEliminar && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <TouchButton
                type="button"
                variant="secondary"
                disabled={ocupado}
                onClick={() =>
                  void ejecutar(async () => {
                    if (enEdicion.desactivadoEn) await reactivarMarca(enEdicion.id)
                    else await desactivarMarca(enEdicion.id)
                    cerrar()
                  })
                }
              >
                {enEdicion.desactivadoEn ? 'Reactivar' : 'Desactivar'}
              </TouchButton>
              {usosEnEdicion === 0 && (
                <TouchButton
                  type="button"
                  variant="ghost"
                  disabled={ocupado}
                  onClick={() => setConfirmarEliminar(true)}
                  className="text-danger"
                >
                  Eliminar
                </TouchButton>
              )}
            </div>
          )}

          {enEdicion && confirmarEliminar && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm text-text">
                ¿Eliminar «{enEdicion.nombre}»? No la usa ningún insumo.
              </p>
              <div className="flex flex-wrap gap-2">
                <TouchButton
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    void ejecutar(async () => {
                      await eliminarMarca(enEdicion.id)
                      cerrar()
                    })
                  }
                  className="bg-danger"
                >
                  Eliminar
                </TouchButton>
                <TouchButton type="button" variant="ghost" onClick={() => setConfirmarEliminar(false)}>
                  Cancelar
                </TouchButton>
              </div>
            </div>
          )}
        </BottomSheet>
      )}
    </section>
  )
}
