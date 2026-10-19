import { db, type Lugar } from '../../../lib/db'
import { getSupabaseStatus } from '../../../lib/supabase'
import { tenantActualOFallar, useAuthStore } from '../../../stores/authStore'
import { lugaresActivos } from '../../../stores/lugarStore'

/**
 * Gestión de lugares de trabajo (spec 014 US4, FR-011). Solo administradores
 * (la interfaz oculta la sección al personal y el servidor lo exige por RLS).
 * Escribe en Dexie y el sync lo sube (`pushLugares`), así que funciona sin red;
 * un rechazo del servidor (nombre repetido en otro dispositivo, último lugar
 * activo) se descarta y vuelve el valor del servidor.
 */
const MAX_NOMBRE = 60

function exigirAdministrador(): void {
  if (useAuthStore.getState().usuario?.rol !== 'administrador') {
    throw new Error('Solo un administrador puede gestionar los lugares de trabajo.')
  }
}

function clave(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es')
}

async function lugaresDelTenant(): Promise<Lugar[]> {
  return db.lugares.where('tenantId').equals(tenantActualOFallar()).toArray()
}

/** 1–60 caracteres y único en el tenant sin distinguir mayúsculas (Edge Case "Nombre duplicado"). */
export function validarNombreLugar(
  nombre: string,
  lugares: Lugar[],
  idExcluido?: string,
): string | null {
  const limpio = nombre.trim()
  if (!limpio) return 'Ingresa el nombre del lugar.'
  if (limpio.length > MAX_NOMBRE) return `El nombre admite hasta ${MAX_NOMBRE} caracteres.`
  if (lugares.some((lugar) => lugar.id !== idExcluido && clave(lugar.nombre) === clave(limpio))) {
    return 'Ya existe un lugar con ese nombre.'
  }
  return null
}

export async function crearLugar(nombre: string): Promise<Lugar> {
  exigirAdministrador()
  const lugares = await lugaresDelTenant()
  const error = validarNombreLugar(nombre, lugares)
  if (error) throw new Error(error)
  const lugar: Lugar = {
    id: crypto.randomUUID(),
    tenantId: tenantActualOFallar(),
    nombre: nombre.trim(),
    desactivadoEn: null,
    creadoEn: new Date().toISOString(),
    sincronizado: false,
  }
  await db.lugares.add(lugar)
  return lugar
}

export async function renombrarLugar(id: string, nombre: string): Promise<void> {
  exigirAdministrador()
  const lugares = await lugaresDelTenant()
  const error = validarNombreLugar(nombre, lugares, id)
  if (error) throw new Error(error)
  await db.lugares.update(id, { nombre: nombre.trim(), sincronizado: false })
}

/** Conserva el historial; no se permite con el último lugar activo (FR-005). */
export async function desactivarLugar(id: string): Promise<void> {
  exigirAdministrador()
  const activos = lugaresActivos(await lugaresDelTenant())
  if (activos.length <= 1 && activos.some((lugar) => lugar.id === id)) {
    throw new Error('Debe quedar al menos un lugar de trabajo activo.')
  }
  await db.lugares.update(id, {
    desactivadoEn: new Date().toISOString(),
    sincronizado: false,
  })
}

export async function reactivarLugar(id: string): Promise<void> {
  exigirAdministrador()
  await db.lugares.update(id, { desactivadoEn: null, sincronizado: false })
}

/**
 * Nombre del tenant (FR-012): vive solo en el servidor, así que leerlo y
 * cambiarlo necesita conexión — no es flujo clínico. `null` sin conexión.
 */
export async function leerNombreTenant(): Promise<string | null> {
  const { client, error } = getSupabaseStatus()
  if (error) return null
  const respuesta = await client
    .from('tenants')
    .select('nombre')
    .eq('id', tenantActualOFallar())
    .maybeSingle()
  return respuesta.error ? null : ((respuesta.data as { nombre: string } | null)?.nombre ?? null)
}

export async function guardarNombreTenant(nombre: string): Promise<void> {
  exigirAdministrador()
  const limpio = nombre.trim()
  if (!limpio || limpio.length > 80) {
    throw new Error('El nombre debe tener entre 1 y 80 caracteres.')
  }
  const { client, error } = getSupabaseStatus()
  if (error) throw new Error('Necesitas conexión para cambiar el nombre.')
  const respuesta = await client
    .from('tenants')
    .update({ nombre: limpio })
    .eq('id', tenantActualOFallar())
  if (respuesta.error) throw new Error('No se pudo guardar el nombre. Revisa tu conexión.')
}
