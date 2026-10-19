// Spec 014 (contracts/supabase-schema.md, "Edge Function"): acepta una
// invitación sin sesión. Con service role:
//   1. revisa el token (`revisar_invitacion`): pendiente, vigente y que el
//      correo no pertenezca a otro tenant;
//   2. crea el usuario de Auth (o, si el correo ya existe sin perfil o en el
//      mismo tenant, le fija la contraseña);
//   3. `consumir_invitacion` marca la invitación y crea o reactiva el perfil,
//      en una transacción.
// Los pasos 2 y 3 no son atómicos, pero reintentar es seguro: un usuario de
// Auth sin perfil se completa en el siguiente intento.
//
// POST { token, nombre, password } → 200 { correo } | 4xx { codigo, mensaje }

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Codigo =
  | 'solicitud_invalida'
  | 'invitacion_invalida'
  | 'invitacion_vencida'
  | 'correo_en_otro_tenant'
  | 'password_debil'
  | 'error_interno'

const ERRORES: Record<Codigo, { status: number; mensaje: string }> = {
  solicitud_invalida: { status: 400, mensaje: 'Faltan datos en la solicitud.' },
  invitacion_invalida: { status: 404, mensaje: 'Esta invitación ya no es válida.' },
  invitacion_vencida: { status: 410, mensaje: 'Esta invitación venció; pide una nueva.' },
  correo_en_otro_tenant: {
    status: 409,
    mensaje: 'Este correo ya pertenece a otro cliente de Dentdelion.',
  },
  password_debil: {
    status: 422,
    mensaje: 'La contraseña debe tener al menos 10 caracteres, con letras y números.',
  },
  error_interno: { status: 500, mensaje: 'No se pudo aceptar la invitación.' },
}

function responder(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function fallar(codigo: Codigo): Response {
  const { status, mensaje } = ERRORES[codigo]
  return responder(status, { codigo, mensaje })
}

async function sha256Hex(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(texto),
  )
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function esPasswordDebil(error: { code?: string; status?: number; message?: string }) {
  return (
    error.code === 'weak_password' ||
    error.status === 422 ||
    /password/i.test(error.message ?? '')
  )
}

const CODIGOS_SQL: Codigo[] = [
  'invitacion_invalida',
  'invitacion_vencida',
  'correo_en_otro_tenant',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fallar('solicitud_invalida')

  let cuerpo: { token?: unknown; nombre?: unknown; password?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return fallar('solicitud_invalida')
  }
  const { token, nombre, password } = cuerpo
  if (
    typeof token !== 'string' ||
    token.length < 20 ||
    typeof nombre !== 'string' ||
    nombre.trim().length < 1 ||
    nombre.trim().length > 80 ||
    typeof password !== 'string'
  ) {
    return fallar('solicitud_invalida')
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const tokenHash = await sha256Hex(token)

  const revision = await admin.rpc('revisar_invitacion', {
    p_token_hash: tokenHash,
  })
  if (revision.error) {
    console.error('revisar_invitacion', revision.error)
    return fallar('error_interno')
  }
  const fila = (revision.data as {
    correo: string | null
    codigo: Codigo | null
    usuario_id: string | null
  }[])[0]
  if (!fila) return fallar('invitacion_invalida')
  if (fila.codigo) return fallar(fila.codigo)

  let usuarioId = fila.usuario_id
  if (usuarioId) {
    const { error } = await admin.auth.admin.updateUserById(usuarioId, {
      password,
      email_confirm: true,
    })
    if (error) {
      if (esPasswordDebil(error)) return fallar('password_debil')
      console.error('updateUserById', error)
      return fallar('error_interno')
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: fila.correo!,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre.trim() },
    })
    if (error || !data.user) {
      if (error && esPasswordDebil(error)) return fallar('password_debil')
      console.error('createUser', error)
      return fallar('error_interno')
    }
    usuarioId = data.user.id
  }

  const consumo = await admin.rpc('consumir_invitacion', {
    p_token_hash: tokenHash,
    p_uid: usuarioId,
    p_nombre: nombre,
  })
  if (consumo.error) {
    const codigo = CODIGOS_SQL.find((c) => consumo.error.message.includes(c))
    if (codigo) return fallar(codigo)
    console.error('consumir_invitacion', consumo.error)
    return fallar('error_interno')
  }

  return responder(200, { correo: fila.correo })
})
