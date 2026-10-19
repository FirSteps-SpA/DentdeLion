import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lote, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((nombre) => [nombre, new MemoryTable()])),
    ),
  }
})

/**
 * Spec 014 T020/T060: el ciclo sube solo filas del tenant con sesión, con
 * `tenant_id`/`lugar_id`/`traslado_id`, y nunca separa las dos mitades de un
 * traslado — ni en el upsert por lote ni en el reintento fila por fila.
 */
const estado = {
  upserts: [] as { tabla: string; filas: Record<string, unknown>[] }[],
  /** Movimientos que el servidor rechaza por permisos (RLS) en cualquier upsert que los incluya. */
  rechazados: new Set<string>(),
}

const client = {
  auth: authFalso,
  from(tabla: string) {
    return {
      async upsert(filas: unknown) {
        const lista = (Array.isArray(filas) ? filas : [filas]) as Record<string, unknown>[]
        if (tabla === 'movimientos' && lista.some((f) => estado.rechazados.has(f.id as string))) {
          return {
            error: { code: '42501', message: 'new row violates row-level security policy' },
          }
        }
        estado.upserts.push({ tabla, filas: lista })
        return { error: null }
      },
      select() {
        const resultado = Promise.resolve({ data: [], error: null })
        return Object.assign(resultado, {
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
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
import { usarLugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1, TENANT_2 } from '../helpers/tenancy'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

function movimiento(overrides: Partial<Movimiento>): Movimiento {
  return {
    unidad: 'unidad',
    id: crypto.randomUUID(),
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    tipo: 'consumo',
    loteId: 'l1',
    cantidad: 1,
    usuarioId: 'u1',
    movimientoOrigenId: null,
    creadoEn: '2026-10-18T10:00:00.000Z',
    sincronizado: false,
    ...overrides,
  }
}

function lote(overrides: Partial<Lote>): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    id: crypto.randomUUID(),
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId: 'i1',
    numeroLote: 'L1',
    proveedor: 'P',
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-10-18T09:00:00.000Z',
    ...overrides,
  }
}

const subidos = (tabla: string) =>
  estado.upserts.filter((u) => u.tabla === tabla).flatMap((u) => u.filas)

beforeEach(async () => {
  usarLugar1()
  estado.upserts = []
  estado.rechazados = new Set()
  for (const tabla of [db.movimientos, db.lotes]) await tabla.clear()
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      email: 'u1@x.cl',
      nombre: 'U1',
      rol: 'personal',
      autenticadoEn: 'x',
      tenantId: TENANT_1,
      desactivadoEn: null,
    },
    isReady: true,
  })
})

describe('sync por tenant (spec 014 FR-004/FR-017)', () => {
  it('no sube filas de otro tenant y deja sus pendientes intactos', async () => {
    const propio = movimiento({ id: 'propio' })
    const ajeno = movimiento({ id: 'ajeno', tenantId: TENANT_2 })
    await db.movimientos.bulkPut([propio, ajeno])
    await db.lotes.bulkPut([lote({ id: 'l1' }), lote({ id: 'lB', tenantId: TENANT_2 })])

    await runSyncBatch()

    expect(subidos('movimientos').map((f) => f.id)).toEqual(['propio'])
    expect(subidos('lotes').map((f) => f.id)).toEqual(['l1'])
    expect(movimientosT.all().find((m) => m.id === 'ajeno')!.sincronizado).toBe(false)
  })

  it('envía tenant_id, lugar_id y traslado_id', async () => {
    await db.movimientos.put(movimiento({ id: 'm1', lugarId: LUGAR_2 }))
    await db.lotes.put(lote({ id: 'l1' }))

    await runSyncBatch()

    expect(subidos('movimientos')[0]).toMatchObject({
      tenant_id: TENANT_1,
      lugar_id: LUGAR_2,
      traslado_id: null,
    })
    expect(subidos('lotes')[0]).toMatchObject({ tenant_id: TENANT_1, lugar_id: LUGAR_1 })
  })
})

describe('traslados en el sync (spec 014 FR-023, research.md R4)', () => {
  const par = () => [
    movimiento({ id: 'sal', tipo: 'traslado_salida', trasladoId: 't1', cantidad: 4 }),
    movimiento({
      id: 'ent',
      tipo: 'traslado_entrada',
      trasladoId: 't1',
      cantidad: 4,
      lugarId: LUGAR_2,
    }),
  ]

  it('sube las dos mitades en el mismo upsert', async () => {
    await db.movimientos.bulkPut(par())

    await runSyncBatch()

    const upserts = estado.upserts.filter((u) => u.tabla === 'movimientos')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].filas.map((f) => f.id).sort()).toEqual(['ent', 'sal'])
    expect(movimientosT.all().every((m) => m.sincronizado)).toBe(true)
  })

  it('en el reintento fila por fila mantiene el par junto', async () => {
    await db.movimientos.bulkPut([...par(), movimiento({ id: 'malo' })])
    estado.rechazados.add('malo')

    await runSyncBatch()

    const upserts = estado.upserts.filter((u) => u.tabla === 'movimientos')
    expect(upserts.map((u) => u.filas.map((f) => f.id).sort())).toEqual([['ent', 'sal']])
    expect(movimientosT.all().find((m) => m.id === 'malo')!.sincronizado).toBe(false)
  })

  it('no sube una mitad sin su pareja local', async () => {
    await db.movimientos.put(par()[0])

    await runSyncBatch()

    expect(subidos('movimientos')).toEqual([])
    expect(movimientosT.all()[0].sincronizado).toBe(false)
  })

  it('sube sola una mitad cuya pareja ya está en el servidor', async () => {
    const [salida, entrada] = par()
    await db.movimientos.bulkPut([salida, { ...entrada, sincronizado: true }])

    await runSyncBatch()

    expect(subidos('movimientos').map((f) => f.id)).toEqual(['sal'])
  })
})
