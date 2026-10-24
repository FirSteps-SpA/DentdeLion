import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import type { Categoria, Insumo } from '../../../src/lib/db'
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
      insumos: new MemoryTable(),
      categorias: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  crearCategoriaDesdeAjustes,
  renombrarCategoria,
  desactivarCategoria,
  reactivarCategoria,
} from '../../../src/features/ajustes/lib/categoriasAdmin'
import { TENANT_1 } from '../../helpers/tenancy'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>

function insumo(id: string, categoria: string, overrides: Partial<Insumo> = {}): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre: `Insumo ${id}`,
    categoria,
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
    ...overrides,
  }
}

function categoria(id: string, nombre: string, overrides: Partial<Categoria> = {}): Categoria {
  return {
    tenantId: TENANT_1,
    id,
    nombre,
    creadoPor: 'admin-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
    rechazadoEn: null,
    desactivadoEn: null,
    ...overrides,
  }
}

beforeEach(() => {
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'admin-1',
      email: 'a@x.cl',
      nombre: 'Admin',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
})

afterEach(() => {
  insumosT.rows.clear()
  categoriasT.rows.clear()
  useAuthStore.setState({ usuario: null, isReady: true })
})

describe('crearCategoriaDesdeAjustes (FR-014)', () => {
  it('creates a new category', async () => {
    await crearCategoriaDesdeAjustes('Ortodoncia')

    const filas = categoriasT.all()
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({
      nombre: 'Ortodoncia',
      sincronizado: false,
      desactivadoEn: null,
    })
  })

  it('rejects a duplicate by normalized key', async () => {
    categoriasT.seed([categoria('c1', 'Ortodoncia')])

    await expect(crearCategoriaDesdeAjustes('  ORTODONCIA ')).rejects.toThrow()
    expect(categoriasT.all()).toHaveLength(1)
  })

  it('rejects a duplicate of a precargada', async () => {
    await expect(crearCategoriaDesdeAjustes('fresas')).rejects.toThrow()
  })

  it('requires an administrador', async () => {
    useAuthStore.setState({
      usuario: {
        tenantId: TENANT_1,
        desactivadoEn: null,
        id: 'p1',
        email: 'p@x.cl',
        nombre: 'P',
        rol: 'personal',
        autenticadoEn: 'x',
      },
      isReady: true,
    })

    await expect(crearCategoriaDesdeAjustes('Ortodoncia')).rejects.toThrow()
    expect(categoriasT.all()).toHaveLength(0)
  })
})

describe('renombrarCategoria (FR-015/016)', () => {
  it('renames in place and cascades to active and dado-de-baja insumos', async () => {
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    insumosT.seed([
      insumo('a', 'Ortodoncia'),
      insumo('b', 'Ortodoncia', { dadoDeBajaEn: '2026-01-02T00:00:00.000Z' }),
      insumo('c', 'Fresas'),
    ])

    const resultado = await renombrarCategoria('c1', 'Endodoncia')

    expect(resultado).toEqual({ tipo: 'renombrada' })
    expect(categoriasT.all()[0]).toMatchObject({
      nombre: 'Endodoncia',
      desactivadoEn: null,
    })
    expect((await db.insumos.get('a'))!.categoria).toBe('Endodoncia')
    expect((await db.insumos.get('b'))!.categoria).toBe('Endodoncia')
    expect((await db.insumos.get('c'))!.categoria).toBe('Fresas')
  })

  it('merges into a colliding precargada and deactivates the renamed row', async () => {
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    insumosT.seed([insumo('a', 'Ortodoncia')])

    const resultado = await renombrarCategoria('c1', 'fresas')

    expect(resultado).toEqual({ tipo: 'fusionada', con: 'Fresas' })
    expect(categoriasT.all()[0].desactivadoEn).not.toBeNull()
    expect((await db.insumos.get('a'))!.categoria).toBe('Fresas')
  })

  it('merges into another colliding created category', async () => {
    categoriasT.seed([
      categoria('c1', 'Ortodoncia'),
      categoria('c2', 'Endodoncia Avanzada'),
    ])
    insumosT.seed([insumo('a', 'Ortodoncia')])

    const resultado = await renombrarCategoria('c1', 'Endodoncia Avanzada')

    expect(resultado).toEqual({ tipo: 'fusionada', con: 'Endodoncia Avanzada' })
    expect((await db.insumos.get('a'))!.categoria).toBe('Endodoncia Avanzada')
  })

  it('rejects an inexistent category id (covers precargadas/"Sin categoría", FR-019)', async () => {
    await expect(renombrarCategoria('no-existe', 'Algo')).rejects.toThrow()
  })

  it('requires an administrador', async () => {
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    useAuthStore.setState({
      usuario: {
        tenantId: TENANT_1,
        desactivadoEn: null,
        id: 'p1',
        email: 'p@x.cl',
        nombre: 'P',
        rol: 'personal',
        autenticadoEn: 'x',
      },
      isReady: true,
    })

    await expect(renombrarCategoria('c1', 'Endodoncia')).rejects.toThrow()
  })
})

describe('desactivarCategoria / reactivarCategoria (FR-017/018)', () => {
  it('deactivates without touching insumos', async () => {
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    insumosT.seed([insumo('a', 'Ortodoncia')])

    await desactivarCategoria('c1')

    expect(categoriasT.all()[0].desactivadoEn).not.toBeNull()
    expect((await db.insumos.get('a'))!.categoria).toBe('Ortodoncia')
  })

  it('reactivates', async () => {
    categoriasT.seed([
      categoria('c1', 'Ortodoncia', { desactivadoEn: '2026-01-01T00:00:00.000Z' }),
    ])

    await reactivarCategoria('c1')

    expect(categoriasT.all()[0].desactivadoEn).toBeNull()
  })

  it('requires an administrador', async () => {
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    useAuthStore.setState({
      usuario: {
        tenantId: TENANT_1,
        desactivadoEn: null,
        id: 'p1',
        email: 'p@x.cl',
        nombre: 'P',
        rol: 'personal',
        autenticadoEn: 'x',
      },
      isReady: true,
    })

    await expect(desactivarCategoria('c1')).rejects.toThrow()
  })
})
