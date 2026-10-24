import { useNombreDeMarca } from '../lib/useNombreDeMarca'

export interface NombreConMarcaProps {
  nombre: string
  marcaId: string | null | undefined
  /** Clases del renglón del nombre (tamaño y peso de cada lista). */
  className?: string
}

/**
 * Spec 023 (R8, FR-012) — "Nombre · Marca" en Inventario y Compras, con la
 * marca en tono secundario. El nombre va en su propio `<span>`, igual con o
 * sin marca, y el renglón parte línea en vez de desbordar en el teléfono.
 */
export function NombreConMarca({ nombre, marcaId, className }: NombreConMarcaProps) {
  const marca = useNombreDeMarca(marcaId)
  return (
    <span className={`min-w-0 break-words ${className ?? ''}`}>
      <span>{nombre}</span>
      {marca && <span className="font-normal text-text-muted"> · {marca}</span>}
    </span>
  )
}
