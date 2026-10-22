import { useState } from 'react'

/**
 * Spec 017 (FR-014, UI §3) — elemento resaltado de un gráfico. Se elige
 * tocando su entrada de la leyenda o su etiqueta (≥ 48 px); tocar la figura o
 * pasar el cursor es solo un complemento.
 */
export function useSeleccion() {
  const [seleccion, setSeleccion] = useState<number | null>(null)
  return {
    seleccion,
    alternar: (i: number) => setSeleccion((actual) => (actual === i ? null : i)),
    hover: (i: number | null) => setSeleccion(i),
    atenuado: (i: number) => seleccion !== null && seleccion !== i,
  }
}

export const botonEntrada =
  'touch-target flex w-full items-center gap-3 rounded-md px-2 text-left text-body text-text hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-brand aria-pressed:bg-bg-secondary aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-brand'
