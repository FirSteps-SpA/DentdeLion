// Spec 029 (contracts/api.md, research.md R1–R3) — sugiere cuánto se usa de
// cada material en un tratamiento, con Claude. Solo administración, 20 por
// tenant por día; la clave de Anthropic vive solo aquí (secreto de Supabase).
//
// Orden de controles: forma → sesión → rol → materiales del tenant → clave
// configurada → reserva del límite → IA → validación → resultado.
//
// POST { tratamiento, insumoIds } → 200 { reconocido, sugerencias } | 4xx/5xx { codigo }

import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0'
import {
  ESQUEMA,
  SISTEMA,
  armarMensaje,
  validarRespuesta,
  validarSolicitud,
  type MaterialBase,
} from './logica.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Codigo =
  | 'solicitud_invalida'
  | 'sin_sesion'
  | 'solo_administracion'
  | 'materiales_invalidos'
  | 'no_configurado'
  | 'limite_diario'
  | 'error_modelo'

const ESTADO: Record<Codigo, number> = {
  solicitud_invalida: 400,
  sin_sesion: 401,
  solo_administracion: 403,
  materiales_invalidos: 404,
  limite_diario: 429,
  error_modelo: 502,
  no_configurado: 503,
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const error = (codigo: Codigo) => json({ codigo }, ESTADO[codigo])

/** Unidades de magnitud continua (las mismas de `src/lib/unidades.ts`). */
const UNIDADES_DECIMALES = new Set(['ml', 'l', 'g', 'mg', 'm', 'cm'])

/** Modelo predeterminado (skill claude-api); el costo queda acotado por el límite diario. */
const MODELO = 'claude-opus-5-5'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return error('solicitud_invalida')

  const solicitud = validarSolicitud(await req.json().catch(() => null))
  if (!solicitud) return error('solicitud_invalida')

  // Cliente con el JWT de quien llama: RLS limita perfil e insumos a su tenant.
  const autorizacion = req.headers.get('Authorization') ?? ''
  const usuarioCliente = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: autorizacion } } },
  )
  const { data: sesion } = await usuarioCliente.auth.getUser()
  const usuario = sesion?.user
  if (!usuario) return error('sin_sesion')

  const { data: perfil } = await usuarioCliente
    .from('perfiles')
    .select('rol, tenant_id, desactivado_en')
    .eq('id', usuario.id)
    .maybeSingle()
  if (!perfil || perfil.desactivado_en || perfil.rol !== 'administrador') {
    return error('solo_administracion')
  }

  const { data: filas } = await usuarioCliente
    .from('insumos')
    .select('id, nombre, unidad_medida, unidad_compra, contenido, dado_de_baja_en, tenant_id')
    .in('id', solicitud.insumoIds)
  const propias = (filas ?? []).filter(
    (f) => f.tenant_id === perfil.tenant_id && f.dado_de_baja_en === null,
  )
  if (propias.length !== solicitud.insumoIds.length) return error('materiales_invalidos')
  const materiales: MaterialBase[] = solicitud.insumoIds.map((id) => {
    const f = propias.find((p) => p.id === id)!
    return {
      id,
      nombre: String(f.nombre),
      unidad: String(f.unidad_medida),
      permiteDecimales: UNIDADES_DECIMALES.has(String(f.unidad_medida).trim().toLowerCase()),
      unidadCompra: String(f.unidad_compra ?? f.unidad_medida),
      contenido: Number(f.contenido ?? 1),
    }
  })

  // La clave antes de reservar: sin clave no se consume el límite.
  const clave = Deno.env.get('ANTHROPIC_API_KEY')
  if (!clave) return error('no_configurado')

  const servicio = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: reserva, error: errorReserva } = await servicio.rpc('reservar_estimacion', {
    p_tenant: perfil.tenant_id,
    p_usuario: usuario.id,
    p_tratamiento: solicitud.tratamiento,
    p_materiales: materiales.length,
  })
  if (errorReserva) return error('error_modelo')
  if (!reserva) return error('limite_diario')

  const cerrar = (resultado: 'ok' | 'no_reconocido' | 'error_modelo' | 'error_servicio') =>
    servicio.from('estimaciones_ia').update({ resultado }).eq('id', reserva)

  try {
    // Sin reintentos (no duplicar costo) y con tope de tiempo (edge case).
    const anthropic = new Anthropic({ apiKey: clave, timeout: 30_000, maxRetries: 0 })
    const respuesta = await anthropic.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      // Fallback del servidor ante rechazos del modelo (skill claude-api).
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SISTEMA,
      messages: [{ role: 'user', content: armarMensaje(solicitud.tratamiento, materiales) }],
      // Sin herramientas; salida estructurada con esquema fijo (R3–R5).
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: ESQUEMA as unknown as Record<string, unknown> },
      },
    })
    if (respuesta.stop_reason !== 'end_turn') {
      await cerrar('error_modelo')
      return error('error_modelo')
    }
    const texto = respuesta.content.find((b) => b.type === 'text')
    const estimacion = validarRespuesta(
      texto && texto.type === 'text' ? JSON.parse(texto.text) : null,
      materiales,
    )
    if (!estimacion) {
      await cerrar('error_modelo')
      return error('error_modelo')
    }
    await cerrar(estimacion.reconocido ? 'ok' : 'no_reconocido')
    return json(estimacion)
  } catch (e) {
    // Nunca se registra el contenido; solo el tipo de error.
    await cerrar(e instanceof Anthropic.APIError ? 'error_servicio' : 'error_modelo')
    console.error('estimar-materiales:', e instanceof Error ? e.name : 'error')
    return error('error_modelo')
  }
})
