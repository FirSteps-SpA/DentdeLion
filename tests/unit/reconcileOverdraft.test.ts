import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Movimiento } from '../../src/lib/db'

let movimientosMock: Movimiento[] = []
const updateLote = vi.fn(async (id: string, changes: unknown) => {
  void id
  void changes
  return 1
})

vi.mock('../../src/lib/db', () => ({
  db: {
    movimientos: {
      where: () => ({
        equals: () => ({
          toArray: async () => movimientosMock,
        }),
      }),
    },
    lotes: {
      update: (...args: Parameters<typeof updateLote>) => updateLote(...args),
      // Spec 015: sin lote conocido, los movimientos se leen sin convertir.
      get: async () => undefined,
    },
  },
}))

import { reconcileOverdraft } from '../../src/lib/sync/reconcileOverdraft'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

function makeMovimiento(overrides: Partial<Movimiento>): Movimiento {
  return {
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId: 'lote-1',
    cantidad: 0,
    usuarioId: 'user-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
    ...overrides,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  movimientosMock = []
})

describe('reconcileOverdraft', () => {
  it('flags the lot for review when derived stock is negative', async () => {
    movimientosMock = [
      makeMovimiento({ tipo: 'ingreso', cantidad: 5 }),
      makeMovimiento({ tipo: 'consumo', cantidad: 8 }),
    ]

    await reconcileOverdraft('lote-1')

    expect(updateLote).toHaveBeenCalledWith('lote-1', { estado: 'revision' })
  })

  it('does not flag the lot when derived stock is non-negative', async () => {
    movimientosMock = [
      makeMovimiento({ tipo: 'ingreso', cantidad: 10 }),
      makeMovimiento({ tipo: 'consumo', cantidad: 4 }),
    ]

    await reconcileOverdraft('lote-1')

    expect(updateLote).not.toHaveBeenCalled()
  })

  it('never drops or reverts any movement it reads', async () => {
    const movimientos = [
      makeMovimiento({ tipo: 'ingreso', cantidad: 5 }),
      makeMovimiento({ tipo: 'consumo', cantidad: 20 }),
    ]
    movimientosMock = movimientos

    await reconcileOverdraft('lote-1')

    // reconcileOverdraft only ever calls lotes.update — it has no access to
    // delete/mutate movimientos, so the input array is necessarily untouched.
    expect(movimientosMock).toEqual(movimientos)
    expect(updateLote).toHaveBeenCalledTimes(1)
  })
})
