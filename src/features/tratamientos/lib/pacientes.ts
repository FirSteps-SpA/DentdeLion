import {
  db,
  type PacienteRegistro,
  type TratamientoRealizado,
  type UsuarioActual,
} from '../../../lib/db'
import { tenantActualOFallar, useAuthStore } from '../../../stores/authStore'
import { plegar } from '../../insumos/lib/categorias'

/**
 * Spec 028 (research.md R2–R5, UI §3) — paciente de un tratamiento realizado.
 * Dato de salud: solo lo ven y lo cambian quien registró el tratamiento y la
 * administración (lo impone el servidor; aquí se refleja en la UI). Ningún
 * mensaje de error incluye el texto del paciente (R6).
 */

export const MAX_PACIENTE = 60

/** `trim`, espacios colapsados y máximo 60; vacío → `null` (FR-001). */
export function normalizarPaciente(texto: string): string | null {
  const limpio = texto.trim().replace(/\s+/g, ' ').slice(0, MAX_PACIENTE).trim()
  return limpio === '' ? null : limpio
}

const esAdministracion = (usuario: UsuarioActual | null) => usuario?.rol === 'administrador'

/** FR-005: autor del registro o administración. */
export function pacienteVisible(
  fila: Pick<PacienteRegistro, 'autorId'> | undefined,
  usuario: UsuarioActual | null,
): boolean {
  if (!fila || !usuario) return false
  return fila.autorId === usuario.id || esAdministracion(usuario)
}

/** FR-010: autor o administración, y el registro no está anulado. */
export function puedeEditarPaciente(
  registro: Pick<TratamientoRealizado, 'usuarioId' | 'anuladoEn'>,
  usuario: UsuarioActual | null,
): boolean {
  if (!usuario || registro.anuladoEn !== null) return false
  return registro.usuarioId === usuario.id || esAdministracion(usuario)
}

/** La fila local del paciente (sin subir) para un registro. */
export function filaPaciente(
  registro: Pick<TratamientoRealizado, 'id' | 'usuarioId'>,
  paciente: string | null,
  usuarioId: string,
  tenantId: string,
): PacienteRegistro {
  return {
    registroId: registro.id,
    tenantId,
    autorId: registro.usuarioId,
    paciente,
    actualizadoPor: usuarioId,
    actualizadoEn: new Date().toISOString(),
    sincronizado: false,
  }
}

/**
 * Agrega, corrige o quita (texto vacío) el paciente de un registro (FR-010).
 * Sin conexión: queda en Dexie y sube con el sync.
 */
export async function guardarPaciente(registroId: string, texto: string): Promise<void> {
  const usuario = useAuthStore.getState().usuario
  await db.transaction('rw', [db.tratamientosRealizados, db.pacientesRegistro], async () => {
    const registro = await db.tratamientosRealizados.get(registroId)
    if (!registro) throw new Error('El tratamiento no existe.')
    if (!puedeEditarPaciente(registro, usuario)) {
      throw new Error(
        registro.anuladoEn
          ? 'No se puede cambiar el paciente de un tratamiento anulado.'
          : 'Solo quien registró el tratamiento o la administración pueden cambiar el paciente.',
      )
    }
    const paciente = normalizarPaciente(texto)
    const actual = await db.pacientesRegistro.get(registroId)
    // Sin fila y sin texto: no hay nada que guardar.
    if (!actual && paciente === null) return
    if (actual && actual.paciente === paciente) return
    await db.pacientesRegistro.put(
      filaPaciente(registro, paciente, usuario!.id, tenantActualOFallar()),
    )
  })
}

/**
 * Filtro del historial (FR-012): registros cuyo paciente visible contiene la
 * búsqueda, sin distinguir mayúsculas, tildes ni espacios extra. Búsqueda
 * vacía = todos.
 */
export function filtrarPorPaciente<T extends { id: string }>(
  registros: T[],
  pacientes: ReadonlyMap<string, string>,
  busqueda: string,
): T[] {
  const buscado = plegar(busqueda.trim().replace(/\s+/g, ' '))
  if (buscado === '') return registros
  return registros.filter((r) => {
    const paciente = pacientes.get(r.id)
    return paciente !== undefined && plegar(paciente.replace(/\s+/g, ' ')).includes(buscado)
  })
}
