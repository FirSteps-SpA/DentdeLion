import {
  SelectorCatalogo,
  type TextosSelectorCatalogo,
} from '../../../components/ui/SelectorCatalogo'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import {
  SIN_CATEGORIA_TRATAMIENTO,
  crearCategoriaTratamiento,
  reactivarCategoriaTratamiento,
} from '../lib/categorias'

export interface SelectorCategoriaTratamientoProps {
  id: string
  /** Id elegido, o `null` = "Sin categoría". */
  valor: string | null
  onCambio: (categoriaId: string | null) => void
}

const TEXTOS: TextosSelectorCatalogo = {
  titulo: 'Categoría',
  placeholderCampo: SIN_CATEGORIA_TRATAMIENTO,
  buscar: 'Buscar categoría',
  placeholderBuscar: 'Buscar o escribir una categoría nueva',
  lista: 'Categorías de tratamientos',
  agregar: (nombre) => `Agregar categoría «${nombre}»`,
  vacio: 'Todavía no hay categorías. Escribe el nombre para agregar una.',
  desactivado: (nombre) => `«${nombre}» está desactivada.`,
  errorAgregar: 'No se pudo agregar la categoría.',
  errorReactivar: 'No se pudo reactivar la categoría.',
  ninguno: SIN_CATEGORIA_TRATAMIENTO,
  elegido: (categoria) =>
    categoria.desactivadoEn ? `«${categoria.nombre}» (desactivada)` : categoria.nombre,
}

/**
 * Spec 026 (FR-005, contracts/ui-contracts.md §2) — campo Categoría del
 * formulario de tratamiento: opcional, con "Sin categoría" arriba y "Agregar
 * categoría" (el formulario ya es solo de administración).
 */
export function SelectorCategoriaTratamiento({
  id,
  valor,
  onCambio,
}: SelectorCategoriaTratamientoProps) {
  const categorias = useTratamientosStore((s) => s.categorias)
  return (
    <SelectorCatalogo
      id={id}
      valor={valor}
      onCambio={onCambio}
      items={categorias.map((c) => ({ ...c, eliminadoEn: null }))}
      textos={TEXTOS}
      crear={crearCategoriaTratamiento}
      reactivar={reactivarCategoriaTratamiento}
      permitirNinguno
    />
  )
}
