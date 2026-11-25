import { useEffect, useState } from 'react'
import type { Lugar } from '../../../lib/db'
import { useInventoryStore } from '../../../stores/inventoryStore'
import {
  bodegasActivas,
  lugaresActivos,
  lugaresDeBodega,
  rotuloBodega,
  useLugarStore,
} from '../../../stores/lugarStore'
import { stockLoteEnBodega } from '../../insumos/lib/stock'
import { compartirBodega, resumenDeJuntar, separarDeBodega } from '../../insumos/lib/bodega'
import {
  crearLugar,
  desactivarLugar,
  guardarNombreTenant,
  leerNombreTenant,
  reactivarLugar,
  renombrarLugar,
} from '../lib/lugares'
import { Boxes, Building, MapPin, Pencil, Plus, Trash, Undo } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { fijarPorcentajeLugar } from '../../tratamientos/lib/catalogo'
import { compararCambios } from '../../insumos/lib/proyeccion'
import { NumeroInput } from '../../../components/ui/NumeroInput'
import { useNombreAutor } from '../../../stores/useNombreAutor'

type Modo =
  | { tipo: 'crear' }
  | { tipo: 'renombrar'; lugar: Lugar }
  | { tipo: 'desactivar'; lugar: Lugar; conStock: number; compartidaCon: string | null }
  | { tipo: 'porcentaje'; lugar: Lugar }
  | { tipo: 'compartir'; lugar: Lugar }
  | { tipo: 'confirmarCompartir'; lugar: Lugar; conId: string }
  | { tipo: 'separar'; lugar: Lugar; compartidaCon: string }
  | null

/**
 * Sección "Lugares de trabajo" (spec 014 US4, contracts/ui-contracts.md):
 * reemplaza "Clínica". Nombre del tenant, y crear, renombrar, desactivar y
 * reactivar lugares. Solo administradores (la monta `AjustesView`).
 *
 * Spec 033 (US1, ui-contracts §1): "Comparte bodega con …" y "Compartir
 * bodega con…", con una confirmación que resume el efecto y unifica mínimos;
 * "Dejar de compartir bodega" y desactivar separando primero (US3).
 */
export function LugaresSection({ sinTitulo = false }: { sinTitulo?: boolean } = {}) {
  const lugares = useLugarStore((s) => s.lugares)
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const insumos = useInventoryStore((s) => s.insumos)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  // Spec 033: mínimo elegido por insumo en la confirmación de juntar.
  const [minimosElegidos, setMinimosElegidos] = useState<Record<string, number | null>>({})
  // Spec 016 US4 (FR-012, Q2): % profesional por lugar, con su historial.
  const porcentajes = useTratamientosStore((s) => s.porcentajes)
  const cambiosTratamiento = useTratamientosStore((s) => s.cambiosTratamiento)
  const autor = useNombreAutor()
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

  /**
   * Insumos con stock en el lugar, para el contador y la confirmación. Spec
   * 033: el stock común de su bodega.
   */
  function insumosConStock(lugarId: string): number {
    const bodega = lugaresDeBodega(lugarId, lugares)
    const conStock = new Set(
      lotes
        .filter((lote) => stockLoteEnBodega(movimientos, lote.id, bodega) > 0)
        .map((lote) => lote.insumoId),
    )
    return conStock.size
  }

  const bodegas = bodegasActivas(lugares)

  /** Spec 033: "Box 1" para Box 2 si comparten bodega; `null` si no comparte. */
  function compartidaCon(lugar: Lugar): string | null {
    if (lugar.desactivadoEn) return null
    const otros = [...lugaresDeBodega(lugar.id, lugares)].filter((id) => id !== lugar.id)
    return otros.length > 0 ? rotuloBodega(otros, lugares) : null
  }

  const resumen =
    modo?.tipo === 'confirmarCompartir'
      ? resumenDeJuntar(modo.lugar.id, modo.conId, {
          insumos,
          lotes,
          movimientos,
          minimosLugar,
          lugares,
        })
      : null

  function elegirConQuien(lugar: Lugar, conId: string) {
    const previo = resumenDeJuntar(lugar.id, conId, {
      insumos,
      lotes,
      movimientos,
      minimosLugar,
      lugares,
    })
    setMinimosElegidos(
      Object.fromEntries(previo.minimosDistintos.map((m) => [m.insumo.id, m.porDefecto])),
    )
    abrir({ tipo: 'confirmarCompartir', lugar, conId })
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
    const con = compartidaCon(lugar)
    // Spec 033 (FR-010): si comparte bodega, siempre se confirma la separación.
    if (conStock > 0 || con) {
      abrir({ tipo: 'desactivar', lugar, conStock, compartidaCon: con })
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
    <section
      className="flex flex-col gap-2"
      aria-labelledby={sinTitulo ? undefined : 'ajustes-lugares'}
    >
      {/* Spec 019: dentro de su subpantalla, el título lo pone la pantalla. */}
      {!sinTitulo && (
        <h2 id="ajustes-lugares" className="flex items-center gap-2 text-h3 text-text">
          <Building size={18} className="text-primary" />
          Lugares de trabajo
        </h2>
      )}

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
          const con = compartidaCon(lugar)
          return (
            <li key={lugar.id}>
              <Card className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                <MapPin size={16} className="shrink-0 text-text-muted" />
                <span className="flex min-w-40 flex-1 flex-col">
                  <span className="truncate text-sm font-bold text-text">{lugar.nombre}</span>
                  {con && (
                    <span className="flex items-center gap-1 text-xs font-bold text-primary-text">
                      <Boxes size={12} className="shrink-0" />
                      Comparte bodega con {con}
                    </span>
                  )}
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
                {con && (
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => abrir({ tipo: 'separar', lugar, compartidaCon: con })}
                    aria-label={`Dejar de compartir bodega de ${lugar.nombre}`}
                    className="px-3 text-xs"
                  >
                    <Undo size={16} />
                    Dejar de compartir bodega
                  </TouchButton>
                )}
                {!desactivado && bodegas.length > 1 && (
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => abrir({ tipo: 'compartir', lugar })}
                    aria-label={`Compartir bodega de ${lugar.nombre} con…`}
                    className="px-3 text-xs"
                  >
                    <Boxes size={16} />
                    Compartir bodega
                  </TouchButton>
                )}
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
              <NumeroInput
                id="porcentaje-lugar"
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
                    {autor(c.usuarioId)}{' '}
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

      {modo?.tipo === 'compartir' && (
        <BottomSheet
          titulo={`Compartir bodega de ${modo.lugar.nombre} con…`}
          onClose={() => setModo(null)}
        >
          <div data-sheet-body className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">
              Los lugares que comparten bodega usan un solo stock, sin traslados entre ellos.
            </p>
            <ul className="flex flex-col gap-2">
              {bodegas
                .filter((grupo) => !grupo.some((l) => l.id === modo.lugar.id))
                .map((grupo) => (
                  <li key={grupo[0].id}>
                    <TouchButton
                      type="button"
                      variant="secondary"
                      className="w-full justify-start"
                      onClick={() => elegirConQuien(modo.lugar, grupo[0].id)}
                    >
                      <MapPin size={16} />
                      {rotuloBodega(
                        grupo.map((l) => l.id),
                        lugares,
                      )}
                    </TouchButton>
                  </li>
                ))}
            </ul>
          </div>
        </BottomSheet>
      )}

      {modo?.tipo === 'confirmarCompartir' && resumen && (
        <BottomSheet titulo="¿Compartir bodega?" onClose={() => setModo(null)}>
          <div data-sheet-body className="flex flex-col gap-3">
            <p className="text-sm text-text">
              El stock de {resumen.rotuloLugar} y {resumen.rotuloCon} se sumará
              {resumen.insumosConStockEnAmbos === 0
                ? '. Ningún insumo tiene stock en ambos.'
                : `: ${
                    resumen.insumosConStockEnAmbos === 1
                      ? '1 insumo con stock en ambos pasará'
                      : `${resumen.insumosConStockEnAmbos} insumos con stock en ambos pasarán`
                  } a un solo total.`}{' '}
              No se borra ni se cambia ningún movimiento.
            </p>
            {resumen.minimosDistintos.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-text">
                  Elige el stock mínimo de la bodega
                </p>
                <ul className="flex flex-col gap-2">
                  {resumen.minimosDistintos.map(({ insumo, opciones }) => (
                    <li key={insumo.id} className="flex flex-col gap-1">
                      <label
                        htmlFor={`minimo-bodega-${insumo.id}`}
                        className="text-sm text-text"
                      >
                        {insumo.nombre}
                      </label>
                      <select
                        id={`minimo-bodega-${insumo.id}`}
                        value={String(opciones.findIndex((o) => o.minimo === minimosElegidos[insumo.id]))}
                        onChange={(event) =>
                          setMinimosElegidos((actual) => ({
                            ...actual,
                            [insumo.id]: opciones[Number(event.target.value)].minimo,
                          }))
                        }
                        className="touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] text-text"
                      >
                        {opciones.map((opcion, indice) => (
                          <option key={opcion.rotulo} value={indice}>
                            {opcion.rotulo}: {opcion.minimo ?? 'sin mínimo'}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <TouchButton
              type="button"
              disabled={ocupado}
              onClick={() =>
                void ejecutar(() =>
                  compartirBodega(
                    modo.lugar.id,
                    modo.conId,
                    new Map(
                      resumen.minimosDistintos.map(({ insumo, porDefecto }) => [
                        insumo.id,
                        insumo.id in minimosElegidos ? minimosElegidos[insumo.id] : porDefecto,
                      ]),
                    ),
                  ),
                )
              }
            >
              Compartir bodega
            </TouchButton>
            <TouchButton type="button" variant="ghost" onClick={() => setModo(null)}>
              Cancelar
            </TouchButton>
          </div>
        </BottomSheet>
      )}

      {modo?.tipo === 'separar' && (
        <BottomSheet
          titulo="¿Dejar de compartir bodega?"
          onClose={() => setModo(null)}
        >
          <div data-sheet-body className="flex flex-col gap-3">
            <p className="text-sm text-text">
              El stock común se queda en {modo.compartidaCon}. {modo.lugar.nombre} empezará en 0;
              podrás trasladarle stock después.
            </p>
            <p className="text-xs text-text-muted">
              Lo que {modo.lugar.nombre} tenía por sus propios movimientos se registra como
              traslados a la bodega. El historial no cambia.
            </p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <TouchButton
              type="button"
              disabled={ocupado}
              onClick={() => void ejecutar(() => separarDeBodega(modo.lugar.id))}
            >
              Dejar de compartir
            </TouchButton>
            <TouchButton type="button" variant="ghost" onClick={() => setModo(null)}>
              Cancelar
            </TouchButton>
          </div>
        </BottomSheet>
      )}

      {modo?.tipo === 'desactivar' && (
        <BottomSheet titulo={`¿Desactivar ${modo.lugar.nombre}?`} onClose={() => setModo(null)}>
          <div data-sheet-body className="flex flex-col gap-3">
            {modo.compartidaCon ? (
              <p className="text-sm text-text">
                Comparte bodega con {modo.compartidaCon}. Primero se separará de la bodega: el
                stock común se queda en {modo.compartidaCon}. El historial se conserva y puedes
                reactivarlo.
              </p>
            ) : (
              <p className="text-sm text-text">
                Tiene {modo.conStock === 1 ? '1 insumo' : `${modo.conStock} insumos`} con stock. Su
                stock dejará de verse en el selector. El historial se conserva y puedes
                reactivarlo.
              </p>
            )}
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
