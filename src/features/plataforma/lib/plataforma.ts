import { useEffect, useState } from 'react'
import { getSupabaseStatus } from '../../../lib/supabase'
import { enlaceDeInvitacion } from '../../ajustes/lib/invitaciones'

/**
 * Spec 031 (contracts/api.md) — cliente de la Edge Function `plataforma`.
 * Nada de esto se guarda en el dispositivo (FR-002). Las funciones lanzan
 * `ErrorPlataforma` con un mensaje para mostrar tal cual.
 */

export interface ClientePlataforma {
  id: string
  nombre: string
  creadoEn: string
  lugares: number
  usuariosActivos: number
  ultimaActividad: string | null
}

export interface UsuarioPlataforma {
  id: string
  nombre: string
  correo: string
  rol: 'administrador' | 'personal'
  desactivado: boolean
}

export interface InvitacionPlataforma {
  id: string
  correo: string
  rol: 'administrador' | 'personal'
  venceEn: string
}

export interface DetalleCliente {
  cliente: { id: string; nombre: string }
  usuarios: UsuarioPlataforma[]
  invitaciones: InvitacionPlataforma[]
}

export const MENSAJES_PLATAFORMA: Record<string, string> = {
  sin_conexion: 'Necesita conexión.',
  sin_sesion: 'Tu sesión venció; vuelve a iniciar sesión.',
  sin_permiso: 'Tu cuenta no administra la plataforma.',
  solicitud_invalida: 'Revisa los datos.',
  no_encontrado: 'Ya no existe; recarga la lista.',
  confirmacion_incorrecta: 'La confirmación no coincide.',
  unica_administradora:
    'Es la única administradora: invita a otra o elimina el cliente.',
  propia_cuenta: 'No puedes eliminar tu propia cuenta.',
  propio_cliente: 'No puedes eliminar el cliente de tu propia cuenta.',
  correo_en_otro_tenant: 'Ese correo ya pertenece a otro cliente.',
  ya_es_miembro: 'Esa persona ya es parte del cliente.',
  error_interno: 'No se pudo completar; intenta de nuevo.',
}

export class ErrorPlataforma extends Error {
  readonly codigo: string
  constructor(codigo: string) {
    super(MENSAJES_PLATAFORMA[codigo] ?? MENSAJES_PLATAFORMA.error_interno)
    this.codigo = codigo
  }
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ErrorPlataforma('sin_conexion')
  }
  const { client, error } = getSupabaseStatus()
  if (error) throw new ErrorPlataforma('sin_conexion')
  const { data, error: errorFuncion } = await client.functions.invoke(
    'plataforma',
    { body: cuerpo },
  )
  if (!errorFuncion) return data as T
  const contexto = (errorFuncion as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    const respuesta = (await contexto.json().catch(() => null)) as {
      codigo?: string
    } | null
    throw new ErrorPlataforma(respuesta?.codigo ?? 'error_interno')
  }
  throw new ErrorPlataforma('sin_conexion')
}

export const listarClientes = () =>
  llamar<{ clientes: ClientePlataforma[] }>({ accion: 'listar' }).then(
    (r) => r.clientes,
  )

export const detalleCliente = (tenantId: string) =>
  llamar<DetalleCliente>({ accion: 'detalle', tenantId })

export async function crearCliente(datos: {
  nombre: string
  lugar: string
  correo: string
}) {
  const r = await llamar<{ tenantId: string; token: string; venceEn: string }>({
    accion: 'crear_cliente',
    ...datos,
  })
  return {
    tenantId: r.tenantId,
    enlace: enlaceDeInvitacion(r.token),
    venceEn: r.venceEn,
  }
}

export async function invitarACliente(datos: {
  tenantId: string
  correo: string
  rol: 'administrador' | 'personal'
}) {
  const r = await llamar<{ token: string; venceEn: string }>({
    accion: 'invitar',
    ...datos,
  })
  return { enlace: enlaceDeInvitacion(r.token), venceEn: r.venceEn }
}

export const eliminarUsuario = (usuarioId: string, confirmacion: string) =>
  llamar<{ ok: true; cuentaPendiente: boolean }>({
    accion: 'eliminar_usuario',
    usuarioId,
    confirmacion,
  })

export const eliminarCliente = (tenantId: string, confirmacion: string) =>
  llamar<{ cuentasBorradas: number; cuentasPendientes: string[] }>({
    accion: 'eliminar_cliente',
    tenantId,
    confirmacion,
  })

export const borrarCuentas = (usuarioIds: string[]) =>
  llamar<{ cuentasPendientes: string[] }>({
    accion: 'borrar_cuentas',
    usuarioIds,
  })

/** Respaldo del cliente (FR-010): lo descarga como archivo JSON. */
export async function descargarRespaldo(
  tenantId: string,
  nombreCliente: string,
): Promise<void> {
  const datos = await llamar<unknown>({ accion: 'exportar_cliente', tenantId })
  const texto = JSON.stringify(datos, null, 2)
  const archivo = new Blob([texto], { type: 'application/json' })
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `respaldo-${nombreCliente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

/**
 * Spec 031 (R1, R8): ¿esta cuenta es operadora de la plataforma? Se consulta
 * al servidor con conexión; sin red o con error, "no" (la tarjeta no aparece).
 */
export async function esOperadorPlataforma(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return false
  try {
    const { client, error } = getSupabaseStatus()
    if (error) return false
    const { data, error: errorRpc } = await client.rpc('es_operador_plataforma')
    return !errorRpc && data === true
  } catch {
    return false
  }
}

/** `null` mientras se consulta: quien decide visibilidad no debe cerrar la sección todavía. */
export function useEsOperadorPlataforma(
  usuarioId: string | undefined,
): boolean | null {
  const [estado, setEstado] = useState<{ usuarioId?: string; es: boolean }>({
    es: false,
  })
  useEffect(() => {
    if (!usuarioId) return
    let vigente = true
    void esOperadorPlataforma().then((es) => {
      if (vigente) setEstado({ usuarioId, es })
    })
    return () => {
      vigente = false
    }
  }, [usuarioId])
  if (!usuarioId) return false
  return estado.usuarioId === usuarioId ? estado.es : null
}
