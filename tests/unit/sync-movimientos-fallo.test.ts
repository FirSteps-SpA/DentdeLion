import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consultaFalsa } from '../helpers/consultaFalsa'
import type { Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      categorias: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      estadoSync: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
    }),
  }
})

// Cliente cuyo upsert de `movimientos` falla como lo hace supabase-js sin red:
// no lanza, devuelve `{ error }`.
let errorMovimientos: { message: string; code?: string } | null = null
let opcionesUpsertMovimientos: unknown = null
const subidosMovimientos: string[] = []

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(rows: unknown, opciones?: unknown) {
        if (nombre !== 'movimientos') return { error: null }
        opcionesUpsertMovimientos = opciones
        if (!errorMovimientos) {
          for (const r of Array.isArray(rows) ? rows : [rows]) {
            subidosMovimientos.push((r as { id: string }).id)
          }
        }
        return { error: errorMovimientos }
      },
      select() {
        const resultado = consultaFalsa({ filas: () => [], error: () => null })
        return Object.assign(resultado, {
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        })
      },
    }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const consumoOffline: Movimiento = {
  tratamientoRealizadoId: null,
  unidad: 'unidad',
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

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('pushMovimientos ante un upsert fallido', () => {
  beforeEach(async () => {
    errorMovimientos = null
    subidosMovimientos.length = 0
    await db.movimientos.clear()
    await db.movimientos.put({ ...consumoOffline })
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
  })

  it('no marca como sincronizado un movimiento que no llegó al servidor (sin red)', async () => {
    errorMovimientos = { message: 'TypeError: Failed to fetch' }

    await runSyncBatch()

    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })

  it('lo sube en el siguiente ciclo cuando vuelve la conexión', async () => {
    errorMovimientos = { message: 'TypeError: Failed to fetch' }
    await runSyncBatch()

    errorMovimientos = null
    await runSyncBatch()

    expect(movimientosT.all()[0].sincronizado).toBe(true)
  })

  it('no marca como sincronizado ante un error del servidor', async () => {
    errorMovimientos = { message: 'internal error', code: '500' }

    await runSyncBatch()

    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })

  it('reenvía con ON CONFLICT DO NOTHING (movimientos es solo-INSERT)', async () => {
    await runSyncBatch()

    expect(opcionesUpsertMovimientos).toMatchObject({
      onConflict: 'id',
      ignoreDuplicates: true,
    })
    expect(movimientosT.all()[0].sincronizado).toBe(true)
  })

  it('en un dispositivo compartido, deja pendientes los movimientos de otro usuario', async () => {
    await db.movimientos.put({ ...consumoOffline, id: 'm2', usuarioId: 'u2' })

    await runSyncBatch()

    expect(subidosMovimientos).toEqual(['m1'])
    expect(movimientosT.all().find((m) => m.id === 'm2')!.sincronizado).toBe(
      false,
    )
  })

  it('ante un rechazo de permisos sube fila por fila y deja pendientes las rechazadas', async () => {
    await db.movimientos.put({ ...consumoOffline, id: 'm3' })
    errorMovimientos = {
      message: 'new row violates row-level security policy',
      code: '42501',
    }

    await runSyncBatch()

    expect(movimientosT.all().every((m) => !m.sincronizado)).toBe(true)
  })
})
