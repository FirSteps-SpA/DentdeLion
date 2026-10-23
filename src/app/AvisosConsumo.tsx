import { useAvisosStore, type Aviso } from '../stores/avisosStore'
import { AlertTriangle, CircleCheck, Undo } from '../components/icons'

function textoAviso(aviso: Aviso): string {
  if (aviso.tipo === 'cambio-rechazado') {
    return `Tu cambio en «${aviso.insumoNombre}» no se guardó: ya no tienes permisos de administrador.`
  }
  if (aviso.tipo === 'material-creado') {
    return `«${aviso.insumoNombre}» agregado al inventario`
  }
  if (aviso.tipo === 'categoria-rechazada') {
    return `La categoría «${aviso.insumoNombre}» no se guardó: ya no tienes permisos de administrador.`
  }
  if (aviso.tipo === 'proveedor-no-eliminado') {
    return `No se pudo eliminar «${aviso.insumoNombre}»: tiene lotes registrados.`
  }
  if (aviso.tipo === 'proveedor-repetido') {
    return `El cambio en «${aviso.insumoNombre}» no se guardó: ya existe un proveedor con ese nombre.`
  }
  if (aviso.tipo === 'traslado') {
    return aviso.estado === 'revertido' ? 'Traslado revertido' : (aviso.detalle ?? 'Traslado registrado')
  }
  if (aviso.tipo === 'tratamiento') {
    return aviso.estado === 'revertido'
      ? 'Tratamiento deshecho'
      : `Registrado: ${aviso.insumoNombre}`
  }
  if (aviso.estado === 'revertido') return 'Consumo revertido'
  return `Consumido 1 ${aviso.unidadMedida ?? ''} de ${aviso.insumoNombre}`.replace(
    '  ',
    ' ',
  )
}

/**
 * Pila de avisos temporales (spec 007 FR-006/FR-009/FR-021b), montada una
 * sola vez en `App.tsx` fuera de las vistas para que sobreviva a la
 * navegación entre secciones. Máx. 3 avisos (avisosStore); "Deshacer" solo
 * en avisos de consumo pendientes. Estilo del toast del DS §37 (spec 013):
 * fondo oscuro, texto blanco, ícono de éxito verde y radio 10; en móvil, por
 * encima de la barra inferior.
 */
export function AvisosConsumo() {
  const avisos = useAvisosStore((s) => s.avisos)
  const deshacer = useAvisosStore((s) => s.deshacer)

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md bg-text px-3.5 py-1.5 text-left text-sm font-semibold text-white shadow-dropdown"
        >
          {aviso.tipo === 'cambio-rechazado' ||
          aviso.tipo === 'categoria-rechazada' ||
          aviso.tipo === 'proveedor-no-eliminado' ||
          aviso.tipo === 'proveedor-repetido' ? (
            <AlertTriangle size={18} className="shrink-0 text-warning-30-bg" />
          ) : (
            <CircleCheck size={18} className="shrink-0 text-success" />
          )}
          <span className="flex-1 py-2">{textoAviso(aviso)}</span>
          {(aviso.tipo === 'consumo' ||
            aviso.tipo === 'traslado' ||
            aviso.tipo === 'tratamiento') &&
            aviso.estado === 'pendiente' && (
            <button
              type="button"
              onClick={() => void deshacer(aviso.id).catch(() => undefined)}
              aria-label={
                aviso.tipo === 'tratamiento'
                  ? `Deshacer registro de ${aviso.insumoNombre}`
                  : `Deshacer consumo de ${aviso.insumoNombre}`
              }
              className="touch-target flex shrink-0 items-center justify-center gap-2 rounded-md border border-white/30 px-3.5 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <Undo size={16} />
              Deshacer
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
