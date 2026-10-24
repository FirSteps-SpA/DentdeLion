import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioInsumo,
  Categoria,
  Insumo,
  ItemCompra,
  Lote,
  Lugar,
  Movimiento,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((nombre) => [nombre, new MemoryTable()])),
    ),
  }
})

import { db } from '../../src/lib/db'
import { aislarDatosLocales, delTenant } from '../../src/lib/tenancy'
import { agruparPendientes } from '../../src/lib/sync/indicador'
import { LUGAR_1, TENANT_1, TENANT_2 } from '../helpers/tenancy'

/**
 * Spec 014 T029 (FR-004, research.md R8): en un dispositivo compartido, al
 * entrar un usuario de otro tenant se borra lo ya sincronizado del anterior y
 * se conservan sus pendientes, ocultos; al volver su dueño, reaparecen.
 */
const tabla = <T,>(t: unknown) => t as MemoryTable<T & { id: string }>

const insumo = (id: string, tenantId = TENANT_1) =>
  ({ id, tenantId, nombre: id, dadoDeBajaEn: null }) as Insumo
const lote = (id: string, insumoId: string, tenantId = TENANT_1) =>
  ({ id, tenantId, lugarId: LUGAR_1, insumoId, estado: 'activo' }) as Lote
const movimiento = (id: string, loteId: string, sincronizado: boolean) =>
  ({
    id,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    tipo: 'consumo',
    loteId,
    cantidad: 1,
    usuarioId: 'ana',
    movimientoOrigenId: null,
    creadoEn: '2026-10-18T10:00:00.000Z',
    sincronizado,
  }) as Movimiento

function usuario(id: string, tenantId: string): UsuarioActual {
  return {
    id,
    tenantId,
    email: `${id}@x.cl`,
    nombre: id,
    rol: 'personal',
    autenticadoEn: 'x',
    desactivadoEn: null,
  }
}

beforeEach(async () => {
  for (const nombre of [
    'insumos',
    'lotes',
    'movimientos',
    'cambiosInsumo',
    'categorias',
    'itemsCompra',
    'lugares',
    'usuarioActual',
    'configuracionAlertas',
    'marcas',
  ] as const) {
    await db[nombre].clear()
  }
  // Tenant 1: un insumo con un consumo pendiente y otro ya sincronizado.
  await db.insumos.bulkPut([insumo('conPendiente'), insumo('sincronizado')])
  await db.lotes.bulkPut([lote('lp', 'conPendiente'), lote('ls', 'sincronizado')])
  await db.movimientos.bulkPut([
    movimiento('pendiente', 'lp', false),
    movimiento('subido', 'ls', true),
  ])
  await db.cambiosInsumo.bulkPut([
    { id: 'cambioSubido', tenantId: TENANT_1, insumoId: 'sincronizado', sincronizado: true },
  ] as CambioInsumo[])
  await db.categorias.bulkPut([
    { id: 'catSubida', tenantId: TENANT_1, sincronizado: true },
    { id: 'catPendiente', tenantId: TENANT_1, sincronizado: false },
  ] as Categoria[])
  await db.itemsCompra.bulkPut([
    { id: 'itemPendiente', tenantId: TENANT_1, estado: 'pendiente' },
    { id: 'itemComprado', tenantId: TENANT_1, estado: 'comprado' },
  ] as ItemCompra[])
  await db.lugares.put({ id: LUGAR_1, tenantId: TENANT_1, sincronizado: true } as Lugar)
  await db.configuracionAlertas.put({
    id: 'global',
    tenantId: TENANT_1,
    nivelesAvisoDias: [30],
    sincronizado: true,
  })
})

describe('aislarDatosLocales (spec 014 FR-004)', () => {
  it('al entrar otro tenant borra lo sincronizado y conserva los pendientes', async () => {
    await aislarDatosLocales(TENANT_2)

    const ids = (t: unknown) => tabla(t).all().map((f) => f.id).sort()
    expect(ids(db.movimientos)).toEqual(['pendiente'])
    expect(ids(db.lotes)).toEqual(['lp'])
    expect(ids(db.insumos)).toEqual(['conPendiente'])
    expect(ids(db.cambiosInsumo)).toEqual([])
    expect(ids(db.categorias)).toEqual(['catPendiente'])
    expect(ids(db.itemsCompra)).toEqual(['itemPendiente'])
    expect(ids(db.lugares)).toEqual([])
    expect(await db.configuracionAlertas.get('global')).toBeUndefined()
  })

  it('el mismo tenant no pierde nada', async () => {
    await aislarDatosLocales(TENANT_1)

    expect(tabla(db.movimientos).all()).toHaveLength(2)
    expect(tabla(db.insumos).all()).toHaveLength(2)
    expect(tabla(db.lugares).all()).toHaveLength(1)
  })

  it('los pendientes ajenos no se ven ni se cuentan; reaparecen al volver su dueño', async () => {
    await aislarDatosLocales(TENANT_2)
    await db.usuarioActual.put(usuario('beto', TENANT_2))

    expect(await delTenant('insumos')).toEqual([])
    expect(await delTenant('movimientos')).toEqual([])
    expect(
      agruparPendientes(
        await delTenant('movimientos'),
        await delTenant('cambiosInsumo'),
        await delTenant('categorias'),
      ),
    ).toEqual([])

    await db.usuarioActual.clear()
    await aislarDatosLocales(TENANT_1)
    await db.usuarioActual.put(usuario('ana', TENANT_1))

    expect((await delTenant('movimientos')).map((m) => m.id)).toEqual(['pendiente'])
    expect(
      agruparPendientes(
        await delTenant('movimientos'),
        await delTenant('cambiosInsumo'),
        await delTenant('categorias'),
      ).map((p) => p.usuarioId),
    ).toEqual(['ana'])
  })

  it('spec 023: borra las marcas sincronizadas del otro tenant y conserva las pendientes', async () => {
    const marca = (id: string, sincronizado: boolean, tenantId = TENANT_1) => ({
      id,
      tenantId,
      nombre: id,
      creadoPor: 'ana',
      creadoEn: '2026-10-24T10:00:00.000Z',
      desactivadoEn: null,
      eliminadoEn: null,
      sincronizado,
    })
    await db.marcas.bulkPut([
      marca('3m', true),
      marca('gc-pendiente', false),
      marca('propia', true, TENANT_2),
    ])

    await aislarDatosLocales(TENANT_2)

    expect(tabla(db.marcas).all().map((m) => m.id).sort()).toEqual([
      'gc-pendiente',
      'propia',
    ])
  })
})
