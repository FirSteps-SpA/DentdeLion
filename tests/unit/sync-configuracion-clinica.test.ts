import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfiguracionClinica } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      configuracionClinica: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      categorias: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      estadoSync: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
    }),
  }
})

type RemoteRow = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, RemoteRow>> = {}
let redCaida = false

function tabla(nombre: string) {
  remoto[nombre] ??= new Map()
  return remoto[nombre]
}

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(rows: RemoteRow | RemoteRow[]) {
        if (redCaida) return { error: { code: 'NETWORK', message: 'fetch failed' } }
        const lista = Array.isArray(rows) ? rows : [rows]
        for (const row of lista) tabla(nombre).set(row.id, structuredClone(row))
        return { error: null }
      },
      select() {
        const resultado = Promise.resolve({
          data: redCaida
            ? null
            : [...tabla(nombre).values()].map((r) => structuredClone(r)),
          error: redCaida ? { message: 'fetch failed' } : null,
        })
        return Object.assign(resultado, {
          eq: () => ({
            maybeSingle: async () => ({
              data: redCaida ? null : (tabla(nombre).get('global') ?? null),
              error: redCaida ? { message: 'fetch failed' } : null,
            }),
          }),
        })
      },
    }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'

const configT = db.configuracionClinica as unknown as MemoryTable<ConfiguracionClinica>

beforeEach(() => {
  for (const key of Object.keys(remoto)) delete remoto[key]
  redCaida = false
  configT.seed([])
  useAuthStore.setState({
    usuario: {
      id: 'admin-1',
      email: 'a@x.cl',
      nombre: 'Admin',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
})

describe('sync of configuracion_clinica (spec 010 FR-020, same pattern as configuracion_alertas)', () => {
  it('pushes the local row when one has been saved', async () => {
    configT.seed([
      { id: 'global', nombre: 'Clínica Dental Sonrisas', sincronizado: false },
    ])

    await runSyncBatch()

    expect(tabla('configuracion_clinica').get('global')).toMatchObject({
      nombre: 'Clínica Dental Sonrisas',
    })
    expect(configT.all()[0].sincronizado).toBe(true)
  })

  it('does not push anything when no row has ever been saved', async () => {
    await runSyncBatch()

    expect(tabla('configuracion_clinica').has('global')).toBe(false)
  })

  it('pulls a remote row into the local table', async () => {
    tabla('configuracion_clinica').set('global', {
      id: 'global',
      nombre: 'Clínica Remota',
    })

    await runSyncBatch()

    expect(await db.configuracionClinica.get('global')).toMatchObject({
      nombre: 'Clínica Remota',
    })
  })

  it('never throws without a backend', async () => {
    redCaida = true
    configT.seed([{ id: 'global', nombre: 'Clínica X', sincronizado: false }])

    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'sin-red' })
    expect(configT.all()[0].sincronizado).toBe(false)
  })
})
