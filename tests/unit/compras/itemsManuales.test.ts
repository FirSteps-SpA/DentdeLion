import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, ItemCompra, UsuarioActual } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  agregarItemManual,
  eliminarItemManual,
  insumoVinculado,
  marcarCompradoSinInventario,
  validarItemManual,
} from '../../../src/features/compras/lib/itemsManuales'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'
import { usarLugar1 } from '../../helpers/lugarFalso'

const itemsCompraT = db.itemsCompra as unknown as MemoryTable<ItemCompra>

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    tenantId: TENANT_1,
    id: 'i1',
    nombre: 'Composite A2',
    categoria: 'Restauración',
    unidadMedida: 'pieza',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function itemCompra(overrides: Partial<ItemCompra>): ItemCompra {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: 'item-1',
    nombre: 'Guantes M',
    cantidad: null,
    nota: null,
    insumoId: null,
    estado: 'pendiente',
    creadoPor: 'creador-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    compradoPor: null,
    compradoEn: null,
    ...overrides,
  }
}

const usuario: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'user-1',
  email: 'u@x.cl',
  nombre: 'Usuario',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  itemsCompraT.seed([])
  useAuthStore.setState({ usuario, isReady: true })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('validarItemManual', () => {
  it('rejects an empty or blank-only nombre', () => {
    const v1 = validarItemManual({ nombre: '', cantidad: null, nota: '', insumoId: null })
    expect(v1.valido).toBe(false)
    const v2 = validarItemManual({ nombre: '   ', cantidad: null, nota: '', insumoId: null })
    expect(v2.valido).toBe(false)
  })

  it('accepts a trimmed nombre with no other requirements', () => {
    expect(
      validarItemManual({ nombre: 'Guantes M', cantidad: null, nota: '', insumoId: null }),
    ).toEqual({ valido: true })
  })
})

describe('agregarItemManual', () => {
  it('creates the row pendiente with the creadoPor correcto', async () => {
    const item = await agregarItemManual({
      nombre: 'Guantes M',
      cantidad: 3,
      nota: 'Marca X',
      insumoId: null,
    })

    expect(item.estado).toBe('pendiente')
    expect(item.creadoPor).toBe('user-1')
    expect(itemsCompraT.all()).toHaveLength(1)
    expect(itemsCompraT.all()[0]).toMatchObject({ nombre: 'Guantes M', cantidad: 3 })
  })

  it('throws on an empty nombre and writes nothing', async () => {
    await expect(
      agregarItemManual({ nombre: '', cantidad: null, nota: '', insumoId: null }),
    ).rejects.toThrow(/nombre/)
    expect(itemsCompraT.all()).toHaveLength(0)
  })
})

describe('eliminarItemManual', () => {
  it('leaves it eliminado sin borrar la fila', async () => {
    itemsCompraT.seed([itemCompra({ id: 'item-1' })])

    await eliminarItemManual('item-1')

    const item = await db.itemsCompra.get('item-1')
    expect(item?.estado).toBe('eliminado')
  })
})

describe('marcarCompradoSinInventario', () => {
  it('leaves it comprado sin tocar lotes/movimientos', async () => {
    itemsCompraT.seed([itemCompra({ id: 'item-1' })])

    await marcarCompradoSinInventario('item-1')

    const item = await db.itemsCompra.get('item-1')
    expect(item).toMatchObject({ estado: 'comprado', compradoPor: 'user-1' })
    expect(item?.compradoEn).not.toBeNull()
  })
})

describe('insumoVinculado', () => {
  it('returns null when insumoId is null', () => {
    expect(insumoVinculado(itemCompra({ insumoId: null }), [insumo({})])).toBeNull()
  })

  it('returns null when the linked insumo is not in insumosActivos (dado de baja)', () => {
    expect(
      insumoVinculado(itemCompra({ insumoId: 'i1' }), []),
    ).toBeNull()
  })

  it('returns the Insumo when it is still active', () => {
    const activo = insumo({})
    expect(insumoVinculado(itemCompra({ insumoId: 'i1' }), [activo])).toBe(activo)
  })
})
