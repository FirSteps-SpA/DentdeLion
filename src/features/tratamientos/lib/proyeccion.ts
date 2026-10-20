import type {
  CambioTratamiento,
  MaterialTratamiento,
  Tratamiento,
} from '../../../lib/db'
import { compararCambios } from '../../insumos/lib/proyeccion'

/**
 * Spec 016 data-model.md — un tratamiento tal como lo ve la app: la fila de
 * identidad más lo proyectado desde su ledger (research.md R1).
 */
export interface TratamientoProyectado {
  id: string
  nombre: string
  activo: boolean
  materiales: MaterialTratamiento[]
  /** Precio por lugar; sin entrada = sin precio en ese lugar (Clarifications Q1). */
  precios: Map<string, number>
  creadoEn: string
  creadoPor: string
}

function vigentesOrdenados(cambios: CambioTratamiento[]): CambioTratamiento[] {
  return cambios.filter((cambio) => cambio.rechazadoEn === null).sort(compararCambios)
}

/**
 * Proyecta los tratamientos desde su ledger: por campo (y por lugar en
 * `precio`) gana el cambio de mayor `(creadoEn, id)`. Pura y determinista:
 * el mismo ledger da lo mismo en cualquier dispositivo, sin importar el orden
 * de llegada. Un tratamiento sin nombre vigente (su alta fue rechazada) no se
 * devuelve.
 */
export function proyectarTratamientos(
  filas: Tratamiento[],
  cambios: CambioTratamiento[],
): TratamientoProyectado[] {
  const porTratamiento = new Map<string, CambioTratamiento[]>()
  for (const cambio of vigentesOrdenados(cambios)) {
    if (!cambio.tratamientoId) continue
    const grupo = porTratamiento.get(cambio.tratamientoId) ?? []
    grupo.push(cambio)
    porTratamiento.set(cambio.tratamientoId, grupo)
  }

  const proyectados: TratamientoProyectado[] = []
  for (const fila of filas) {
    if (fila.rechazadoEn !== null) continue
    let nombre: string | null = null
    let activo = true
    let materiales: MaterialTratamiento[] = []
    const precios = new Map<string, number>()
    for (const cambio of porTratamiento.get(fila.id) ?? []) {
      switch (cambio.campo) {
        case 'nombre':
          nombre = String(cambio.valorNuevo)
          break
        case 'activo':
          activo = cambio.valorNuevo === true
          break
        case 'materiales':
          materiales = Array.isArray(cambio.valorNuevo) ? cambio.valorNuevo : []
          break
        case 'precio':
          if (!cambio.lugarId) break
          if (typeof cambio.valorNuevo === 'number') precios.set(cambio.lugarId, cambio.valorNuevo)
          else precios.delete(cambio.lugarId)
          break
        default:
          break
      }
    }
    if (nombre === null) continue
    proyectados.push({
      id: fila.id,
      nombre,
      activo,
      materiales,
      precios,
      creadoEn: fila.creadoEn,
      creadoPor: fila.creadoPor,
    })
  }
  return proyectados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Spec 016 (Clarifications Q2, FR-009/FR-012) — % profesional de cada lugar:
 * el último cambio `porcentajeProfesional` del lugar; `null` lo borra.
 */
export function porcentajesPorLugar(cambios: CambioTratamiento[]): Map<string, number> {
  const porcentajes = new Map<string, number>()
  for (const cambio of vigentesOrdenados(cambios)) {
    if (cambio.campo !== 'porcentajeProfesional' || !cambio.lugarId) continue
    if (typeof cambio.valorNuevo === 'number') porcentajes.set(cambio.lugarId, cambio.valorNuevo)
    else porcentajes.delete(cambio.lugarId)
  }
  return porcentajes
}
