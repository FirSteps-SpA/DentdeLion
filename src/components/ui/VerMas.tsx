import { textoQuedan } from '../../lib/paginacion'
import { TouchButton } from './TouchButton'

export interface VerMasProps {
  quedan: number
  mostrados: number
  total: number
  onVerMas: () => void
}

/**
 * "Ver más" común de las listas de tarjetas (spec 020 FR-006, FR-014/015):
 * dice cuántos quedan y anuncia lo visible a los lectores de pantalla (R6).
 * No se muestra si no queda nada.
 */
export function VerMas({ quedan, mostrados, total, onVerMas }: VerMasProps) {
  if (quedan <= 0) return null
  return (
    <div className="flex flex-col">
      <TouchButton type="button" variant="secondary" onClick={onVerMas}>
        Ver más ({textoQuedan(quedan)})
      </TouchButton>
      <p role="status" aria-live="polite" className="sr-only">
        Se muestran {Math.min(mostrados, total)} de {total}
      </p>
    </div>
  )
}
