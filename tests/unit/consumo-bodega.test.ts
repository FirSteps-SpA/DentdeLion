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
import {
  registrarConsumo,
  StockInsuficienteConsumoError,
} from '../../src/features/insumos/lib/consumo'
import {
  ajustarStockLotes,
  filasStockPorLote,
  stockVencidoEnLugar,
} from '../../src/features/insumos/lib/ajusteStock'
import { guardarMinimoLugar } from '../../src/features/insumos/lib/minimos'
import {
  destinosDeTraslado,
  trasladar,
  validarTraslado,
} from '../../src/features/insumos/lib/traslado'
import { stockLoteEnBodega, stockLoteEnLugar } from '../../src/features/insumos/lib/stock'
import { useAuthStore } from '../../src/stores/authStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 033 T010 (US2, research.md R3/R4, FR-016): con Box 1 y Box 2 en la
 * misma bodega, todo lo que valida stock usa el común, y el mínimo se escribe
 * en los dos lugares.
 */
const LUGAR_3 = '00000000-0000-4000-8000-000000000013'
const box1: Lugar = { ...lugar1, bodegaId: 'bodega-b' }
const box2: Lugar = { ...lugar2, bodegaId: 'bodega-b' }
const box3: Lugar = { ...lugar2, id: LUGAR_3, nombre: 'Las Condes', creadoEn: '2026-03-01T00:00:00.000Z' }

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>

const insumo = {
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Guantes',
  unidadMedida: 'unidad',
  stockMinimo: 2,
  caduca: true,
  permiteDecimales: false,
} as unknown as Insumo

const lote = {
  id: 'l1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  insumoId: 'i1',
  numeroLote: 'L1',
  fechaCaducidad: '2099-01-01',
  creadoEn: '2026-01-01T00:00:00.000Z',
} as Lote

const ingreso: Movimiento = {
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  id: 'ing',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  tipo: 'ingreso',
  loteId: 'l1',
  cantidad: 10,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
}

const BODEGA = new Set([LUGAR_1, LUGAR_2])
const comun = () => stockLoteEnBodega(movimientosT.all(), 'l1', BODEGA)

function usarBodega(activo: string, lugares: Lugar[] = [box1, box2, box3]) {
  useLugarStore.setState({ lugares, lugarActivoId: activo, isReady: true })
}

beforeEach(async () => {
  vi.restoreAllMocks()
  usarBodega(LUGAR_2)
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      tenantId: TENANT_1,
      desactivadoEn: null,
      email: 'u@x.cl',
      nombre: 'U',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  await db.lugares.bulkPut([box1, box2, box3])
  await db.insumos.put(insumo)
  await db.lotes.put(lote)
  movimientosT.seed([ingreso])
  minimosT.seed([])
})

describe('consumo contra el stock común', () => {
  it('consume en Box 2 un lote ingresado en Box 1', async () => {
    const movimiento = await registrarConsumo({ insumo, loteId: 'l1', cantidad: 4 })

    expect(movimiento).toMatchObject({ tipo: 'consumo', lugarId: LUGAR_2, cantidad: 4 })
    expect(comun()).toBe(6)
    // El saldo propio de Box 2 queda negativo; la bodega no.
    expect(stockLoteEnLugar(movimientosT.all(), 'l1', LUGAR_2)).toBe(-4)
  })

  it('no deja pasar del stock común', async () => {
    await expect(registrarConsumo({ insumo, loteId: 'l1', cantidad: 11 })).rejects.toBeInstanceOf(
      StockInsuficienteConsumoError,
    )
    expect(movimientosT.all()).toEqual([ingreso])
  })

  it('sin bodega compartida, Box 2 no tiene stock (FR-019)', async () => {
    usarBodega(LUGAR_2, [lugar1, lugar2])
    await expect(registrarConsumo({ insumo, loteId: 'l1', cantidad: 1 })).rejects.toBeInstanceOf(
      StockInsuficienteConsumoError,
    )
  })
})

describe('ajuste de stock contra el stock común', () => {
  it('Editar en Box 2 muestra y corrige el stock de la bodega', async () => {
    const filas = filasStockPorLote(insumo, [lote], movimientosT.all(), LUGAR_2, [box1, box2, box3])
    expect(filas).toMatchObject([{ lugarId: LUGAR_2, stock: 10 }])

    await ajustarStockLotes('i1', [{ loteId: 'l1', lugarId: LUGAR_2, cantidad: 7 }])

    expect(comun()).toBe(7)
  })

  it('en "Todos", un renglón por bodega con su rótulo', () => {
    const filas = filasStockPorLote(insumo, [lote], movimientosT.all(), 'todos', [box1, box2, box3])
    expect(filas).toMatchObject([
      { lugarId: LUGAR_1, nombreLugar: 'Clínica + Box Las Condes', stock: 10 },
    ])
  })

  it('un lote vencido de la bodega se ofrece descartar al recibir en Box 2', () => {
    const vencido = { ...lote, fechaCaducidad: '2020-01-01' }
    expect(stockVencidoEnLugar(insumo, [vencido], movimientosT.all(), LUGAR_2)).toMatchObject([
      { stock: 10 },
    ])
  })
})

describe('traslados (FR-016)', () => {
  const datos = () => ({ insumo, lugares: [box1, box2, box3], movimientos: movimientosT.all() })

  it('los destinos excluyen la bodega del origen', () => {
    expect(destinosDeTraslado(LUGAR_2, [box1, box2, box3]).map((l) => l.id)).toEqual([LUGAR_3])
    expect(destinosDeTraslado(LUGAR_2, [box1, box2])).toEqual([])
  })

  it('rechaza un destino de la misma bodega', () => {
    expect(
      validarTraslado({ loteId: 'l1', origenId: LUGAR_2, destinoId: LUGAR_1, cantidad: 1 }, datos()),
    ).toMatch(/comparte bodega/)
  })

  it('desde Box 2 traslada stock que entró en Box 1', async () => {
    await trasladar(insumo, { loteId: 'l1', origenId: LUGAR_2, destinoId: LUGAR_3, cantidad: 4 })

    expect(comun()).toBe(6)
    expect(stockLoteEnLugar(movimientosT.all(), 'l1', LUGAR_3)).toBe(4)
    expect(
      validarTraslado({ loteId: 'l1', origenId: LUGAR_2, destinoId: LUGAR_3, cantidad: 7 }, datos()),
    ).toMatch(/Stock insuficiente/)
  })
})

describe('mínimo de la bodega (R4)', () => {
  it('editar en Box 2 escribe la misma fila en Box 1 y Box 2', async () => {
    await guardarMinimoLugar(insumo, LUGAR_2, 5)

    expect(
      minimosT
        .all()
        .map((m) => [m.lugarId, m.stockMinimo])
        .sort(),
    ).toEqual([
      [LUGAR_1, 5],
      [LUGAR_2, 5],
    ])
  })
})
