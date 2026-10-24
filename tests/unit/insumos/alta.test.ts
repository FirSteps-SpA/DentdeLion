import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Categoria,
  Insumo,
  Lote,
  Movimiento,
  Proveedor,
  UsuarioActual,
} from '../../../src/lib/db'
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
      proveedores: new MemoryTable(),
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
import { catalogoCategorias } from '../../../src/features/insumos/lib/categorias'
import {
  darDeAltaMaterial,
  posiblesDuplicados,
  sugerirMateriales,
  validarAltaMaterial,
  type AltaMaterialInput,
} from '../../../src/features/insumos/lib/alta'
import { TENANT_1 } from '../../helpers/tenancy'
import { usarLugar1 } from '../../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const proveedoresT = db.proveedores as unknown as MemoryTable<Proveedor>
const borradoresT = db.borradores as unknown as MemoryTable<{
  id: string
  datos: unknown
  actualizadoEn: string
}>

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'pieza',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
    categoria: 'Fresas',
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

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', rol: 'personal' }

const HOY = '2026-09-23'

// Spec 021: el lote se registra con un proveedor del catálogo.
const PROVEEDOR_X: Proveedor = {
  id: 'proveedor-x',
  tenantId: TENANT_1,
  nombre: 'Proveedor X',
  whatsapp: null,
  contacto: null,
  creadoPor: 'admin-1',
  creadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
  eliminadoEn: null,
  sincronizado: true,
}

function inputBase(overrides: Partial<AltaMaterialInput> = {}): AltaMaterialInput {
  return {
    nombre: 'Fresa Diamante 856',
    categoria: 'Fresas',
    categoriaNueva: false,
    unidadMedida: 'unidad',
    codigoFabricante: '',
    stockMinimo: null,
    caduca: true,
    stockInicial: 0,
    lote: { numeroLote: '', proveedorId: null, fechaCaducidad: '' },
    confirmarCaducado: false,
    ...overrides,
  }
}

beforeEach(() => {
  insumosT.seed([])
  categoriasT.seed([])
  lotesT.seed([])
  movimientosT.seed([])
  borradoresT.seed([])
  proveedoresT.seed([PROVEEDOR_X])
  useAuthStore.setState({ usuario: admin, isReady: true })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('validarAltaMaterial — US1 (FR-005/FR-006/FR-007/FR-008/FR-009)', () => {
  const catalogoVacio = catalogoCategorias([], [])

  it('rejects an empty name', () => {
    const r = validarAltaMaterial(
      inputBase({ nombre: '   ' }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(r.valido === false && r.errores.nombre).toBeTruthy()
  })

  it('rejects a duplicate name case-insensitively, but allows a dado de baja homonym', () => {
    const activo = insumo({ nombre: 'Fresa Diamante 856' })
    const r = validarAltaMaterial(
      inputBase({ nombre: '  fresa diamante 856 ' }),
      [activo],
      catalogoVacio,
      HOY,
    )
    expect(r.valido === false && r.errores.nombre).toMatch(/Ya existe/)

    const r2 = validarAltaMaterial(
      inputBase({ nombre: 'Fresa Diamante 856' }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(r2.valido).toBe(true)
  })

  it('requires a categoría, and resolves "fresas" to the precargada', () => {
    const vacia = validarAltaMaterial(
      inputBase({ categoria: '' }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(vacia.valido === false && vacia.errores.categoria).toBeTruthy()

    const desconocida = validarAltaMaterial(
      inputBase({ categoria: 'Inventada' }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(desconocida.valido === false && desconocida.errores.categoria).toBeTruthy()

    const resuelta = validarAltaMaterial(
      inputBase({ categoria: 'fresas' }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(resuelta.valido).toBe(true)
  })

  it('rejects an unknown unidad de medida', () => {
    const r = validarAltaMaterial(
      { ...inputBase(), unidadMedida: 'litro' as never },
      [],
      catalogoVacio,
      HOY,
    )
    expect(r.valido === false && r.errores.unidadMedida).toBeTruthy()
  })

  it('rejects a decimal stock mínimo for caja but accepts it for mL', () => {
    const caja = validarAltaMaterial(
      inputBase({ stockMinimo: 1.5, unidadMedida: 'caja' }),
      [],
      catalogoVacio,
      HOY,
    )
    const ml = validarAltaMaterial(
      inputBase({ stockMinimo: 1.5, unidadMedida: 'mL' }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(caja.valido === false && caja.errores.stockMinimo).toBeTruthy()
    expect(ml.valido).toBe(true)
  })
})

describe('validarAltaMaterial — US2 (FR-013..FR-018)', () => {
  const catalogoVacio = catalogoCategorias([], [])

  it('requires numeroLote, proveedor and fechaCaducidad when stockInicial > 0', () => {
    const r = validarAltaMaterial(
      inputBase({ stockInicial: 5 }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(r.valido === false && r.errores.numeroLote).toBeTruthy()
    expect(r.valido === false && r.errores.proveedor).toBeTruthy()
    expect(r.valido === false && r.errores.fechaCaducidad).toBeTruthy()
  })

  it('requires no lote fields when stockInicial is 0', () => {
    const r = validarAltaMaterial(inputBase({ stockInicial: 0 }), [], catalogoVacio, HOY)
    expect(r.valido).toBe(true)
  })

  it('discards a typed fechaCaducidad and requires nothing when caduca is false', () => {
    const r = validarAltaMaterial(
      inputBase({
        stockInicial: 5,
        caduca: false,
        lote: { numeroLote: 'L1', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2020-01-01' },
      }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(r.valido).toBe(true)
    expect(r.advertencias.loteCaducado).toBe(false)
  })

  it('flags loteCaducado for yesterday but not for today', () => {
    const ayer = validarAltaMaterial(
      inputBase({
        stockInicial: 5,
        lote: { numeroLote: 'L1', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2026-09-22' },
      }),
      [],
      catalogoVacio,
      HOY,
    )
    const hoyMismo = validarAltaMaterial(
      inputBase({
        stockInicial: 5,
        lote: { numeroLote: 'L1', proveedorId: PROVEEDOR_X.id, fechaCaducidad: HOY },
      }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(ayer.advertencias.loteCaducado).toBe(true)
    expect(hoyMismo.advertencias.loteCaducado).toBe(false)
  })

  it('rejects a negative stockInicial', () => {
    const r = validarAltaMaterial(
      inputBase({ stockInicial: -1 }),
      [],
      catalogoVacio,
      HOY,
    )
    expect(r.valido === false && r.errores.stockInicial).toBeTruthy()
  })
})

describe('darDeAltaMaterial — US1 (FR-006, atomicidad)', () => {
  it('writes one insumo with creadoPor and clears the borrador', async () => {
    borradoresT.seed([
      { id: 'alta-material', datos: { nombre: 'x' }, actualizadoEn: 'x' },
    ])

    const { insumo: creado, conLoteInicial } = await darDeAltaMaterial(inputBase())

    expect(conLoteInicial).toBe(false)
    expect(creado).toMatchObject({
      nombre: 'Fresa Diamante 856',
      categoria: 'Fresas',
      creadoPor: 'admin-1',
    })
    expect(insumosT.all()).toHaveLength(1)
    expect(await db.borradores.get('alta-material')).toBeUndefined()
  })

  it('a second call with the same name throws (double-tap guard)', async () => {
    const p1 = darDeAltaMaterial(inputBase())
    const p2 = darDeAltaMaterial(inputBase())

    await expect(p1).resolves.toBeDefined()
    await expect(p2).rejects.toThrow(/Ya existe/)
    expect(insumosT.all()).toHaveLength(1)
  })
})

describe('darDeAltaMaterial — US2 (FR-013..FR-021, SC-003)', () => {
  it('spec 021: rechaza un proveedor eliminado o inexistente sin escribir nada', async () => {
    proveedoresT.seed([{ ...PROVEEDOR_X, eliminadoEn: '2026-09-01T00:00:00.000Z' }])
    await expect(
      darDeAltaMaterial(
        inputBase({
          stockInicial: 1,
          lote: { numeroLote: 'L', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2027-01-01' },
        }),
      ),
    ).rejects.toThrow('Ingresa el proveedor.')
    expect(insumosT.all()).toHaveLength(0)
  })

  it('spec 021: acepta un proveedor desactivado mientras el formulario estaba abierto', async () => {
    proveedoresT.seed([{ ...PROVEEDOR_X, desactivadoEn: '2026-09-01T00:00:00.000Z' }])
    await darDeAltaMaterial(
      inputBase({
        stockInicial: 1,
        lote: { numeroLote: 'L', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2027-01-01' },
      }),
    )
    expect(lotesT.all()[0].proveedorId).toBe(PROVEEDOR_X.id)
  })

  function inputConLote(overrides: Partial<AltaMaterialInput> = {}) {
    return inputBase({
      stockInicial: 10,
      lote: { numeroLote: 'A123', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2027-01-01' },
      ...overrides,
    })
  }

  it('writes exactly 1 insumo + 1 lote + 1 ingreso movimiento with the user id', async () => {
    const { conLoteInicial } = await darDeAltaMaterial(inputConLote())

    expect(conLoteInicial).toBe(true)
    expect(insumosT.all()).toHaveLength(1)
    expect(lotesT.all()).toHaveLength(1)
    // Spec 021: proveedor del catálogo y su nombre (texto que conserva la 2.4.0).
    expect(lotesT.all()[0]).toMatchObject({ proveedorId: 'proveedor-x', proveedor: 'Proveedor X' })
    const movimientos = movimientosT.all()
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0]).toMatchObject({
      tipo: 'ingreso',
      cantidad: 10,
      usuarioId: 'admin-1',
      sincronizado: false,
    })
  })

  it('spec 015: stock inicial en cajas suma en cartuchos y guarda la presentación', async () => {
    await darDeAltaMaterial(
      inputConLote({
        unidadMedida: 'cartucho',
        unidadCompra: 'caja',
        contenido: 50,
        stockInicial: 2,
      }),
    )
    expect(insumosT.all()[0]).toMatchObject({
      unidadMedida: 'cartucho',
      unidadCompra: 'caja',
      contenido: 50,
    })
    expect(lotesT.all()[0]).toMatchObject({
      cantidadIngresada: 2,
      unidadIngresada: 'caja',
      contenido: 50,
      unidadConsumo: 'cartucho',
    })
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 100, unidad: 'cartucho' })
  })

  it('spec 015: el stock inicial puede ir en unidad de consumo', async () => {
    await darDeAltaMaterial(
      inputConLote({
        unidadMedida: 'cartucho',
        unidadCompra: 'caja',
        contenido: 50,
        stockInicial: 30,
        unidadStockInicial: 'cartucho',
      }),
    )
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 30, unidad: 'cartucho' })
  })

  it('throws without confirmarCaducado and writes nothing', async () => {
    await expect(
      darDeAltaMaterial(
        inputConLote({ lote: { numeroLote: 'A1', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2020-01-01' } }),
      ),
    ).rejects.toThrow(/caducado/i)
    expect(insumosT.all()).toHaveLength(0)
  })

  it('resolves offline (SC-003) and a later sync cycle leaves the movimiento unsynced without throwing', async () => {
    await darDeAltaMaterial(inputConLote())
    const movimiento = movimientosT.all()[0]
    expect(movimiento.sincronizado).toBe(false)

    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'sin-red' })

    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })

  it('rolls back everything if the movimiento write fails (atomicity)', async () => {
    borradoresT.seed([
      { id: 'alta-material', datos: { nombre: 'x' }, actualizadoEn: 'x' },
    ])
    vi.spyOn(db.movimientos, 'add').mockRejectedValueOnce(new Error('boom'))

    await expect(darDeAltaMaterial(inputConLote())).rejects.toThrow('boom')

    expect(insumosT.all()).toHaveLength(0)
    expect(lotesT.all()).toHaveLength(0)
    expect(await db.borradores.get('alta-material')).toBeDefined()
  })
})

describe('darDeAltaMaterial — US3 (FR-011/FR-012, permisos)', () => {
  it('an admin creates "Ortodoncia": 1 categoria row + insumo with that category', async () => {
    const { insumo: creado } = await darDeAltaMaterial(
      inputBase({
        nombre: 'Alambre Ortodoncia',
        categoria: 'Ortodoncia',
        categoriaNueva: true,
      }),
    )

    expect(categoriasT.all()).toHaveLength(1)
    expect(categoriasT.all()[0]).toMatchObject({
      nombre: 'Ortodoncia',
      creadoPor: 'admin-1',
      sincronizado: false,
    })
    expect(creado.categoria).toBe('Ortodoncia')
  })

  it('"FRESAS" as a new categoría resolves to the existing precargada, no row written', async () => {
    const { insumo: creado } = await darDeAltaMaterial(
      inputBase({ categoria: 'FRESAS', categoriaNueva: true }),
    )

    expect(categoriasT.all()).toHaveLength(0)
    expect(creado.categoria).toBe('Fresas')
  })

  it('personal with categoriaNueva throws and writes nothing', async () => {
    useAuthStore.setState({ usuario: personal })

    await expect(
      darDeAltaMaterial(
        inputBase({
          nombre: 'Alambre Ortodoncia',
          categoria: 'Ortodoncia',
          categoriaNueva: true,
        }),
      ),
    ).rejects.toThrow(/administrador/)
    expect(categoriasT.all()).toHaveLength(0)
    expect(insumosT.all()).toHaveLength(0)
  })

  it('rejects the reserved "Sin categoría" name', async () => {
    await expect(
      darDeAltaMaterial(
        inputBase({ categoria: 'sin categoria', categoriaNueva: true }),
      ),
    ).rejects.toThrow(/reservado/)
  })

  it('a failed save leaves no categoria row', async () => {
    vi.spyOn(db.movimientos, 'add').mockRejectedValueOnce(new Error('boom'))

    await expect(
      darDeAltaMaterial(
        inputBase({
          nombre: 'Alambre Ortodoncia',
          categoria: 'Ortodoncia',
          categoriaNueva: true,
          stockInicial: 5,
          lote: { numeroLote: 'L1', proveedorId: PROVEEDOR_X.id, fechaCaducidad: '2027-01-01' },
        }),
      ),
    ).rejects.toThrow('boom')

    expect(categoriasT.all()).toHaveLength(0)
  })
})

describe('sugerirMateriales (US4, R8)', () => {
  const composite = insumo({ nombre: 'Resína Z350', creadoEn: '2026-01-01T00:00:00.000Z' })
  const anestesia = insumo({ nombre: 'Anestesia X', creadoEn: '2026-01-02T00:00:00.000Z' })

  it('returns nothing below 2 characters', () => {
    expect(sugerirMateriales([composite, anestesia], 'r')).toEqual([])
  })

  it('matches accent-insensitively', () => {
    const r = sugerirMateriales([composite, anestesia], 'resina')
    expect(r.map((i) => i.nombre)).toEqual(['Resína Z350'])
  })

  it('limits results', () => {
    const muchos = Array.from({ length: 8 }, (_, i) =>
      insumo({ nombre: `Composite ${i}` }),
    )
    expect(sugerirMateriales(muchos, 'composite', 5)).toHaveLength(5)
  })
})

describe('posiblesDuplicados (US4, R9)', () => {
  it('flags only the newer of a pair sharing a claveNombre', () => {
    const viejo = insumo({ id: 'a', nombre: 'Guantes M', creadoEn: '2026-01-01T00:00:00.000Z' })
    const nuevo = insumo({ id: 'b', nombre: 'guantes m', creadoEn: '2026-02-01T00:00:00.000Z' })
    expect(posiblesDuplicados([viejo, nuevo])).toEqual(new Set(['b']))
  })

  it('breaks a creadoEn tie by id', () => {
    const x = insumo({ id: 'x', nombre: 'Igual', creadoEn: '2026-01-01T00:00:00.000Z' })
    const y = insumo({ id: 'y', nombre: 'Igual', creadoEn: '2026-01-01T00:00:00.000Z' })
    expect(posiblesDuplicados([y, x])).toEqual(new Set(['y']))
  })

  it('flags two of a triple sharing a name', () => {
    const a = insumo({ id: 'a', nombre: 'Triple', creadoEn: '2026-01-01T00:00:00.000Z' })
    const b = insumo({ id: 'b', nombre: 'Triple', creadoEn: '2026-01-02T00:00:00.000Z' })
    const c = insumo({ id: 'c', nombre: 'Triple', creadoEn: '2026-01-03T00:00:00.000Z' })
    expect(posiblesDuplicados([a, b, c])).toEqual(new Set(['b', 'c']))
  })

  it('clears the flag once one is renamed', () => {
    const a = insumo({ id: 'a', nombre: 'Original', creadoEn: '2026-01-01T00:00:00.000Z' })
    const bRenombrado = insumo({
      id: 'b',
      nombre: 'Ya No Igual',
      creadoEn: '2026-02-01T00:00:00.000Z',
    })
    expect(posiblesDuplicados([a, bRenombrado])).toEqual(new Set())
  })
})
