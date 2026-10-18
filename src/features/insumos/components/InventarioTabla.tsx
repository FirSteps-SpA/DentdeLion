import type { EstadoInsumo } from '../lib/estado'
import { estadoVisual } from '../lib/estado'
import { ICONO_ESTADO } from '../lib/estadoIconos'
import type { DisponibilidadConsumoRapido } from '../lib/consumoRapido'
import { MoreVertical } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { TouchButton } from '../../../components/ui/TouchButton'
import { MOTIVO_DESHABILITADO } from './InsumoCard'

export interface FilaInventario {
  estadoInsumo: EstadoInsumo
  disponibilidad: DisponibilidadConsumoRapido
  posibleDuplicado: boolean
}

export interface InventarioTablaProps {
  filas: FilaInventario[]
  onOpen: (insumoId: string) => void
  onConsumirUno: (insumoId: string) => void
  onAbrirMenu: (insumoId: string) => void
}

const COLUMNAS = [
  'Producto',
  'Categoría',
  'Stock',
  'Stock mínimo',
  'Vencimiento',
  'Estado',
  'Acciones',
]

/**
 * Inventario en tabla para desktop (spec 013 US5, DS §22): mismas filas,
 * acciones, permisos y filtros que las tarjetas (`InsumoCard`) — solo cambia
 * la disposición. Columnas con datos de hoy; Presentación y Costo unitario
 * llegan con la spec 015.
 */
export function InventarioTabla({
  filas,
  onOpen,
  onConsumirUno,
  onAbrirMenu,
}: InventarioTablaProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border">
            {COLUMNAS.map((columna) => (
              <th
                key={columna}
                scope="col"
                className="px-4 py-3 text-xs font-bold whitespace-nowrap text-text-muted"
              >
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ estadoInsumo, disponibilidad, posibleDuplicado }) => {
            const { insumo, stockTotal, loteMasProximoAVencer } = estadoInsumo
            const visual = estadoVisual(estadoInsumo)
            return (
              <tr
                key={insumo.id}
                className="h-16 border-b border-border last:border-b-0 hover:bg-bg"
              >
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onOpen(insumo.id)}
                    className="touch-target flex flex-col items-start justify-center rounded-md text-left focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <span className="text-sm font-bold text-text">
                      {insumo.nombre}
                    </span>
                    <span className="text-caption text-text-muted">
                      {insumo.unidadMedida}
                    </span>
                    {posibleDuplicado && (
                      <Badge variant="warning-30">Posible duplicado</Badge>
                    )}
                  </button>
                </td>
                <td className="px-4 py-2 text-sm font-medium text-text">
                  {insumo.categoria}
                </td>
                <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-text">
                  {stockTotal} {insumo.unidadMedida}
                </td>
                <td className="px-4 py-2 text-sm font-medium text-text">
                  {insumo.stockMinimo ?? '—'}
                </td>
                <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-text">
                  {loteMasProximoAVencer?.fechaCaducidad ?? '—'}
                </td>
                <td className="px-4 py-2">
                  <Badge
                    variant={visual.tono}
                    icono={ICONO_ESTADO[visual.icono]}
                  >
                    {visual.etiqueta}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <TouchButton
                      type="button"
                      variant={disponibilidad.ok ? 'secondary' : 'ghost'}
                      disabled={!disponibilidad.ok}
                      onClick={() => onConsumirUno(insumo.id)}
                      aria-label={
                        disponibilidad.ok
                          ? `Consumir 1 ${insumo.unidadMedida} de ${insumo.nombre}`
                          : `${MOTIVO_DESHABILITADO[disponibilidad.motivo]}: ${insumo.nombre}`
                      }
                      className="shrink-0 px-3 whitespace-nowrap disabled:text-text-muted"
                    >
                      {disponibilidad.ok
                        ? 'Consumir 1'
                        : MOTIVO_DESHABILITADO[disponibilidad.motivo]}
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
