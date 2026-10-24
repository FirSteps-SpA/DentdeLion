import { db, type Marca } from '../../../lib/db'
import { useAuthStore, tenantActualOFallar } from '../../../stores/authStore'
import { coincidenciaEn } from '../../../lib/catalogo'
import { claveMarca } from './marcas'

/**
 * Spec 023 (contracts/ui-contracts.md "marcasAdmin.ts") — escritura local
 * primero (Constitución I): cada cambio queda en Dexie con `sincronizado:
 * false` y lo sube `pushMarcas`. Crear lo puede hacer cualquier miembro
 * (FR-007); el resto, solo administración (FR-019).
 */

export const MENSAJE_NOMBRE_VACIO = 'Escribe el nombre de la marca.'
export const MENSAJE_NOMBRE_REPETIDO = 'Ya existe una marca con ese nombre.'

export function mensajeConInsumos(usos: number): string {
  return usos === 1
    ? 'No se puede eliminar: la usa 1 insumo.'
    : `No se puede eliminar: la usan ${usos} insumos.`
}

/** El nombre coincide con una marca desactivada (US2-4). */
export class MarcaDesactivada extends Error {
  readonly marca: Marca
  constructor(marca: Marca) {
    super(`«${marca.nombre}» está desactivada.`)
    this.marca = marca
    this.name = 'MarcaDesactivada'
  }
}

function usuarioActual(): { id: string; esAdministrador: boolean } {
  const usuario = useAuthStore.getState().usuario
  if (!usuario) throw new Error('No hay un usuario autenticado local.')
  return { id: usuario.id, esAdministrador: usuario.rol === 'administrador' }
}

function exigirAdministracion(accion: string): void {
  if (!usuarioActual().esAdministrador) {
    throw new Error(`Solo un administrador puede ${accion} marcas.`)
  }
}

function limpiarNombre(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (!limpio || limpio.length > 60) throw new Error(MENSAJE_NOMBRE_VACIO)
  return limpio
}

async function delTenant(): Promise<Marca[]> {
  return db.marcas.where('tenantId').equals(tenantActualOFallar()).toArray()
}

/**
 * Crea una marca. Desde el selector (por defecto), si ya existe una activa
 * con la misma clave la devuelve en vez de crear otra (US2-3); desde Ajustes
 * (`estricto`), la rechaza. Con una desactivada lanza `MarcaDesactivada`.
 */
export async function crearMarca(
  datos: { nombre: string },
  opciones: { estricto?: boolean } = {},
): Promise<Marca> {
  const { id: usuarioId } = usuarioActual()
  const nombre = limpiarNombre(datos.nombre)
  const tenantId = tenantActualOFallar()

  return db.transaction('rw', db.marcas, async () => {
    const existente = coincidenciaEn(await delTenant(), nombre)
    if (existente.tipo === 'desactivado') throw new MarcaDesactivada(existente.item)
    if (existente.tipo === 'activo') {
      if (opciones.estricto) throw new Error(MENSAJE_NOMBRE_REPETIDO)
      return existente.item
    }
    const nueva: Marca = {
      id: crypto.randomUUID(),
      tenantId,
      nombre,
      creadoPor: usuarioId,
      creadoEn: new Date().toISOString(),
      desactivadoEn: null,
      eliminadoEn: null,
      sincronizado: false,
    }
    await db.marcas.add(nueva)
    return nueva
  })
}

async function obtener(id: string): Promise<Marca> {
  const marca = await db.marcas.get(id)
  if (!marca || marca.eliminadoEn) throw new Error('Esa marca ya no existe.')
  return marca
}

/** Renombra (FR-016). El nombre sigue siendo único (FR-002). */
export async function renombrarMarca(id: string, nombre: string): Promise<void> {
  exigirAdministracion('renombrar')
  const limpio = limpiarNombre(nombre)
  await db.transaction('rw', db.marcas, async () => {
    await obtener(id)
    const clave = claveMarca(limpio)
    const repetida = (await delTenant()).some(
      (otra) => otra.id !== id && !otra.eliminadoEn && claveMarca(otra.nombre) === clave,
    )
    if (repetida) throw new Error(MENSAJE_NOMBRE_REPETIDO)
    await db.marcas.update(id, { nombre: limpio, sincronizado: false })
  })
}

/** Deja de ofrecerse en el selector; sus insumos la conservan (FR-018). */
export async function desactivarMarca(id: string): Promise<void> {
  exigirAdministracion('desactivar')
  await db.transaction('rw', db.marcas, async () => {
    await obtener(id)
    await db.marcas.update(id, {
      desactivadoEn: new Date().toISOString(),
      sincronizado: false,
    })
  })
}

export async function reactivarMarca(id: string): Promise<void> {
  exigirAdministracion('reactivar')
  await db.transaction('rw', db.marcas, async () => {
    await obtener(id)
    await db.marcas.update(id, { desactivadoEn: null, sincronizado: false })
  })
}

/** Insumos del dispositivo con esta marca, incluidos los dados de baja. */
export async function usosDeMarca(id: string): Promise<number> {
  return db.insumos.where('marcaId').equals(id).count()
}

/**
 * Baja lógica (R6): `eliminadoEn` con fecha, solo sin insumos (FR-016). Si el
 * servidor tiene insumos que aún no llegaron aquí, la rechaza y el pull la
 * revierte con un aviso.
 */
export async function eliminarMarca(id: string): Promise<void> {
  exigirAdministracion('eliminar')
  await db.transaction('rw', db.marcas, db.insumos, async () => {
    await obtener(id)
    const usos = await usosDeMarca(id)
    if (usos > 0) throw new Error(mensajeConInsumos(usos))
    await db.marcas.update(id, {
      eliminadoEn: new Date().toISOString(),
      sincronizado: false,
    })
  })
}
