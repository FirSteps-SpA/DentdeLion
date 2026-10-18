import type { Indicador } from '../lib/sync/indicador'

/** Texto completo del estado del indicador (spec 012 contracts/ui-contracts.md). */
export function textoIndicador(indicador: Indicador): string {
  const conNumero = (base: string) =>
    indicador.propios > 0 ? `${base} · ${indicador.etiqueta}` : base
  switch (indicador.estado) {
    case 'sincronizado':
      return 'Sincronizado'
    case 'pendientes':
      return `${indicador.etiqueta} pendientes`
    case 'sin-conexion':
      return conNumero('Sin conexión')
    case 'error':
      return conNumero('Error de sincronización')
  }
}

/** Versión corta para el encabezado en pantallas angostas. */
export function textoCortoIndicador(indicador: Indicador): string {
  const conNumero = (base: string) =>
    indicador.propios > 0 ? `${base} · ${indicador.etiqueta}` : base
  switch (indicador.estado) {
    case 'sincronizado':
      return 'Sincronizado'
    case 'pendientes':
      return `${indicador.etiqueta} pend.`
    case 'sin-conexion':
      return conNumero('Sin red')
    case 'error':
      return conNumero('Error')
  }
}

const hora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' })
const diaMes = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' })

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** "hoy 14:32", "ayer 18:05" o "12 oct 09:10" (spec 012 contracts/ui-contracts.md). */
export function fechaRelativa(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso)
  const ayer = new Date(ahora)
  ayer.setDate(ahora.getDate() - 1)
  const hh = hora.format(fecha)
  if (mismoDia(fecha, ahora)) return `hoy ${hh}`
  if (mismoDia(fecha, ayer)) return `ayer ${hh}`
  return `${diaMes.format(fecha).replace('.', '')} ${hh}`
}
