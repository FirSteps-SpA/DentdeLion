import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseStatus } from './index'

export interface Perfil {
  id: string
  nombre: string
  rol: 'administrador' | 'personal'
  /** Spec 014 FR-001. */
  tenant_id: string
  /** Spec 014 FR-021 — con fecha, el usuario está desactivado. */
  desactivado_en: string | null
}

/**
 * Reads the caller's own `perfiles` row (contracts/supabase-schema.md — RLS
 * always lets a user read `id = auth.uid()`, even when deactivated, so the
 * app can tell "acceso desactivado" apart, spec 014 FR-021). Returns `null` on any failure so
 * callers can fold it into the single generic login error (spec FR-005)
 * without distinguishing the reason.
 */
export async function fetchPerfilPropio(
  client: SupabaseClient,
  userId: string,
): Promise<Perfil | null> {
  const { data, error } = await client
    .from('perfiles')
    .select('id, nombre, rol, tenant_id, desactivado_en')
    .eq('id', userId)
    .single()

  if (error || !data) return null
  return data as Perfil
}

const SIN_CONEXION_NOMBRE = 'Necesitas conexión para cambiar tu nombre.'

/**
 * Spec 032 (FR-009, contracts/api.md): cambia el nombre de la persona con
 * sesión mediante `actualizar_mi_nombre`, que solo toca el nombre propio.
 * Necesita conexión, como el resto de los cambios de perfil y equipo
 * (research.md R5). Devuelve el nombre guardado (sin espacios sobrantes).
 */
export async function guardarNombrePropio(nombre: string): Promise<string> {
  const limpio = nombre.trim()
  if (!limpio) throw new Error('Escribe tu nombre.')
  if (limpio.length > 80) throw new Error('El nombre puede tener hasta 80 caracteres.')
  const { client, error } = getSupabaseStatus()
  if (error || !client) throw new Error(SIN_CONEXION_NOMBRE)
  const respuesta = await client.rpc('actualizar_mi_nombre', { p_nombre: limpio })
  if (respuesta.error) {
    if (/nombre_invalido/.test(respuesta.error.message ?? '')) {
      throw new Error('Escribe tu nombre.')
    }
    throw new Error(SIN_CONEXION_NOMBRE)
  }
  return typeof respuesta.data === 'string' ? respuesta.data : limpio
}
