import { describe, expect, it, vi } from 'vitest'
import type { PacienteRegistro } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      usuarioActual: new MemoryTable(),
      borradores: new MemoryTable(),
      pacientesRegistro: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { useAuthStore } from '../../src/stores/authStore'
import { TENANT_1 } from '../helpers/tenancy'

const pacientesT = db.pacientesRegistro as unknown as MemoryTable<PacienteRegistro>
const fila = (registroId: string, sincronizado: boolean): PacienteRegistro => ({
  registroId, tenantId: TENANT_1, autorId: 'p1', paciente: 'Juan',
  actualizadoPor: 'p1', actualizadoEn: 'x', sincronizado,
})

/** Spec 028 T012 (FR-006, SC-003). */
describe('cerrar sesión y pacientes', () => {
  it('borra los sincronizados y conserva los pendientes', async () => {
    pacientesT.seed([fila('a', true), fila('b', false), fila('c', true)])
    await useAuthStore.getState().logout()
    expect(pacientesT.all().map((p) => p.registroId)).toEqual(['b'])
  })
})
