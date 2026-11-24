/**
 * Spec 031 (FR-013): cuando el sync borra los datos de una cuenta eliminada,
 * el login lo explica una vez. En `sessionStorage`: si no está disponible, el
 * login aparece sin el aviso.
 */
const CLAVE = 'dentdelion:cuenta-eliminada'

export function marcarCuentaEliminada(): void {
  try {
    sessionStorage.setItem(CLAVE, '1')
  } catch {
    // Sin almacenamiento.
  }
}

/** Lee y borra el aviso: se muestra una sola vez. */
export function tomarAvisoCuentaEliminada(): boolean {
  try {
    const hay = sessionStorage.getItem(CLAVE) === '1'
    sessionStorage.removeItem(CLAVE)
    return hay
  } catch {
    return false
  }
}
