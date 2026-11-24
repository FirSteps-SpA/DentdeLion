// Spec 031 (contracts/api.md) — lógica pura de la Edge Function `plataforma`:
// forma de cada acción y traducción de errores de Postgres a códigos. Sin
// imports de Deno: se prueba con Vitest (tests/unit/plataforma/logica.test.ts).

export type Accion =
  | { accion: 'listar' }
  | { accion: 'detalle'; tenantId: string }
  | { accion: 'crear_cliente'; nombre: string; lugar: string; correo: string }
  | {
      accion: 'invitar'
      tenantId: string
      correo: string
      rol: 'administrador' | 'personal'
    }
  | { accion: 'eliminar_usuario'; usuarioId: string; confirmacion: string }
  | { accion: 'exportar_cliente'; tenantId: string }
  | { accion: 'eliminar_cliente'; tenantId: string; confirmacion: string }
  | { accion: 'borrar_cuentas'; usuarioIds: string[] }

export type Codigo =
  | 'sin_sesion'
  | 'sin_permiso'
  | 'solicitud_invalida'
  | 'no_encontrado'
  | 'confirmacion_incorrecta'
  | 'unica_administradora'
  | 'propia_cuenta'
  | 'propio_cliente'
  | 'correo_en_otro_tenant'
  | 'ya_es_miembro'
  | 'error_interno'

export const ESTADO: Record<Codigo, number> = {
  sin_sesion: 401,
  sin_permiso: 403,
  solicitud_invalida: 400,
  no_encontrado: 404,
  confirmacion_incorrecta: 409,
  unica_administradora: 409,
  propia_cuenta: 409,
  propio_cliente: 409,
  correo_en_otro_tenant: 409,
  ya_es_miembro: 409,
  error_interno: 500,
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  return t.length >= 1 && t.length <= max ? t : null
}
const uuid = (v: unknown): string | null =>
  typeof v === 'string' && UUID.test(v) ? v : null
const correo = (v: unknown): string | null => {
  const t = texto(v, 254)?.toLowerCase() ?? null
  return t && CORREO.test(t) ? t : null
}

/** Forma de la petición; cualquier otra cosa → null (`solicitud_invalida`). */
export function validarAccion(cuerpo: unknown): Accion | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null
  const c = cuerpo as Record<string, unknown>
  switch (c.accion) {
    case 'listar':
      return { accion: 'listar' }
    case 'detalle':
    case 'exportar_cliente': {
      const tenantId = uuid(c.tenantId)
      return tenantId ? { accion: c.accion, tenantId } : null
    }
    case 'crear_cliente': {
      const nombre = texto(c.nombre, 80)
      const lugar = texto(c.lugar, 80)
      const mail = correo(c.correo)
      return nombre && lugar && mail
        ? { accion: 'crear_cliente', nombre, lugar, correo: mail }
        : null
    }
    case 'invitar': {
      const tenantId = uuid(c.tenantId)
      const mail = correo(c.correo)
      const rol =
        c.rol === 'administrador' || c.rol === 'personal' ? c.rol : null
      return tenantId && mail && rol
        ? { accion: 'invitar', tenantId, correo: mail, rol }
        : null
    }
    case 'eliminar_usuario': {
      const usuarioId = uuid(c.usuarioId)
      return usuarioId && typeof c.confirmacion === 'string'
        ? {
            accion: 'eliminar_usuario',
            usuarioId,
            confirmacion: c.confirmacion,
          }
        : null
    }
    case 'eliminar_cliente': {
      const tenantId = uuid(c.tenantId)
      return tenantId && typeof c.confirmacion === 'string'
        ? { accion: 'eliminar_cliente', tenantId, confirmacion: c.confirmacion }
        : null
    }
    case 'borrar_cuentas': {
      const ids = Array.isArray(c.usuarioIds) ? c.usuarioIds.map(uuid) : []
      return ids.length >= 1 &&
        ids.length <= 100 &&
        ids.every((id) => id !== null)
        ? { accion: 'borrar_cuentas', usuarioIds: ids as string[] }
        : null
    }
    default:
      return null
  }
}

/** La confirmación escrita coincide sin importar mayúsculas ni espacios de los bordes. */
export function confirmacionValida(escrita: string, esperada: string): boolean {
  const n = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
  return esperada.trim() !== '' && n(escrita) === n(esperada)
}

const CODIGOS_SQL: Codigo[] = [
  'no_encontrado',
  'unica_administradora',
  'propia_cuenta',
  'propio_cliente',
  'correo_en_otro_tenant',
  'ya_es_miembro',
  'solicitud_invalida',
]

/** Las funciones SQL lanzan el código como mensaje; lo demás es error interno. */
export function codigoDeError(mensaje: string | undefined): Codigo {
  return CODIGOS_SQL.find((c) => mensaje?.includes(c)) ?? 'error_interno'
}

/** Nombre de archivo del respaldo: "respaldo-clinica-x-2026-11-23.json". */
export function nombreRespaldo(cliente: string, fecha: Date): string {
  const base = cliente
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `respaldo-${base || 'cliente'}-${fecha.toISOString().slice(0, 10)}.json`
}
