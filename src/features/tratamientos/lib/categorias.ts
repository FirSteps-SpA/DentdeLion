import { db, type CambioTratamiento, type CategoriaTratamiento } from '../../../lib/db'
import { tenantActualOFallar } from '../../../stores/authStore'
import { claveCategoria } from '../../insumos/lib/categorias'
import { exigirAdministrador, nuevoCambio } from './catalogo'
import { claveCategoriaLugar, porcentajesPorCategoria } from './proyeccion'

/**
 * Spec 026 (research.md R1, R2, R4) — catálogo de categorías de tratamientos
 * y su % profesional por lugar. Solo administración (FR-008).
 */

/** Las 8 que la migración siembra en cada tenant (FR-001). Referencia para pruebas y textos. */
export const CATEGORIAS_TRATAMIENTO_SEMBRADAS = [
  'Evaluación',
  'Prevención',
  'Restauración',
  'Endodoncia',
  'Periodoncia',
  'Extracción y cirugía',
  'Prótesis',
  'Urgencia',
] as const

export const SIN_CATEGORIA_TRATAMIENTO = 'Sin categoría'

/**
 * FR-003: 1–40 caracteres, único por clave (sin mayúsculas, tildes ni
 * espacios) entre las no rechazadas, y distinto de "Sin categoría". Devuelve
 * el mensaje de error o `null`.
 */
export function validarNombreCategoriaTratamiento(
  nombre: string,
  existentes: readonly CategoriaTratamiento[],
  idActual?: string,
): string | null {
  const limpio = nombre.trim()
  if (!limpio || limpio.length > 40) return 'Ingresa un nombre de hasta 40 caracteres.'
  const clave = claveCategoria(limpio)
  if (clave === claveCategoria(SIN_CATEGORIA_TRATAMIENTO)) return 'Ese nombre está reservado.'
  const repetida = existentes.some(
    (c) => c.id !== idActual && c.rechazadoEn === null && claveCategoria(c.nombre) === clave,
  )
  return repetida ? 'Ya existe una categoría con ese nombre.' : null
}

function validarPorcentaje(porcentaje: number | null): void {
  if (porcentaje !== null && (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
    throw new Error('El porcentaje profesional debe estar entre 0 y 100.')
  }
}

/** Crea una categoría activa (Ajustes o "Agregar categoría" del formulario). */
export async function crearCategoriaTratamiento(nombre: string): Promise<{ id: string }> {
  const usuarioId = exigirAdministrador('crear categorías de')
  return db.transaction('rw', db.categoriasTratamiento, async () => {
    const error = validarNombreCategoriaTratamiento(
      nombre,
      await db.categoriasTratamiento.toArray(),
    )
    if (error) throw new Error(error)
    const nueva: CategoriaTratamiento = {
      id: crypto.randomUUID(),
      tenantId: tenantActualOFallar(),
      nombre: nombre.trim(),
      creadoPor: usuarioId,
      creadoEn: new Date().toISOString(),
      desactivadoEn: null,
      sincronizado: false,
      rechazadoEn: null,
    }
    await db.categoriasTratamiento.add(nueva)
    return { id: nueva.id }
  })
}

export interface CambiosCategoriaTratamiento {
  nombre?: string
  activa?: boolean
  /** % por lugar: número 0–100, o `null` para volver al general. Solo se escriben los que cambian. */
  porcentajes?: Record<string, number | null>
}

/**
 * Guarda la hoja "Editar categoría" (UI §1) en una transacción: nombre y
 * estado en la fila (último cambio gana, FR-002) y cada % cambiado como un
 * cambio `porcentajeCategoria` del ledger (FR-009). Si algo es inválido no se
 * guarda nada.
 */
export async function guardarCategoriaTratamiento(
  id: string,
  cambios: CambiosCategoriaTratamiento,
): Promise<void> {
  const usuarioId = exigirAdministrador('cambiar categorías de')
  for (const porcentaje of Object.values(cambios.porcentajes ?? {})) validarPorcentaje(porcentaje)

  await db.transaction('rw', [db.categoriasTratamiento, db.cambiosTratamiento], async () => {
    const actual = await db.categoriasTratamiento.get(id)
    if (!actual || actual.rechazadoEn) throw new Error('La categoría no existe.')

    const fila: Partial<CategoriaTratamiento> = {}
    if (cambios.nombre !== undefined && cambios.nombre.trim() !== actual.nombre) {
      const error = validarNombreCategoriaTratamiento(
        cambios.nombre,
        await db.categoriasTratamiento.toArray(),
        id,
      )
      if (error) throw new Error(error)
      fila.nombre = cambios.nombre.trim()
    }
    if (cambios.activa !== undefined && cambios.activa !== (actual.desactivadoEn === null)) {
      fila.desactivadoEn = cambios.activa ? null : new Date().toISOString()
    }

    const vigentes = porcentajesPorCategoria(await db.cambiosTratamiento.toArray())
    const nuevos: CambioTratamiento[] = []
    for (const [lugarId, porcentaje] of Object.entries(cambios.porcentajes ?? {})) {
      const anterior = vigentes.get(claveCategoriaLugar(id, lugarId)) ?? null
      if (anterior === porcentaje) continue
      nuevos.push(
        nuevoCambio(usuarioId, 'porcentajeCategoria', anterior, porcentaje, {
          lugarId,
          categoriaId: id,
        }),
      )
    }

    if (Object.keys(fila).length > 0) {
      await db.categoriasTratamiento.update(id, { ...fila, sincronizado: false })
    }
    if (nuevos.length > 0) await db.cambiosTratamiento.bulkAdd(nuevos)
  })
}

/** Reactivar desde el selector (`SelectorCatalogo.reactivar`). */
export async function reactivarCategoriaTratamiento(id: string): Promise<void> {
  await guardarCategoriaTratamiento(id, { activa: true })
}

/**
 * Spec 026 (FR-007): nombre para mostrar de la categoría de un tratamiento:
 * "Sin categoría", el nombre, o "Evaluación (desactivada)". Un id desconocido
 * (rechazado o aún no sincronizado) se muestra como "Sin categoría".
 */
export function nombreCategoriaTratamiento(
  categorias: readonly CategoriaTratamiento[],
  categoriaId: string | null,
): string {
  const categoria = categoriaId ? categorias.find((c) => c.id === categoriaId) : undefined
  if (!categoria) return SIN_CATEGORIA_TRATAMIENTO
  return categoria.desactivadoEn ? `${categoria.nombre} (desactivada)` : categoria.nombre
}

/** Valor del filtro "Sin categoría" (los demás son ids; '' = todas). */
export const FILTRO_SIN_CATEGORIA = 'sin-categoria'

/**
 * Opciones del filtro por categoría (catálogo e historial): las categorías
 * en uso, por nombre, y "Sin categoría" al final si hay alguno sin ella.
 */
export function opcionesFiltroCategoria(
  categorias: readonly CategoriaTratamiento[],
  idsEnUso: readonly (string | null)[],
): { valor: string; nombre: string }[] {
  const conocidas = new Set(categorias.map((c) => c.id))
  const usados = new Set(idsEnUso)
  const opciones = categorias
    .filter((c) => usados.has(c.id))
    .map((c) => ({ valor: c.id, nombre: nombreCategoriaTratamiento(categorias, c.id) }))
  if (idsEnUso.some((id) => id === null || !conocidas.has(id))) {
    opciones.push({ valor: FILTRO_SIN_CATEGORIA, nombre: SIN_CATEGORIA_TRATAMIENTO })
  }
  return opciones
}

/** ¿El id de categoría pasa el filtro? */
export function pasaFiltroCategoria(
  categorias: readonly CategoriaTratamiento[],
  categoriaId: string | null,
  filtro: string,
): boolean {
  if (filtro === '') return true
  const conocida = categoriaId !== null && categorias.some((c) => c.id === categoriaId)
  if (filtro === FILTRO_SIN_CATEGORIA) return !conocida
  return categoriaId === filtro
}
