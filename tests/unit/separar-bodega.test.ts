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
import { separarDeBodega } from '../../src/features/insumos/lib/bodega'
import { desactivarLugar } from '../../src/features/ajustes/lib/lugares'
import { stockLoteEnBodega, stockLoteEnLugar } from '../../src/features/insumos/lib/stock'
import { minimoEfectivoBodega } from '../../src/features/insumos/lib/minimos'
import { lugaresDeBodega } from '../../src/stores/lugarStore'
import { useAuthStore } from '../../src/stores/authStore'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/** Spec 033 T026 (US3, FR-007..FR-010, research.md R6). */
const LUGAR_3 = '00000000-0000-4000-8000-000000000013'
const box1: Lugar = { ...lugar1, bodegaId: 'b' }
const box2: Lugar = { ...lugar2, bodegaId: 'b' }
const box3: Lugar = {
  ...lugar2,
  id: LUGAR_3,
  nombre: 'Box 3',
  creadoEn: '2026-03-01T00:00:00.000Z',
  bodegaId: 'b',
}

const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>

const insumo = {
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Anestesia',
  unidadMedida: 'unidad',
  stockMinimo: null,
} as unknown as Insumo

const lote = (id: string, lugarId: string) =>
  ({ id, insumoId: 'i1', lugarId, tenantId: TENANT_1, numeroLote: id }) as Lote

let n = 0
const mov = (
  tipo: Movimiento['tipo'],
  loteId: string,
  lugarId: string,
  cantidad: number,
): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  id: `m${++n}`,
  tenantId: TENANT_1,
  lugarId,
  trasladoId: null,
  tipo,
  loteId,
  cantidad,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
})

// Lote A: 10 entran en Box 1; Box 2 consume 4 (saldo propio −4).
// Lote B: 3 entran en Box 2 (saldo propio +3). Lote C: 5 en Box 1 (Box 2 en 0).
const iniciales = [
  mov('ingreso', 'A', LUGAR_1, 10),
  mov('consumo', 'A', LUGAR_2, 4),
  mov('ingreso', 'B', LUGAR_2, 3),
  mov('ingreso', 'C', LUGAR_1, 5),
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

const stockEn = (loteId: string, lugarId: string) =>
  stockLoteEnLugar(movimientosT.all(), loteId, lugarId)

beforeEach(async () => {
  usuario('administrador')
  lugaresT.seed([box1, box2])
  await db.insumos.put(insumo)
  await db.lotes.bulkPut([lote('A', LUGAR_1), lote('B', LUGAR_2), lote('C', LUGAR_1)])
  movimientosT.seed([...iniciales])
  minimosT.seed(
    [LUGAR_1, LUGAR_2, LUGAR_3].map((lugarId) => ({
      insumoId: 'i1',
      lugarId,
      tenantId: TENANT_1,
      stockMinimo: 6,
      sincronizado: true,
    })),
  )
})

describe('separarDeBodega', () => {
  it('saldo positivo, negativo y cero: Box 2 queda en 0 y Box 1 con todo', async () => {
    const traslados = await separarDeBodega(LUGAR_2)

    expect(traslados).toBe(2)
    for (const loteId of ['A', 'B', 'C']) expect(stockEn(loteId, LUGAR_2)).toBe(0)
    expect(stockEn('A', LUGAR_1)).toBe(6)
    expect(stockEn('B', LUGAR_1)).toBe(3)
    expect(stockEn('C', LUGAR_1)).toBe(5)
  })

  it('los traslados son pares con el mismo trasladoId y el sentido del saldo', async () => {
    await separarDeBodega(LUGAR_2)

    const nuevos = movimientosT.all().slice(iniciales.length)
    const delA = nuevos.filter((m) => m.loteId === 'A')
    const delB = nuevos.filter((m) => m.loteId === 'B')
    // A (−4): sale de Box 1 y entra en Box 2.
    expect(delA).toMatchObject([
      { tipo: 'traslado_salida', lugarId: LUGAR_1, cantidad: 4 },
      { tipo: 'traslado_entrada', lugarId: LUGAR_2, cantidad: 4 },
    ])
    // B (+3): sale de Box 2 y entra en Box 1.
    expect(delB).toMatchObject([
      { tipo: 'traslado_salida', lugarId: LUGAR_2, cantidad: 3 },
      { tipo: 'traslado_entrada', lugarId: LUGAR_1, cantidad: 3 },
    ])
    for (const par of [delA, delB]) {
      expect(par[0].trasladoId).toBeTruthy()
      expect(par[0].trasladoId).toBe(par[1].trasladoId)
      expect(par.every((m) => m.usuarioId === 'u1' && !m.sincronizado)).toBe(true)
    }
  })

  it('no toca el historial: los movimientos anteriores siguen iguales', async () => {
    await separarDeBodega(LUGAR_2)

    expect(movimientosT.all().slice(0, iniciales.length)).toEqual(iniciales)
  })

  it('en una bodega de dos, ninguno queda compartiendo', async () => {
    await separarDeBodega(LUGAR_2)

    expect(lugaresT.all().map((l) => [l.id, l.bodegaId, l.sincronizado])).toEqual([
      [LUGAR_1, null, false],
      [LUGAR_2, null, false],
    ])
  })

  it('en una bodega de tres, los otros dos siguen compartiendo el stock común', async () => {
    lugaresT.seed([box1, box2, box3])
    await separarDeBodega(LUGAR_2)

    const lugares = lugaresT.all()
    expect(lugares.map((l) => l.bodegaId)).toEqual(['b', null, 'b'])
    const resto = lugaresDeBodega(LUGAR_1, lugares)
    expect(resto).toEqual(new Set([LUGAR_1, LUGAR_3]))
    expect(stockLoteEnBodega(movimientosT.all(), 'A', resto)).toBe(6)
    expect(stockLoteEnBodega(movimientosT.all(), 'B', resto)).toBe(3)
  })

  it('el lugar separado conserva el mínimo de la bodega', async () => {
    await separarDeBodega(LUGAR_2)

    expect(minimoEfectivoBodega(insumo, new Set([LUGAR_2]), minimosT.all())).toBe(6)
  })

  it('rechaza un lugar que no comparte y al personal', async () => {
    lugaresT.seed([lugar1, lugar2])
    await expect(separarDeBodega(LUGAR_2)).rejects.toThrow(/no comparte/)

    lugaresT.seed([box1, box2])
    usuario('personal')
    await expect(separarDeBodega(LUGAR_2)).rejects.toThrow(/administrador/)
    expect(movimientosT.all()).toEqual(iniciales)
  })
})

describe('desactivar un lugar que comparte bodega (FR-010)', () => {
  it('primero lo separa: el stock común queda en el lugar activo', async () => {
    await desactivarLugar(LUGAR_2)

    const lugares = lugaresT.all()
    expect(lugares.find((l) => l.id === LUGAR_2)).toMatchObject({ bodegaId: null })
    expect(lugares.find((l) => l.id === LUGAR_2)?.desactivadoEn).toBeTruthy()
    expect(lugares.find((l) => l.id === LUGAR_1)?.bodegaId).toBeNull()
    expect(stockEn('A', LUGAR_1) + stockEn('B', LUGAR_1) + stockEn('C', LUGAR_1)).toBe(14)
    for (const loteId of ['A', 'B', 'C']) expect(stockEn(loteId, LUGAR_2)).toBe(0)
  })
})
