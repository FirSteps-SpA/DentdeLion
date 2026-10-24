import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioTratamiento,
  Insumo,
  Lote,
  Movimiento,
  TratamientoRealizado,
  UsuarioActual,
} from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  const { tablasMemoria } = await import('../../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})
vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import { runSyncBatch } from '../../../src/lib/sync'
import {
  anularTratamiento,
  registrarTratamiento,
  StockInsuficienteError,
} from '../../../src/features/tratamientos/lib/registro'
import type { TratamientoProyectado } from '../../../src/features/tratamientos/lib/proyeccion'
import {
  computeStockLote,
  movimientosNormalizadosDeLote,
} from '../../../src/features/insumos/lib/stock'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'
import { usarLugar1 } from '../../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>
const cambiosTratamientoT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>

const usuario: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'p1',
  email: 'p@x.cl',
  nombre: 'Paula',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

function insumo(id: string, unidadMedida: string, extra: Partial<Insumo> = {}): Insumo {
  return {
    id,
    tenantId: TENANT_1,
    nombre: id === 'art' ? 'Articaína' : 'Resina',
    categoria: 'X',
    unidadMedida,
    unidadCompra: unidadMedida,
    contenido: 1,
    permiteDecimales: unidadMedida === 'g',
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
    ...extra,
  }
}

function lote(id: string, insumoId: string, fechaCaducidad: string | null, precioCompra: number | null, lugarId = LUGAR_1): Lote {
  return {
    id,
    tenantId: TENANT_1,
    lugarId,
    insumoId,
    numeroLote: id,
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: insumoId === 'art' ? 'cartucho' : 'g',
    precioCompra,
  }
}

function ingreso(loteId: string, cantidad: number, unidad: string, lugarId = LUGAR_1): Movimiento {
  return {
    id: `ing-${loteId}`,
    tenantId: TENANT_1,
    lugarId,
    trasladoId: null,
    tipo: 'ingreso',
    loteId,
    cantidad,
    unidad,
    tratamientoRealizadoId: null,
    usuarioId: 'p1',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

const restauracion: TratamientoProyectado = {
  id: 't1',
  nombre: 'Restauración clase II',
  activo: true,
  materiales: [
    { insumoId: 'art', cantidad: 1, unidad: 'cartucho' },
    { insumoId: 'res', cantidad: 2, unidad: 'g' },
  ],
  precios: new Map([[LUGAR_1, 45000]]),
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'admin',
}

const stock = async (loteId: string, lugarId = LUGAR_1) =>
  computeStockLote((await movimientosNormalizadosDeLote(loteId)).filter((m) => m.lugarId === lugarId))

beforeEach(() => {
  usarLugar1()
  useAuthStore.setState({ usuario, isReady: true })
  insumosT.seed([insumo('art', 'cartucho'), insumo('res', 'g')])
  lotesT.seed([
    lote('a1', 'art', '2027-01-01', 650),
    lote('r1', 'res', '2026-12-01', 1200),
    lote('r2', 'res', '2027-06-01', 1200),
  ])
  movimientosT.seed([ingreso('a1', 10, 'cartucho'), ingreso('r1', 1.5, 'g'), ingreso('r2', 5, 'g')])
  realizadosT.seed([])
  cambiosTratamientoT.seed([
    {
      id: 'pct',
      tenantId: TENANT_1,
      tratamientoId: null,
      lugarId: LUGAR_1,
      campo: 'porcentajeProfesional',
      valorAnterior: null,
      valorNuevo: 40,
      usuarioId: 'admin',
      creadoEn: '2026-01-01T00:00:00.000Z',
      sincronizado: true,
      rechazadoEn: null,
    },
  ])
})

describe('registrarTratamiento (spec 016 US3, R4)', () => {
  it('crea el registro con su snapshot y descuenta por FEFO repartiendo entre lotes', async () => {
    const registro = await registrarTratamiento(restauracion)

    expect(registro).toMatchObject({
      lugarId: LUGAR_1,
      precio: 45000,
      porcentajeProfesional: 40,
      costoMateriales: 650 + 2 * 1200,
      costoCompleto: true,
      gananciaEstimada: 18000 - 3050,
      usuarioId: 'p1',
      anuladoEn: null,
      sincronizado: false,
    })
    expect(registro.materiales).toEqual([
      { insumoId: 'art', nombre: 'Articaína', cantidad: 1, unidad: 'cartucho', costoUnitario: 650 },
      { insumoId: 'res', nombre: 'Resina', cantidad: 2, unidad: 'g', costoUnitario: 1200 },
    ])
    const consumos = movimientosT.all().filter((m) => m.tipo === 'consumo')
    expect(consumos.map((m) => [m.loteId, m.cantidad, m.unidad, m.tratamientoRealizadoId])).toEqual([
      ['a1', 1, 'cartucho', registro.id],
      ['r1', 1.5, 'g', registro.id],
      ['r2', 0.5, 'g', registro.id],
    ])
    expect(await stock('r1')).toBe(0)
    expect(await stock('r2')).toBe(4.5)
  })

  it('las cantidades se pueden ajustar; 0 no genera movimiento', async () => {
    const registro = await registrarTratamiento(restauracion, { cantidades: { art: 0, res: 3 } })
    const consumos = movimientosT.all().filter((m) => m.tipo === 'consumo')
    expect(consumos.map((m) => m.loteId)).toEqual(['r1', 'r2'])
    expect(registro.materiales[0]).toMatchObject({ cantidad: 0 })
  })

  it('si falta stock lanza el detalle y no escribe nada (FR-014/FR-015)', async () => {
    const error = await registrarTratamiento(restauracion, { cantidades: { res: 9 } }).catch((e) => e)
    expect(error).toBeInstanceOf(StockInsuficienteError)
    expect((error as StockInsuficienteError).faltantes).toEqual([
      expect.objectContaining({ insumoId: 'res', pedido: 9, disponible: 6.5, soloCaducado: false }),
    ])
    expect(realizadosT.all()).toEqual([])
    expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toEqual([])
  })

  it('no usa lotes caducados y avisa si solo hay caducado', async () => {
    lotesT.seed([lote('a1', 'art', '2020-01-01', 650), lote('r2', 'res', '2027-06-01', 1200)])
    movimientosT.seed([ingreso('a1', 10, 'cartucho'), ingreso('r2', 5, 'g')])
    const error = await registrarTratamiento(restauracion).catch((e) => e)
    expect((error as StockInsuficienteError).faltantes).toEqual([
      expect.objectContaining({ insumoId: 'art', disponible: 0, soloCaducado: true }),
    ])
  })

  it('no descuenta del stock de otro lugar (SC-004)', async () => {
    lotesT.seed([lote('a1', 'art', null, 650, LUGAR_2), lote('r2', 'res', null, 1200)])
    movimientosT.seed([ingreso('a1', 10, 'cartucho', LUGAR_2), ingreso('r2', 5, 'g')])
    await expect(registrarTratamiento(restauracion)).rejects.toBeInstanceOf(StockInsuficienteError)
  })

  it('un insumo dado de baja no se descuenta y queda con cantidad 0', async () => {
    insumosT.seed([insumo('art', 'cartucho', { dadoDeBajaEn: '2026-02-01' }), insumo('res', 'g')])
    const registro = await registrarTratamiento(restauracion)
    expect(registro.materiales[0]).toMatchObject({ insumoId: 'art', cantidad: 0, dadoDeBaja: true })
    expect(movimientosT.all().some((m) => m.tipo === 'consumo' && m.loteId === 'a1')).toBe(false)
  })

  it('sin precio en el lugar: guarda el costo y deja la ganancia en null', async () => {
    const registro = await registrarTratamiento({ ...restauracion, precios: new Map() })
    expect(registro).toMatchObject({ precio: null, gananciaEstimada: null, costoMateriales: 3050 })
  })

  it('cambiar el precio después no altera los registros previos (SC-003)', async () => {
    const primero = await registrarTratamiento(restauracion)
    const segundo = await registrarTratamiento({ ...restauracion, precios: new Map([[LUGAR_1, 50000]]) })
    expect(segundo).toMatchObject({ precio: 50000, gananciaEstimada: 20000 - 3050 })
    expect(realizadosT.all().find((r) => r.id === primero.id)).toMatchObject({
      precio: 45000,
      gananciaEstimada: 18000 - 3050,
    })
  })

  it('sin red queda pendiente de subir', async () => {
    const registro = await registrarTratamiento(restauracion)
    await expect(runSyncBatch()).resolves.toMatchObject({ estado: 'sin-red' })
    expect(realizadosT.all().find((r) => r.id === registro.id)?.sincronizado).toBe(false)
  })
})

describe('rendimiento (plan)', () => {
  it('un registro de 10 materiales repartidos entre lotes tarda menos de 300 ms', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `m${i}`)
    insumosT.seed(ids.map((id) => insumo(id, 'cartucho')))
    lotesT.seed(
      ids.flatMap((id) =>
        [1, 2, 3].map((n) => ({ ...lote(`${id}-${n}`, id, `2027-0${n}-01`, 500), unidadConsumo: 'cartucho' })),
      ),
    )
    movimientosT.seed(ids.flatMap((id) => [1, 2, 3].map((n) => ingreso(`${id}-${n}`, 2, 'cartucho'))))
    const grande: TratamientoProyectado = {
      ...restauracion,
      materiales: ids.map((insumoId) => ({ insumoId, cantidad: 5, unidad: 'cartucho' })),
    }

    const inicio = performance.now()
    const registro = await registrarTratamiento(grande)
    expect(performance.now() - inicio).toBeLessThan(300)
    expect(registro.costoMateriales).toBe(10 * 5 * 500)
    expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(30)
  })
})

describe('anularTratamiento (US3-6, R5)', () => {
  it('revierte cada consumo con un ajuste vinculado y marca el registro; es idempotente', async () => {
    const registro = await registrarTratamiento(restauracion)
    const ajustes = await anularTratamiento(registro.id)

    expect(ajustes?.map((m) => [m.tipo, m.loteId, m.cantidad, m.tratamientoRealizadoId])).toEqual([
      ['ajuste', 'a1', 1, registro.id],
      ['ajuste', 'r1', 1.5, registro.id],
      ['ajuste', 'r2', 0.5, registro.id],
    ])
    expect(await stock('a1')).toBe(10)
    expect(await stock('r1')).toBe(1.5)
    expect(realizadosT.all()[0]).toMatchObject({
      anuladoPor: 'p1',
      anulacionSincronizada: false,
    })
    expect(await anularTratamiento(registro.id)).toBeNull()
    expect(movimientosT.all().filter((m) => m.tipo === 'ajuste')).toHaveLength(3)
  })
})
