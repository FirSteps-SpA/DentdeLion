/**
 * Spec 017 (research.md R9) — `select('*')` falso con la forma de
 * supabase-js: se puede `await`-ear directo o encadenar `.order()`, `.gt()` y
 * `.limit()` (paginación por cursor de `seleccionarTodo`) y `.eq().maybeSingle()`.
 * `maxRows` imita el corte de PostgREST (`max_rows`): ningún select devuelve
 * más filas, pida las que pida.
 */
type Fila = { id: string } & Record<string, unknown>
type ErrorFalso = { message?: string; code?: string } | null
type Respuesta = { data: unknown; error: ErrorFalso; status: number }

export interface OpcionesConsulta {
  filas: () => Fila[]
  error: () => ErrorFalso
  status?: number
  maxRows?: number
  /** Se llama al resolver una consulta con `.limit()` (una página). */
  alPedirPagina?: () => ErrorFalso
  maybeSingle?: () => unknown
}

export function consultaFalsa(opciones: OpcionesConsulta) {
  let mayorQue: string | null = null
  let limite: number | null = null
  const resolver = (): Respuesta => {
    const errorPagina = limite !== null ? (opciones.alPedirPagina?.() ?? null) : null
    const error = opciones.error() ?? errorPagina
    if (error) return { data: null, error, status: opciones.status ?? 400 }
    let filas = opciones
      .filas()
      .map((f) => structuredClone(f))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    if (mayorQue !== null) filas = filas.filter((f) => f.id > (mayorQue as string))
    const tope = Math.min(limite ?? Infinity, opciones.maxRows ?? Infinity)
    return { data: filas.slice(0, tope), error: null, status: 200 }
  }
  const consulta = {
    order() {
      return consulta
    },
    gt(_columna: string, valor: string) {
      mayorQue = valor
      return consulta
    },
    limit(n: number) {
      limite = n
      return consulta
    },
    eq() {
      return {
        maybeSingle: async (): Promise<Respuesta> => {
          const error = opciones.error()
          return {
            data: error ? null : structuredClone(opciones.maybeSingle?.() ?? null),
            error,
            status: error ? (opciones.status ?? 400) : 200,
          }
        },
      }
    },
    then<T1 = Respuesta, T2 = never>(
      ok?: ((r: Respuesta) => T1 | PromiseLike<T1>) | null,
      fallo?: ((e: unknown) => T2 | PromiseLike<T2>) | null,
    ): Promise<T1 | T2> {
      return Promise.resolve(resolver()).then(ok, fallo)
    },
  }
  return consulta
}
