import type { SupabaseClient } from '@supabase/supabase-js'

/** Igual que el `max_rows` de PostgREST (`supabase/config.toml`). */
export const TAMANO_PAGINA = 1000

export interface RespuestaPaginada<T> {
  data: T[] | null
  error: { message?: string; code?: string } | null
  status?: number
}

export interface OpcionesPaginado {
  /**
   * Columnas de la clave por la que se pagina: `['id']` por defecto, o dos
   * columnas para una clave compuesta (spec 019: `minimos_lugar`).
   */
  clave?: [string] | [string, string]
  tamanoPagina?: number
}

/**
 * Spec 017 (research.md R9, FR-018a) — todas las filas visibles de una tabla.
 * PostgREST corta cada select en `max_rows`, así que un `select('*')` simple
 * bajaba la historia truncada sin error. Pagina **por cursor** (`id >
 * último`), no por desplazamiento: una fila insertada o borrada entre páginas
 * no corre las siguientes. Ante el error de cualquier página devuelve
 * `data: null`, para no aplicar la tabla a medias.
 *
 * Spec 019 (research.md R5): con una clave compuesta `[a, b]` el cursor es la
 * tupla — `a > último.a`, o `a = último.a` y `b > último.b`. El tercer
 * parámetro acepta todavía un número (`tamanoPagina`).
 */
export async function seleccionarTodo<T extends Record<string, unknown> = { id: string }>(
  client: SupabaseClient,
  tabla: string,
  opciones: OpcionesPaginado | number = {},
): Promise<RespuestaPaginada<T>> {
  const { clave = ['id'], tamanoPagina = TAMANO_PAGINA } =
    typeof opciones === 'number' ? { tamanoPagina: opciones } : opciones
  const [a, b] = clave
  const filas: T[] = []
  let ultima: T | null = null
  for (;;) {
    let consulta = client.from(tabla).select('*').order(a)
    if (b) consulta = consulta.order(b)
    consulta = consulta.limit(tamanoPagina)
    if (ultima !== null) {
      const va = String(ultima[a])
      consulta = b
        ? consulta.or(`${a}.gt.${va},and(${a}.eq.${va},${b}.gt.${String(ultima[b])})`)
        : consulta.gt(a, va)
    }
    const respuesta = await consulta
    if (respuesta.error || !respuesta.data) {
      return { data: null, error: respuesta.error, status: respuesta.status }
    }
    const pagina = respuesta.data as T[]
    filas.push(...pagina)
    if (pagina.length < tamanoPagina) return { data: filas, error: null, status: respuesta.status }
    ultima = pagina[pagina.length - 1]
  }
}
