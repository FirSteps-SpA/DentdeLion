import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 021 T009 (data-model.md "Dexie v13"): un dispositivo con la v12 (spec
 * 016) pasa a la v13 con `proveedorId: null` en sus lotes, sin predeterminado
 * en sus lugares, la tabla `proveedores` vacía y sin `configuracionClinica`.
 */
const ESQUEMA_V12 = {
  usuarioActual: 'id',
  insumos: 'id, nombre, categoria, codigoFabricante, tenantId',
  lotes:
    'id, insumoId, fechaCaducidad, codigoFabricante, estado, tenantId, lugarId',
  movimientos:
    'id, loteId, tipo, usuarioId, creadoEn, sincronizado, tenantId, lugarId, trasladoId, tratamientoRealizadoId',
  configuracionAlertas: 'id',
  cambiosInsumo: 'id, insumoId, campo, creadoEn, sincronizado, tenantId',
  categorias: 'id, creadoEn, sincronizado, tenantId',
  borradores: 'id',
  itemsCompra: 'id, insumoId, estado, creadoEn, tenantId, lugarId',
  configuracionClinica: 'id',
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
}

describe('Dexie v13 (spec 021)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('agrega proveedores, el proveedor del lote y el predeterminado del lugar; borra configuracionClinica', async () => {
    const v12 = new Dexie('inDENToryDB')
    v12.version(12).stores(ESQUEMA_V12)
    await v12.open()
    await v12.table('lotes').add({
      id: 'l1',
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      insumoId: 'i1',
      numeroLote: 'A1',
      proveedor: 'Dental Sur',
      estado: 'activo',
    })
    await v12.table('lugares').add({
      id: LUGAR_1,
      tenantId: TENANT_1,
      nombre: 'Clínica',
      desactivadoEn: null,
      creadoEn: '2026-01-01T00:00:00.000Z',
      sincronizado: false,
    })
    await v12
      .table('configuracionClinica')
      .add({ id: 'global', nombre: 'Clínica', tenantId: TENANT_1 })
    v12.close()

    const { db } = await import('../../src/lib/db')
    await db.open()

    expect(db.verno).toBe(13)
    expect(await db.lotes.get('l1')).toMatchObject({
      proveedor: 'Dental Sur',
      proveedorId: null,
    })
    expect(await db.lugares.get(LUGAR_1)).toMatchObject({
      proveedorPredeterminadoId: null,
      sincronizado: false,
    })
    expect(db.tables.map((tabla) => tabla.name)).not.toContain(
      'configuracionClinica',
    )
    expect(await db.proveedores.count()).toBe(0)
    expect(
      await db.proveedores.where('tenantId').equals(TENANT_1).count(),
    ).toBe(0)
    expect(await db.lotes.where('proveedorId').equals('p1').count()).toBe(0)
  })
})
