import { db } from '../../../lib/db'
import { tenantActualOFallar } from '../../../stores/authStore'
import { NIVELES_AVISO_POR_DEFECTO } from '../../../stores/alertasStore'
import { LARGO_MAXIMO_SALUDO } from '../../compras/lib/pedido'

export const MENSAJE_SALUDO_LARGO = `El saludo puede tener hasta ${LARGO_MAXIMO_SALUDO} caracteres.`

/**
 * Spec 022 (FR-022, research.md R1/R9): guarda el saludo del pedido en la
 * fila de configuración del tenant, marcada para subir (solo administración
 * la sube; la UI que lo llama ya es solo de administración). Vacío o solo
 * espacios = el saludo de la clienta (`null`). Conserva el resto de la fila.
 */
export async function guardarSaludoPedido(texto: string): Promise<void> {
  const saludo = texto.trim()
  if (saludo.length > LARGO_MAXIMO_SALUDO) throw new Error(MENSAJE_SALUDO_LARGO)
  await escribir(saludo || null)
}

export async function restablecerSaludoPedido(): Promise<void> {
  await escribir(null)
}

async function escribir(saludoPedido: string | null): Promise<void> {
  const actual = await db.configuracionAlertas.get('global')
  await db.configuracionAlertas.put({
    ...actual,
    id: 'global',
    tenantId: tenantActualOFallar(),
    nivelesAvisoDias: actual?.nivelesAvisoDias ?? NIVELES_AVISO_POR_DEFECTO,
    saludoPedido,
    sincronizado: false,
  })
}
