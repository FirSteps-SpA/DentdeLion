import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Borrador } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      borradores: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import { useBorradorAlta } from '../../../src/features/insumos/lib/useBorradorAlta'

const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

beforeEach(() => {
  borradoresT.seed([])
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Flushes the initial `db.borradores.get(...)` microtask under fake timers. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('useBorradorAlta (spec 008 R6)', () => {
  it('writes no row for an untouched form, even one opened with inicial.nombre set', async () => {
    renderHook(() => useBorradorAlta({ nombre: 'Hilo sutura' }))
    await flush()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(borradoresT.all()).toHaveLength(0)
  })

  it('writes a row 400 ms after a change', async () => {
    const { result } = renderHook(() => useBorradorAlta({}))
    await flush()

    act(() => result.current.setDatos({ nombre: 'Fresa' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399)
    })
    expect(borradoresT.all()).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(borradoresT.all()).toHaveLength(1)
    expect(borradoresT.all()[0].datos).toMatchObject({ nombre: 'Fresa' })
  })

  it('restores an existing borrador on remount, winning over inicial.nombre', async () => {
    const { result, unmount } = renderHook(() => useBorradorAlta({}))
    await flush()
    act(() => result.current.setDatos({ nombre: 'Guardado' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    unmount()

    const { result: result2 } = renderHook(() =>
      useBorradorAlta({ nombre: 'Otro' }),
    )
    await flush()

    expect(result2.current.restaurado).toBe(true)
    expect(result2.current.datos.nombre).toBe('Guardado')
  })

  it('descartar cancels the pending timer and deletes the row', async () => {
    const { result } = renderHook(() => useBorradorAlta({}))
    await flush()
    act(() => result.current.setDatos({ nombre: 'Fresa' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(borradoresT.all()).toHaveLength(1)

    act(() => result.current.setDatos({ nombre: 'Otra' }))
    await act(async () => {
      await result.current.descartar()
    })
    expect(borradoresT.all()).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(borradoresT.all()).toHaveLength(0)
  })

  it('authStore.logout() clears the borrador', async () => {
    const { result } = renderHook(() => useBorradorAlta({}))
    await flush()
    act(() => result.current.setDatos({ nombre: 'Fresa' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(borradoresT.all()).toHaveLength(1)

    await act(async () => {
      await useAuthStore.getState().logout()
    })

    expect(borradoresT.all()).toHaveLength(0)
  })
})
