import { useState } from 'react'

/** Elementos por página o por grupo de "Ver más" (spec 020 FR-001). */
export const TAMANO_PAGINA = 25

/** "Ver más" en listas de tarjetas; páginas numeradas en la tabla de desktop. */
export type ModoPaginacion = 'ver-mas' | 'paginas'

export function totalPaginas(total: number): number {
  return Math.max(1, Math.ceil(total / TAMANO_PAGINA))
}

/** Página que cubre `hasta`, acotada a la última con elementos (R3). */
export function paginaDe(hasta: number, total: number): number {
  return Math.min(
    Math.max(1, Math.ceil(hasta / TAMANO_PAGINA)),
    totalPaginas(total),
  )
}

/** Rango 1-based de una página, p. ej. `{ desde: 26, hasta: 50 }`. */
export function rangoPagina(
  pagina: number,
  total: number,
): { desde: number; hasta: number } {
  if (total === 0) return { desde: 0, hasta: 0 }
  return {
    desde: (pagina - 1) * TAMANO_PAGINA + 1,
    hasta: Math.min(pagina * TAMANO_PAGINA, total),
  }
}

/**
 * Números de página a mostrar: la primera, la última, la actual ± 1 y "…" en
 * los huecos; con 7 páginas o menos, todas (R6).
 */
export function paginasVisibles(
  actual: number,
  total: number,
): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const numeros = [1, actual - 1, actual, actual + 1, total]
    .filter((n, i, todos) => n >= 1 && n <= total && todos.indexOf(n) === i)
    .sort((a, b) => a - b)
  const resultado: (number | '…')[] = []
  for (const n of numeros) {
    const anterior = resultado[resultado.length - 1]
    if (typeof anterior === 'number' && n - anterior === 2)
      resultado.push(anterior + 1)
    else if (typeof anterior === 'number' && n - anterior > 2)
      resultado.push('…')
    resultado.push(n)
  }
  return resultado
}

export function textoQuedan(n: number): string {
  return n === 1 ? 'queda 1' : `quedan ${n}`
}

export interface ListaPaginada<T> {
  visibles: T[]
  total: number
  /** Solo en "Ver más". */
  quedan: number
  /** Solo en páginas: la mostrada (1-based, ya acotada). */
  pagina: number
  paginas: number
  /** Hay más de una página o grupo (FR-002). */
  hayControles: boolean
  verMas: () => void
  irAPagina: (pagina: number) => void
  /** Índice del primer elemento agregado por el último "Ver más", para enfocarlo. */
  indicePrimerNuevo: number | null
}

/**
 * Paginación de presentación (spec 020 R1–R3). Guarda un solo número,
 * `hasta`: cuántos elementos cubre la vista. Así "Ver más" y las páginas
 * comparten estado y pasar de tarjetas a tabla conserva la posición. Si
 * cambia `clave` (búsqueda, filtros, lugar), vuelve al comienzo. `items`
 * llega ya filtrado y ordenado.
 */
export function useListaPaginada<T>(
  items: T[],
  { clave, modo }: { clave: string; modo: ModoPaginacion },
): ListaPaginada<T> {
  const [estado, setEstado] = useState({
    clave,
    hasta: TAMANO_PAGINA,
    primerNuevo: null as number | null,
  })
  if (estado.clave !== clave) {
    setEstado({ clave, hasta: TAMANO_PAGINA, primerNuevo: null })
  }
  const hasta = estado.clave === clave ? estado.hasta : TAMANO_PAGINA
  const primerNuevo = estado.clave === clave ? estado.primerNuevo : null

  const total = items.length
  const paginas = totalPaginas(total)
  const pagina = paginaDe(hasta, total)
  const visibles =
    modo === 'ver-mas'
      ? items.slice(0, hasta)
      : items.slice((pagina - 1) * TAMANO_PAGINA, pagina * TAMANO_PAGINA)

  return {
    visibles,
    total,
    quedan: Math.max(0, total - hasta),
    pagina,
    paginas,
    hayControles: total > TAMANO_PAGINA,
    verMas: () =>
      setEstado((e) => ({
        ...e,
        hasta: e.hasta + TAMANO_PAGINA,
        primerNuevo: e.hasta,
      })),
    irAPagina: (p) =>
      setEstado((e) => ({
        ...e,
        hasta: Math.max(1, p) * TAMANO_PAGINA,
        primerNuevo: null,
      })),
    indicePrimerNuevo:
      modo === 'ver-mas' && primerNuevo !== null && primerNuevo < total
        ? primerNuevo
        : null,
  }
}
