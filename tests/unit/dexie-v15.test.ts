import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 026 T004 (data-model.md "Dexie v15"): un dispositivo con la v14 (spec
 * 023) pasa a la v15 con `categoriaId: null` en sus cambios de tratamiento,
 * `categoriaId`/`categoriaNombre: null` en sus registros y la tabla
 * `categoriasTratamiento` vacía, sin perder ninguna fila.
 */
const ESQUEMA_V14 = {
  usuarioActual: 'id',
  insumos: 'id, nombre, categoria, codigoFabricante, tenantId, marcaId',
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
  marcas: 'id, tenantId, sincronizado',
}

describe('Dexie v15 (spec 026)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('agrega categoriasTratamiento y completa la categoría con null', async () => {
    const v14 = new Dexie('inDENToryDB')
    v14.version(14).stores(ESQUEMA_V14)
    await v14.open()
    await v14.table('cambiosTratamiento').bulkAdd([
      { id: 'c1', tenantId: TENANT_1, tratamientoId: null, lugarId: LUGAR_1, campo: 'porcentajeProfesional', valorNuevo: 40, creadoEn: '2026-10-01T00:00:00.000Z' },
      { id: 'c2', tenantId: TENANT_1, tratamientoId: 't1', lugarId: null, campo: 'nombre', valorNuevo: 'Resina', creadoEn: '2026-10-01T00:00:00.000Z' },
    ])
    await v14.table('tratamientosRealizados').add({
      id: 'r1', tenantId: TENANT_1, lugarId: LUGAR_1, tratamientoId: 't1', nombre: 'Resina',
      precio: 20000, porcentajeProfesional: 40, creadoEn: '2026-10-02T00:00:00.000Z',
    })
    v14.close()

    const { db } = await import('../../src/lib/db')
    await db.open()

    expect(db.verno).toBe(17) // la v15 corre dentro de la cadena hasta la última versión
    expect(await db.cambiosTratamiento.count()).toBe(2)
    expect(await db.cambiosTratamiento.get('c1')).toMatchObject({ valorNuevo: 40, categoriaId: null })
    expect(await db.cambiosTratamiento.get('c2')).toMatchObject({ categoriaId: null })
    expect(await db.tratamientosRealizados.get('r1')).toMatchObject({
      porcentajeProfesional: 40,
      categoriaId: null,
      categoriaNombre: null,
    })
    expect(await db.categoriasTratamiento.count()).toBe(0)
  })
})
