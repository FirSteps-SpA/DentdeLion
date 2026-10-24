import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 023 T008 (data-model.md "Dexie v14"): un dispositivo con la v13 (spec
 * 021) pasa a la v14 con `marcaId: null` en sus insumos y la tabla `marcas`
 * vacía, sin perder ningún insumo.
 */
const ESQUEMA_V13 = {
  usuarioActual: 'id',
  insumos: 'id, nombre, categoria, codigoFabricante, tenantId',
  lotes:
    'id, insumoId, fechaCaducidad, codigoFabricante, estado, tenantId, lugarId, proveedorId',
  movimientos:
    'id, loteId, tipo, usuarioId, creadoEn, sincronizado, tenantId, lugarId, trasladoId, tratamientoRealizadoId',
  configuracionAlertas: 'id',
  cambiosInsumo: 'id, insumoId, campo, creadoEn, sincronizado, tenantId',
  categorias: 'id, creadoEn, sincronizado, tenantId',
  borradores: 'id',
  itemsCompra: 'id, insumoId, estado, creadoEn, tenantId, lugarId',
  preferenciasNotificaciones: 'id',
  usuariosConocidos: 'id',
  estadoSync: 'id',
  lugares: 'id, tenantId',
  minimosLugar: '[insumoId+lugarId], tenantId, lugarId',
  lugarActivo: 'id',
  cambiosLote: 'id, loteId, creadoEn, sincronizado, tenantId',
  tratamientos: 'id, tenantId, creadoEn, sincronizado',
  cambiosTratamiento:
    'id, tratamientoId, lugarId, campo, creadoEn, sincronizado, tenantId',
  tratamientosRealizados:
    'id, tratamientoId, lugarId, creadoEn, sincronizado, tenantId',
  proveedores: 'id, tenantId, sincronizado',
}

describe('Dexie v14 (spec 023)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('agrega marcas y la marca del insumo (sin marca)', async () => {
    const v13 = new Dexie('inDENToryDB')
    v13.version(13).stores(ESQUEMA_V13)
    await v13.open()
    await v13.table('insumos').bulkAdd([
      { id: 'i1', tenantId: TENANT_1, nombre: 'Composite Z350', categoria: 'Resinas' },
      { id: 'i2', tenantId: TENANT_1, nombre: 'Guantes', categoria: 'Descartables' },
    ])
    v13.close()

    const { db } = await import('../../src/lib/db')
    await db.open()

    expect(db.verno).toBe(14)
    expect(await db.insumos.count()).toBe(2)
    expect(await db.insumos.get('i1')).toMatchObject({
      nombre: 'Composite Z350',
      marcaId: null,
    })
    expect(await db.insumos.get('i2')).toMatchObject({ marcaId: null })
    expect(await db.marcas.count()).toBe(0)
    expect(await db.insumos.where('marcaId').equals('m1').count()).toBe(0)
  })
})
