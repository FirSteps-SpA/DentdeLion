import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioActual, UsuarioConocido } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
      borradores: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import { TENANT_1 } from '../../helpers/tenancy'

const conocidosT = db.usuariosConocidos as unknown as MemoryTable<UsuarioConocido>

function usuario(id: string, nombre: string): UsuarioActual {
  return { tenantId: TENANT_1, desactivadoEn: null, id, email: `${id}@x.cl`, nombre, rol: 'personal', autenticadoEn: 'x' }
}

beforeEach(() => {
  conocidosT.seed([])
})

describe('usuariosConocidos (spec 012 research.md R7)', () => {
  it('login registra a la persona en el dispositivo', async () => {
    await useAuthStore.getState().login(usuario('A', 'Ana'))

    expect(conocidosT.all()).toEqual([
      { id: 'A', nombre: 'Ana', vistoEn: expect.any(String) },
    ])
  })

  it('logout no la borra y un segundo login suma a la otra persona', async () => {
    await useAuthStore.getState().login(usuario('A', 'Ana'))
    await useAuthStore.getState().logout()
    await useAuthStore.getState().login(usuario('B', 'Bea'))

    expect(conocidosT.all().map((u) => u.nombre).sort()).toEqual(['Ana', 'Bea'])
  })
})
