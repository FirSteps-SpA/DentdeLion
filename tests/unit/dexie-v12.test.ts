import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 016 T009 (data-model.md "Dexie v12"): un dispositivo con la v11 (spec
 * 015) y un consumo sin subir pasa a la v12 con `tratamientoRealizadoId: null`
 * y las tablas de tratamientos vacías, sin tocar `sincronizado`.
 */
const ESQUEMA_V11 = {
  usuarioActual: 'id',
  insumos: 'id, nombre, categoria, codigoFabricante, tenantId',
  lotes: 'id, insumoId, fechaCaducidad, codigoFabricante, estado, tenantId, lugarId',
  movimientos:
    'id, loteId, tipo, usuarioId, creadoEn, sincronizado, tenantId, lugarId, trasladoId',
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
}

describe('Dexie v12 (spec 016)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('agrega las tablas de tratamientos y el vínculo de los movimientos sin tocar pendientes', async () => {
    const v11 = new Dexie('inDENToryDB')
    v11.version(11).stores(ESQUEMA_V11)
    await v11.open()
    await v11.table('movimientos').add({
      id: 'm1',
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      tipo: 'consumo',
      loteId: 'l1',
      cantidad: 1,
      unidad: 'cartucho',
      sincronizado: false,
    })
    v11.close()

    const { db } = await import('../../src/lib/db')
    await db.open()

    expect(db.verno).toBe(13) // la v12 corre dentro de la cadena hasta la última versión
    expect(await db.movimientos.get('m1')).toMatchObject({
      tratamientoRealizadoId: null,
      unidad: 'cartucho',
      sincronizado: false,
    })
    expect(await db.tratamientos.count()).toBe(0)
    expect(await db.cambiosTratamiento.count()).toBe(0)
    expect(await db.tratamientosRealizados.count()).toBe(0)
    expect(await db.movimientos.where('tratamientoRealizadoId').equals('x').count()).toBe(0)
  })
})
