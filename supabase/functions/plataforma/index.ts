// Spec 031 (contracts/api.md, research.md R1, R2, R6, R7) — administración de
// la plataforma. Solo para operadores (`administradores_plataforma`, que la
// API no puede leer ni escribir): se verifica en cada llamada. Con service
// role llama a las funciones SQL de plataforma y borra cuentas con la API de
// administración de Auth. Cada acción que cambia algo queda en
// `auditoria_plataforma`.
//
// POST { accion, ... } → 200 | 4xx/5xx { codigo }

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  ESTADO,
  codigoDeError,
  confirmacionValida,
  nombreRespaldo,
  validarAccion,
  type Codigo,
} from './logica.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-disposition',
}

const json = (
  cuerpo: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  })
const error = (codigo: Codigo) => json({ codigo }, ESTADO[codigo])

class ErrorPlataforma extends Error {
  constructor(readonly codigo: Codigo) {
    super(codigo)
  }
}

/** Llama a una función SQL de plataforma; un error de Postgres pasa a código. */
async function rpc<T>(
  db: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error: e } = await db.rpc(fn, args)
  if (e) throw new ErrorPlataforma(codigoDeError(e.message))
  return data as T
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return error('solicitud_invalida')

  const pedido = validarAccion(await req.json().catch(() => null))
  if (!pedido) return error('solicitud_invalida')

  const url = Deno.env.get('SUPABASE_URL')!
  const usuarioCliente = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  })
  const { data: sesion } = await usuarioCliente.auth.getUser()
  const operador = sesion?.user
  if (!operador) return error('sin_sesion')

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: esOperador } = await db
    .from('administradores_plataforma')
    .select('usuario_id')
    .eq('usuario_id', operador.id)
    .maybeSingle()
  if (!esOperador) return error('sin_permiso')

  const auditar = (fila: {
    accion: string
    resultado: string
    tenant_id?: string | null
    tenant_nombre?: string | null
    usuario_id?: string | null
    usuario_correo?: string | null
  }) =>
    db
      .from('auditoria_plataforma')
      .insert({ operador_id: operador.id, ...fila })

  const nombreCliente = async (tenantId: string) => {
    const { data } = await db
      .from('tenants')
      .select('nombre')
      .eq('id', tenantId)
      .maybeSingle()
    if (!data) throw new ErrorPlataforma('no_encontrado')
    return String(data.nombre)
  }

  try {
    switch (pedido.accion) {
      case 'listar': {
        const filas = await rpc<Record<string, unknown>[]>(
          db,
          'resumen_clientes',
          {},
        )
        return json({
          clientes: filas.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            creadoEn: f.creado_en,
            lugares: Number(f.lugares),
            usuariosActivos: Number(f.usuarios_activos),
            ultimaActividad: f.ultima_actividad,
          })),
        })
      }

      case 'detalle': {
        const nombre = await nombreCliente(pedido.tenantId)
        const usuarios = await rpc<Record<string, unknown>[]>(
          db,
          'usuarios_de_cliente',
          {
            p_tenant: pedido.tenantId,
          },
        )
        const { data: invitaciones } = await db
          .from('invitaciones')
          .select('id, correo, rol, vence_en')
          .eq('tenant_id', pedido.tenantId)
          .eq('estado', 'pendiente')
          .gt('vence_en', new Date().toISOString())
          .order('creado_en', { ascending: false })
        return json({
          cliente: { id: pedido.tenantId, nombre },
          usuarios: usuarios.map((u) => ({
            id: u.id,
            nombre: u.nombre,
            correo: u.correo,
            rol: u.rol,
            desactivado: u.desactivado_en !== null,
          })),
          invitaciones: (invitaciones ?? []).map((i) => ({
            id: i.id,
            correo: i.correo,
            rol: i.rol,
            venceEn: i.vence_en,
          })),
        })
      }

      case 'crear_cliente': {
        const [fila] = await rpc<
          { tenant_id: string; token: string; vence_en: string }[]
        >(db, 'crear_cliente', {
          p_nombre: pedido.nombre,
          p_lugar: pedido.lugar,
          p_correo: pedido.correo,
          p_operador: operador.id,
        })
        await auditar({
          accion: 'crear_cliente',
          resultado: 'ok',
          tenant_id: fila.tenant_id,
          tenant_nombre: pedido.nombre,
          usuario_correo: pedido.correo,
        })
        return json({
          tenantId: fila.tenant_id,
          token: fila.token,
          venceEn: fila.vence_en,
        })
      }

      case 'invitar': {
        const nombre = await nombreCliente(pedido.tenantId)
        const [fila] = await rpc<{ token: string; vence_en: string }[]>(
          db,
          'invitar_a_cliente',
          {
            p_tenant: pedido.tenantId,
            p_correo: pedido.correo,
            p_rol: pedido.rol,
            p_operador: operador.id,
          },
        )
        await auditar({
          accion: 'invitar',
          resultado: 'ok',
          tenant_id: pedido.tenantId,
          tenant_nombre: nombre,
          usuario_correo: pedido.correo,
        })
        return json({ token: fila.token, venceEn: fila.vence_en })
      }

      case 'eliminar_usuario': {
        const { data: cuenta } = await db.auth.admin.getUserById(
          pedido.usuarioId,
        )
        const correo = cuenta?.user?.email ?? ''
        if (!cuenta?.user) throw new ErrorPlataforma('no_encontrado')
        if (!confirmacionValida(pedido.confirmacion, correo)) {
          throw new ErrorPlataforma('confirmacion_incorrecta')
        }
        const [fila] = await rpc<{ tenant_id: string }[]>(
          db,
          'eliminar_usuario',
          {
            p_usuario: pedido.usuarioId,
            p_operador: operador.id,
          },
        )
        const { error: errorAuth } = await db.auth.admin.deleteUser(
          pedido.usuarioId,
        )
        await auditar({
          accion: 'eliminar_usuario',
          resultado: errorAuth ? 'perfil_borrado_cuenta_pendiente' : 'ok',
          tenant_id: fila.tenant_id,
          usuario_id: pedido.usuarioId,
          usuario_correo: correo,
        })
        return json({ ok: true, cuentaPendiente: Boolean(errorAuth) })
      }

      case 'exportar_cliente': {
        const nombre = await nombreCliente(pedido.tenantId)
        const respaldo = await rpc<unknown>(db, 'exportar_cliente', {
          p_tenant: pedido.tenantId,
        })
        await auditar({
          accion: 'exportar_cliente',
          resultado: 'ok',
          tenant_id: pedido.tenantId,
          tenant_nombre: nombre,
        })
        return json(respaldo, 200, {
          'Content-Disposition': `attachment; filename="${nombreRespaldo(nombre, new Date())}"`,
        })
      }

      case 'eliminar_cliente': {
        const nombre = await nombreCliente(pedido.tenantId)
        if (!confirmacionValida(pedido.confirmacion, nombre)) {
          throw new ErrorPlataforma('confirmacion_incorrecta')
        }
        const cuentas = await rpc<string[]>(db, 'eliminar_cliente', {
          p_tenant: pedido.tenantId,
          p_operador: operador.id,
        })
        const pendientes: string[] = []
        for (const id of cuentas ?? []) {
          const { error: e } = await db.auth.admin.deleteUser(id)
          if (e) pendientes.push(id)
        }
        await auditar({
          accion: 'eliminar_cliente',
          resultado: pendientes.length
            ? `ok_cuentas_pendientes:${pendientes.length}`
            : 'ok',
          tenant_id: pedido.tenantId,
          tenant_nombre: nombre,
        })
        return json({
          cuentasBorradas: (cuentas ?? []).length - pendientes.length,
          cuentasPendientes: pendientes,
        })
      }

      case 'borrar_cuentas': {
        // Reintento de cuentas que quedaron sin borrar: solo las que ya no
        // tienen perfil (su usuario o su cliente se eliminó), nunca la propia.
        const { data: conPerfil } = await db
          .from('perfiles')
          .select('id')
          .in('id', pedido.usuarioIds)
        const protegidas = new Set([
          operador.id,
          ...(conPerfil ?? []).map((p) => String(p.id)),
        ])
        const pendientes: string[] = []
        for (const id of pedido.usuarioIds) {
          if (protegidas.has(id)) continue
          const { error: e } = await db.auth.admin.deleteUser(id)
          if (e && e.status !== 404) pendientes.push(id)
        }
        await auditar({
          accion: 'borrar_cuentas',
          resultado: pendientes.length
            ? `pendientes:${pendientes.length}`
            : 'ok',
        })
        return json({ cuentasPendientes: pendientes })
      }
    }
  } catch (e) {
    const codigo = e instanceof ErrorPlataforma ? e.codigo : 'error_interno'
    if (codigo === 'error_interno')
      console.error('plataforma:', e instanceof Error ? e.message : e)
    return error(codigo)
  }
})
