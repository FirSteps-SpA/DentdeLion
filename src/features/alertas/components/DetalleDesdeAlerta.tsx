import { useEffect } from 'react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { InsumoDetalle } from '../../insumos/components/InsumoDetalle'
import type { VistaLugar } from '../../insumos/lib/vistaLugar'

/** Insumo abierto desde una alerta y el lugar de esa alerta (`null` sin lugar resuelto). */
export interface DetalleAbierto {
  insumoId: string
  lugarId: string | null
}

export interface DetalleDesdeAlertaProps {
  abierto: DetalleAbierto
  vistas: VistaLugar[]
  onClose: () => void
}

/**
 * El detalle del insumo de Inventario, en una hoja encima de Alertas o Inicio
 * (spec 018 FR-009, R5): en Inventario se muestra en línea, pero aquí
 * quedaría al final de la página. Usa la vista del lugar de la alerta, así en
 * "Todos" muestra los lotes de ese lugar. Al cerrarlo la persona sigue donde
 * estaba.
 */
export function DetalleDesdeAlerta({ abierto, vistas, onClose }: DetalleDesdeAlertaProps) {
  const vista =
    vistas.find((v) => (v.lugar?.id ?? null) === abierto.lugarId) ?? vistas[0]
  const insumo = vista?.datos.insumos.find((i) => i.id === abierto.insumoId)

  // Si el insumo deja de existir (p. ej. se dio de baja en otro dispositivo), se cierra.
  useEffect(() => {
    if (!insumo) onClose()
  }, [insumo, onClose])

  if (!vista || !insumo) return null
  return (
    <BottomSheet titulo="Detalle del insumo" onClose={onClose}>
      <InsumoDetalle
        insumo={insumo}
        lotes={vista.datos.lotes.filter((lote) => lote.insumoId === insumo.id)}
        movimientos={vista.datos.movimientos}
        onClose={onClose}
      />
    </BottomSheet>
  )
}
