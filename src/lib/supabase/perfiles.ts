import type { SupabaseClient } from '@supabase/supabase-js'

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
