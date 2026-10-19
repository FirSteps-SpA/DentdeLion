import { describe, expect, it, vi } from 'vitest'

/** Spec 014 T053 (FR-021): errores del servidor traducidos para la interfaz. */
let respuesta: { data: unknown; error: { message: string } | null } = { data: [], error: null }
const client = {
  from: () => ({
    update: () => ({ eq: () => ({ select: async () => respuesta }) }),
  }),
}
vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { cambiarRol, desactivarUsuario } from '../../../src/features/ajustes/lib/equipo'

describe('equipo', () => {
  it('traduce el rechazo de la última administradora', async () => {
    respuesta = { data: null, error: { message: 'ultimo_administrador' } }
    await expect(cambiarRol('u1', 'personal')).rejects.toThrow(
      'Debe quedar al menos una administradora activa.',
    )
  })

  it('sin filas actualizadas (RLS) informa falta de permiso', async () => {
    respuesta = { data: [], error: null }
    await expect(desactivarUsuario('u2')).rejects.toThrow(/permiso/)
  })

  it('con una fila actualizada no falla', async () => {
    respuesta = { data: [{ id: 'u2' }], error: null }
    await expect(desactivarUsuario('u2')).resolves.toBeUndefined()
  })
})
