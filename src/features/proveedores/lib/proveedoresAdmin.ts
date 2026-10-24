import { db, type Proveedor } from '../../../lib/db'
import { useAuthStore, tenantActualOFallar } from '../../../stores/authStore'
import { claveNombre, coincidencia } from './proveedores'
import { MENSAJE_WHATSAPP_INVALIDO, normalizarWhatsapp } from './whatsapp'

/**
 * Spec 021 (contracts/ui-contracts.md "proveedoresAdmin.ts") — escritura local
 * primero (Constitución I): cada cambio queda en Dexie con `sincronizado:
 * false` y lo sube `pushProveedores`. Crear lo puede hacer cualquier miembro
 * (Clarifications Q4); el resto, solo administración.
 */

export const MENSAJE_NOMBRE_VACIO = 'Escribe el nombre del proveedor.'
export const MENSAJE_NOMBRE_REPETIDO = 'Ya existe un proveedor con ese nombre.'
export const MENSAJE_CON_LOTES =
  'Este proveedor tiene lotes: puedes desactivarlo, pero no eliminarlo.'

/** El nombre coincide con un proveedor desactivado (US2-4). */
export class ProveedorDesactivado extends Error {
  readonly proveedor: Proveedor
  constructor(proveedor: Proveedor) {
    super(`«${proveedor.nombre}» está desactivado.`)
    this.proveedor = proveedor
    this.name = 'ProveedorDesactivado'
  }
}

export interface DatosProveedor {
  nombre: string
  whatsapp?: string
  contacto?: string
}

function usuarioActual(): { id: string; esAdministrador: boolean } {
  const usuario = useAuthStore.getState().usuario
  if (!usuario) throw new Error('No hay un usuario autenticado local.')
  return { id: usuario.id, esAdministrador: usuario.rol === 'administrador' }
}

function exigirAdministracion(accion: string): void {
  if (!usuarioActual().esAdministrador) {
    throw new Error(`Solo un administrador puede ${accion} proveedores.`)
  }
}

function limpiarNombre(nombre: string): string {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (!limpio || limpio.length > 60) throw new Error(MENSAJE_NOMBRE_VACIO)
  return limpio
}

function limpiarContacto(contacto: string | undefined): string | null {
  const limpio = (contacto ?? '').trim()
  return limpio ? limpio.slice(0, 60) : null
}

function limpiarWhatsapp(whatsapp: string | undefined): string | null {
  const resultado = normalizarWhatsapp(whatsapp ?? '')
  if (!resultado.ok) throw new Error(MENSAJE_WHATSAPP_INVALIDO)
  return resultado.valor
}

async function delTenant(): Promise<Proveedor[]> {
  return db.proveedores
    .where('tenantId')
    .equals(tenantActualOFallar())
    .toArray()
}

/**
 * Crea un proveedor. Desde el selector del registro (por defecto), si ya
 * existe uno activo con la misma clave lo devuelve en vez de crear otro
 * (US2-3); desde Ajustes (`estricto`), lo rechaza. Con uno desactivado lanza
 * `ProveedorDesactivado`.
 */
export async function crearProveedor(
  datos: DatosProveedor,
  opciones: { estricto?: boolean } = {},
): Promise<Proveedor> {
  const { id: usuarioId } = usuarioActual()
  const nombre = limpiarNombre(datos.nombre)
  const whatsapp = limpiarWhatsapp(datos.whatsapp)
  const contacto = limpiarContacto(datos.contacto)
  const tenantId = tenantActualOFallar()

  return db.transaction('rw', db.proveedores, async () => {
    const existente = coincidencia(await delTenant(), nombre)
    if (existente.tipo === 'desactivado')
      throw new ProveedorDesactivado(existente.proveedor)
    if (existente.tipo === 'activo') {
      if (opciones.estricto) throw new Error(MENSAJE_NOMBRE_REPETIDO)
      return existente.proveedor
    }
    const nuevo: Proveedor = {
      id: crypto.randomUUID(),
      tenantId,
      nombre,
      whatsapp,
      contacto,
      creadoPor: usuarioId,
      creadoEn: new Date().toISOString(),
      desactivadoEn: null,
      eliminadoEn: null,
      sincronizado: false,
    }
    await db.proveedores.add(nuevo)
    return nuevo
  })
}

async function obtener(id: string): Promise<Proveedor> {
  const proveedor = await db.proveedores.get(id)
  if (!proveedor || proveedor.eliminadoEn)
    throw new Error('Ese proveedor ya no existe.')
  return proveedor
}

/** Renombra y cambia el contacto (FR-011). El nombre sigue siendo único (FR-002). */
export async function editarProveedor(
  id: string,
  datos: DatosProveedor,
): Promise<void> {
  exigirAdministracion('editar')
  const nombre = limpiarNombre(datos.nombre)
  const whatsapp = limpiarWhatsapp(datos.whatsapp)
  const contacto = limpiarContacto(datos.contacto)
  await db.transaction('rw', db.proveedores, async () => {
    await obtener(id)
    const clave = claveNombre(nombre)
    const repetido = (await delTenant()).some(
      (otro) =>
        otro.id !== id &&
        !otro.eliminadoEn &&
        claveNombre(otro.nombre) === clave,
    )
    if (repetido) throw new Error(MENSAJE_NOMBRE_REPETIDO)
    await db.proveedores.update(id, {
      nombre,
      whatsapp,
      contacto,
      sincronizado: false,
    })
  })
}

/** Deja de ofrecerse al registrar y de ser predeterminado (FR-013). */
export async function desactivarProveedor(id: string): Promise<void> {
  exigirAdministracion('desactivar')
  await db.transaction('rw', db.proveedores, db.lugares, async () => {
    await obtener(id)
    await db.proveedores.update(id, {
      desactivadoEn: new Date().toISOString(),
      sincronizado: false,
    })
    await quitarDePredeterminados(id)
  })
}

export async function reactivarProveedor(id: string): Promise<void> {
  exigirAdministracion('reactivar')
  await db.transaction('rw', db.proveedores, async () => {
    await obtener(id)
    await db.proveedores.update(id, {
      desactivadoEn: null,
      sincronizado: false,
    })
  })
}

/** ¿Hay lotes de este proveedor en el dispositivo? (R7: eliminar solo sin lotes). */
export async function tieneLotes(id: string): Promise<boolean> {
  return (await db.lotes.where('proveedorId').equals(id).count()) > 0
}

/**
 * Baja lógica (R7): `eliminadoEn` con fecha. Si el servidor tiene lotes que
 * aún no llegaron aquí, la rechaza y el pull la revierte con un aviso.
 */
export async function eliminarProveedor(id: string): Promise<void> {
  exigirAdministracion('eliminar')
  await db.transaction('rw', db.proveedores, db.lugares, db.lotes, async () => {
    await obtener(id)
    if (await tieneLotes(id)) throw new Error(MENSAJE_CON_LOTES)
    await db.proveedores.update(id, {
      eliminadoEn: new Date().toISOString(),
      sincronizado: false,
    })
    await quitarDePredeterminados(id)
  })
}

/** Predeterminado de un lugar (FR-003): reemplaza el anterior de ese lugar. */
export async function fijarPredeterminado(
  lugarId: string,
  proveedorId: string | null,
): Promise<void> {
  exigirAdministracion('cambiar el predeterminado de')
  await db.transaction('rw', db.proveedores, db.lugares, async () => {
    if (proveedorId) {
      const proveedor = await obtener(proveedorId)
      if (proveedor.desactivadoEn)
        throw new Error(
          'Reactiva el proveedor para usarlo como predeterminado.',
        )
    }
    const lugar = await db.lugares.get(lugarId)
    if (!lugar) throw new Error('Ese lugar ya no existe.')
    if (lugar.proveedorPredeterminadoId === proveedorId) return
    await db.lugares.update(lugarId, {
      proveedorPredeterminadoId: proveedorId,
      sincronizado: false,
    })
  })
}

async function quitarDePredeterminados(proveedorId: string): Promise<void> {
  await db.lugares
    .filter((lugar) => lugar.proveedorPredeterminadoId === proveedorId)
    .modify({ proveedorPredeterminadoId: null, sincronizado: false })
}
