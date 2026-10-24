import {
  SelectorCatalogo,
  type TextosSelectorCatalogo,
} from '../../../components/ui/SelectorCatalogo'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { crearMarca, reactivarMarca } from '../lib/marcasAdmin'

export interface SelectorMarcaProps {
  /** Para el `<label htmlFor>` del campo. */
  id: string
  /** `marcaId` elegido, o `null` = "Sin marca". */
  valor: string | null
  onCambio: (marcaId: string | null) => void
  describedBy?: string
}

const TEXTOS: TextosSelectorCatalogo = {
  titulo: 'Marca',
  placeholderCampo: 'Sin marca',
  buscar: 'Buscar marca',
  placeholderBuscar: 'Buscar o escribir una marca nueva',
  lista: 'Marcas',
  agregar: (nombre) => `Agregar marca «${nombre}»`,
  vacio: 'Todavía no hay marcas. Escribe el nombre para agregar una.',
  desactivado: (nombre) => `«${nombre}» está desactivada.`,
  errorAgregar: 'No se pudo agregar la marca.',
  errorReactivar: 'No se pudo reactivar la marca.',
  ninguno: 'Sin marca',
  elegido: (marca) =>
    marca.desactivadoEn ? `«${marca.nombre}» (desactivada)` : marca.nombre,
}

/**
 * Spec 023 (research.md R7, R12; contracts/ui-contracts.md "SelectorMarca") —
 * campo Marca del alta y de la edición del insumo. Opcional y sin
 * predeterminado (FR-005, FR-006): "Sin marca" arriba. Cualquier miembro
 * puede agregar una marca (FR-007); solo administración reactiva una
 * desactivada.
 */
export function SelectorMarca({ id, valor, onCambio, describedBy }: SelectorMarcaProps) {
  const marcas = useInventoryStore((s) => s.marcas)
  return (
    <SelectorCatalogo
      id={id}
      valor={valor}
      onCambio={onCambio}
      items={marcas}
      textos={TEXTOS}
      crear={(nombre) => crearMarca({ nombre })}
      reactivar={reactivarMarca}
      permitirNinguno
      describedBy={describedBy}
    />
  )
}
