import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CampoEditableInsumo, Insumo } from '../../../lib/db'
import { useBarcodeScanner } from '../../../lib/scanner/useBarcodeScanner'
import { lotesDeInsumo, useInventoryStore } from '../../../stores/inventoryStore'
import {
  editarInsumo,
  validarEdicionInsumo,
  validarStockMinimo,
  type CambiosInsumoInput,
} from '../lib/catalogo'
import { catalogoCategorias, resolverCategoria } from '../lib/categorias'
import { Minus, Plus, Scan } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import { hayVariosLugares, nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { guardarMinimoLugar } from '../lib/minimos'
import { PresentacionFields } from './PresentacionFields'
import { ConvertirUnidadDialog } from './ConvertirUnidadDialog'

export interface EditarInsumoFormProps {
  insumo: Insumo
  onGuardado: () => void
  onCancelar: () => void
}

const INPUT_CLASS =
  'h-full w-full border-none bg-transparent text-[15px] font-normal text-text outline-none'

/**
 * Escaneo del código de fabricante solo bajo acción explícita (spec 007
 * FR-023, Constitution V): la cámara se pide únicamente tras tocar
 * "Escanear", nunca al abrir el formulario.
 *
 * Oculta temporalmente de este formulario (spec 011 FR-008/FR-010): se deja
 * de invocar más abajo pero se conserva y se exporta (sin cambios de
 * implementación) para poder reactivarla más adelante sin reescribirla.
 */
export function EscanearCodigo({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const { scan, stop } = useBarcodeScanner()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activo, setActivo] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (!activo || !videoRef.current) return
    let cancelado = false
    void scan(videoRef.current).then((resultado) => {
      if (cancelado) return
      setActivo(false)
      if (resultado.status === 'success') onCodigo(resultado.codigo)
      else if (resultado.status === 'unavailable') setMensaje(resultado.message)
      else setMensaje('Código no reconocido.')
    })
    return () => {
      cancelado = true
    }
  }, [activo, scan, onCodigo])

  return (
    <div className="flex flex-col gap-2">
      <TouchButton
        type="button"
        variant="secondary"
        disabled={activo}
        onClick={() => {
          setMensaje(null)
          setActivo(true)
        }}
      >
        <Scan size={18} />
        {activo ? 'Escaneando…' : 'Escanear código'}
      </TouchButton>
      {activo && (
        <Card className="flex flex-col gap-2 p-3">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full rounded-md"
          />
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => {
              stop()
              setActivo(false)
            }}
          >
            Cancelar escaneo
          </TouchButton>
        </Card>
      )}
      {mensaje && (
        <p role="status" className="text-xs text-text-muted">
          {mensaje}
        </p>
      )}
    </div>
  )
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
 * Edición de los datos de producto de un insumo (spec 007 FR-013..FR-017).
 * Precargado con los valores actuales; "admite decimales" se muestra como
 * dato derivado de la unidad (research.md R8). Los errores aparecen bajo
 * cada campo sin borrar lo escrito; "Cancelar" no escribe nada.
 */
export function EditarInsumoForm({
  insumo: insumoMostrado,
  onGuardado,
  onCancelar,
}: EditarInsumoFormProps) {
  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const categoriasRows = useInventoryStore((s) => s.categorias)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  // Spec 014: la lista entrega el insumo con el mínimo del lugar activo; aquí
  // se edita el del catálogo, así que se parte de la fila del catálogo.
  const insumo = insumos.find((i) => i.id === insumoMostrado.id) ?? insumoMostrado
  const catalogo = catalogoCategorias(categoriasRows, insumos)
  // Spec 014 FR-007: con varios lugares, el mínimo del lugar activo aparte.
  const lugarMinimo =
    hayVariosLugares(lugares) && lugarActivoId && lugarActivoId !== 'todos'
      ? lugarActivoId
      : null
  const minimoLugarActual = lugarMinimo
    ? (minimosLugar.find((m) => m.insumoId === insumo.id && m.lugarId === lugarMinimo)
        ?.stockMinimo ?? null)
    : null
  const [minimoLugar, setMinimoLugar] = useState(
    minimoLugarActual === null ? '' : String(minimoLugarActual),
  )
  const minimoLugarValor = minimoLugar.trim() === '' ? null : Number(minimoLugar)
  const [errorMinimoLugar, setErrorMinimoLugar] = useState<string | null>(null)
  const [nombre, setNombre] = useState(insumo.nombre)
  const [categoria, setCategoria] = useState(
    () => resolverCategoria(insumo.categoria, catalogo) ?? insumo.categoria,
  )
  const [unidadMedida, setUnidadMedida] = useState(insumo.unidadMedida)
  // Spec 015 (FR-006): `null` = "igual que la de consumo".
  const [unidadCompra, setUnidadCompra] = useState<string | null>(
    insumo.unidadCompra === insumo.unidadMedida ? null : insumo.unidadCompra,
  )
  const [contenido, setContenido] = useState<number | null>(insumo.contenido)
  const [convirtiendo, setConvirtiendo] = useState(false)
  const [stockMinimo, setStockMinimo] = useState(
    insumo.stockMinimo === null ? '' : String(insumo.stockMinimo),
  )
  const [codigoFabricante, setCodigoFabricante] = useState(
    insumo.codigoFabricante ?? '',
  )
  const [caduca, setCaduca] = useState(insumo.caduca)
  const [errores, setErrores] = useState<
    Partial<Record<CampoEditableInsumo, string>>
  >({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const stockMinimoValor =
    stockMinimo.trim() === '' ? null : Number(stockMinimo)
  const unidadCompraFinal = unidadCompra ?? unidadMedida
  const contenidoFinal = unidadCompraFinal === unidadMedida ? 1 : (contenido ?? Number.NaN)
  const cambios: CambiosInsumoInput = {
    nombre,
    categoria,
    unidadMedida,
    unidadCompra: unidadCompraFinal,
    contenido: contenidoFinal,
    stockMinimo: stockMinimoValor,
    codigoFabricante: codigoFabricante.trim() || null,
    caduca,
  }
  const hayCambios =
    nombre.trim() !== insumo.nombre ||
    categoria !== insumo.categoria ||
    unidadMedida !== insumo.unidadMedida ||
    unidadCompraFinal !== insumo.unidadCompra ||
    contenidoFinal !== insumo.contenido ||
    stockMinimoValor !== insumo.stockMinimo ||
    (codigoFabricante.trim() || null) !== insumo.codigoFabricante ||
    caduca !== insumo.caduca
  const cambiaMinimoLugar = lugarMinimo !== null && minimoLugarValor !== minimoLugarActual
  const tieneLotes = lotesDeInsumo(lotes, insumo.id).length > 0

  function ajustarMinimo(delta: number) {
    const siguiente = Math.max(0, (stockMinimoValor ?? 0) + delta)
    setStockMinimo(String(siguiente))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorGeneral(null)
    const validacion = validarEdicionInsumo(insumo, cambios, insumos, catalogo)
    const errorLugar = cambiaMinimoLugar
      ? validarStockMinimo(minimoLugarValor, unidadMedida)
      : null
    setErrorMinimoLugar(errorLugar)
    if (!validacion.valido || errorLugar) {
      setErrores(validacion.valido ? {} : validacion.errores)
      return
    }
    setErrores({})
    setIsPending(true)
    try {
      if (hayCambios) await editarInsumo(insumo.id, cambios)
      if (cambiaMinimoLugar && lugarMinimo) {
        await guardarMinimoLugar(insumo, lugarMinimo, minimoLugarValor)
      }
      onGuardado()
    } catch (error) {
      setErrorGeneral(
        error instanceof Error ? error.message : 'No se pudo guardar.',
      )
    } finally {
      setIsPending(false)
    }
  }

  const errorProps = (campo: CampoEditableInsumo) =>
    errores[campo]
      ? { 'aria-invalid': true, 'aria-describedby': `error-${campo}` }
      : {}

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <IconField label="Nombre comercial" htmlFor="editar-nombre">
          <input
            id="editar-nombre"
            type="text"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            className={INPUT_CLASS}
            {...errorProps('nombre')}
          />
        </IconField>
        <ErrorCampo id="error-nombre" mensaje={errores.nombre} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
          Categoría
          <select
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            className="touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text"
            {...errorProps('categoria')}
          >
            {catalogo.map((c) => (
              <option key={c.clave} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <ErrorCampo id="error-categoria" mensaje={errores.categoria} />
      </div>

      <PresentacionFields
        idPrefix="editar"
        valor={{ unidadMedida, unidadCompra, contenido }}
        onChange={(cambio) => {
          if (cambio.unidadMedida !== undefined) setUnidadMedida(cambio.unidadMedida)
          if (cambio.unidadCompra !== undefined) setUnidadCompra(cambio.unidadCompra)
          if (cambio.contenido !== undefined) setContenido(cambio.contenido)
        }}
        errores={{
          unidadMedida: errores.unidadMedida,
          unidadCompra: errores.unidadCompra,
          contenido: errores.contenido,
        }}
        accionUnidadConsumo={
          tieneLotes ? (
            // Spec 015 FR-007a: con movimientos, la unidad se cambia por conversión.
            <TouchButton
              type="button"
              variant="ghost"
              onClick={() => setConvirtiendo(true)}
              className="shrink-0 px-3"
            >
              Convertir unidad
            </TouchButton>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-1.5 text-sm font-bold text-text">
        <label htmlFor="editar-stock-minimo">
          {lugarMinimo ? 'Stock mínimo del catálogo' : 'Stock mínimo'} (vacío = sin alerta)
        </label>
        <div className="flex items-stretch gap-2">
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => ajustarMinimo(-1)}
            aria-label="Restar uno al stock mínimo"
          >
            <Minus size={16} />
          </TouchButton>
          <div className="touch-target flex flex-1 items-center justify-center rounded-md border border-border bg-surface">
            <input
              id="editar-stock-minimo"
              type="number"
              step="any"
              min={0}
              value={stockMinimo}
              onChange={(event) => setStockMinimo(event.target.value)}
              className="w-full border-none bg-transparent text-center text-[15px] font-extrabold text-text outline-none"
              {...errorProps('stockMinimo')}
            />
          </div>
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => ajustarMinimo(1)}
            aria-label="Sumar uno al stock mínimo"
          >
            <Plus size={16} />
          </TouchButton>
        </div>
        <ErrorCampo id="error-stockMinimo" mensaje={errores.stockMinimo} />
      </div>

      {lugarMinimo && (
        <div className="flex flex-col gap-1.5 text-sm font-bold text-text">
          <label htmlFor="editar-minimo-lugar">
            Stock mínimo en {nombreLugar(lugares, lugarMinimo)}
          </label>
          <div className="touch-target flex items-center rounded-md border border-border bg-surface px-3.5">
            <input
              id="editar-minimo-lugar"
              type="number"
              step="any"
              min={0}
              value={minimoLugar}
              placeholder={`Usar el del catálogo (${stockMinimoValor ?? 'sin alerta'})`}
              onChange={(event) => setMinimoLugar(event.target.value)}
              className="w-full border-none bg-transparent text-[15px] font-normal text-text outline-none"
              {...(errorMinimoLugar
                ? { 'aria-invalid': true, 'aria-describedby': 'error-minimo-lugar' }
                : {})}
            />
          </div>
          <p className="text-xs font-normal text-text-muted">
            Vacío = usar el mínimo del catálogo en este lugar.
          </p>
          <ErrorCampo id="error-minimo-lugar" mensaje={errorMinimoLugar ?? undefined} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <IconField
          label="Código de fabricante (opcional)"
          htmlFor="editar-codigo"
        >
          <input
            id="editar-codigo"
            type="text"
            value={codigoFabricante}
            onChange={(event) => setCodigoFabricante(event.target.value)}
            className={INPUT_CLASS}
          />
        </IconField>
      </div>

      <div className="flex flex-col gap-1">
        <label className="touch-target flex items-center gap-2 text-sm font-bold text-text">
          <input
            type="checkbox"
            role="switch"
            checked={caduca}
            onChange={(event) => setCaduca(event.target.checked)}
            className="h-5 w-5"
          />
          ¿Caduca?
        </label>
        {caduca !== insumo.caduca && tieneLotes && (
          <p role="note" className="text-xs font-bold text-warning-30-text">
            Los lotes existentes no se modifican.
          </p>
        )}
      </div>

      {errorGeneral && (
        <p role="alert" className="text-sm text-danger">
          {errorGeneral}
        </p>
      )}

      <div className="flex gap-2">
        <TouchButton
          type="button"
          variant="ghost"
          onClick={onCancelar}
          className="flex-1"
        >
          Cancelar
        </TouchButton>
        <TouchButton
          type="submit"
          disabled={!(hayCambios || cambiaMinimoLugar) || isPending}
          className="flex-1"
        >
          {isPending ? 'Guardando…' : 'Guardar'}
        </TouchButton>
      </div>
      {convirtiendo && (
        <ConvertirUnidadDialog
          insumo={insumo}
          onClose={() => setConvirtiendo(false)}
          // El formulario quedó con la unidad anterior: se cierra tras convertir.
          onConvertido={onGuardado}
        />
      )}
    </form>
  )
}
