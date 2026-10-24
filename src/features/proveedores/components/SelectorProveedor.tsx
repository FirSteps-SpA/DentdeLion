import {
  SelectorCatalogo,
  type TextosSelectorCatalogo,
} from '../../../components/ui/SelectorCatalogo'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { crearProveedor, reactivarProveedor } from '../lib/proveedoresAdmin'

export interface SelectorProveedorProps {
  /** Para el `<label htmlFor>` del campo y el foco del primer error. */
  id: string
  /** `proveedorId` elegido, o `null`. */
  valor: string | null
  onCambio: (proveedorId: string) => void
  invalido?: boolean
  describedBy?: string
}

const TEXTOS: TextosSelectorCatalogo = {
  titulo: 'Proveedor',
  placeholderCampo: 'Elige un proveedor',
  buscar: 'Buscar proveedor',
  placeholderBuscar: 'Buscar o escribir un proveedor nuevo',
  lista: 'Proveedores',
  agregar: (nombre) => `Agregar proveedor «${nombre}»`,
  vacio: 'Todavía no hay proveedores. Escribe el nombre para agregar uno.',
  desactivado: (nombre) => `«${nombre}» está desactivado.`,
  errorAgregar: 'No se pudo agregar el proveedor.',
  errorReactivar: 'No se pudo reactivar el proveedor.',
}

/**
 * Spec 021 (research.md R8, contracts/ui-contracts.md "SelectorProveedor") —
 * campo Proveedor del alta de material y de la recepción de compras, sobre el
 * `SelectorCatalogo` común (spec 023 R7). Cualquier miembro puede agregar un
 * proveedor (Clarifications Q4); solo administración reactiva uno desactivado.
 */
export function SelectorProveedor({
  id,
  valor,
  onCambio,
  invalido,
  describedBy,
}: SelectorProveedorProps) {
  const proveedores = useInventoryStore((s) => s.proveedores)
  return (
    <SelectorCatalogo
      id={id}
      valor={valor}
      onCambio={(proveedorId) => {
        if (proveedorId) onCambio(proveedorId)
      }}
      items={proveedores}
      textos={TEXTOS}
      crear={(nombre) => crearProveedor({ nombre })}
      reactivar={reactivarProveedor}
      invalido={invalido}
      describedBy={describedBy}
    />
  )
}
