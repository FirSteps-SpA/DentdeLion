import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lote, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import {
  crearClienteFalso,
  crearEstado,
  reiniciar,
} from '../helpers/clienteFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
    ),
  }
})

const estado = crearEstado()
const client = crearClienteFalso(estado)

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch, sincronizarAhora } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { useSyncStore } from '../../src/stores/syncStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const lote: Lote = {
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'l1',
  insumoId: 'i1',
  numeroLote: 'A',
  proveedor: 'P',
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-10-18T10:00:00.000Z',
}

const movimiento: Movimiento = {
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  id: 'm1',
  tipo: 'consumo',
  loteId: 'l1',
  cantidad: 1,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-10-18T10:00:00.000Z',
  sincronizado: false,
}

beforeEach(async () => {
  reiniciar(estado)
  for (const tabla of ['lotes', 'movimientos', 'itemsCompra', 'estadoSync'] as const) {
    await db[tabla].clear()
  }
  await db.lotes.put({ ...lote })
  await db.movimientos.put({ ...movimiento })
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'u1',
      email: 'u1@x.cl',
      nombre: 'Usuario 1',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  useSyncStore.setState({ fase: 'inactivo', ultimoResultado: null })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('runSyncBatch informa el resultado del ciclo (spec 012 R1–R3)', () => {
  it('(a) sin errores da ok y guarda la última sincronización exitosa', async () => {
    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('ok')
    expect(resultado.etapasConError).toEqual([])
    expect(await db.estadoSync.get('local')).toEqual({
      id: 'local',
      ultimaExitosaEn: resultado.terminadoEn,
    })
  })

  it('(b) un error de red en push lotes da sin-red y no guarda la hora', async () => {
    estado.errorUpsert.lotes = { message: 'TypeError: Failed to fetch' }

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('sin-red')
    expect(await db.estadoSync.get('local')).toBeUndefined()
  })

  it('(c) un error de servidor en push items_compra da error con la etapa', async () => {
    await db.itemsCompra.put({
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      id: 'it1',
      nombre: 'Guantes',
      cantidad: null,
      nota: null,
      insumoId: null,
      estado: 'pendiente',
      creadoPor: 'u1',
      creadoEn: 'x',
      compradoPor: null,
      compradoEn: null,
    })
    estado.errorUpsert.items_compra = { code: '23505', message: 'duplicate key' }

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('error')
    expect(resultado.etapasConError).toContain('push items_compra')
  })

  it('(d) un error de servidor y uno de red en el mismo ciclo dan error', async () => {
    estado.errorSelect.cambios_insumo = { code: 'XX000', message: 'internal error' }
    estado.errorUpsert.lotes = { message: 'Failed to fetch' }

    expect((await runSyncBatch()).estado).toBe('error')
  })

  it('un error de red corta el ciclo: no sigue con las etapas siguientes', async () => {
    estado.errorUpsert.lotes = { message: 'Failed to fetch' }

    expect((await runSyncBatch()).estado).toBe('sin-red')
    expect(estado.upserts.some((u) => u.tabla === 'movimientos')).toBe(false)
  })

  it('con el navegador sin red no hace ninguna petición', async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    try {
      expect((await runSyncBatch()).estado).toBe('sin-red')
      expect(estado.llamadasSesion).toBe(0)
      expect(estado.upserts).toEqual([])
    } finally {
      if (original) Object.defineProperty(window.navigator, 'onLine', original)
      else delete (window.navigator as { onLine?: boolean }).onLine
    }
  })

  it('(e) sin sesión da sesion y no sube nada', async () => {
    estado.sesionUserId = null

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('sesion')
    expect(estado.upserts).toEqual([])
    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })

  it('(f) una sesión de otro usuario da sesion', async () => {
    estado.sesionUserId = 'otro'

    expect((await runSyncBatch()).estado).toBe('sesion')
    expect(estado.upserts).toEqual([])
  })

  it('(g) getSession con error de red da sin-red, sin push', async () => {
    estado.errorSesion = { message: 'Failed to fetch' }

    expect((await runSyncBatch()).estado).toBe('sin-red')
    expect(estado.upserts).toEqual([])
  })

  it('(h) dos sincronizarAhora seguidos comparten un único ciclo', async () => {
    const primero = sincronizarAhora()
    const segundo = sincronizarAhora()

    expect(segundo).toBe(primero)
    expect(useSyncStore.getState().fase).toBe('sincronizando')
    await primero
    expect(estado.llamadasSesion).toBe(1)
    expect(useSyncStore.getState()).toMatchObject({
      fase: 'inactivo',
      ultimoResultado: 'ok',
    })
  })

  it('(i) nunca lanza aunque un upsert lance', async () => {
    estado.lanzar = new Error('boom')

    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'error' })
  })

  it('(j) un movimiento rechazado fila por fila es error y queda pendiente', async () => {
    estado.rechazarFila.movimientos = () => ({
      code: '42501',
      message: 'new row violates row-level security policy',
    })

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('error')
    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })

  it.each([
    ['PGRST301', { code: 'PGRST301', message: 'JWSError' }, undefined],
    ['401', { message: 'Unauthorized' }, 401],
    ['JWT expired', { message: 'JWT expired' }, undefined],
  ])('(k) un error de sesión (%s) da sesion y corta el ciclo', async (_n, error, status) => {
    estado.errorUpsert.lotes = error
    estado.errorSelect.movimientos = { message: 'Failed to fetch' }
    if (status) estado.status.lotes = status

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('sesion')
    // Se cortó en push lotes: no llegó a subir movimientos.
    expect(estado.upserts.some((u) => u.tabla === 'movimientos')).toBe(false)
  })
})
