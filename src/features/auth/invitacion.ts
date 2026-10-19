import { getSupabaseStatus } from '../../lib/supabase'

/**
 * Aceptar una invitación (spec 014 US5, contracts/supabase-schema.md,
 * "Edge Function"). Sin sesión: `ver_invitacion` es el único RPC público, y
 * la Edge Function `aceptar-invitacion` crea la cuenta con service role.
 */
export type CodigoInvitacion =
  | 'invitacion_invalida'
  | 'invitacion_vencida'
  | 'correo_en_otro_tenant'
  | 'password_debil'
  | 'sin_conexion'
  | 'error'

export const MENSAJES_INVITACION: Record<CodigoInvitacion, string> = {
  invitacion_invalida: 'Esta invitación ya no es válida.',
  invitacion_vencida: 'Esta invitación venció; pide una nueva.',
  correo_en_otro_tenant: 'Este correo ya pertenece a otro cliente de Dentdelion.',
  password_debil: 'La contraseña debe tener al menos 10 caracteres, con letras y números.',
  sin_conexion: 'Necesitas conexión para aceptar la invitación.',
  error: 'No se pudo aceptar la invitación. Inténtalo de nuevo.',
}

/** Token de `/?invitacion=<token>`, o `null`. */
export function tokenDeLaUrl(search = window.location.search): string | null {
  return new URLSearchParams(search).get('invitacion')
}

/** Quita `?invitacion=` de la URL sin recargar, al terminar o al ignorarla. */
export function limpiarTokenDeLaUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('invitacion')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}

/** Regla visible del formulario: 10+ caracteres, con letras y números (la de Auth). */
export function validarPassword(password: string, repetida: string): string | null {
  if (password.length < 10 || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) || !/\d/.test(password)) {
    return MENSAJES_INVITACION.password_debil
  }
  if (password !== repetida) return 'Las contraseñas no coinciden.'
  return null
}

export async function verInvitacion(
  token: string,
): Promise<{ correo: string; tenant: string } | CodigoInvitacion> {
  const { client, error } = getSupabaseStatus()
  if (error) return 'sin_conexion'
  const respuesta = await client.rpc('ver_invitacion', { p_token: token })
  if (respuesta.error) return 'sin_conexion'
  const fila = (respuesta.data as { correo: string; tenant: string }[])[0]
  return fila ?? 'invitacion_invalida'
}

export async function aceptarInvitacion(
  token: string,
  nombre: string,
  password: string,
): Promise<{ correo: string } | CodigoInvitacion> {
  const { client, error } = getSupabaseStatus()
  if (error) return 'sin_conexion'
  const { data, error: errorFuncion } = await client.functions.invoke('aceptar-invitacion', {
    body: { token, nombre, password },
  })
  if (!errorFuncion) return data as { correo: string }
  // FunctionsHttpError trae la respuesta: { codigo, mensaje }.
  const contexto = (errorFuncion as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const cuerpo = (await contexto.json()) as { codigo?: string }
      if (cuerpo.codigo && cuerpo.codigo in MENSAJES_INVITACION) {
        return cuerpo.codigo as CodigoInvitacion
      }
    } catch {
      // Respuesta no JSON.
    }
    return 'error'
  }
  return 'sin_conexion'
}
