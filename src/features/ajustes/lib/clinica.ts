import { db } from '../../../lib/db'
import { exigirAdministrador } from '../../insumos/lib/catalogo'

/**
 * Guarda el nombre de la clínica/gabinete (spec 010 FR-020/021). Solo
 * administrador. Rechaza un nombre vacío o solo espacios sin escribir nada
 * — el encabezado conserva el valor anterior (o el default "Gabinete").
 */
export async function guardarNombreClinica(
  nombre: string,
): Promise<{ error: string } | void> {
  exigirAdministrador('configurar la clínica')
  const limpio = nombre.trim()
  if (!limpio) {
    return { error: 'Ingresa un nombre de clínica.' }
  }
  // `sincronizado: false`: el ciclo la sube en el próximo push (spec 012 research.md R5).
  await db.configuracionClinica.put({
    id: 'global',
    nombre: limpio,
    sincronizado: false,
  })
}
