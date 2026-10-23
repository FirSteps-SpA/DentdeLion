import { useAuthStore } from '../../src/stores/authStore'
import { consultaFalsa } from './consultaFalsa'

/**
 * Cliente Supabase falso configurable para las pruebas del ciclo de la spec
 * 012: tablas en memoria, errores por tabla (lote completo o por fila) y una
 * sesión controlable. Igual que supabase-js, nunca lanza: devuelve
 * `{ error, status }`.
 */
type Fila = { id: string } & Record<string, unknown>
type ErrorFalso = { message?: string; code?: string } | null
type Respuesta = { data?: unknown; error: ErrorFalso; status: number }

export interface EstadoClienteFalso {
  remoto: Record<string, Map<string, Fila>>
  /** Error que devuelve cualquier upsert a esa tabla. */
  errorUpsert: Record<string, ErrorFalso>
  /** Error para upserts que contengan alguna de estas filas (por id o por función). */
  rechazarFila: Record<string, (fila: Fila) => ErrorFalso>
  errorSelect: Record<string, ErrorFalso>
  status: Record<string, number>
  /** `undefined` = la del usuario de `useAuthStore`; `null` = sin sesión. */
  sesionUserId: string | null | undefined
  errorSesion: ErrorFalso
  /** Si se define, `getSession` espera esta promesa (para ver un ciclo en curso). */
  esperarSesion: Promise<void> | null
  llamadasSesion: number
  upserts: { tabla: string; filas: Fila[] }[]
  /** Spec 016 — `update(...).eq('id', …)` aplicados (anulaciones de tratamientos). */
  updates: { tabla: string; id: string; cambios: Record<string, unknown> }[]
  /** Si se define, cualquier upsert lanza (simula un fallo inesperado). */
  lanzar: Error | null
  /** Spec 017 (R9) — corte de PostgREST (`max_rows`) para cualquier select. */
  maxRows: number
  /** Spec 017 — página (1, 2, …) de esa tabla que devuelve error. */
  errorEnPagina: Record<string, number>
  /** Spec 017 — páginas pedidas por tabla (`.limit()`), para `errorEnPagina`. */
  paginasPedidas: Record<string, number>
}

/** Spec 019: `minimos_lugar` no tiene `id`; su clave es (insumo, lugar). */
export function claveFila(fila: Fila): string {
  return fila.id ?? `${String(fila.insumo_id)}|${String(fila.lugar_id)}`
}

export function crearEstado(): EstadoClienteFalso {
  return {
    remoto: {},
    errorUpsert: {},
    rechazarFila: {},
    errorSelect: {},
    status: {},
    sesionUserId: undefined,
    errorSesion: null,
    esperarSesion: null,
    llamadasSesion: 0,
    upserts: [],
    updates: [],
    lanzar: null,
    maxRows: 1000,
    errorEnPagina: {},
    paginasPedidas: {},
  }
}

export function reiniciar(estado: EstadoClienteFalso): void {
  Object.assign(estado, crearEstado())
}

export function crearClienteFalso(estado: EstadoClienteFalso) {
  const tabla = (nombre: string) => (estado.remoto[nombre] ??= new Map())
  return {
    auth: {
      async getSession() {
        estado.llamadasSesion++
        if (estado.esperarSesion) await estado.esperarSesion
        if (estado.errorSesion)
          return { data: { session: null }, error: estado.errorSesion }
        const id =
          estado.sesionUserId === undefined
            ? useAuthStore.getState().usuario?.id
            : estado.sesionUserId
        return { data: { session: id ? { user: { id } } : null }, error: null }
      },
    },
    from(nombre: string) {
      const status = () => estado.status[nombre] ?? 400
      return {
        async upsert(filas: Fila | Fila[]): Promise<Respuesta> {
          if (estado.lanzar) throw estado.lanzar
          const lista = Array.isArray(filas) ? filas : [filas]
          estado.upserts.push({ tabla: nombre, filas: structuredClone(lista) })
          const errorTabla = estado.errorUpsert[nombre]
          if (errorTabla) return { error: errorTabla, status: status() }
          const rechazar = estado.rechazarFila[nombre]
          if (rechazar) {
            for (const fila of lista) {
              const error = rechazar(fila)
              if (error) return { error, status: status() }
            }
          }
          for (const fila of lista) tabla(nombre).set(claveFila(fila), structuredClone(fila))
          return { error: null, status: 201 }
        },
        update(cambios: Record<string, unknown>) {
          return {
            async eq(_columna: string, id: string): Promise<Respuesta> {
              estado.updates.push({ tabla: nombre, id, cambios: structuredClone(cambios) })
              const errorTabla = estado.errorUpsert[nombre]
              if (errorTabla) return { error: errorTabla, status: status() }
              const fila = tabla(nombre).get(id)
              if (fila) tabla(nombre).set(id, { ...fila, ...structuredClone(cambios) })
              return { error: null, status: 204 }
            },
          }
        },
        select() {
          return consultaFalsa({
            filas: () => [...tabla(nombre).values()],
            error: () => estado.errorSelect[nombre] ?? null,
            status: status(),
            maxRows: estado.maxRows,
            alPedirPagina: () => {
              const pagina = (estado.paginasPedidas[nombre] ?? 0) + 1
              estado.paginasPedidas[nombre] = pagina
              return estado.errorEnPagina[nombre] === pagina
                ? { message: `fallo en la página ${pagina}` }
                : null
            },
            maybeSingle: () => tabla(nombre).get('global') ?? null,
          })
        },
      }
    },
  }
}
