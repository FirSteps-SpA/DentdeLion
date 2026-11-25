import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Lote, Lugar, MinimoLugar, Movimiento } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((nombre) => [nombre, new MemoryTable()])),
    ),
  }
})

import { db } from '../../src/lib/db'
import { compartirBodega, resumenDeJuntar } from '../../src/features/insumos/lib/bodega'
import { stockLoteEnBodega } from '../../src/features/insumos/lib/stock'
import { minimoEfectivoBodega } from '../../src/features/insumos/lib/minimos'
import { lugaresDeBodega } from '../../src/stores/lugarStore'
import { useAuthStore } from '../../src/stores/authStore'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/** Spec 033 T022 (US1, FR-002/FR-003/FR-006, research.md R5, SC-001). */
const LUGAR_3 = '00000000-0000-4000-8000-000000000013'
const lugar3: Lugar = { ...lugar2, id: LUGAR_3, nombre: 'Box 3', creadoEn: '2026-03-01T00:00:00.000Z' }

const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const insumo = (id: string, nombre: string, stockMinimo: number | null = null) =>
  ({ id, nombre, stockMinimo, dadoDeBajaEn: null, tenantId: TENANT_1 }) as unknown as Insumo

const lote = (id: string, insumoId: string, lugarId: string) =>
  ({ id, insumoId, lugarId, tenantId: TENANT_1 }) as Lote

const ingreso = (loteId: string, lugarId: string, cantidad: number): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  id: `ing-${loteId}`,
  tenantId: TENANT_1,
  lugarId,
  trasladoId: null,
  tipo: 'ingreso',
  loteId,
  cantidad,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
})

const jeringas = insumo('i1', 'Jeringas')
const guantes = insumo('i2', 'Guantes', 4)
// Box 1: 2 jeringas (lote A) y 5 guantes. Box 2: 1 jeringa (lote B).
const lotes = [lote('A', 'i1', LUGAR_1), lote('B', 'i1', LUGAR_2), lote('G', 'i2', LUGAR_1)]
const movimientos = [ingreso('A', LUGAR_1, 2), ingreso('B', LUGAR_2, 1), ingreso('G', LUGAR_1, 5)]
const minimos: MinimoLugar[] = [
  { insumoId: 'i1', lugarId: LUGAR_1, tenantId: TENANT_1, stockMinimo: 5, sincronizado: true },
  { insumoId: 'i1', lugarId: LUGAR_2, tenantId: TENANT_1, stockMinimo: 3, sincronizado: true },
]

function usuario(rol: 'administrador' | 'personal') {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      tenantId: TENANT_1,
      desactivadoEn: null,
      email: 'u@x.cl',
      nombre: 'U',
      rol,
      autenticadoEn: 'x',
    },
    isReady: true,
  })
}

beforeEach(() => {
  usuario('administrador')
  lugaresT.seed([lugar1, lugar2, lugar3])
  minimosT.seed(minimos.map((m) => ({ ...m })))
  movimientosT.seed(movimientos)
})

describe('resumenDeJuntar (FR-004)', () => {
  it('cuenta los insumos con stock en ambos y lista los mínimos distintos, por defecto el mayor', () => {
    const resumen = resumenDeJuntar(LUGAR_2, LUGAR_1, {
      insumos: [jeringas, guantes],
      lotes,
      movimientos,
      minimosLugar: minimos,
      lugares: [lugar1, lugar2, lugar3],
    })

    expect(resumen.rotuloLugar).toBe('Box Las Condes')
    expect(resumen.rotuloCon).toBe('Clínica')
    expect(resumen.insumosConStockEnAmbos).toBe(1)
    // Guantes: 4 (catálogo) en los dos lados, no hay nada que unificar.
    expect(resumen.minimosDistintos).toMatchObject([
      {
        insumo: { id: 'i1' },
        opciones: [
          { rotulo: 'Box Las Condes', minimo: 3 },
          { rotulo: 'Clínica', minimo: 5 },
        ],
        porDefecto: 5,
      },
    ])
  })
})

describe('compartirBodega (R5)', () => {
  it('dos lugares solos: uuid nuevo en ambos, mínimo elegido en ambos y sin movimientos', async () => {
    const bodegaId = await compartirBodega(LUGAR_2, LUGAR_1, new Map([['i1', 5]]))

    expect(bodegaId).not.toBe(LUGAR_1)
    expect(bodegaId).not.toBe(LUGAR_2)
    const lugares = lugaresT.all()
    expect(lugares.find((l) => l.id === LUGAR_1)).toMatchObject({ bodegaId, sincronizado: false })
    expect(lugares.find((l) => l.id === LUGAR_2)).toMatchObject({ bodegaId, sincronizado: false })
    expect(lugares.find((l) => l.id === LUGAR_3)?.bodegaId ?? null).toBeNull()
    expect(minimosT.all().filter((m) => m.insumoId === 'i1').map((m) => m.stockMinimo)).toEqual([5, 5])
    expect(movimientosT.all()).toEqual(movimientos)

    // SC-001: el stock común es la suma, con los dos lotes.
    const bodega = lugaresDeBodega(LUGAR_2, lugares)
    expect(stockLoteEnBodega(movimientos, 'A', bodega) + stockLoteEnBodega(movimientos, 'B', bodega)).toBe(3)
    expect(minimoEfectivoBodega(jeringas, bodega, minimosT.all())).toBe(5)
  })

  it('un tercer lugar se une a la bodega existente con el mismo bodegaId', async () => {
    const bodegaId = await compartirBodega(LUGAR_2, LUGAR_1, new Map())
    await compartirBodega(LUGAR_3, LUGAR_1, new Map())

    expect(lugaresT.all().map((l) => l.bodegaId)).toEqual([bodegaId, bodegaId, bodegaId])
  })

  it('juntar dos bodegas deja una sola con todos', async () => {
    const LUGAR_4 = '00000000-0000-4000-8000-000000000014'
    lugaresT.seed([
      { ...lugar1, bodegaId: 'b-1' },
      { ...lugar2, bodegaId: 'b-1' },
      { ...lugar3, bodegaId: 'b-2' },
      { ...lugar3, id: LUGAR_4, nombre: 'Box 4', bodegaId: 'b-2' },
    ])

    await compartirBodega(LUGAR_1, LUGAR_3, new Map([['i1', 3]]))

    expect(lugaresT.all().map((l) => l.bodegaId)).toEqual(['b-2', 'b-2', 'b-2', 'b-2'])
    expect(minimosT.all().filter((m) => m.insumoId === 'i1' && m.stockMinimo === 3)).toHaveLength(4)
  })

  it('rechaza lugares que ya comparten, uno desactivado y al personal (FR-005)', async () => {
    await compartirBodega(LUGAR_2, LUGAR_1, new Map())
    await expect(compartirBodega(LUGAR_1, LUGAR_2, new Map())).rejects.toThrow(/ya comparten/)

    lugaresT.seed([lugar1, { ...lugar2, desactivadoEn: '2026-05-01T00:00:00.000Z' }])
    await expect(compartirBodega(LUGAR_1, LUGAR_2, new Map())).rejects.toThrow(/activos/)

    usuario('personal')
    lugaresT.seed([lugar1, lugar2])
    await expect(compartirBodega(LUGAR_1, LUGAR_2, new Map())).rejects.toThrow(/administrador/)
    expect(lugaresT.all().every((l) => !l.bodegaId)).toBe(true)
  })
})
