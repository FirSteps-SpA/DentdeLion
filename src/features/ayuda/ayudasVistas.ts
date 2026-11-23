import type { IdAyuda } from './contenido'

/**
 * Spec 030 (research.md R4) — qué ayudas ya vio cada persona en este
 * dispositivo, para abrirlas solas solo la primera vez (FR-005). En
 * `localStorage`: no se sincroniza. Si el navegador no deja leer o escribir,
 * se comporta como "no vista" y la app sigue igual.
 */

const PREFIJO = 'dentdelion:ayudas-vistas:'

/** Las pruebas existentes no deben ver hojas inesperadas; las de la spec 030 lo activan. */
export const configuracionAyuda = { automatica: import.meta.env.MODE !== 'test' }

function leer(usuarioId: string): Set<string> {
  try {
    const crudo = localStorage.getItem(PREFIJO + usuarioId)
    const lista: unknown = crudo ? JSON.parse(crudo) : []
    return new Set(Array.isArray(lista) ? lista.filter((x) => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function ayudaVista(usuarioId: string, id: IdAyuda): boolean {
  return leer(usuarioId).has(id)
}

export function marcarAyudaVista(usuarioId: string, id: IdAyuda): void {
  try {
    const vistas = leer(usuarioId)
    if (vistas.has(id)) return
    vistas.add(id)
    localStorage.setItem(PREFIJO + usuarioId, JSON.stringify([...vistas]))
  } catch {
    // Sin almacenamiento: se volverá a abrir sola; no es un error para la persona.
  }
}

/** Una sola hoja de ayuda a la vez (edge case "varias primeras visitas"). */
let abierta: IdAyuda | null = null

export function tomarHojaAyuda(id: IdAyuda): boolean {
  if (abierta !== null && abierta !== id) return false
  abierta = id
  return true
}

export function soltarHojaAyuda(id: IdAyuda): void {
  if (abierta === id) abierta = null
}
