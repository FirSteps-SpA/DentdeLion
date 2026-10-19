import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'
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
import * as movements from '../../src/features/insumos/lib/movements'
import {
  deshacerTraslado,
  trasladar,
  validarTraslado,
} from '../../src/features/insumos/lib/traslado'
import { computeStockLote, stockLoteEnLugar } from '../../src/features/insumos/lib/stock'
import { useAuthStore } from '../../src/stores/authStore'
import { lugar1, lugar2, usarDosLugares } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/** Spec 014 T059 (US6, FR-022–FR-024, SC-008). */
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const insumo = {
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Guantes',
  unidadMedida: 'caja',
} as Insumo

const lote = {
  id: 'l1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  insumoId: 'i1',
  numeroLote: 'L1',
  fechaCaducidad: '2020-01-01',
} as Lote

const ingreso: Movimiento = {
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

const stock = (lugarId: string) => stockLoteEnLugar(movimientosT.all(), 'l1', lugarId)

beforeEach(async () => {
  vi.restoreAllMocks()
  usarDosLugares(LUGAR_1)
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      tenantId: TENANT_1,
      desactivadoEn: null,
      email: 'u@x.cl',
      nombre: 'U',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  await db.lugares.bulkPut([lugar1, lugar2])
  await db.lotes.put(lote)
  movimientosT.seed([ingreso])
})

describe('validarTraslado', () => {
  const datos = () => ({ insumo, lugares: [lugar1, lugar2], movimientos: [ingreso] })
  const base = { loteId: 'l1', origenId: LUGAR_1, destinoId: LUGAR_2, cantidad: 4 }

  it('acepta un traslado válido', () => {
    expect(validarTraslado(base, datos())).toBeNull()
  })

  it('rechaza el mismo lugar, un destino desactivado, el exceso y los decimales', () => {
    expect(validarTraslado({ ...base, destinoId: LUGAR_1 }, datos())).toMatch(/distinto/)
    expect(
      validarTraslado(base, {
        ...datos(),
        lugares: [lugar1, { ...lugar2, desactivadoEn: '2026-01-01' }],
      }),
    ).toMatch(/destino activo/)
    expect(validarTraslado({ ...base, cantidad: 11 }, datos())).toMatch(/Stock insuficiente/)
    expect(validarTraslado({ ...base, cantidad: 1.5 }, datos())).toMatch(/decimales/)
  })
})

describe('trasladar / deshacerTraslado', () => {
  it('escribe el par del mismo lote; el total no cambia (SC-008)', async () => {
    const [salida, entrada] = await trasladar(insumo, {
      loteId: 'l1',
      origenId: LUGAR_1,
      destinoId: LUGAR_2,
      cantidad: 4,
    })

    expect(salida).toMatchObject({ tipo: 'traslado_salida', lugarId: LUGAR_1, loteId: 'l1' })
    expect(entrada).toMatchObject({ tipo: 'traslado_entrada', lugarId: LUGAR_2, loteId: 'l1' })
    expect(salida.trasladoId).toBe(entrada.trasladoId)
    expect(stock(LUGAR_1)).toBe(6)
    expect(stock(LUGAR_2)).toBe(4)
    expect(computeStockLote(movimientosT.all())).toBe(10)
  })

  it('un lote caducado se puede trasladar (Edge Case)', async () => {
    await expect(
      trasladar(insumo, { loteId: 'l1', origenId: LUGAR_1, destinoId: LUGAR_2, cantidad: 1 }),
    ).resolves.toHaveLength(2)
  })

  it('si falla la segunda mitad no queda ninguna', async () => {
    const original = movements.crearMovimiento
    let llamadas = 0
    vi.spyOn(movements, 'crearMovimiento').mockImplementation(async (input) => {
      llamadas++
      if (llamadas === 2) throw new Error('boom')
      return original(input)
    })

    await expect(
      trasladar(insumo, { loteId: 'l1', origenId: LUGAR_1, destinoId: LUGAR_2, cantidad: 4 }),
    ).rejects.toThrow('boom')
    expect(movimientosT.all()).toEqual([ingreso])
  })

  it('deshacer devuelve el stock y un segundo deshacer no hace nada', async () => {
    const [salida] = await trasladar(insumo, {
      loteId: 'l1',
      origenId: LUGAR_1,
      destinoId: LUGAR_2,
      cantidad: 4,
    })

    const inverso = await deshacerTraslado(salida.id)
    expect(inverso?.[0]).toMatchObject({
      tipo: 'traslado_salida',
      lugarId: LUGAR_2,
      movimientoOrigenId: salida.id,
    })
    expect(stock(LUGAR_1)).toBe(10)
    expect(stock(LUGAR_2)).toBe(0)
    expect(await deshacerTraslado(salida.id)).toBeNull()
  })
})
