import { AlertTriangle, CircleCheck, Clock } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'

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
        <CircleCheck size={20} className="shrink-0 text-success-text" />
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
        className="touch-target flex flex-col items-start gap-1 px-3.5 py-2.5 text-left hover:border-brand"
      >
        <span className="flex items-center gap-1.5 text-danger">
          <Clock size={16} />
          <span className="text-caption font-bold">Caducados/Próximos</span>
        </span>
        <span className="text-h2 font-extrabold text-danger">{totalCaducidad}</span>
      </Card>

      <Card
        as="button"
        type="button"
        onClick={onFiltrarStockBajo}
        className="touch-target flex flex-col items-start gap-1 px-3.5 py-2.5 text-left hover:border-brand"
      >
        <span className="flex items-center gap-1.5 text-warning-30-text">
          <AlertTriangle size={16} />
          <span className="text-caption font-bold">Bajo Stock</span>
        </span>
        <span className="text-h2 font-extrabold text-warning-30-text">
          {totalStockBajo}
        </span>
      </Card>
    </div>
  )
}
