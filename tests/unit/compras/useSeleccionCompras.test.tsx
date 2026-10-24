import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Borrador, UsuarioActual } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      borradores: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import { useSeleccionCompras } from '../../../src/features/compras/lib/useSeleccionCompras'
import { TENANT_1, TENANT_2 } from '../../helpers/tenancy'

const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

const usuario: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'u1',
  email: 'a@x.cl',
  nombre: 'Ana',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

function fila(): Borrador | undefined {
  return borradoresT.all().find((b) => b.id === 'seleccion-compras')
}

function clavesGuardadas(): string[] {
  const f = fila()
  return f?.id === 'seleccion-compras' ? [...f.datos.claves].sort() : []
}

beforeEach(() => {
  borradoresT.seed([])
  useAuthStore.setState({ usuario, isReady: true })
})

async function montar(pendientes: ReadonlySet<string> | null) {
  const hook = renderHook(({ p }) => useSeleccionCompras(p), {
    initialProps: { p: pendientes },
  })
  await waitFor(() => expect(hook.result.current.cargando).toBe(false))
  return hook
}

describe('useSeleccionCompras (spec 022 R2, FR-003)', () => {
  it('arranca sin nada marcado', async () => {
    const { result } = await montar(new Set(['a', 'b']))
    expect(result.current.seleccion.size).toBe(0)
  })

  it('guarda lo marcado en borradores y lo recupera al volver a montar', async () => {
    const pendientes = new Set(['a', 'b'])
    const primero = await montar(pendientes)
    act(() => primero.result.current.alternar('a'))
    expect(primero.result.current.seleccion.has('a')).toBe(true)
    await waitFor(() => expect(clavesGuardadas()).toEqual(['a']))
    expect(fila()).toMatchObject({ datos: { tenantId: TENANT_1 } })
    primero.unmount()

    const segundo = await montar(pendientes)
    expect([...segundo.result.current.seleccion]).toEqual(['a'])

    act(() => segundo.result.current.alternar('a'))
    expect(segundo.result.current.seleccion.size).toBe(0)
    await waitFor(() => expect(clavesGuardadas()).toEqual([]))
  })

  it('poda lo que ya no está pendiente y lo guarda podado', async () => {
    borradoresT.seed([
      {
        id: 'seleccion-compras',
        datos: { tenantId: TENANT_1, claves: ['a', 'salio'] },
        actualizadoEn: '2026-01-01T00:00:00.000Z',
      },
    ])
    const { result } = await montar(new Set(['a', 'nuevo']))
    expect([...result.current.seleccion]).toEqual(['a'])
    await waitFor(() => expect(clavesGuardadas()).toEqual(['a']))
  })

  it('un ítem que sale y vuelve aparece sin marcar', async () => {
    const { result, rerender } = await montar(new Set(['a']))
    act(() => result.current.alternar('a'))
    rerender({ p: new Set<string>() })
    await waitFor(() => expect(clavesGuardadas()).toEqual([]))
    rerender({ p: new Set(['a']) })
    expect(result.current.seleccion.has('a')).toBe(false)
  })

  it('sin saber qué está pendiente (null) no poda', async () => {
    borradoresT.seed([
      {
        id: 'seleccion-compras',
        datos: { tenantId: TENANT_1, claves: ['a'] },
        actualizadoEn: '2026-01-01T00:00:00.000Z',
      },
    ])
    const { result } = await montar(null)
    expect([...result.current.seleccion]).toEqual(['a'])
    expect(clavesGuardadas()).toEqual(['a'])
  })

  it('ignora la selección de otro tenant', async () => {
    borradoresT.seed([
      {
        id: 'seleccion-compras',
        datos: { tenantId: TENANT_2, claves: ['a'] },
        actualizadoEn: '2026-01-01T00:00:00.000Z',
      },
    ])
    const { result } = await montar(new Set(['a']))
    expect(result.current.seleccion.size).toBe(0)
  })

  it('marcarTodos marca todas y, si ya estaban, las desmarca (FR-002)', async () => {
    const { result } = await montar(new Set(['a', 'b', 'c']))
    act(() => result.current.alternar('a'))
    act(() => result.current.marcarTodos(['a', 'b']))
    expect([...result.current.seleccion].sort()).toEqual(['a', 'b'])
    act(() => result.current.marcarTodos(['a', 'b']))
    expect(result.current.seleccion.size).toBe(0)
  })
})
