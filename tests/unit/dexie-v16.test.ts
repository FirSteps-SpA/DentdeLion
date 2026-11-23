import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/** Spec 028 T004 (data-model.md "Dexie v16"): v15 → v16 agrega `pacientesRegistro` vacía, sin perder registros. */
const ESQUEMA_V15 = {
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
  categoriasTratamiento: 'id, tenantId, sincronizado',
}

describe('Dexie v16 (spec 028)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('agrega pacientesRegistro y conserva los registros', async () => {
    const v15 = new Dexie('inDENToryDB')
    v15.version(15).stores(ESQUEMA_V15)
    await v15.open()
    await v15.table('tratamientosRealizados').add({
      id: 'r1', tenantId: TENANT_1, lugarId: LUGAR_1, tratamientoId: 't1', creadoEn: '2026-11-01T00:00:00.000Z',
    })
    v15.close()

    const { db } = await import('../../src/lib/db')
    await db.open()
    expect(db.verno).toBe(16)
    expect(await db.tratamientosRealizados.count()).toBe(1)
    expect(await db.pacientesRegistro.count()).toBe(0)
    await db.pacientesRegistro.put({
      registroId: 'r1', tenantId: TENANT_1, autorId: 'p1', paciente: 'Juan',
      actualizadoPor: 'p1', actualizadoEn: 'x', sincronizado: false,
    })
    expect(await db.pacientesRegistro.get('r1')).toMatchObject({ paciente: 'Juan' })
  })
})
