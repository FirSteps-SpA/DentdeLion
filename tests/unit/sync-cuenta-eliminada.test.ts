import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Movimiento, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
    ),
  }
})

/**
 * Spec 031 T010, T011 (research.md R4, R5; FR-008, FR-013): el sync baja los
 * ids de cuentas eliminadas y cierra la sesión de una cuenta eliminada, sin
 * borrar nada ante una falla.
 */
const estado = {
  perfil: null as null | {
    id: string
    nombre: string
    rol: string
    tenant_id: string
    desactivado_en: null
  },
  /** Respuesta de `cuenta_eliminada`: true, false o un error. */
  cuentaEliminada: false as boolean | 'error',
  eliminados: [] as {
    usuario_id: string
    tenant_id: string
    eliminado_en: string
  }[],
  signOut: vi.fn(async () => ({ error: null })),
}

function seleccion(nombre: string) {
  const consulta = {
    order: () => consulta,
    gt: () => consulta,
    eq: () => consulta,
    is: () => consulta,
    limit: () => consulta,
    async maybeSingle() {
      return { data: null, error: null, status: 200 }
    },
    then(
      resolver: (r: unknown) => unknown,
      rechazar?: (e: unknown) => unknown,
    ) {
      const data =
        nombre === 'usuarios_eliminados'
          ? structuredClone(estado.eliminados)
          : []
      return Promise.resolve({ data, error: null, status: 200 }).then(
        resolver,
        rechazar,
      )
    },
  }
  return consulta
}

const client = {
  auth: { ...authFalso, signOut: estado.signOut },
  from(nombre: string) {
    return {
      upsert: async () => ({ error: null, status: 201 }),
      insert: async () => ({ error: null, status: 201 }),
      update: () => ({ eq: async () => ({ error: null, status: 204 }) }),
      select: () => seleccion(nombre),
    }
  },
  async rpc(fn: string) {
    if (fn !== 'cuenta_eliminada')
      return { data: null, error: { message: 'no' } }
    if (estado.cuentaEliminada === 'error')
      return { data: null, error: { message: 'fetch failed' } }
    return { data: estado.cuentaEliminada, error: null }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))
vi.mock('../../src/lib/supabase/perfiles', () => ({
  fetchPerfilPropio: async () => estado.perfil,
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { tomarAvisoCuentaEliminada } from '../../src/lib/avisoCuentaEliminada'
import { useAuthStore } from '../../src/stores/authStore'
import { lugar1 } from '../helpers/lugarFalso'
import { TENANT_1 } from '../helpers/tenancy'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const conocidosT = db.usuariosConocidos as unknown as MemoryTable<{
  id: string
  nombre: string
  vistoEn: string
}>
const eliminadosT = db.usuariosEliminados as unknown as MemoryTable<{
  id: string
  tenantId: string
  eliminadoEn: string
}>

const personal: UsuarioActual = {
  id: 'p1',
  tenantId: TENANT_1,
  email: 'p@x.cl',
  nombre: 'Ana',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}

beforeEach(() => {
  estado.perfil = null
  estado.cuentaEliminada = false
  estado.eliminados = []
  estado.signOut.mockClear()
  tomarAvisoCuentaEliminada()
  insumosT.seed([{ id: 'i1', tenantId: TENANT_1, nombre: 'Gasa' } as Insumo])
  movimientosT.seed([
    {
      id: 'm1',
      tenantId: TENANT_1,
      sincronizado: false,
    } as unknown as Movimiento,
  ])
  conocidosT.seed([])
  eliminadosT.seed([])
  ;(db.lugares as unknown as MemoryTable<typeof lugar1>).seed([lugar1])
  useAuthStore.setState({ usuario: personal, isReady: true })
})

describe('cuenta eliminada (R5)', () => {
  it('si el servidor confirma que no existe: borra todo lo local, cierra sesión y avisa', async () => {
    estado.cuentaEliminada = true
    await runSyncBatch()
    expect(insumosT.all()).toHaveLength(0)
    expect(movimientosT.all()).toHaveLength(0)
    expect(useAuthStore.getState().usuario).toBeNull()
    expect(estado.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(tomarAvisoCuentaEliminada()).toBe(true)
  })

  it.each([
    ['la cuenta existe (perfil sin respuesta)', false as const],
    ['error o sin red al preguntar', 'error' as const],
  ])('%s: no borra nada', async (_caso, respuesta) => {
    estado.cuentaEliminada = respuesta
    await runSyncBatch()
    expect(insumosT.all()).toHaveLength(1)
    expect(movimientosT.all()).toHaveLength(1)
    expect(useAuthStore.getState().usuario?.id).toBe('p1')
    expect(estado.signOut).not.toHaveBeenCalled()
  })
})

describe('usuarios eliminados del tenant (R4)', () => {
  it('baja los ids y olvida sus nombres', async () => {
    estado.perfil = {
      id: 'p1',
      nombre: 'Ana',
      rol: 'personal',
      tenant_id: TENANT_1,
      desactivado_en: null,
    }
    conocidosT.seed([
      { id: 'x1', nombre: 'Paula', vistoEn: '2026-11-01T00:00:00.000Z' },
      { id: 'x2', nombre: 'Rosa', vistoEn: '2026-11-01T00:00:00.000Z' },
    ])
    estado.eliminados = [
      {
        usuario_id: 'x1',
        tenant_id: TENANT_1,
        eliminado_en: '2026-11-23T10:00:00.000Z',
      },
    ]
    await runSyncBatch()
    expect(eliminadosT.all()).toEqual([
      { id: 'x1', tenantId: TENANT_1, eliminadoEn: '2026-11-23T10:00:00.000Z' },
    ])
    expect(conocidosT.all().map((c) => c.id)).toEqual(['x2'])
  })
})
