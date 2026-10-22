import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lote, Movimiento, TratamientoRealizado } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { crearClienteFalso, crearEstado, reiniciar } from '../helpers/clienteFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})

const estado = crearEstado()
const client = crearClienteFalso(estado)

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 017 T003 (research.md R9, FR-018a): PostgREST corta cada select en
 * `max_rows` (1.000). Los pulls de las tablas que crecen paginan por cursor
 * para bajar la historia completa, y una página con error no deja la tabla a
 * medio aplicar.
 */
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>

const id = (prefijo: string, i: number) => `${prefijo}-${String(i).padStart(6, '0')}`

function sembrarRemoto(tabla: string, filas: Record<string, unknown>[]) {
  estado.remoto[tabla] = new Map(filas.map((f) => [f.id as string, f as { id: string }]))
}

function movimientos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: id('m', i),
    tenant_id: TENANT_1,
    lugar_id: LUGAR_1,
    traslado_id: null,
    tipo: 'ingreso',
    lote_id: 'l-000000',
    cantidad: 1,
    unidad: 'unidad',
    tratamiento_realizado_id: null,
    usuario_id: 'A',
    movimiento_origen_id: null,
    creado_en: '2026-01-01T00:00:00.000Z',
  }))
}

function lotes(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: id('l', i),
    tenant_id: TENANT_1,
    lugar_id: LUGAR_1,
    insumo_id: 'i1',
    numero_lote: `L${i}`,
    proveedor: 'P',
    fecha_caducidad: null,
    codigo_fabricante: null,
    estado: 'activo',
    creado_en: '2026-01-01T00:00:00.000Z',
    cantidad_ingresada: 1,
    unidad_ingresada: 'unidad',
    contenido: 1,
    unidad_consumo: 'unidad',
    precio_compra: 100,
  }))
}

function realizados(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: id('r', i),
    tenant_id: TENANT_1,
    lugar_id: LUGAR_1,
    tratamiento_id: 't1',
    nombre: 'Control',
    precio: 10000,
    porcentaje_profesional: 40,
    materiales: [],
    costo_materiales: 0,
    costo_completo: true,
    ganancia_estimada: 4000,
    usuario_id: 'A',
    creado_en: '2026-01-01T00:00:00.000Z',
    anulado_en: null,
    anulado_por: null,
  }))
}

beforeEach(() => {
  reiniciar(estado)
  movimientosT.seed([])
  lotesT.seed([])
  realizadosT.seed([])
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'A',
      email: 'a@x.cl',
      nombre: 'Ana',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
})

describe('pulls paginados (spec 017 R9)', () => {
  it('baja los 2.500 movimientos aunque cada select corte en 1.000', async () => {
    sembrarRemoto('movimientos', movimientos(2500))

    await runSyncBatch()

    expect((await db.movimientos.toArray()).length).toBe(2500)
  })

  it('con exactamente 2.000 filas también baja todas (última página vacía)', async () => {
    sembrarRemoto('movimientos', movimientos(2000))

    await runSyncBatch()

    expect((await db.movimientos.toArray()).length).toBe(2000)
  })

  it('pagina también lotes y tratamientos realizados', async () => {
    sembrarRemoto('lotes', lotes(1500))
    sembrarRemoto('tratamientos_realizados', realizados(1200))

    await runSyncBatch()

    expect((await db.lotes.toArray()).length).toBe(1500)
    expect((await db.tratamientosRealizados.toArray()).length).toBe(1200)
  })

  it('si falla la página 2 no aplica la tabla a medias y registra la etapa con error', async () => {
    sembrarRemoto('movimientos', movimientos(2500))
    estado.errorEnPagina.movimientos = 2

    const resultado = await runSyncBatch()

    expect((await db.movimientos.toArray()).length).toBe(0)
    expect(resultado.estado).toBe('error')
    expect(resultado.etapasConError).toContain('pull movimientos')
  })
})
