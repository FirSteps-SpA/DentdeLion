import { useMemo } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { pacienteVisible } from './pacientes'

/**
 * Spec 028 (FR-005): pacientes que la sesión puede ver, por registro y sin
 * los vacíos. En un dispositivo compartido oculta los pendientes de otra
 * persona.
 */
export function usePacientesVisibles(): Map<string, string> {
  const filas = useTratamientosStore((s) => s.pacientesRegistro)
  const usuario = useAuthStore((s) => s.usuario)
  return useMemo(
    () =>
      new Map(
        filas
          .filter((fila) => fila.paciente !== null && pacienteVisible(fila, usuario))
          .map((fila) => [fila.registroId, fila.paciente as string]),
      ),
    [filas, usuario],
  )
}
