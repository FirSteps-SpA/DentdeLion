import { useLayoutEffect, useRef, useState, type Ref, type RefObject } from 'react'
import type { EstadoInsumo } from '../lib/estado'
import { estadoVisual } from '../lib/estado'
import { ICONO_ESTADO } from '../lib/estadoIconos'
import type { DisponibilidadConsumo } from '../lib/consumo'
import { MoreVertical, PackageMinus } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { TouchButton } from '../../../components/ui/TouchButton'
import { MOTIVO_DESHABILITADO } from './InsumoCard'
import { formatearPresentacion } from '../lib/presentacion'
import { etiquetaUnidad, formatearEquivalente, formatearCantidad } from '../../../lib/unidades'
import { formatearCLP } from '../lib/precio'
import { useCostosUnitarios } from '../lib/useCostosUnitarios'
import { NombreConMarca } from '../../marcas/components/NombreConMarca'

export interface FilaInventario {
  estadoInsumo: EstadoInsumo
  disponibilidad: DisponibilidadConsumo
  posibleDuplicado: boolean
  /** Spec 014 — en "Todos", el stock de cada lugar. */
  desglose?: string
}

export interface InventarioTablaProps {
  filas: FilaInventario[]
  onOpen: (insumoId: string) => void
  onConsumir: (insumoId: string) => void
  onAbrirMenu: (insumoId: string) => void
  /** Spec 020 R6: título oculto con el rango ("Insumos 26–50 de 200"); se enfoca al cambiar de página. */
  titulo?: string
  tituloRef?: Ref<HTMLTableCaptionElement>
}

const COLUMNAS = [
  'Producto',
  'Categoría',
  'Presentación',
  'Stock',
  'Stock mínimo',
  'Costo unitario',
  'Vencimiento',
  'Estado',
  'Acciones',
]

/**
 * Inventario en tabla para desktop (spec 013 US5, DS §22): mismas filas,
 * acciones, permisos y filtros que las tarjetas (`InsumoCard`) — solo cambia
 * la disposición. Presentación y Costo unitario (spec 015 FR-005/FR-017) en
 * el orden del DS §22.
 *
 * Spec 032 US3 (research.md R7): el encabezado queda fijo bajo la `TopBar`
 * (72 px) al bajar, así que el contenedor usa `overflow-x-clip` (uno con
 * scroll propio haría que el `sticky` se pegue a él y no a la página). Si la
 * tabla no cabe en el ancho (desde 1200 px con la sidebar abierta), pasa a
 * modo compacto: menos padding, encabezados en dos líneas y "Consumir" como
 * ícono. Si ni así cabe, vuelve al scroll horizontal sin encabezado fijo,
 * para no cortar columnas. El borde inferior del encabezado va como sombra
 * porque, con `border-collapse`, el borde de la fila no acompaña al `th` fijo.
 */
export function InventarioTabla({
  filas,
  onOpen,
  onConsumir,
  onAbrirMenu,
  titulo,
  tituloRef,
}: InventarioTablaProps) {
  const costos = useCostosUnitarios()
  const contenedorRef = useRef<HTMLDivElement>(null)
  const tablaRef = useRef<HTMLTableElement>(null)
  const modo = useModoTabla(contenedorRef, tablaRef)
  const compacta = modo !== 'normal'
  const px = compacta ? 'px-2.5' : 'px-4'
  return (
    <div
      ref={contenedorRef}
      data-modo={modo}
      className={`scroll-mt-24 rounded-lg border border-border bg-surface shadow-card ${
        modo === 'desborda' ? 'overflow-x-auto' : 'overflow-x-clip'
      }`}
    >
      <table ref={tablaRef} className="w-full border-collapse text-left">
        {titulo && (
          <caption ref={tituloRef} tabIndex={-1} className="sr-only">
            {titulo}
          </caption>
        )}
        <thead>
          <tr className="border-b border-border">
            {COLUMNAS.map((columna) => (
              <th
                key={columna}
                scope="col"
                className={`${modo === 'desborda' ? '' : 'sticky top-[72px] z-10'} bg-surface ${px} py-3 text-xs font-bold text-text-muted shadow-[inset_0_-1px_0_var(--color-border)] ${
                  compacta ? 'min-w-12' : 'whitespace-nowrap'
                }`}
              >
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ estadoInsumo, disponibilidad, posibleDuplicado, desglose }) => {
            const { insumo, stockTotal, loteMasProximoAVencer } = estadoInsumo
            const visual = estadoVisual(estadoInsumo)
            return (
              <tr
                key={insumo.id}
                className="h-16 border-b border-border last:border-b-0 hover:bg-bg"
              >
                <td className={`${px} py-2`}>
                  <button
                    type="button"
                    onClick={() => onOpen(insumo.id)}
                    className="touch-target flex flex-col items-start justify-center rounded-md text-left focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <NombreConMarca
                      nombre={insumo.nombre}
                      marcaId={insumo.marcaId}
                      className="text-sm font-bold text-text"
                    />
                    <span className="text-caption text-text-muted">
                      {etiquetaUnidad(insumo.unidadMedida)}
                    </span>
                    {posibleDuplicado && (
                      <Badge variant="warning-30">Posible duplicado</Badge>
                    )}
                  </button>
                </td>
                <td className={`${px} py-2 text-sm font-medium text-text`}>
                  {insumo.categoria}
                </td>
                <td className={`${px} py-2 text-sm font-medium text-text`}>
                  {formatearPresentacion(insumo)}
                </td>
                <td className={`${px} py-2 text-sm font-medium whitespace-nowrap text-text`}>
                  {formatearCantidad(stockTotal, insumo.unidadMedida)}
                  {formatearEquivalente(stockTotal, insumo) && (
                    // Spec 015 FR-021: equivalente en unidades de compra.
                    <span className="block text-xs font-normal text-text-muted">
                      {formatearEquivalente(stockTotal, insumo)}
                    </span>
                  )}
                  {desglose && (
                    <span className="block text-xs font-normal text-text-muted">{desglose}</span>
                  )}
                </td>
                <td className={`${px} py-2 text-sm font-medium text-text`}>
                  {insumo.stockMinimo ?? '—'}
                </td>
                <td className={`${px} py-2 text-sm font-medium whitespace-nowrap text-text`}>
                  {costos.has(insumo.id) ? (
                    formatearCLP(costos.get(insumo.id)!.costo)
                  ) : (
                    <span className="text-text-muted">Sin precio</span>
                  )}
                </td>
                <td className={`${px} py-2 text-sm font-medium whitespace-nowrap text-text`}>
                  {loteMasProximoAVencer?.fechaCaducidad ?? '—'}
                </td>
                <td className={`${px} py-2`}>
                  <Badge
                    variant={visual.tono}
                    icono={ICONO_ESTADO[visual.icono]}
                  >
                    {visual.etiqueta}
                  </Badge>
                </td>
                <td className={`${px} py-2`}>
                  <div className="flex items-center gap-1">
                    <TouchButton
                      type="button"
                      variant={disponibilidad.ok ? 'secondary' : 'ghost'}
                      disabled={!disponibilidad.ok}
                      onClick={() => onConsumir(insumo.id)}
                      aria-label={
                        disponibilidad.ok
                          ? `Consumir ${insumo.nombre}`
                          : `${MOTIVO_DESHABILITADO[disponibilidad.motivo]}: ${insumo.nombre}`
                      }
                      title={
                        compacta
                          ? disponibilidad.ok
                            ? 'Consumir'
                            : MOTIVO_DESHABILITADO[disponibilidad.motivo]
                          : undefined
                      }
                      className={`shrink-0 whitespace-nowrap disabled:text-text-muted ${
                        compacta ? 'px-0' : 'px-3'
                      }`}
                    >
                      {compacta ? (
                        <PackageMinus size={20} />
                      ) : disponibilidad.ok ? (
                        'Consumir'
                      ) : (
                        MOTIVO_DESHABILITADO[disponibilidad.motivo]
                      )}
                    </TouchButton>
                    <TouchButton
                      type="button"
                      variant="ghost"
                      onClick={() => onAbrirMenu(insumo.id)}
                      aria-label={`Más opciones de ${insumo.nombre}`}
                      aria-haspopup="dialog"
                      className="shrink-0 border-none px-0 text-text-muted"
                    >
                      <MoreVertical size={20} />
                    </TouchButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type ModoTabla = 'normal' | 'compacta' | 'desborda'

/**
 * Spec 032 (research.md R7): cómo se dibuja la tabla según si entra en el
 * ancho de su contenedor (`offsetWidth` de la tabla, que con `w-full` crece solo si su contenido
 * mínimo no entra, contra `clientWidth` del
 * contenedor). Al pasar a compacta se recuerda el ancho que necesitaba la
 * normal, para volver a ella solo si el contenedor llega a ese ancho (sin
 * parpadeo). Se vuelve a medir al cambiar el contenedor o la tabla (ventana,
 * sidebar, otra página). Sin `ResizeObserver` (jsdom) queda en normal.
 */
function useModoTabla(
  contenedorRef: RefObject<HTMLDivElement | null>,
  tablaRef: RefObject<HTMLTableElement | null>,
): ModoTabla {
  const [modo, setModo] = useState<ModoTabla>('normal')
  const anchoNormal = useRef(0)
  const anchoCompacta = useRef(0)

  useLayoutEffect(() => {
    const contenedor = contenedorRef.current
    const tabla = tablaRef.current
    if (!contenedor || !tabla || typeof ResizeObserver === 'undefined') return
    // Se decide según el modo que está dibujado (`data-modo`), no el del
    // estado: el observador puede medir antes de que React pinte el cambio.
    const medir = () => {
      const dibujado = (contenedor.dataset.modo ?? 'normal') as ModoTabla
      const disponible = contenedor.clientWidth + 1
      const necesita = tabla.offsetWidth
      let siguiente: ModoTabla = dibujado
      if (dibujado === 'normal') {
        if (necesita > disponible) {
          anchoNormal.current = necesita
          siguiente = 'compacta'
        }
      } else if (disponible >= anchoNormal.current) {
        siguiente = 'normal'
      } else if (dibujado === 'compacta') {
        if (necesita > disponible) {
          anchoCompacta.current = necesita
          siguiente = 'desborda'
        }
      } else if (disponible >= anchoCompacta.current) {
        siguiente = 'compacta'
      }
      setModo(siguiente)
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(contenedor)
    observador.observe(tabla)
    return () => observador.disconnect()
  }, [contenedorRef, tablaRef])

  return modo
}
