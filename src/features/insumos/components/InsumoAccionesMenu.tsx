import type { ReactNode } from 'react'
import type { Insumo, UsuarioActual } from '../../../lib/db'
import {
  ChevronRight,
  PackageMinus,
  Pencil,
  Trash,
} from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'

export interface InsumoAccionesMenuProps {
  insumo: Insumo
  rol: UsuarioActual['rol'] | undefined
  onVerDetalle: () => void
  onConsumirOtraCantidad: () => void
  onEditar: () => void
  onEliminar: () => void
  onClose: () => void
}

function Opcion({
  onClick,
  icono,
  children,
  peligro = false,
}: {
  onClick: () => void
  icono: ReactNode
  children: ReactNode
  peligro?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target flex w-full items-center gap-3 rounded-md border border-border px-3.5 text-left text-sm font-bold ${
        peligro ? 'bg-danger-bg text-danger' : 'bg-surface text-text'
      }`}
    >
      {icono}
      <span className="flex-1">{children}</span>
    </button>
  )
}

/**
 * Menú de opciones de una tarjeta (spec 007 FR-010..FR-012). "Editar" y
 * "Eliminar" solo se renderizan para administradores — para personal
 * regular no existen en el DOM (y `catalogo.ts` además rechaza la acción).
 */
export function InsumoAccionesMenu({
  insumo,
  rol,
  onVerDetalle,
  onConsumirOtraCantidad,
  onEditar,
  onEliminar,
  onClose,
}: InsumoAccionesMenuProps) {
  const esAdministrador = rol === 'administrador'

  return (
    <BottomSheet titulo={insumo.nombre} onClose={onClose}>
      <Opcion
        onClick={onVerDetalle}
        icono={<ChevronRight size={18} className="text-primary" />}
      >
        Ver detalle
      </Opcion>
      <Opcion
        onClick={onConsumirOtraCantidad}
        icono={<PackageMinus size={18} className="text-primary" />}
      >
        Consumir otra cantidad
      </Opcion>
      {esAdministrador && (
        <>
          <Opcion
            onClick={onEditar}
            icono={<Pencil size={18} className="text-primary" />}
          >
            Editar
          </Opcion>
          <Opcion onClick={onEliminar} icono={<Trash size={18} />} peligro>
            Eliminar
          </Opcion>
        </>
      )}
    </BottomSheet>
  )
}
