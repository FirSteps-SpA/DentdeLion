import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioInsumo,
  Categoria,
  Insumo,
  Movimiento,
  UsuarioActual,
} from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      categorias: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  darDeBajaInsumo,
  editarInsumo,
  restaurarInsumo,
  validarEdicionInsumo,
} from '../../../src/features/insumos/lib/catalogo'
import { catalogoCategorias } from '../../../src/features/insumos/lib/categorias'
import { TENANT_1 } from '../../helpers/tenancy'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id: 'i1',
    nombre: 'Anestesia',
    categoria: 'Cirugía',
    unidadMedida: 'caja',
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

const a = insumo({ id: 'i1', nombre: 'Anestesia' })
const b = insumo({ id: 'i2', nombre: 'Fresa Diamante', categoria: 'Fresas' })

beforeEach(() => {
  insumosT.seed([a, b])
  cambiosT.seed([])
  movimientosT.seed([])
  categoriasT.seed([])
  useAuthStore.setState({ usuario: admin, isReady: true })
})

describe('validarEdicionInsumo (FR-014)', () => {
  const activos = [a, b]
  const catalogo = catalogoCategorias([], activos)

  it('rejects an empty name', () => {
    const r = validarEdicionInsumo(a, { nombre: '   ' }, activos, catalogo)
    expect(r.valido === false && r.errores.nombre).toBeTruthy()
  })

  it('rejects a name used by another active insumo, ignoring case and spaces', () => {
    const r = validarEdicionInsumo(
      a,
      { nombre: '  fresa diamante ' },
      activos,
      catalogo,
    )
    expect(r.valido === false && r.errores.nombre).toMatch(/Ya existe/)
  })

  it('ignores insumos dados de baja for uniqueness', () => {
    const r = validarEdicionInsumo(a, { nombre: 'Fresa Diamante' }, [a], catalogo)
    expect(r.valido === false && 'nombre' in r.errores).toBe(false)
  })

  it('rejects a negative or (for countable units) decimal stock mínimo', () => {
    const neg = validarEdicionInsumo(a, { stockMinimo: -1 }, activos, catalogo)
    const dec = validarEdicionInsumo(a, { stockMinimo: 1.5 }, activos, catalogo)
    const ml = validarEdicionInsumo(
      a,
      { stockMinimo: 1.5, unidadMedida: 'mL' },
      activos,
      catalogo,
    )
    expect(neg.valido === false && neg.errores.stockMinimo).toBeTruthy()
    expect(dec.valido === false && dec.errores.stockMinimo).toBeTruthy()
    expect(ml.valido).toBe(true)
  })

  it('rejects an unknown categoría', () => {
    const r = validarEdicionInsumo(
      a,
      { categoria: 'Inventada' },
      activos,
      catalogo,
    )
    expect(r.valido === false && r.errores.categoria).toBeTruthy()
  })

  it('accepts a categoría created as a Categoria row', () => {
    const catalogoConOrtodoncia = catalogoCategorias(
      [
        {
          tenantId: TENANT_1,
          id: 'cat-1',
          nombre: 'Ortodoncia',
          creadoPor: 'admin-1',
          creadoEn: '2026-01-01T00:00:00.000Z',
          sincronizado: false,
          rechazadoEn: null,
          desactivadoEn: null,
        },
      ],
      activos,
    )
    const r = validarEdicionInsumo(
      a,
      { categoria: 'Ortodoncia' },
      activos,
      catalogoConOrtodoncia,
    )
    expect(r.valido).toBe(true)
  })
})

describe('editarInsumo (FR-012/FR-013/FR-015)', () => {
  it('throws for personal and writes nothing', async () => {
    useAuthStore.setState({ usuario: personal })
    await expect(editarInsumo('i1', { nombre: 'Otro' })).rejects.toThrow(
      /administrador/,
    )
    expect(cambiosT.all()).toHaveLength(0)
  })

  it('writes one cambio per changed field and reprojects the row', async () => {
    await editarInsumo('i1', {
      nombre: ' Anestesia X ',
      stockMinimo: 4,
      categoria: 'Cirugía',
    })

    const cambios = cambiosT.all()
    expect(cambios.map((c) => c.campo).sort()).toEqual([
      'nombre',
      'stockMinimo',
    ])
    expect(cambios.find((c) => c.campo === 'nombre')).toMatchObject({
      valorAnterior: 'Anestesia',
      valorNuevo: 'Anestesia X',
      usuarioId: 'admin-1',
      sincronizado: false,
      rechazadoEn: null,
    })
    expect(await db.insumos.get('i1')).toMatchObject({
      nombre: 'Anestesia X',
      stockMinimo: 4,
    })
    expect(movimientosT.all()).toHaveLength(0)
  })

  it('writes nothing when nothing changed', async () => {
    await editarInsumo('i1', { nombre: 'Anestesia', stockMinimo: null })
    expect(cambiosT.all()).toHaveLength(0)
  })

  it('rejects an invalid edit', async () => {
    await expect(
      editarInsumo('i1', { nombre: 'Fresa Diamante' }),
    ).rejects.toThrow()
    expect(cambiosT.all()).toHaveLength(0)
  })

  it('succeeds when the categoría is a created Categoria row', async () => {
    categoriasT.seed([
      {
        tenantId: TENANT_1,
        id: 'cat-1',
        nombre: 'Ortodoncia',
        creadoPor: 'admin-1',
        creadoEn: '2026-01-01T00:00:00.000Z',
        sincronizado: false,
        rechazadoEn: null,
        desactivadoEn: null,
      },
    ])

    await editarInsumo('i1', { categoria: 'Ortodoncia' })

    expect(await db.insumos.get('i1')).toMatchObject({
      categoria: 'Ortodoncia',
    })
  })
})

describe('darDeBajaInsumo (FR-018, Clarification Q5)', () => {
  it('throws for personal', async () => {
    useAuthStore.setState({ usuario: personal })
    await expect(darDeBajaInsumo('i1')).rejects.toThrow(/administrador/)
  })

  it('writes one baja cambio, sets the baja fields and no movimientos; idempotent', async () => {
    await darDeBajaInsumo('i1')
    await darDeBajaInsumo('i1')

    expect(cambiosT.all()).toEqual([
      expect.objectContaining({ campo: 'baja', valorNuevo: true }),
    ])
    expect(await db.insumos.get('i1')).toMatchObject({
      dadoDeBajaPor: 'admin-1',
      dadoDeBajaEn: expect.any(String),
    })
    expect(movimientosT.all()).toHaveLength(0)
  })
})

describe('restaurarInsumo (spec 010 FR-023/024)', () => {
  it('throws for personal', async () => {
    useAuthStore.setState({ usuario: personal })
    await expect(restaurarInsumo('i1')).rejects.toThrow(/administrador/)
  })

  it('is a no-op when the insumo is already active', async () => {
    await restaurarInsumo('i1')

    expect(cambiosT.all()).toHaveLength(0)
    expect((await db.insumos.get('i1'))!.dadoDeBajaEn).toBeNull()
  })

  it('reverts a dado-de-baja insumo back to activo, recorded in the ledger', async () => {
    // Relojes distintos: en el mismo milisegundo el ledger desempata por `id`
    // (UUID aleatorio) y la restauración podía quedar ordenada antes de la baja.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'))
      await darDeBajaInsumo('i1')

      vi.setSystemTime(new Date('2026-01-01T10:00:01.000Z'))
      await restaurarInsumo('i1')
    } finally {
      vi.useRealTimers()
    }

    const cambios = cambiosT.all().filter((c) => c.campo === 'baja')
    expect(cambios).toHaveLength(2)
    expect(cambios[1]).toMatchObject({ valorAnterior: true, valorNuevo: null })
    expect(await db.insumos.get('i1')).toMatchObject({
      dadoDeBajaEn: null,
      dadoDeBajaPor: null,
    })
  })
})
