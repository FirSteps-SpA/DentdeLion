import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, describe, expect, it } from 'vitest'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 014 T016 (research.md R8): un dispositivo con la 2.2.0 (Dexie v9) y
 * datos —incluido un consumo sin subir— pasa a la v10 con todo en el tenant 1
 * / lugar 1, sin tocar `sincronizado`. Usa IndexedDB real en memoria
 * (`fake-indexeddb`) porque el `memoryDb` de las demás pruebas no ejecuta los
 * upgrades de Dexie.
 */

// Esquema completo de la v9 tal como lo deja la 2.2.0 (src/lib/db, versiones 1–9).
const ESQUEMA_V9 = {
  usuarioActual: 'id',
  insumos: 'id, nombre, categoria, codigoFabricante',
  lotes: 'id, insumoId, fechaCaducidad, codigoFabricante, estado',
  movimientos: 'id, loteId, tipo, usuarioId, creadoEn, sincronizado',
  configuracionAlertas: 'id',
  cambiosInsumo: 'id, insumoId, campo, creadoEn, sincronizado',
  categorias: 'id, creadoEn, sincronizado',
  borradores: 'id',
  itemsCompra: 'id, insumoId, estado, creadoEn',
  configuracionClinica: 'id',
  preferenciasNotificaciones: 'id',
  usuariosConocidos: 'id',
  estadoSync: 'id',
}

async function sembrarV9(): Promise<void> {
  const v9 = new Dexie('inDENToryDB')
  v9.version(9).stores(ESQUEMA_V9)
  await v9.open()
  await v9.table('usuarioActual').add({
    id: 'u1',
    email: 'ana@x.cl',
    nombre: 'Ana',
    rol: 'administrador',
    autenticadoEn: '2026-10-01T00:00:00.000Z',
  })
  await v9.table('insumos').add({ id: 'i1', nombre: 'Guantes', categoria: 'Protección' })
  await v9.table('lotes').add({ id: 'l1', insumoId: 'i1', estado: 'activo' })
  await v9.table('movimientos').bulkAdd([
    { id: 'm1', tipo: 'ingreso', loteId: 'l1', cantidad: 10, sincronizado: true },
    { id: 'm2', tipo: 'consumo', loteId: 'l1', cantidad: 1, sincronizado: false },
  ])
  await v9.table('itemsCompra').add({ id: 'c1', nombre: 'Algodón', estado: 'pendiente' })
  await v9.table('categorias').add({ id: 'k1', nombre: 'Cirugía', sincronizado: true })
  await v9.table('cambiosInsumo').add({ id: 'x1', insumoId: 'i1', sincronizado: false })
  await v9
    .table('configuracionAlertas')
    .put({ id: 'global', nivelesAvisoDias: [30, 7, 1], sincronizado: true })
  await v9
    .table('configuracionClinica')
    .put({ id: 'global', nombre: 'Clínica Providencia', sincronizado: true })
  v9.close()
}

describe('Dexie v10 (spec 014 FR-016/FR-018)', () => {
  afterAll(async () => {
    const { db } = await import('../../src/lib/db')
    db.close()
  })

  it('migra los datos de la 2.2.0 al tenant 1 / lugar 1 sin perder pendientes', async () => {
    await sembrarV9()
    const { db } = await import('../../src/lib/db')
    await db.open()

    expect(db.verno).toBe(14) // la v10 corre dentro de la cadena hasta la última versión
    const [movimientoSubido, consumoPendiente] = await db.movimientos.bulkGet(['m1', 'm2'])
    expect(movimientoSubido).toMatchObject({
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      trasladoId: null,
      sincronizado: true,
    })
    expect(consumoPendiente).toMatchObject({
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      sincronizado: false,
    })
    expect(await db.lotes.get('l1')).toMatchObject({ tenantId: TENANT_1, lugarId: LUGAR_1 })
    expect(await db.itemsCompra.get('c1')).toMatchObject({
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
    })
    expect(await db.insumos.get('i1')).toMatchObject({ tenantId: TENANT_1 })
    expect(await db.categorias.get('k1')).toMatchObject({ tenantId: TENANT_1 })
    expect(await db.cambiosInsumo.get('x1')).toMatchObject({
      tenantId: TENANT_1,
      sincronizado: false,
    })
    expect(await db.configuracionAlertas.get('global')).toMatchObject({
      tenantId: TENANT_1,
    })
    expect(await db.usuarioActual.get('u1')).toMatchObject({
      tenantId: TENANT_1,
      desactivadoEn: null,
    })
    expect(await db.lugares.get(LUGAR_1)).toEqual({
      id: LUGAR_1,
      tenantId: TENANT_1,
      nombre: 'Clínica Providencia',
      desactivadoEn: null,
      creadoEn: '2026-01-01T00:00:00.000Z',
      sincronizado: true,
      proveedorPredeterminadoId: null,
    })
    // Los índices nuevos responden.
    expect(await db.movimientos.where('lugarId').equals(LUGAR_1).count()).toBe(2)
    expect(await db.insumos.where('tenantId').equals(TENANT_1).count()).toBe(1)
  })
})
