import { useState } from 'react'
import type { CategoriaTratamiento } from '../../../lib/db'
import { useLugarStore, lugaresActivos } from '../../../stores/lugarStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import {
  crearCategoriaTratamiento,
  guardarCategoriaTratamiento,
} from '../../tratamientos/lib/categorias'
import { claveCategoriaLugar } from '../../tratamientos/lib/proyeccion'
import { Plus } from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { NumeroInput } from '../../../components/ui/NumeroInput'
import { Switch } from '../../../components/ui/Switch'
import { TouchButton } from '../../../components/ui/TouchButton'
import { VerMas } from '../../../components/ui/VerMas'
import { useListaPaginada } from '../../../lib/paginacion'

const INPUT_CLASS = 'h-full w-full border-none bg-transparent text-sm text-text outline-none'

interface Formulario {
  /** `null` = nueva. */
  id: string | null
  nombre: string
  activa: boolean
  /** % por lugar como texto ('' = usa el general). */
  porcentajes: Record<string, string>
}

const formatoPorcentaje = (valor: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(valor)

/**
 * Spec 026 (FR-002, FR-009, contracts/ui-contracts.md §1) — catálogo de
 * categorías de tratamientos en Ajustes, solo para administración: crear,
 * renombrar, desactivar/reactivar y fijar el % profesional de cada categoría
 * en cada lugar activo. Un % vacío usa el general del lugar.
 */
export function CategoriasTratamientoSection() {
  const categorias = useTratamientosStore((s) => s.categorias)
  const porcentajesLugar = useTratamientosStore((s) => s.porcentajes)
  const porcentajesCategoria = useTratamientosStore((s) => s.porcentajesCategoria)
  const lugares = lugaresActivos(useLugarStore((s) => s.lugares))

  const lista = useListaPaginada(categorias, { clave: '', modo: 'ver-mas' })
  const [form, setForm] = useState<Formulario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const propio = (categoriaId: string, lugarId: string) =>
    porcentajesCategoria.get(claveCategoriaLugar(categoriaId, lugarId))

  function abrir(categoria: CategoriaTratamiento | null) {
    setError(null)
    setForm(
      categoria
        ? {
            id: categoria.id,
            nombre: categoria.nombre,
            activa: categoria.desactivadoEn === null,
            porcentajes: Object.fromEntries(
              lugares.map((lugar) => {
                const valor = propio(categoria.id, lugar.id)
                return [lugar.id, valor === undefined ? '' : String(valor)]
              }),
            ),
          }
        : { id: null, nombre: '', activa: true, porcentajes: {} },
    )
  }

  function resumenPorcentajes(categoriaId: string): string | null {
    const partes = lugares
      .filter((lugar) => propio(categoriaId, lugar.id) !== undefined)
      .map((lugar) => `${lugar.nombre}: ${formatoPorcentaje(propio(categoriaId, lugar.id)!)} %`)
    return partes.length > 0 ? partes.join(' · ') : null
  }

  async function guardar() {
    if (!form) return
    setOcupado(true)
    setError(null)
    try {
      if (form.id === null) {
        await crearCategoriaTratamiento(form.nombre)
      } else {
        const porcentajes: Record<string, number | null> = {}
        for (const [lugarId, texto] of Object.entries(form.porcentajes)) {
          porcentajes[lugarId] = texto.trim() === '' ? null : Number(texto)
        }
        await guardarCategoriaTratamiento(form.id, {
          nombre: form.nombre,
          activa: form.activa,
          porcentajes,
        })
      }
      setForm(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">
        Cada categoría puede tener su propio % profesional en cada lugar. Sin él, usa el % general
        del lugar.
      </p>
      <div className="flex items-center justify-end gap-2">
        <TouchButton type="button" variant="secondary" onClick={() => abrir(null)} className="text-sm">
          <Plus size={16} />
          Nueva categoría
        </TouchButton>
      </div>

      {lista.total === 0 ? (
        <Card className="px-3.5 py-4">
          <p className="text-sm text-text-muted">Todavía no hay categorías.</p>
        </Card>
      ) : (
        <Card className="flex flex-col divide-y divide-border px-1.5">
          {lista.visibles.map((categoria) => {
            const resumen = resumenPorcentajes(categoria.id)
            return (
              <button
                key={categoria.id}
                type="button"
                onClick={() => abrir(categoria)}
                aria-label={`Editar ${categoria.nombre}`}
                className="flex min-h-12 flex-col items-start gap-1 rounded-md px-2 py-2.5 text-left hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="text-sm font-semibold break-words text-text">
                  {categoria.nombre}
                  {categoria.desactivadoEn !== null && (
                    <span className="font-normal text-text-muted"> · Desactivada</span>
                  )}
                </span>
                <span className="text-xs text-text-muted">
                  {resumen ?? '% general de cada lugar'}
                </span>
              </button>
            )
          })}
        </Card>
      )}
      <VerMas
        quedan={lista.quedan}
        mostrados={lista.visibles.length}
        total={lista.total}
        onVerMas={lista.verMas}
      />

      {form && (
        <BottomSheet
          titulo={form.id ? 'Editar categoría' : 'Nueva categoría'}
          onClose={() => setForm(null)}
        >
          {error && (
            <Card className="bg-danger-bg px-3.5 py-2.5">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            </Card>
          )}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void guardar()
            }}
            className="flex flex-col gap-4"
          >
            <IconField label="Nombre" htmlFor="categoria-tratamiento-nombre">
              <input
                id="categoria-tratamiento-nombre"
                type="text"
                value={form.nombre}
                maxLength={40}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
                className={INPUT_CLASS}
              />
            </IconField>

            {form.id !== null && (
              <>
                {/* Mismo patrón que Notificaciones: texto visible junto al interruptor (FR-018). */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text">
                    {form.activa ? 'Activa: se ofrece al asignar' : 'Desactivada: no se ofrece al asignar'}
                  </span>
                  <Switch
                    checked={form.activa}
                    onChange={(activa) => setForm({ ...form, activa })}
                    label="Activa (se ofrece al asignar)"
                  />
                </div>
                <fieldset className="flex flex-col gap-3">
                  <legend className="mb-1 text-sm font-bold text-text">
                    % profesional por lugar
                  </legend>
                  {lugares.map((lugar) => {
                    const texto = form.porcentajes[lugar.id] ?? ''
                    const general = porcentajesLugar.get(lugar.id)
                    const valor = Number(texto)
                    const valido = texto.trim() !== '' && valor >= 0 && valor <= 100
                    return (
                      <IconField
                        key={lugar.id}
                        label={lugar.nombre}
                        htmlFor={`porcentaje-categoria-${lugar.id}`}
                        hint={
                          valido
                            ? `Profesional ${formatoPorcentaje(valor)} % · Clínica ${formatoPorcentaje(100 - valor)} %`
                            : undefined
                        }
                      >
                        <NumeroInput
                          id={`porcentaje-categoria-${lugar.id}`}
                          min={0}
                          max={100}
                          step="any"
                          value={texto}
                          placeholder={
                            general === undefined
                              ? 'Sin % general en este lugar'
                              : `Usa el general (${formatoPorcentaje(general)} %)`
                          }
                          onChange={(event) =>
                            setForm({
                              ...form,
                              porcentajes: { ...form.porcentajes, [lugar.id]: event.target.value },
                            })
                          }
                          className={INPUT_CLASS}
                        />
                      </IconField>
                    )
                  })}
                </fieldset>
              </>
            )}

            <TouchButton type="submit" disabled={ocupado || !form.nombre.trim()}>
              Guardar
            </TouchButton>
          </form>
        </BottomSheet>
      )}
    </section>
  )
}
