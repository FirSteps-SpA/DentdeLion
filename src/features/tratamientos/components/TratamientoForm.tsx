import { useState, type FormEvent } from 'react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { IconField } from '../../../components/ui/IconField'
import { Stepper } from '../../../components/ui/Stepper'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Search, Trash } from '../../../components/icons'
import { etiquetaUnidad, unidadAdmiteDecimales } from '../../../lib/unidades'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { lugaresActivos, useLugarStore } from '../../../stores/lugarStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import {
  cambiarActivo,
  crearTratamiento,
  editarTratamiento,
  validarTratamiento,
  type CampoTratamientoInput,
  type TratamientoInput,
} from '../lib/catalogo'
import { cantidadEfectiva } from '../lib/montos'
import type { TratamientoProyectado } from '../lib/proyeccion'
import { textoCosto, textoGanancia } from '../lib/textos'
import { useInsumosPorId, useMontosTratamiento } from '../lib/useMontosTratamiento'
import { ETIQUETA_GANANCIA } from '../lib/montos'

const INPUT_CLASS = 'h-full w-full border-none bg-transparent text-[15px] text-text outline-none'

export interface TratamientoFormProps {
  /** Sin él, alta. */
  tratamiento?: TratamientoProyectado
  onGuardado: () => void
  onCancelar: () => void
}

/**
 * Spec 016 US1 (contracts/ui-contracts.md §3) — alta y edición de un
 * tratamiento: nombre, precio en cada lugar (Q1), materiales con su cantidad
 * en la unidad de consumo y vista previa de costo y "Ganancia estimada" en el
 * lugar activo. Solo administración. Controles ≥ 48 px.
 */
export function TratamientoForm({ tratamiento, onGuardado, onCancelar }: TratamientoFormProps) {
  const insumos = useInventoryStore((s) => s.insumos)
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  const insumosPorId = useInsumosPorId()
  const tratamientos = useTratamientosStore((s) => s.tratamientos)
  const lugares = lugaresActivos(useLugarStore((s) => s.lugares))
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const montosDe = useMontosTratamiento()

  const [nombre, setNombre] = useState(tratamiento?.nombre ?? '')
  const [materiales, setMateriales] = useState<TratamientoInput['materiales']>(
    () =>
      tratamiento?.materiales.map((m) => ({
        insumoId: m.insumoId,
        cantidad: cantidadEfectiva(m, insumosPorId.get(m.insumoId), cambiosInsumo),
      })) ?? [],
  )
  const [precios, setPrecios] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lugares.map((l) => [l.id, String(tratamiento?.precios.get(l.id) ?? '')]),
    ),
  )
  const [busqueda, setBusqueda] = useState('')
  const [errores, setErrores] = useState<Partial<Record<CampoTratamientoInput, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const input: TratamientoInput = {
    nombre,
    materiales,
    precios: Object.fromEntries(
      Object.entries(precios).map(([lugarId, texto]) => [
        lugarId,
        texto.trim() === '' ? null : Number(texto),
      ]),
    ),
  }
  const lugarVistaPrevia =
    lugarActivoId && lugarActivoId !== 'todos' ? lugarActivoId : lugares[0]?.id
  const vistaPrevia = lugarVistaPrevia
    ? montosDe(
        {
          id: tratamiento?.id ?? 'nuevo',
          nombre,
          activo: true,
          materiales: materiales.map((m) => ({
            ...m,
            unidad: insumosPorId.get(m.insumoId)?.unidadMedida ?? 'unidad',
          })),
          precios: new Map(
            Object.entries(input.precios).filter(
              (entrada): entrada is [string, number] => entrada[1] !== null,
            ),
          ),
          creadoEn: '',
          creadoPor: '',
        },
        lugarVistaPrevia,
      )
    : null

  const elegidos = new Set(materiales.map((m) => m.insumoId))
  const resultados = busqueda.trim()
    ? insumos
        .filter(
          (i) =>
            !elegidos.has(i.id) &&
            i.nombre.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')),
        )
        .slice(0, 6)
    : []

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validacion = validarTratamiento(input, tratamientos, insumosPorId, tratamiento?.id)
    setErrores(validacion)
    if (Object.keys(validacion).length > 0) return
    setIsPending(true)
    setErrorGeneral(null)
    try {
      if (tratamiento) await editarTratamiento(tratamiento.id, input)
      else await crearTratamiento(input)
      onGuardado()
    } catch (error) {
      setErrorGeneral(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setIsPending(false)
    }
  }

  async function alternarActivo() {
    if (!tratamiento) return
    await cambiarActivo(tratamiento.id, !tratamiento.activo)
    onGuardado()
  }

  return (
    <BottomSheet titulo={tratamiento ? 'Editar tratamiento' : 'Nuevo tratamiento'} onClose={onCancelar}>
      <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <IconField label="Nombre" htmlFor="tratamiento-nombre">
            <input
              id="tratamiento-nombre"
              type="text"
              maxLength={80}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              className={INPUT_CLASS}
            />
          </IconField>
          {errores.nombre && (
            <p role="alert" className="text-xs text-danger">
              {errores.nombre}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-text">Precio en cada lugar</legend>
          {lugares.map((lugar) => (
            <label
              key={lugar.id}
              className="flex items-center justify-between gap-3 text-sm text-text"
            >
              <span>{lugar.nombre}</span>
              <span className="touch-target flex w-40 items-center gap-1 rounded-md border border-border-input bg-surface px-3">
                <span aria-hidden className="text-text-muted">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  aria-label={`Precio en ${lugar.nombre}`}
                  placeholder="Sin precio"
                  value={precios[lugar.id] ?? ''}
                  onChange={(event) =>
                    setPrecios({ ...precios, [lugar.id]: event.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </span>
            </label>
          ))}
          {errores.precios && (
            <p role="alert" className="text-xs text-danger">
              {errores.precios}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-text">Materiales</legend>
          {materiales.map((material, indice) => {
            const insumo = insumosPorId.get(material.insumoId)
            const unidad = insumo?.unidadMedida ?? 'unidad'
            return (
              <div key={material.insumoId} className="flex flex-col gap-1">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Stepper
                      id={`material-${material.insumoId}`}
                      label={`${insumo?.nombre ?? 'Material'} (${etiquetaUnidad(unidad, 2)})${
                        insumo?.dadoDeBajaEn ? ' · Dado de baja' : ''
                      }`}
                      value={material.cantidad}
                      onChange={(cantidad) =>
                        setMateriales(
                          materiales.map((m, i) =>
                            i === indice ? { ...m, cantidad: cantidad ?? 0 } : m,
                          ),
                        )
                      }
                      min={0}
                      permiteDecimales={unidadAdmiteDecimales(unidad)}
                    />
                  </div>
                  <TouchButton
                    type="button"
                    variant="ghost"
                    aria-label={`Quitar ${insumo?.nombre ?? 'material'}`}
                    onClick={() => setMateriales(materiales.filter((_, i) => i !== indice))}
                  >
                    <Trash size={18} />
                  </TouchButton>
                </div>
              </div>
            )
          })}
          <IconField label="Agregar material" htmlFor="tratamiento-buscar" icon={<Search size={18} />}>
            <input
              id="tratamiento-buscar"
              type="text"
              placeholder="Buscar en el inventario"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              className={INPUT_CLASS}
            />
          </IconField>
          {resultados.length > 0 && (
            <ul className="flex flex-col gap-1">
              {resultados.map((insumo) => (
                <li key={insumo.id}>
                  <TouchButton
                    type="button"
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      setMateriales([...materiales, { insumoId: insumo.id, cantidad: 1 }])
                      setBusqueda('')
                    }}
                  >
                    {insumo.nombre}
                  </TouchButton>
                </li>
              ))}
            </ul>
          )}
          {errores.materiales && (
            <p role="alert" className="text-xs text-danger">
              {errores.materiales}
            </p>
          )}
        </fieldset>

        {vistaPrevia && (
          <p className="text-sm text-text" aria-live="polite">
            Costo de materiales: <span className="font-bold">{textoCosto(vistaPrevia)}</span> ·{' '}
            {ETIQUETA_GANANCIA}: <span className="font-bold whitespace-nowrap">{textoGanancia(vistaPrevia)}</span>
          </p>
        )}

        {errorGeneral && (
          <p role="alert" className="text-sm text-danger">
            {errorGeneral}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <TouchButton type="submit" disabled={isPending}>
            {isPending ? 'Guardando…' : 'Guardar'}
          </TouchButton>
          {tratamiento && (
            <TouchButton type="button" variant="ghost" onClick={() => void alternarActivo()}>
              {tratamiento.activo ? 'Desactivar' : 'Reactivar'}
            </TouchButton>
          )}
        </div>
      </form>
    </BottomSheet>
  )
}
