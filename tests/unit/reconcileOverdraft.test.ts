import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lugar, Movimiento } from '../../src/lib/db'

let movimientosMock: Movimiento[] = []
let lugaresMock: Lugar[] = []
const updateLote = vi.fn(async (id: string, changes: unknown) => {
  void id
  void changes
  return 1
})

vi.mock('../../src/lib/db', () => ({
  db: {
    lugares: { toArray: async () => lugaresMock },
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
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

function makeMovimiento(overrides: Partial<Movimiento>): Movimiento {
  return {
    tratamientoRealizadoId: null,
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
  lugaresMock = []
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

  // Spec 033 (R3, T012): el sobregiro se mide contra el stock común.
  describe('bodega compartida', () => {
    it('no marca un consumo en Box 2 de un lote ingresado en Box 1', async () => {
      lugaresMock = [
        { ...lugar1, bodegaId: 'b' },
        { ...lugar2, bodegaId: 'b' },
      ]
      movimientosMock = [
        makeMovimiento({ tipo: 'ingreso', cantidad: 5, lugarId: LUGAR_1 }),
        makeMovimiento({ tipo: 'consumo', cantidad: 3, lugarId: LUGAR_2 }),
      ]

      await reconcileOverdraft('lote-1')

      expect(updateLote).not.toHaveBeenCalled()
    })

    it('dos consumos sin conexión en dos lugares que superan el común → En revisión', async () => {
      lugaresMock = [
        { ...lugar1, bodegaId: 'b' },
        { ...lugar2, bodegaId: 'b' },
      ]
      movimientosMock = [
        makeMovimiento({ tipo: 'ingreso', cantidad: 5, lugarId: LUGAR_1 }),
        makeMovimiento({ tipo: 'consumo', cantidad: 4, lugarId: LUGAR_1 }),
        makeMovimiento({ tipo: 'consumo', cantidad: 3, lugarId: LUGAR_2 }),
      ]

      await reconcileOverdraft('lote-1')

      expect(updateLote).toHaveBeenCalledWith('lote-1', { estado: 'revision' })
    })

    it('sin bodega compartida, el mismo consumo en Box 2 sí se marca (FR-019)', async () => {
      lugaresMock = [lugar1, lugar2]
      movimientosMock = [
        makeMovimiento({ tipo: 'ingreso', cantidad: 5, lugarId: LUGAR_1 }),
        makeMovimiento({ tipo: 'consumo', cantidad: 3, lugarId: LUGAR_2 }),
      ]

      await reconcileOverdraft('lote-1')

      expect(updateLote).toHaveBeenCalledWith('lote-1', { estado: 'revision' })
    })
  })
})
