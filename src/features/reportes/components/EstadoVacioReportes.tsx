import type { Vista } from '../../../app/navegacion'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Boxes, ChartColumn, Stethoscope } from '../../../components/icons'

/**
 * Spec 017 (FR-017) — sin datos en el período: explica qué falta en vez de
 * mostrar $0 o gráficos en blanco, con accesos a Tratamientos e Inventario.
 */
export function EstadoVacioReportes({ onNavegar }: { onNavegar?: (vista: Vista) => void }) {
  return (
    <Card as="section" className="flex flex-col items-center gap-4 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-brand-icon">
        <ChartColumn size={24} />
      </span>
      <p className="max-w-md text-body-lg text-text">
        Registra tratamientos y precios de compra para ver tus reportes.
      </p>
      {onNavegar && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <TouchButton type="button" variant="secondary" onClick={() => onNavegar('tratamientos')}>
            <Stethoscope size={18} />
            Tratamientos
          </TouchButton>
          <TouchButton type="button" variant="secondary" onClick={() => onNavegar('inventario')}>
            <Boxes size={18} />
            Inventario
          </TouchButton>
        </div>
      )}
    </Card>
  )
}
