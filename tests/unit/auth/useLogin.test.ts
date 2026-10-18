import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthStore } from '../../../src/stores/authStore'

const signInWithPassword = vi.fn()

vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({
    client: { auth: { signInWithPassword } },
    error: null,
  }),
}))

vi.mock('../../../src/lib/supabase/perfiles', () => ({
  fetchPerfilPropio: vi.fn(async (_client: unknown, userId: string) => ({
    id: userId,
    nombre: 'Ana Pérez',
    rol: 'personal',
  })),
}))

vi.mock('../../../src/lib/db', () => {
  let row: unknown = null
  return {
    db: {
      usuarioActual: {
        clear: vi.fn(async () => {
          row = null
        }),
        add: vi.fn(async (value: unknown) => {
          row = value
        }),
        toCollection: () => ({ first: async () => row }),
      },
      usuariosConocidos: { put: vi.fn(async () => undefined) },
    },
  }
})

import { useLogin } from '../../../src/features/auth/useLogin'
import { fetchPerfilPropio } from '../../../src/lib/supabase/perfiles'

afterEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ usuario: null, isReady: false })
})

describe('useLogin', () => {
  it('persists UsuarioActual and updates authStore on success', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ana@example.com' } },
      error: null,
    })

    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.signIn('ana@example.com', 'correcta')
    })

    expect(useAuthStore.getState().usuario).toMatchObject({
      id: 'user-1',
      email: 'ana@example.com',
      nombre: 'Ana Pérez',
      rol: 'personal',
    })
    expect(result.current.error).toBeNull()
  })

  it('shows one generic message on wrong password without revealing whether the email exists', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const { result } = renderHook(() => useLogin())

    await act(async () => {
      await result.current.signIn('ana@example.com', 'incorrecta')
    })

    expect(result.current.error).toBe('Correo o contraseña incorrectos.')
    expect(fetchPerfilPropio).not.toHaveBeenCalled()
    expect(useAuthStore.getState().usuario).toBeNull()
  })
})
