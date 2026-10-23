/**
 * Spec 017 (research.md R9) — `select('*')` falso con la forma de
 * supabase-js: se puede `await`-ear directo o encadenar `.order()`, `.gt()` y
 * `.limit()` (paginación por cursor de `seleccionarTodo`) y `.eq().maybeSingle()`.
 * `maxRows` imita el corte de PostgREST (`max_rows`): ningún select devuelve
 * más filas, pida las que pida.
 *
 * Spec 019 (research.md R5): `order()` por varias columnas y `.or()` con el
 * cursor de clave compuesta `a.gt.X,and(a.eq.X,b.gt.Y)`, para tablas sin `id`
 * como `minimos_lugar`.
 */
type Fila = Record<string, unknown>
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
  const orden: string[] = []
  const filtros: ((fila: Fila) => boolean)[] = []
  let limite: number | null = null
  const comparar = (a: Fila, b: Fila) => {
    for (const columna of orden.length > 0 ? orden : ['id']) {
      const va = String(a[columna])
      const vb = String(b[columna])
      if (va !== vb) return va < vb ? -1 : 1
    }
    return 0
  }
  const resolver = (): Respuesta => {
    const errorPagina = limite !== null ? (opciones.alPedirPagina?.() ?? null) : null
    const error = opciones.error() ?? errorPagina
    if (error) return { data: null, error, status: opciones.status ?? 400 }
    const filas = opciones
      .filas()
      .map((f) => structuredClone(f))
      .filter((f) => filtros.every((pasa) => pasa(f)))
      .sort(comparar)
    const tope = Math.min(limite ?? Infinity, opciones.maxRows ?? Infinity)
    return { data: filas.slice(0, tope), error: null, status: 200 }
  }
  const consulta = {
    order(columna: string) {
      orden.push(columna)
      return consulta
    },
    gt(columna: string, valor: string) {
      filtros.push((f) => String(f[columna]) > valor)
      return consulta
    },
    or(filtro: string) {
      const cursor = /^(\w+)\.gt\.([^,]+),and\(\1\.eq\.\2,(\w+)\.gt\.([^)]+)\)$/.exec(filtro)
      if (!cursor) throw new Error(`or() no soportado en la consulta falsa: ${filtro}`)
      const [, a, va, b, vb] = cursor
      filtros.push((f) => String(f[a]) > va || (String(f[a]) === va && String(f[b]) > vb))
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
