import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MinimoLugar } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { claveFila, crearClienteFalso, crearEstado, reiniciar } from '../helpers/clienteFalso'

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
import { TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 019 T026 (US4, FR-022/023, research.md R5): `minimos_lugar` no tiene
 * `id` (su clave es insumo + lugar), así que el pull pagina por cursor de
 * clave compuesta para bajar todas las filas aunque superen `max_rows`.
 */
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>

const id = (prefijo: string, i: number) => `${prefijo}-${String(i).padStart(6, '0')}`

/** `insumos × lugares` filas; varias páginas cortan en medio de un mismo insumo. */
function minimos(insumos: number, lugares: number, valor = 3) {
  const filas: Record<string, unknown>[] = []
  for (let i = 0; i < insumos; i++) {
    for (let l = 0; l < lugares; l++) {
      filas.push({
        tenant_id: TENANT_1,
        insumo_id: id('i', i),
        lugar_id: id('l', l),
        stock_minimo: valor,
      })
    }
  }
  return filas
}

function sembrarRemoto(filas: Record<string, unknown>[]) {
  estado.remoto.minimos_lugar = new Map(
    filas.map((f) => [claveFila(f as { id: string }), f as { id: string }]),
  )
}

beforeEach(() => {
  reiniciar(estado)
  minimosT.seed([])
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

describe('pull de minimos_lugar paginado por clave compuesta (spec 019 US4)', () => {
  it('baja las 2.500 filas en 3 páginas, sin duplicados', async () => {
    sembrarRemoto(minimos(50, 50))

    await runSyncBatch()

    const locales = await db.minimosLugar.toArray()
    expect(locales).toHaveLength(2500)
    expect(new Set(locales.map((m) => `${m.insumoId}|${m.lugarId}`)).size).toBe(2500)
    expect(estado.paginasPedidas.minimos_lugar).toBe(3)
  })

  it('si falla una página no aplica nada y registra la etapa con error', async () => {
    sembrarRemoto(minimos(50, 50))
    estado.errorEnPagina.minimos_lugar = 2

    const resultado = await runSyncBatch()

    expect(await db.minimosLugar.toArray()).toHaveLength(0)
    expect(resultado.estado).toBe('error')
    expect(resultado.etapasConError).toContain('pull minimos_lugar')
  })

  it('no pisa un mínimo local sin subir de la administradora', async () => {
    sembrarRemoto(minimos(50, 50))
    estado.errorUpsert.minimos_lugar = { message: 'sin red' }
    await minimosT.bulkPut([
      {
        insumoId: id('i', 10),
        lugarId: id('l', 10),
        tenantId: TENANT_1,
        stockMinimo: 99,
        sincronizado: false,
      },
    ])

    await runSyncBatch()

    expect(await db.minimosLugar.get([id('i', 10), id('l', 10)])).toMatchObject({
      stockMinimo: 99,
      sincronizado: false,
    })
    expect(await db.minimosLugar.toArray()).toHaveLength(2500)
  })

  it('el ciclo siguiente a un error completa todas las filas', async () => {
    sembrarRemoto(minimos(50, 50))
    estado.errorEnPagina.minimos_lugar = 2
    await runSyncBatch()

    estado.errorEnPagina = {}
    await runSyncBatch()

    expect(await db.minimosLugar.toArray()).toHaveLength(2500)
  })
})
