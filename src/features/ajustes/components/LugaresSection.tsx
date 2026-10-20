import { useEffect, useState } from 'react'
import type { Lugar } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { lugaresActivos, useLugarStore } from '../../../stores/lugarStore'
import { stockLoteEnLugar } from '../../insumos/lib/stock'
import {
  crearLugar,
  desactivarLugar,
  guardarNombreTenant,
  leerNombreTenant,
  reactivarLugar,
  renombrarLugar,
} from '../lib/lugares'
import { Building, MapPin, Pencil, Plus, Trash, Undo } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useAuthStore } from '../../../stores/authStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { fijarPorcentajeLugar } from '../../tratamientos/lib/catalogo'
import { compararCambios } from '../../insumos/lib/proyeccion'

type Modo =
  | { tipo: 'crear' }
  | { tipo: 'renombrar'; lugar: Lugar }
  | { tipo: 'desactivar'; lugar: Lugar; conStock: number }
  | { tipo: 'porcentaje'; lugar: Lugar }
  | null

/**
 * Sección "Lugares de trabajo" (spec 014 US4, contracts/ui-contracts.md):
 * reemplaza "Clínica". Nombre del tenant, y crear, renombrar, desactivar y
 * reactivar lugares. Solo administradores (la monta `AjustesView`).
 */
export function LugaresSection() {
  const lugares = useLugarStore((s) => s.lugares)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  // Spec 016 US4 (FR-012, Q2): % profesional por lugar, con su historial.
  const porcentajes = useTratamientosStore((s) => s.porcentajes)
  const cambiosTratamiento = useTratamientosStore((s) => s.cambiosTratamiento)
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const [porcentajeInput, setPorcentajeInput] = useState('')

  const [nombreTenant, setNombreTenant] = useState<string | null>(null)
  const [cargandoTenant, setCargandoTenant] = useState(true)
  const [modo, setModo] = useState<Modo>(null)
  const [nombreInput, setNombreInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorTenant, setErrorTenant] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let cancelado = false
    void leerNombreTenant().then((nombre) => {
      if (cancelado) return
      setNombreTenant(nombre)
      setCargandoTenant(false)
    })
    return () => {
      cancelado = true
    }
  }, [])

  const activos = lugaresActivos(lugares)
  const ordenados = [...lugares].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))

  /** Insumos con stock en el lugar, para el contador y la confirmación. */
  function insumosConStock(lugarId: string): number {
    const insumos = new Set(
      lotes
        .filter((lote) => stockLoteEnLugar(movimientos, lote.id, lugarId) > 0)
        .map((lote) => lote.insumoId),
    )
    return insumos.size
  }

  function abrir(nuevo: Modo) {
    setModo(nuevo)
    setError(null)
    setNombreInput(nuevo?.tipo === 'renombrar' ? nuevo.lugar.nombre : '')
  }

  async function ejecutar(accion: () => Promise<unknown>) {
    setOcupado(true)
    setError(null)
    try {
      await accion()
      setModo(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setOcupado(false)
    }
  }

  function pedirDesactivar(lugar: Lugar) {
    const conStock = insumosConStock(lugar.id)
    if (conStock > 0) {
      abrir({ tipo: 'desactivar', lugar, conStock })
      return
    }
    void ejecutar(() => desactivarLugar(lugar.id))
  }

  async function guardarTenant(valor: string) {
    if (valor.trim() === (nombreTenant ?? '')) return
    setErrorTenant(null)
    try {
      await guardarNombreTenant(valor)
      setNombreTenant(valor.trim())
    } catch (err) {
      setErrorTenant(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="ajustes-lugares">
      <h2 id="ajustes-lugares" className="flex items-center gap-2 text-h3 text-text">
        <Building size={18} className="text-primary" />
        Lugares de trabajo
      </h2>

      <IconField
        label="Nombre del cliente (clínica o profesional)"
        htmlFor="nombre-tenant"
        hint={
          !cargandoTenant && nombreTenant === null
            ? 'Necesitas conexión para ver o cambiar el nombre.'
            : undefined
        }
        error={errorTenant ?? undefined}
      >
        <input
          key={nombreTenant ?? 'sin-nombre'}
          id="nombre-tenant"
          type="text"
          defaultValue={nombreTenant ?? ''}
          disabled={nombreTenant === null}
          onBlur={(event) => void guardarTenant(event.target.value)}
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>

      {error && !modo && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}

      <ul className="flex flex-col gap-2">
        {ordenados.map((lugar) => {
          const desactivado = !!lugar.desactivadoEn
          const conStock = insumosConStock(lugar.id)
          return (
            <li key={lugar.id}>
              <Card className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                <MapPin size={16} className="shrink-0 text-text-muted" />
                <span className="flex min-w-40 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-text">{lugar.nombre}</span>
                  <span className="text-xs text-text-muted">
                    {conStock === 1 ? '1 insumo con stock' : `${conStock} insumos con stock`}
                  </span>
                  <span className="text-xs text-text-muted">
                    {porcentajes.has(lugar.id)
                      ? `Profesional ${porcentajes.get(lugar.id)} % · Clínica ${
                          100 - (porcentajes.get(lugar.id) ?? 0)
                        } %`
                      : 'Sin % profesional'}
                  </span>
                </span>
                <TouchButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPorcentajeInput(String(porcentajes.get(lugar.id) ?? ''))
                    setError(null)
                    setModo({ tipo: 'porcentaje', lugar })
                  }}
                  aria-label={`% profesional de ${lugar.nombre}`}
                  className="px-3 text-xs"
                >
                  %
                </TouchButton>
                {desactivado && <Badge variant="warning-30">Desactivado</Badge>}
                <TouchButton
                  type="button"
                  variant="ghost"
                  onClick={() => abrir({ tipo: 'renombrar', lugar })}
                  aria-label={`Renombrar ${lugar.nombre}`}
                  className="px-3"
                >
                  <Pencil size={16} />
                </TouchButton>
                {desactivado ? (
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => void ejecutar(() => reactivarLugar(lugar.id))}
                    className="px-3 text-xs"
                  >
                    <Undo size={16} />
                    Reactivar
                  </TouchButton>
                ) : (
                  <TouchButton
                    type="button"
                    variant="ghost"
                    disabled={activos.length <= 1}
                    title={
                      activos.length <= 1
                        ? 'Debe quedar al menos un lugar de trabajo activo'
                        : undefined
                    }
                    onClick={() => pedirDesactivar(lugar)}
                    className="px-3 text-xs"
                  >
                    <Trash size={16} />
                    Desactivar
                  </TouchButton>
                )}
              </Card>
            </li>
          )
        })}
      </ul>

      <TouchButton type="button" variant="secondary" onClick={() => abrir({ tipo: 'crear' })}>
        <Plus size={16} />
        Nuevo lugar
      </TouchButton>

      {modo?.tipo === 'porcentaje' && (
        <BottomSheet titulo={`% profesional en ${modo.lugar.nombre}`} onClose={() => setModo(null)}>
          <form
            data-sheet-body
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const valor = porcentajeInput.trim() === '' ? null : Number(porcentajeInput)
              void ejecutar(() =>
                fijarPorcentajeLugar(
                  modo.lugar.id,
                  valor,
                  porcentajes.get(modo.lugar.id) ?? null,
                ),
              )
            }}
          >
            <IconField
              label="% profesional (0–100)"
              htmlFor="porcentaje-lugar"
              error={error ?? undefined}
              hint={
                porcentajeInput.trim() !== '' &&
                Number(porcentajeInput) >= 0 &&
                Number(porcentajeInput) <= 100
                  ? `Clínica: ${100 - Number(porcentajeInput)} %`
                  : 'Vacío = sin porcentaje (no se calcula la ganancia estimada).'
              }
            >
              <input
                id="porcentaje-lugar"
                type="number"
                min={0}
                max={100}
                step="any"
                value={porcentajeInput}
                onChange={(event) => setPorcentajeInput(event.target.value)}
                className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
              />
            </IconField>
            <TouchButton type="submit" disabled={ocupado}>
              Guardar
            </TouchButton>
            <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
              {cambiosTratamiento
                .filter(
                  (c) =>
                    c.campo === 'porcentajeProfesional' &&
                    c.lugarId === modo.lugar.id &&
                    c.rechazadoEn === null,
                )
                .sort(compararCambios)
                .reverse()
                .map((c) => (
                  <li key={c.id}>
                    {c.valorAnterior === null ? 'sin %' : `${c.valorAnterior} %`} →{' '}
                    {c.valorNuevo === null ? 'sin %' : `${c.valorNuevo} %`} ·{' '}
                    {c.usuarioId === usuario?.id
                      ? usuario.nombre
                      : (conocidos.find((k) => k.id === c.usuarioId)?.nombre ?? 'otra persona')}{' '}
                    ·{' '}
                    {new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(
                      new Date(c.creadoEn),
                    )}
                  </li>
                ))}
            </ul>
          </form>
        </BottomSheet>
      )}

      {(modo?.tipo === 'crear' || modo?.tipo === 'renombrar') && (
        <BottomSheet
          titulo={modo.tipo === 'crear' ? 'Nuevo lugar de trabajo' : 'Renombrar lugar'}
          onClose={() => setModo(null)}
        >
          <form
            data-sheet-body
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void ejecutar(() =>
                modo.tipo === 'crear'
                  ? crearLugar(nombreInput)
                  : renombrarLugar(modo.lugar.id, nombreInput),
              )
            }}
          >
            <IconField label="Nombre del lugar" htmlFor="nombre-lugar" error={error ?? undefined}>
              <input
                id="nombre-lugar"
                type="text"
                value={nombreInput}
                maxLength={60}
                placeholder="p. ej. Box Las Condes"
                onChange={(event) => setNombreInput(event.target.value)}
                className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
              />
            </IconField>
            <TouchButton type="submit" disabled={ocupado}>
              {modo.tipo === 'crear' ? 'Crear lugar' : 'Guardar'}
            </TouchButton>
          </form>
        </BottomSheet>
      )}

      {modo?.tipo === 'desactivar' && (
        <BottomSheet titulo={`¿Desactivar ${modo.lugar.nombre}?`} onClose={() => setModo(null)}>
          <div data-sheet-body className="flex flex-col gap-3">
            <p className="text-sm text-text">
              Tiene {modo.conStock === 1 ? '1 insumo' : `${modo.conStock} insumos`} con stock. Su
              stock dejará de verse en el selector. El historial se conserva y puedes reactivarlo.
            </p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <TouchButton
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(() => desactivarLugar(modo.lugar.id))}
            >
              Desactivar
            </TouchButton>
            <TouchButton type="button" variant="ghost" onClick={() => setModo(null)}>
              Cancelar
            </TouchButton>
          </div>
        </BottomSheet>
      )}
    </section>
  )
}
