import { getSupabaseStatus } from '../../../lib/supabase'
import { APP_NAME } from '../../../lib/branding'

/**
 * Invitaciones al equipo (spec 014 US5, FR-019, research.md R5): un enlace
 * propio de 7 días que la administradora envía por correo, WhatsApp o copia.
 * No hay servidor de correo. Todo pasa por los RPC del servidor (solo
 * administradores) y necesita conexión; no se guarda en Dexie.
 */
export type RolInvitacion = 'administrador' | 'personal'

export interface InvitacionCreada {
  id: string
  enlace: string
  venceEn: string
}

export interface InvitacionPendiente {
  id: string
  correo: string
  rol: RolInvitacion
  venceEn: string
  vencida: boolean
}

const SIN_CONEXION = 'Necesitas conexión para gestionar las invitaciones.'

function cliente() {
  const { client, error } = getSupabaseStatus()
  if (error) throw new Error(SIN_CONEXION)
  return client
}

export function enlaceDeInvitacion(token: string, origen = window.location.origin): string {
  return `${origen}/?invitacion=${encodeURIComponent(token)}`
}

function mensajeDeError(error: { message?: string; code?: string }): string {
  if (/ya_es_miembro/.test(error.message ?? '')) return 'Esa persona ya es parte de tu equipo.'
  if (error.code === '42501') return 'Solo una administradora puede invitar.'
  if (/correo_check/.test(error.message ?? '')) return 'Ingresa un correo válido.'
  return 'No se pudo crear la invitación. Revisa tu conexión.'
}

export async function crearInvitacion(
  correo: string,
  rol: RolInvitacion,
): Promise<InvitacionCreada> {
  const limpio = correo.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new Error('Ingresa un correo válido.')
  const { data, error } = await cliente().rpc('crear_invitacion', {
    p_correo: limpio,
    p_rol: rol,
  })
  if (error) throw new Error(mensajeDeError(error))
  const fila = (data as { id: string; token: string; vence_en: string }[])[0]
  return { id: fila.id, enlace: enlaceDeInvitacion(fila.token), venceEn: fila.vence_en }
}

export async function revocarInvitacion(id: string): Promise<void> {
  const { error } = await cliente().rpc('revocar_invitacion', { p_id: id })
  if (error) throw new Error('No se pudo revocar la invitación.')
}

/** Revoca la invitación y crea otra para el mismo correo y rol (un enlace nuevo). */
export async function reenviarInvitacion(
  invitacion: Pick<InvitacionPendiente, 'id' | 'correo' | 'rol'>,
): Promise<InvitacionCreada> {
  // `crear_invitacion` ya revoca las pendientes del mismo correo.
  return crearInvitacion(invitacion.correo, invitacion.rol)
}

export async function listarInvitacionesPendientes(
  ahora: Date = new Date(),
): Promise<InvitacionPendiente[]> {
  const { data, error } = await cliente()
    .from('invitaciones')
    .select('id, correo, rol, vence_en')
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: false })
  if (error) throw new Error(SIN_CONEXION)
  return (data as { id: string; correo: string; rol: RolInvitacion; vence_en: string }[]).map(
    (fila) => ({
      id: fila.id,
      correo: fila.correo,
      rol: fila.rol,
      venceEn: fila.vence_en,
      vencida: new Date(fila.vence_en) <= ahora,
    }),
  )
}

/** "Enviar por correo" (`mailto:`) y "WhatsApp" (`wa.me`), con el texto en español. */
export function enlacesCompartir(
  enlace: string,
  tenant: string | null,
): { mailto: string; whatsapp: string } {
  const de = tenant ? ` de ${tenant}` : ''
  const asunto = `Invitación a ${APP_NAME}${de}`
  const texto =
    `Te invito a unirte al inventario${de} en ${APP_NAME}. ` +
    `Abre este enlace para crear tu contraseña (vence en 7 días): ${enlace}`
  return {
    mailto: `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texto)}`,
  }
}
