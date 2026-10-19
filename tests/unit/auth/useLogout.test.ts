import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '../../../src/stores/authStore'

const signOut = vi.fn()

vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({
    client: { auth: { signOut } },
    error: null,
  }),
}))

vi.mock('../../../src/lib/db', () => ({
  db: {
    usuarioActual: {
      clear: vi.fn(async () => {}),
      add: vi.fn(async () => {}),
      toCollection: () => ({ first: async () => null }),
    },
    borradores: {
      clear: vi.fn(async () => {}),
    },
  },
}))

import { useLogout } from '../../../src/features/auth/useLogout'
import { db } from '../../../src/lib/db'
import { TENANT_1 } from '../../helpers/tenancy'

const usuarioDePrueba = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'user-1',
  email: 'a@example.com',
  nombre: 'Ana',
  rol: 'personal' as const,
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

afterEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ usuario: null, isReady: false })
})

describe('useLogout', () => {
  it('clears the local session even when the Supabase signOut call rejects (offline)', async () => {
    signOut.mockRejectedValue(new Error('sin conexión'))
    useAuthStore.setState({ usuario: usuarioDePrueba, isReady: true })

    const { result } = renderHook(() => useLogout())

    await act(async () => {
      await result.current.signOut()
    })

    expect(useAuthStore.getState().usuario).toBeNull()
    expect(db.usuarioActual.clear).toHaveBeenCalled()
  })
})
