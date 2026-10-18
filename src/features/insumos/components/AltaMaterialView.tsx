import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import type { Insumo } from '../../../lib/db'
import { mesesRestantes } from '../../../lib/dateMath'
import { useAuthStore } from '../../../stores/authStore'
import { findInsumoPorCodigo, useInventoryStore } from '../../../stores/inventoryStore'
import { ETIQUETAS_UNIDAD, UNIDADES_MEDIDA } from '../lib/catalogo'
import { catalogoCategorias, resolverCategoria } from '../lib/categorias'
import {
  darDeAltaMaterial,
  sugerirMateriales,
  validarAltaMaterial,
  type AltaMaterialInput,
  type CampoAlta,
} from '../lib/alta'
import { ALTA_VACIA, useBorradorAlta } from '../lib/useBorradorAlta'
import { permiteDecimales } from '../lib/quantity'
import { Hash, Truck, Calendar } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Stepper } from '../../../components/ui/Stepper'
import { ConfirmarLoteCaducadoDialog } from './ConfirmarLoteCaducadoDialog'

export interface AltaMaterialViewProps {
  nombreInicial?: string
  onCreated: (resultado: { insumo: Insumo; conLoteInicial: boolean }) => void
  onCancel: () => void
  onAbrirExistente: (insumo: Insumo) => void
}

const INPUT_CLASS =
  'h-full w-full border-none bg-transparent text-sm text-text outline-none'

const SENTINEL_NUEVA = '__nueva-categoria__'

const ORDEN_CAMPOS: CampoAlta[] = [
  'nombre',
  'categoria',
  'unidadMedida',
  'stockMinimo',
  'stockInicial',
  'numeroLote',
  'proveedor',
  'fechaCaducidad',
]

const ID_POR_CAMPO: Record<CampoAlta, string> = {
  nombre: 'alta-nombre',
  categoria: 'alta-categoria',
  unidadMedida: 'alta-unidad-grupo',
  stockMinimo: 'alta-stock-minimo',
  stockInicial: 'alta-stock-inicial',
  numeroLote: 'alta-lote-numero',
  proveedor: 'alta-lote-proveedor',
  fechaCaducidad: 'alta-lote-fecha',
}

function ErrorCampo({ id, mensaje }: { id: string; mensaje?: string }) {
  if (!mensaje) return null
  return (
    <p id={id} role="alert" className="text-xs text-danger">
      {mensaje}
    </p>
  )
}

/**
 * Vista de pantalla completa "Nuevo Material" (spec 008 contracts/ui-contracts.md).
 * Cubre US1–US4: alta sin stock, "Guardar e Ingresar" con primer lote,
 * categoría nueva (solo administrador) y sugerencias/código duplicado. La
 * cámara nunca se activa al montar (Constitution V) — `ScanButton` solo
 * actúa al tocarlo.
 */
export function AltaMaterialView({
  nombreInicial,
  onCreated,
  onCancel,
  onAbrirExistente,
}: AltaMaterialViewProps) {
  const insumos = useInventoryStore((s) => s.insumos)
  const categoriasRows = useInventoryStore((s) => s.categorias)
  const usuario = useAuthStore((s) => s.usuario)
  const { datos, setDatos, restaurado, isLoading, descartar } = useBorradorAlta({
    nombre: nombreInicial ?? '',
  })

  const [errores, setErrores] = useState<Partial<Record<CampoAlta, string>>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [mostrarConfirmarCancelar, setMostrarConfirmarCancelar] = useState(false)
  const [mostrarDialogoCaducado, setMostrarDialogoCaducado] = useState(false)
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [categoriaTexto, setCategoriaTexto] = useState('')
  const [categoriaHint, setCategoriaHint] = useState<string | null>(null)
  const [codigoDuplicado, setCodigoDuplicado] = useState<Insumo | null>(null)
  const fechaRef = useRef<HTMLInputElement>(null)

  const catalogo = catalogoCategorias(categoriasRows, insumos)
  const permiteDecimalesUnidad = permiteDecimales(datos.unidadMedida)
  const vidaUtil = datos.caduca ? mesesRestantes(datos.lote.fechaCaducidad) : null
  const sugerencias = sugerirMateriales(insumos, datos.nombre)
  const esAdmin = usuario?.rol === 'administrador'

  if (isLoading) return null

  const errorProps = (campo: CampoAlta) =>
    errores[campo]
      ? { 'aria-invalid': true, 'aria-describedby': `error-${campo}` }
      : {}

  function verificarCodigo(codigo: string) {
    const trimmed = codigo.trim()
    setCodigoDuplicado(trimmed ? (findInsumoPorCodigo(insumos, trimmed) ?? null) : null)
  }

  function onCategoriaChange(event: ChangeEvent<HTMLSelectElement>) {
    const valor = event.target.value
    if (valor === SENTINEL_NUEVA) {
      setCategoriaTexto('')
      setCreandoCategoria(true)
      return
    }
    setCategoriaHint(null)
    setDatos({ categoria: valor, categoriaNueva: false })
  }

  function usarCategoriaNueva() {
    const nombreTexto = categoriaTexto.trim()
    const resuelta = resolverCategoria(nombreTexto, catalogo)
    if (resuelta !== null) {
      setDatos({ categoria: resuelta, categoriaNueva: false })
      setCategoriaHint(`Ya existía: se usará «${resuelta}»`)
    } else {
      setDatos({ categoria: nombreTexto, categoriaNueva: true })
      setCategoriaHint(null)
    }
    setCreandoCategoria(false)
  }

  function toggleCaduca() {
    const apagando = datos.caduca
    setDatos({
      caduca: !datos.caduca,
      lote: apagando ? { ...datos.lote, fechaCaducidad: '' } : datos.lote,
    })
  }

  function enfocarPrimerError(erroresActuales: Partial<Record<CampoAlta, string>>) {
    const campo = ORDEN_CAMPOS.find((c) => erroresActuales[c])
    if (!campo) return
    document.getElementById(ID_POR_CAMPO[campo])?.focus()
  }

  async function intentarGuardar(datosParaGuardar: AltaMaterialInput) {
    const hoy = new Date().toISOString().slice(0, 10)
    const validacion = validarAltaMaterial(datosParaGuardar, insumos, catalogo, hoy)
    if (!validacion.valido) {
      setErrores(validacion.errores)
      setErrorGeneral(null)
      enfocarPrimerError(validacion.errores)
      return
    }
    setErrores({})
    if (validacion.advertencias.loteCaducado && !datosParaGuardar.confirmarCaducado) {
      setMostrarDialogoCaducado(true)
      return
    }

    setIsPending(true)
    setErrorGeneral(null)
    try {
      const resultado = await darDeAltaMaterial(datosParaGuardar)
      // Cancels any still-pending debounced borrador write (useBorradorAlta
      // would otherwise resurrect it on unmount) — the transaction above
      // already deleted the row, so this is a no-op on the DB.
      await descartar()
      onCreated(resultado)
    } catch (error) {
      setErrorGeneral(
        error instanceof Error ? error.message : 'No se pudo guardar.',
      )
    } finally {
      setIsPending(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await intentarGuardar(datos)
  }

  async function confirmarLoteCaducado() {
    setMostrarDialogoCaducado(false)
    await intentarGuardar({ ...datos, confirmarCaducado: true })
  }

  function revisarFecha() {
    setMostrarDialogoCaducado(false)
    fechaRef.current?.focus()
  }

  async function handleCancelar() {
    const base = { ...ALTA_VACIA, nombre: nombreInicial ?? '' }
    if (JSON.stringify(datos) !== JSON.stringify(base)) {
      setMostrarConfirmarCancelar(true)
      return
    }
    await descartar()
    onCancel()
  }

  async function confirmarDescartar() {
    setMostrarConfirmarCancelar(false)
    await descartar()
    onCancel()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-h3 text-text">Nuevo Material</h1>
        <TouchButton
          type="button"
          variant="ghost"
          onClick={() => void handleCancelar()}
        >
          Cancelar
        </TouchButton>
      </header>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {restaurado && (
            <Card className="bg-primary-soft px-3.5 py-2.5">
              <p role="status" className="text-sm font-bold text-primary">
                Recuperamos tu alta sin terminar
              </p>
            </Card>
          )}

          <div className="flex flex-col gap-1">
            <IconField label="Nombre del material" htmlFor="alta-nombre">
              <input
                id="alta-nombre"
                type="text"
                autoFocus
                value={datos.nombre}
                onChange={(event) => setDatos({ nombre: event.target.value })}
                className={INPUT_CLASS}
                {...errorProps('nombre')}
              />
            </IconField>
            <ErrorCampo id="error-nombre" mensaje={errores.nombre} />
          </div>

          {sugerencias.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
                Ya existen materiales parecidos
              </p>
              <ul className="flex flex-col gap-1.5">
                {sugerencias.map((s) => (
                  <li key={s.id}>
                    <Card
                      as="button"
                      type="button"
                      onClick={() => onAbrirExistente(s)}
                      className="touch-target flex w-full items-center px-3.5 text-left"
                    >
                      <span className="text-sm text-text">
                        «{s.nombre}» · {s.categoria} — Ver
                      </span>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {!creandoCategoria ? (
              <>
                <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
                  Categoría
                  <select
                    id="alta-categoria"
                    value={datos.categoria}
                    onChange={onCategoriaChange}
                    className="touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text"
                    {...errorProps('categoria')}
                  >
                    <option value="" disabled>
                      Elige una categoría
                    </option>
                    {catalogo.map((c) => (
                      <option key={c.clave} value={c.nombre}>
                        {c.nombre}
                      </option>
                    ))}
                    {datos.categoriaNueva &&
                      datos.categoria &&
                      !catalogo.some((c) => c.nombre === datos.categoria) && (
                        <option value={datos.categoria}>
                          {datos.categoria} (nueva)
                        </option>
                      )}
                    {esAdmin && (
                      <option value={SENTINEL_NUEVA}>+ Crear nueva categoría</option>
                    )}
                  </select>
                </label>
                {categoriaHint && (
                  <p className="text-xs text-text-muted">{categoriaHint}</p>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <IconField
                  label="Nombre de la nueva categoría"
                  htmlFor="alta-categoria-nueva"
                >
                  <input
                    id="alta-categoria-nueva"
                    type="text"
                    maxLength={40}
                    autoFocus
                    value={categoriaTexto}
                    onChange={(event) => setCategoriaTexto(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </IconField>
                <div className="flex gap-2">
                  <TouchButton
                    type="button"
                    onClick={usarCategoriaNueva}
                    className="flex-1"
                  >
                    Usar
                  </TouchButton>
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => setCreandoCategoria(false)}
                    className="flex-1"
                  >
                    Volver a la lista
                  </TouchButton>
                </div>
              </div>
            )}
            <ErrorCampo id="error-categoria" mensaje={errores.categoria} />
          </div>

          <div className="flex flex-col gap-1.5 text-sm font-bold text-text">
            <p id="alta-unidad-label">Unidad de medida</p>
            <div
              id="alta-unidad-grupo"
              role="group"
              aria-labelledby="alta-unidad-label"
              className="grid grid-cols-3 gap-2"
            >
              {UNIDADES_MEDIDA.map((u) => (
                <TouchButton
                  key={u}
                  type="button"
                  variant={datos.unidadMedida === u ? 'primary' : 'ghost'}
                  aria-pressed={datos.unidadMedida === u}
                  onClick={() => setDatos({ unidadMedida: u })}
                >
                  {ETIQUETAS_UNIDAD[u]}
                </TouchButton>
              ))}
            </div>
            <ErrorCampo id="error-unidadMedida" mensaje={errores.unidadMedida} />
          </div>

          <div className="flex flex-col gap-1">
            <Stepper
              id="alta-stock-minimo"
              label="Stock mínimo (opcional)"
              value={datos.stockMinimo}
              onChange={(v) => setDatos({ stockMinimo: v })}
              min={0}
              permiteDecimales={permiteDecimalesUnidad}
              allowEmpty
              {...errorProps('stockMinimo')}
            />
            <ErrorCampo id="error-stockMinimo" mensaje={errores.stockMinimo} />
          </div>

          <div className="flex flex-col gap-1">
            <Stepper
              id="alta-stock-inicial"
              label="Stock inicial"
              value={datos.stockInicial}
              onChange={(v) => setDatos({ stockInicial: v ?? 0 })}
              min={0}
              permiteDecimales={permiteDecimalesUnidad}
              {...errorProps('stockInicial')}
            />
            <ErrorCampo id="error-stockInicial" mensaje={errores.stockInicial} />
          </div>

          {datos.stockInicial > 0 && (
            <Card className="flex flex-col gap-3 p-3.5">
              <p className="text-sm font-bold text-text">Primer lote</p>
              <div className="flex flex-col gap-1">
                <IconField
                  label="Número de lote"
                  icon={<Hash size={18} />}
                  htmlFor="alta-lote-numero"
                >
                  <input
                    id="alta-lote-numero"
                    type="text"
                    value={datos.lote.numeroLote}
                    onChange={(event) =>
                      setDatos({
                        lote: { ...datos.lote, numeroLote: event.target.value },
                      })
                    }
                    className={INPUT_CLASS}
                    {...errorProps('numeroLote')}
                  />
                </IconField>
                <ErrorCampo id="error-numeroLote" mensaje={errores.numeroLote} />
              </div>
              <div className="flex flex-col gap-1">
                <IconField
                  label="Proveedor"
                  icon={<Truck size={18} />}
                  htmlFor="alta-lote-proveedor"
                >
                  <input
                    id="alta-lote-proveedor"
                    type="text"
                    value={datos.lote.proveedor}
                    onChange={(event) =>
                      setDatos({
                        lote: { ...datos.lote, proveedor: event.target.value },
                      })
                    }
                    className={INPUT_CLASS}
                    {...errorProps('proveedor')}
                  />
                </IconField>
                <ErrorCampo id="error-proveedor" mensaje={errores.proveedor} />
              </div>
              {datos.caduca && (
                <div className="flex flex-col gap-1">
                  <IconField
                    label="Fecha de vencimiento"
                    icon={<Calendar size={18} />}
                    htmlFor="alta-lote-fecha"
                    hint={
                      vidaUtil !== null
                        ? `Vida útil restante estimada: ${vidaUtil} ${vidaUtil === 1 ? 'mes' : 'meses'}`
                        : undefined
                    }
                  >
                    <input
                      id="alta-lote-fecha"
                      ref={fechaRef}
                      type="date"
                      value={datos.lote.fechaCaducidad}
                      onChange={(event) =>
                        setDatos({
                          lote: {
                            ...datos.lote,
                            fechaCaducidad: event.target.value,
                          },
                        })
                      }
                      className={INPUT_CLASS}
                      {...errorProps('fechaCaducidad')}
                    />
                  </IconField>
                  <ErrorCampo
                    id="error-fechaCaducidad"
                    mensaje={errores.fechaCaducidad}
                  />
                </div>
              )}
            </Card>
          )}

          <div className="flex flex-col gap-1">
            <IconField label="Código de barras (opcional)" htmlFor="alta-codigo">
              <input
                id="alta-codigo"
                type="text"
                value={datos.codigoFabricante}
                onChange={(event) =>
                  setDatos({ codigoFabricante: event.target.value })
                }
                onBlur={() => verificarCodigo(datos.codigoFabricante)}
                className={INPUT_CLASS}
              />
            </IconField>
            {codigoDuplicado && (
              <Card className="flex flex-col gap-2 bg-warning-30-bg px-3.5 py-2.5">
                <p className="text-sm font-bold text-warning-30-text">
                  Este código ya corresponde a «{codigoDuplicado.nombre}».
                </p>
                <TouchButton
                  type="button"
                  variant="secondary"
                  onClick={() => onAbrirExistente(codigoDuplicado)}
                >
                  Abrir «{codigoDuplicado.nombre}»
                </TouchButton>
              </Card>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={datos.caduca}
            onClick={toggleCaduca}
            className="touch-target flex w-full items-center justify-between rounded-md border border-border bg-surface px-3.5 text-left text-sm font-bold text-text"
          >
            Sujeto a caducidad
            <span className="text-text-muted">{datos.caduca ? 'Sí' : 'No'}</span>
          </button>

          {errorGeneral && (
            <Card className="bg-danger-bg px-3.5 py-2.5">
              <p role="alert" className="text-sm text-danger">
                {errorGeneral}
              </p>
            </Card>
          )}
        </div>

        <div className="border-t border-border bg-bg px-4 py-3">
          <TouchButton type="submit" disabled={isPending} className="w-full">
            {isPending
              ? 'Guardando…'
              : datos.stockInicial > 0
                ? 'Guardar e Ingresar'
                : 'Guardar'}
          </TouchButton>
        </div>
      </form>

      {mostrarConfirmarCancelar && (
        <BottomSheet
          titulo="¿Descartar este material?"
          onClose={() => setMostrarConfirmarCancelar(false)}
        >
          <p className="text-sm text-text">Se perderá lo que escribiste.</p>
          <div className="flex gap-2">
            <TouchButton
              type="button"
              variant="ghost"
              onClick={() => setMostrarConfirmarCancelar(false)}
              className="flex-1"
            >
              Seguir editando
            </TouchButton>
            <TouchButton
              type="button"
              onClick={() => void confirmarDescartar()}
              className="flex-1 bg-danger!"
            >
              Descartar
            </TouchButton>
          </div>
        </BottomSheet>
      )}

      {mostrarDialogoCaducado && (
        <ConfirmarLoteCaducadoDialog
          fechaCaducidad={datos.lote.fechaCaducidad}
          onConfirmar={() => void confirmarLoteCaducado()}
          onCancelar={revisarFecha}
        />
      )}
    </div>
  )
}
