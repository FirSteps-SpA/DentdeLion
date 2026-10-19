import { getSupabaseStatus } from '../../../lib/supabase'

/**
 * Equipo del tenant (spec 014 US5, FR-021): lista con correo, cambio de rol y
 * (des)activación. Solo administradores; los datos vienen del servidor
 * (`equipo_tenant`, `perfiles`) y necesitan conexión. El servidor impide
 * dejar el tenant sin administradora (`proteger_ultimo_admin`).
 */
export interface MiembroEquipo {
  id: string
  nombre: string
  correo: string
  rol: 'administrador' | 'personal'
  desactivadoEn: string | null
}

const SIN_CONEXION = 'Necesitas conexión para gestionar el equipo.'

function cliente() {
  const { client, error } = getSupabaseStatus()
  if (error) throw new Error(SIN_CONEXION)
  return client
}

function mensajeDeError(error: { message?: string }): string {
  if (/ultimo_administrador/.test(error.message ?? '')) {
    return 'Debe quedar al menos una administradora activa.'
  }
  return 'No se pudo guardar el cambio. Revisa tu conexión.'
}

export async function listarEquipo(): Promise<MiembroEquipo[]> {
  const { data, error } = await cliente().rpc('equipo_tenant')
  if (error) throw new Error(SIN_CONEXION)
  return (
    data as {
      id: string
      nombre: string
      correo: string
      rol: MiembroEquipo['rol']
      desactivado_en: string | null
    }[]
  ).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    desactivadoEn: fila.desactivado_en,
  }))
}

async function actualizarPerfil(
  id: string,
  cambios: Record<string, string | null>,
): Promise<void> {
  const { data, error } = await cliente().from('perfiles').update(cambios).eq('id', id).select('id')
  if (error) throw new Error(mensajeDeError(error))
  if (!data || data.length === 0) throw new Error('No tienes permiso para cambiar a esta persona.')
}

export function cambiarRol(id: string, rol: MiembroEquipo['rol']): Promise<void> {
  return actualizarPerfil(id, { rol })
}

export function desactivarUsuario(id: string): Promise<void> {
  return actualizarPerfil(id, { desactivado_en: new Date().toISOString() })
}

export function reactivarUsuario(id: string): Promise<void> {
  return actualizarPerfil(id, { desactivado_en: null })
}
