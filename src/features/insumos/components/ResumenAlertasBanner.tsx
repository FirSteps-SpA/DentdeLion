import { AlertTriangle, CircleCheck, Clock } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { IconoFondo } from '../../../components/decoracion'

export interface ResumenAlertasBannerProps {
  totalCaducidad: number
  totalStockBajo: number
  onFiltrarCaducidad: () => void
  onFiltrarStockBajo: () => void
}

/**
 * Resumen compacto de alertas (spec 006 FR-003/FR-004): dos indicadores con
 * color + ícono + conteo + etiqueta de texto (nunca solo color, spec
 * Clarifications). Tocar un indicador aplica el filtro correspondiente sobre
 * el listado — `onFiltrarCaducidad` combina 'caducado' y 'proximo-a-caducar'
 * en un solo toque (spec 006 Analysis F1/A1).
 *
 * Spec 027 (FR-012): ícono en cuadrado con tinte e ícono de fondo, como las
 * KPI de Inicio.
 */
export function ResumenAlertasBanner({
  totalCaducidad,
  totalStockBajo,
  onFiltrarCaducidad,
  onFiltrarStockBajo,
}: ResumenAlertasBannerProps) {
  if (totalCaducidad === 0 && totalStockBajo === 0) {
    return (
      <Card className="flex items-center gap-2.5 bg-success-bg px-3.5 py-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-success-text">
          <CircleCheck size={20} />
        </span>
        <p className="text-sm font-bold text-success-text">
          El inventario está en buen estado
        </p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Card
        as="button"
        type="button"
        onClick={onFiltrarCaducidad}
        className="touch-target relative flex flex-col items-start gap-2 overflow-hidden px-4 py-3 text-left hover:border-brand"
      >
        <IconoFondo Icono={Clock} size={56} className="absolute -right-1 -bottom-1" />
        <span className="relative flex max-w-full min-w-0 items-center gap-2 text-danger">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tinte-peligro">
            <Clock size={16} />
          </span>
          <span className="min-w-0 text-caption font-bold break-words">Caducados/<wbr />Próximos</span>
        </span>
        <span className="relative text-h2 font-extrabold text-danger">{totalCaducidad}</span>
      </Card>

      <Card
        as="button"
        type="button"
        onClick={onFiltrarStockBajo}
        className="touch-target relative flex flex-col items-start gap-2 overflow-hidden px-4 py-3 text-left hover:border-brand"
      >
        <IconoFondo Icono={AlertTriangle} size={56} className="absolute -right-1 -bottom-1" />
        <span className="relative flex max-w-full min-w-0 items-center gap-2 text-warning-30-text">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-tinte-aviso text-warning-icon">
            <AlertTriangle size={16} />
          </span>
          <span className="min-w-0 text-caption font-bold break-words">Bajo Stock</span>
        </span>
        <span className="relative text-h2 font-extrabold text-warning-30-text">
          {totalStockBajo}
        </span>
      </Card>
    </div>
  )
}
