import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, ItemCompra, Lote, Movimiento, UsuarioActual } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      categorias: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      borradores: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      configuracionClinica: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import { runSyncBatch } from '../../../src/lib/sync'
import {
  recibirEnInsumo,
  validarRecepcion,
  type RecepcionInput,
} from '../../../src/features/compras/lib/recepcion'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'
import { usarLugar1 } from '../../helpers/lugarFalso'

const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const itemsCompraT = db.itemsCompra as unknown as MemoryTable<ItemCompra>

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'cartucho',
    contenido: 1,
    tenantId: TENANT_1,
    id: 'i1',
    nombre: 'Anestesia X',
    categoria: 'Cirugía',
    unidadMedida: 'cartucho',
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
    nombre: 'Anestesia X',
    cantidad: null,
    nota: null,
    insumoId: 'i1',
    estado: 'pendiente',
    creadoPor: 'user-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    compradoPor: null,
    compradoEn: null,
    ...overrides,
  }
}

function inputBase(overrides: Partial<RecepcionInput> = {}): RecepcionInput {
  return {
    cantidad: 10,
    numeroLote: 'A123',
    proveedor: 'Proveedor X',
    fechaCaducidad: '2027-01-01',
    confirmarCaducado: false,
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
  lotesT.seed([])
  movimientosT.seed([])
  itemsCompraT.seed([])
  useAuthStore.setState({ usuario, isReady: true })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('validarRecepcion', () => {
  const hoy = '2026-06-15'

  it('requires a positive cantidad valid for the unidad', () => {
    const v = validarRecepcion(inputBase({ cantidad: 0 }), insumo({}), hoy)
    expect(v.valido).toBe(false)
    if (!v.valido) expect(v.errores.cantidad).toMatch(/mayor a cero/)
  })

  it('requires numeroLote and proveedor', () => {
    const v = validarRecepcion(
      inputBase({ numeroLote: '  ', proveedor: '  ' }),
      insumo({}),
      hoy,
    )
    expect(v.valido).toBe(false)
    if (!v.valido) {
      expect(v.errores.numeroLote).toMatch(/número de lote/)
      expect(v.errores.proveedor).toMatch(/proveedor/)
    }
  })

  it('requires fechaCaducidad only when insumo.caduca', () => {
    const noCaduca = validarRecepcion(
      inputBase({ fechaCaducidad: '' }),
      insumo({ caduca: false }),
      hoy,
    )
    expect(noCaduca.valido).toBe(true)

    const siCaduca = validarRecepcion(
      inputBase({ fechaCaducidad: '' }),
      insumo({ caduca: true }),
      hoy,
    )
    expect(siCaduca.valido).toBe(false)
    if (!siCaduca.valido) expect(siCaduca.errores.fechaCaducidad).toMatch(/vencimiento/)
  })

  it('flags loteCaducado for a past date, not for today', () => {
    const ayer = validarRecepcion(
      inputBase({ fechaCaducidad: '2026-06-14' }),
      insumo({}),
      hoy,
    )
    expect(ayer.advertencias.loteCaducado).toBe(true)

    const hoyMismo = validarRecepcion(
      inputBase({ fechaCaducidad: '2026-06-15' }),
      insumo({}),
      hoy,
    )
    expect(hoyMismo.advertencias.loteCaducado).toBe(false)
  })
})

describe('recibirEnInsumo', () => {
  it('writes 1 lote + 1 ingreso movimiento con el usuario autor', async () => {
    const { lote } = await recibirEnInsumo(insumo({}), inputBase(), null)

    expect(lotesT.all()).toHaveLength(1)
    expect(lotesT.all()[0].id).toBe(lote.id)
    const movimientos = movimientosT.all()
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0]).toMatchObject({
      tipo: 'ingreso',
      cantidad: 10,
      usuarioId: 'user-1',
      sincronizado: false,
    })
  })

  it('with itemCompraId, marca ese ItemCompra comprado', async () => {
    itemsCompraT.seed([itemCompra({})])

    await recibirEnInsumo(insumo({}), inputBase(), 'item-1')

    const item = await db.itemsCompra.get('item-1')
    expect(item).toMatchObject({
      estado: 'comprado',
      compradoPor: 'user-1',
    })
    expect(item?.compradoEn).not.toBeNull()
  })

  it('with itemCompraId: null, no ItemCompra se toca', async () => {
    itemsCompraT.seed([itemCompra({})])

    await recibirEnInsumo(insumo({}), inputBase(), null)

    const item = await db.itemsCompra.get('item-1')
    expect(item?.estado).toBe('pendiente')
  })

  it('throws without confirmarCaducado for a past date and writes nothing', async () => {
    await expect(
      recibirEnInsumo(insumo({}), inputBase({ fechaCaducidad: '2020-01-01' }), null),
    ).rejects.toThrow(/caducado/i)
    expect(lotesT.all()).toHaveLength(0)
  })

  it('accepts a past date with confirmarCaducado', async () => {
    await expect(
      recibirEnInsumo(
        insumo({}),
        inputBase({ fechaCaducidad: '2020-01-01', confirmarCaducado: true }),
        null,
      ),
    ).resolves.toBeDefined()
    expect(lotesT.all()).toHaveLength(1)
  })

  it('rolls back everything if the movimiento write fails (atomicity)', async () => {
    itemsCompraT.seed([itemCompra({})])
    vi.spyOn(db.movimientos, 'add').mockRejectedValueOnce(new Error('boom'))

    await expect(recibirEnInsumo(insumo({}), inputBase(), 'item-1')).rejects.toThrow(
      'boom',
    )

    expect(lotesT.all()).toHaveLength(0)
    expect(movimientosT.all()).toHaveLength(0)
    expect((await db.itemsCompra.get('item-1'))?.estado).toBe('pendiente')
  })

  it('resolves offline (sin backend) y el movimiento queda sin sincronizar', async () => {
    await recibirEnInsumo(insumo({}), inputBase(), null)
    expect(movimientosT.all()[0].sincronizado).toBe(false)

    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'sin-red' })

    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })
})

describe('recepción en unidad de compra (spec 015 US2, FR-009/FR-010)', () => {
  const articaina = () =>
    insumo({ unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 50 })

  it('2 cajas suman 100 cartuchos y el lote guarda el snapshot', async () => {
    await recibirEnInsumo(articaina(), inputBase({ cantidad: 2 }), null)

    expect(lotesT.all()[0]).toMatchObject({
      cantidadIngresada: 2,
      unidadIngresada: 'caja',
      contenido: 50,
      unidadConsumo: 'cartucho',
      precioCompra: null,
    })
    expect(movimientosT.all()[0]).toMatchObject({
      tipo: 'ingreso',
      cantidad: 100,
      unidad: 'cartucho',
      sincronizado: false,
    })
  })

  it('en unidad de consumo suma tal cual (US2-2)', async () => {
    await recibirEnInsumo(articaina(), inputBase({ cantidad: 30, unidadIngreso: 'cartucho' }), null)
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 30, unidad: 'cartucho' })
    expect(lotesT.all()[0]).toMatchObject({ cantidadIngresada: 30, unidadIngresada: 'cartucho' })
  })

  it('rechaza una conversión no entera (US2-4)', () => {
    const resultado = validarRecepcion(
      inputBase({ cantidad: 0.5 }),
      insumo({ unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 25 }),
      '2026-06-01',
    )
    expect(resultado.valido).toBe(false)
    expect(resultado.valido ? null : resultado.errores.cantidad).toMatch(/no admite/)
  })

  it('sin red, la recepción en cajas queda pendiente y se sube después (US2-5)', async () => {
    await recibirEnInsumo(articaina(), inputBase({ cantidad: 2 }), null)
    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'sin-red' })
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 100, sincronizado: false })
  })
})
