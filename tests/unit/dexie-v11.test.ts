import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 015 T014 (data-model.md "Dexie v11"): un dispositivo con la 2.3.0
 * (Dexie v10) —con un insumo en `pieza` y un consumo sin subir— pasa a la v11
 * con contenido 1, `unidad` en cada movimiento y `pieza` → `unidad`, sin tocar
 * `sincronizado` ni ninguna cantidad (SC-001).
 */

// Esquema completo de la v10 tal como lo deja la 2.3.0 (src/lib/db, versiones 1–10).
const ESQUEMA_V10 = {
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
}

async function sembrarV10(): Promise<void> {
  const v10 = new Dexie('inDENToryDB')
  v10.version(10).stores(ESQUEMA_V10)
  await v10.open()
  await v10.table('insumos').bulkAdd([
    { id: 'i1', tenantId: TENANT_1, nombre: 'Guantes', unidadMedida: 'pieza', stockMinimo: 5 },
    { id: 'i2', tenantId: TENANT_1, nombre: 'Anestesia', unidadMedida: 'mL', stockMinimo: null },
  ])
  await v10.table('lotes').bulkAdd([
    { id: 'l1', tenantId: TENANT_1, lugarId: LUGAR_1, insumoId: 'i1', estado: 'activo' },
    { id: 'l2', tenantId: TENANT_1, lugarId: LUGAR_1, insumoId: 'i2', estado: 'activo' },
  ])
  await v10.table('movimientos').bulkAdd([
    { id: 'm1', tenantId: TENANT_1, lugarId: LUGAR_1, tipo: 'ingreso', loteId: 'l1', cantidad: 10, sincronizado: true },
    { id: 'm2', tenantId: TENANT_1, lugarId: LUGAR_1, tipo: 'consumo', loteId: 'l1', cantidad: 1, sincronizado: false },
    { id: 'm3', tenantId: TENANT_1, lugarId: LUGAR_1, tipo: 'ingreso', loteId: 'l2', cantidad: 2.5, sincronizado: true },
  ])
  await v10.table('cambiosInsumo').bulkAdd([
    { id: 'x1', tenantId: TENANT_1, insumoId: 'i1', campo: 'unidadMedida', valorAnterior: 'caja', valorNuevo: 'pieza', sincronizado: true },
    { id: 'x2', tenantId: TENANT_1, insumoId: 'i1', campo: 'nombre', valorAnterior: 'pieza', valorNuevo: 'Guantes', sincronizado: false },
  ])
  v10.close()
}

describe('Dexie v11 (spec 015 FR-011)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('agrega la presentación y la unidad sin cambiar cantidades ni pendientes', async () => {
    await sembrarV10()
    const { db } = await import('../../src/lib/db')
    await db.open()

    expect(db.verno).toBe(13) // la v11 corre dentro de la cadena hasta la última versión
    expect(await db.insumos.get('i1')).toMatchObject({
      unidadMedida: 'unidad',
      unidadCompra: 'unidad',
      contenido: 1,
      stockMinimo: 5,
    })
    expect(await db.insumos.get('i2')).toMatchObject({
      unidadMedida: 'mL',
      unidadCompra: 'mL',
      contenido: 1,
    })
    expect(await db.lotes.get('l1')).toMatchObject({
      cantidadIngresada: null,
      unidadIngresada: null,
      contenido: 1,
      unidadConsumo: 'unidad',
      precioCompra: null,
    })
    expect(await db.lotes.get('l2')).toMatchObject({ unidadConsumo: 'mL' })
    expect(await db.movimientos.get('m1')).toMatchObject({
      unidad: 'unidad',
      cantidad: 10,
      sincronizado: true,
    })
    expect(await db.movimientos.get('m2')).toMatchObject({
      unidad: 'unidad',
      cantidad: 1,
      sincronizado: false,
    })
    expect(await db.movimientos.get('m3')).toMatchObject({ unidad: 'mL', cantidad: 2.5 })
    // Solo los cambios de unidad se normalizan; el nombre "pieza" no es una unidad.
    expect(await db.cambiosInsumo.get('x1')).toMatchObject({
      valorAnterior: 'caja',
      valorNuevo: 'unidad',
      factor: null,
      sincronizado: true,
    })
    expect(await db.cambiosInsumo.get('x2')).toMatchObject({
      valorAnterior: 'pieza',
      factor: null,
      sincronizado: false,
    })
    expect(await db.cambiosLote.count()).toBe(0)
  })
})
