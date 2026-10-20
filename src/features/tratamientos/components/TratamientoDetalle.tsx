import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { X } from '../../../components/icons'
import { etiquetaUnidad, formatearCantidad } from '../../../lib/unidades'
import { useAuthStore } from '../../../stores/authStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { formatearCLP } from '../../insumos/lib/precio'
import type { TratamientoProyectado } from '../lib/proyeccion'
import type { MontosTratamiento as Montos } from '../lib/useMontosTratamiento'
import { MontosTratamiento } from './MontosTratamiento'

const CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  materiales: 'Materiales',
  activo: 'Estado',
  precio: 'Precio',
}

export interface TratamientoDetalleProps {
  tratamiento: TratamientoProyectado
  montos: Montos
  onRegistrar?: () => void
  onEditar?: () => void
  onClose: () => void
}

/**
 * Spec 016 US2 (contracts/ui-contracts.md §4): materiales con su costo, el
 * bloque de montos del DS §27 con "Ganancia estimada" y el historial de
 * cambios del tratamiento. Los materiales dados de baja se marcan y
 * administración ve el aviso para reemplazarlos (Edge Cases).
 */
export function TratamientoDetalle({
  tratamiento,
  montos,
  onRegistrar,
  onEditar,
  onClose,
}: TratamientoDetalleProps) {
  const usuario = useAuthStore((s) => s.usuario)
  const esAdministrador = usuario?.rol === 'administrador'
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const cambios = useTratamientosStore((s) => s.cambiosTratamiento)
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })
  const autor = (id: string) =>
    id === usuario?.id ? usuario.nombre : (conocidos.find((c) => c.id === id)?.nombre ?? '')
  const historial = cambios
    .filter((c) => c.tratamientoId === tratamiento.id && c.rechazadoEn === null)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
  const conBaja = montos.costo.lineas.some((linea) => linea.dadoDeBaja)

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-h3 text-text">{tratamiento.nombre}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="touch-target flex items-center justify-center rounded-full text-text-muted"
        >
          <X size={20} />
        </button>
      </div>

      {conBaja && esAdministrador && (
        <p role="note" className="text-sm font-bold text-warning-30-text">
          Tiene materiales dados de baja: reemplázalos en el tratamiento.
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs text-text-muted">
            <th scope="col" className="py-1 font-bold">
              Material
            </th>
            <th scope="col" className="py-1 font-bold">
              Cantidad
            </th>
            <th scope="col" className="py-1 text-right font-bold">
              Costo
            </th>
          </tr>
        </thead>
        <tbody>
          {montos.costo.lineas.map((linea) => (
            <tr key={linea.material.insumoId} className="border-t border-border">
              <td className="py-2">
                {linea.insumo?.nombre ?? 'Material'}
                {linea.dadoDeBaja && (
                  <span className="block text-xs text-text-muted">Dado de baja</span>
                )}
              </td>
              <td className="py-2">
                {formatearCantidad(linea.cantidad, linea.insumo?.unidadMedida ?? linea.material.unidad)}
              </td>
              <td className="py-2 text-right">
                {linea.dadoDeBaja
                  ? '—'
                  : linea.costo === null
                    ? 'Sin precio'
                    : formatearCLP(linea.costo)}
                {linea.costoUnitario !== null && !linea.dadoDeBaja && (
                  <span className="block text-xs text-text-muted">
                    {formatearCLP(linea.costoUnitario)} por{' '}
                    {etiquetaUnidad(linea.insumo?.unidadMedida ?? linea.material.unidad, 1)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <MontosTratamiento montos={montos} />

      <div className="flex flex-col gap-2">
        {onRegistrar && tratamiento.activo && (
          <TouchButton type="button" onClick={onRegistrar}>
            Registrar realizado
          </TouchButton>
        )}
        {onEditar && esAdministrador && (
          <TouchButton type="button" variant="ghost" onClick={onEditar}>
            Editar
          </TouchButton>
        )}
      </div>

      {historial.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-text">Historial de cambios</h4>
          <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
            {historial.map((cambio) => (
              <li key={cambio.id}>
                {CAMPO[cambio.campo] ?? cambio.campo} · {fecha.format(new Date(cambio.creadoEn))}
                {autor(cambio.usuarioId) && ` · ${autor(cambio.usuarioId)}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  )
}
