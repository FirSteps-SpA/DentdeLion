import type { SupabaseClient } from '@supabase/supabase-js'

/** Igual que el `max_rows` de PostgREST (`supabase/config.toml`). */
export const TAMANO_PAGINA = 1000

export interface RespuestaPaginada<T> {
  data: T[] | null
  error: { message?: string; code?: string } | null
  status?: number
}

/**
 * Spec 017 (research.md R9, FR-018a) — todas las filas visibles de una tabla.
 * PostgREST corta cada select en `max_rows`, así que un `select('*')` simple
 * bajaba la historia truncada sin error. Pagina **por cursor** (`id >
 * último`), no por desplazamiento: una fila insertada o borrada entre páginas
 * no corre las siguientes. Ante el error de cualquier página devuelve
 * `data: null`, para no aplicar la tabla a medias.
 */
export async function seleccionarTodo<T extends { id: string }>(
  client: SupabaseClient,
  tabla: string,
  tamanoPagina = TAMANO_PAGINA,
): Promise<RespuestaPaginada<T>> {
  const filas: T[] = []
  let ultimoId: string | null = null
  for (;;) {
    const consulta = client.from(tabla).select('*').order('id').limit(tamanoPagina)
    const respuesta = await (ultimoId === null ? consulta : consulta.gt('id', ultimoId))
    if (respuesta.error || !respuesta.data) {
      return { data: null, error: respuesta.error, status: respuesta.status }
    }
    const pagina = respuesta.data as T[]
    filas.push(...pagina)
    if (pagina.length < tamanoPagina) return { data: filas, error: null, status: respuesta.status }
    ultimoId = pagina[pagina.length - 1].id
  }
}
