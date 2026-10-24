import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioInsumo,
  Insumo,
  Lote,
  MinimoLugar,
  Movimiento,
  UsuarioActual,
} from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  convertirUnidadConsumo,
  presentacionTrasConversion,
  validarConversion,
} from '../../../src/features/insumos/lib/conversion'
import {
  computeStockLote,
  movimientosNormalizadosDeLote,
} from '../../../src/features/insumos/lib/stock'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

const guantes: Insumo = {
  id: 'g',
  tenantId: TENANT_1,
  nombre: 'Guantes',
  categoria: 'Protección',
  unidadMedida: 'caja',
  unidadCompra: 'caja',
  contenido: 1,
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 2,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  marcaId: null,
  creadoPor: null,
}

function lote(id: string, lugarId = LUGAR_1): Lote {
  return {
    id,
    tenantId: TENANT_1,
    lugarId,
    insumoId: 'g',
    numeroLote: id,
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'caja',
    precioCompra: null,
  }
}

let n = 0
function mov(loteId: string, tipo: Movimiento['tipo'], cantidad: number, unidad = 'caja', lugarId = LUGAR_1): Movimiento {
  n += 1
  return {
    tratamientoRealizadoId: null,
    id: `m${n}`,
    tenantId: TENANT_1,
    lugarId,
    trasladoId: null,
    tipo,
    loteId,
    cantidad,
    unidad,
    usuarioId: 'u1',
    movimientoOrigenId: null,
    creadoEn: `2026-01-0${n % 9}T00:00:00.000Z`,
    sincronizado: true,
  }
}

beforeEach(() => {
  useAuthStore.setState({ usuario: admin, isReady: true })
  insumosT.seed([guantes])
  cambiosT.seed([])
  lotesT.seed([lote('l1'), lote('l2', LUGAR_2)])
  movimientosT.seed([mov('l1', 'ingreso', 3), mov('l2', 'ingreso', 1, 'caja', LUGAR_2)])
  minimosT.seed([
    { insumoId: 'g', lugarId: LUGAR_2, tenantId: TENANT_1, stockMinimo: 1, sincronizado: true },
  ])
})

describe('validarConversion (Edge Cases)', () => {
  it('rechaza la misma unidad, factores inválidos y unidades fuera del catálogo', () => {
    expect(validarConversion(guantes, { hasta: 'caja', factor: 2 }, [], [])).toMatch(/distinta/)
    expect(validarConversion(guantes, { hasta: 'unidad', factor: 0 }, [], [])).toMatch(/mayor que cero/)
    expect(validarConversion(guantes, { hasta: 'pieza', factor: 2 }, [], [])).toMatch(/válida/)
  })

  it('rechaza si el stock de algún lote no queda entero, con el conteo', () => {
    const cartuchos = { unidadMedida: 'cartucho' }
    expect(validarConversion(cartuchos, { hasta: 'caja', factor: 1 / 50 }, [120, 100], [])).toMatch(
      /El stock de 1 lote no es múltiplo/,
    )
    expect(validarConversion(cartuchos, { hasta: 'caja', factor: 1 / 50 }, [100, 50], [])).toBeNull()
  })

  it('rechaza si el mínimo no queda entero', () => {
    expect(
      validarConversion({ unidadMedida: 'cartucho' }, { hasta: 'caja', factor: 1 / 50 }, [100], [30]),
    ).toMatch(/stock mínimo/)
  })

  it('con una unidad decimal, todo vale', () => {
    expect(validarConversion(guantes, { hasta: 'mL', factor: 0.3 }, [1], [1])).toBeNull()
  })
})

describe('presentacionTrasConversion', () => {
  it('propone comprar por la unidad anterior × factor', () => {
    expect(
      presentacionTrasConversion(guantes, { hasta: 'unidad', factor: 100, actualizarPresentacion: true }),
    ).toEqual({ unidadCompra: 'caja', contenido: 100 })
  })

  it('sin presentación, la nueva unidad también es la de compra', () => {
    expect(
      presentacionTrasConversion(guantes, { hasta: 'unidad', factor: 100, actualizarPresentacion: false }),
    ).toEqual({ unidadCompra: 'unidad', contenido: 1 })
  })

  it('con otra presentación, escala el contenido', () => {
    expect(
      presentacionTrasConversion(
        { unidadMedida: 'cartucho', unidadCompra: 'caja', contenido: 50 },
        { hasta: 'mL', factor: 1.8, actualizarPresentacion: false },
      ),
    ).toEqual({ unidadCompra: 'caja', contenido: 90 })
  })
})

describe('convertirUnidadConsumo (FR-007a, US1-4)', () => {
  it('3 cajas → 300 unidades: escribe el factor, convierte mínimos y no reescribe movimientos', async () => {
    await convertirUnidadConsumo('g', { hasta: 'unidad', factor: 100, actualizarPresentacion: true })

    expect(cambiosT.all().map((c) => [c.campo, c.valorAnterior, c.valorNuevo, c.factor])).toEqual([
      ['unidadMedida', 'caja', 'unidad', 100],
      ['stockMinimo', 2, 200, null],
      ['contenido', 1, 100, null],
    ])
    expect(insumosT.all()[0]).toMatchObject({
      unidadMedida: 'unidad',
      unidadCompra: 'caja',
      contenido: 100,
      stockMinimo: 200,
    })
    expect(minimosT.all()[0]).toMatchObject({ stockMinimo: 100, sincronizado: false })
    // Los movimientos siguen en cajas; leídos, valen unidades.
    expect(movimientosT.all().map((m) => [m.cantidad, m.unidad])).toEqual([
      [3, 'caja'],
      [1, 'caja'],
    ])
    expect(computeStockLote(await movimientosNormalizadosDeLote('l1'))).toBe(300)
    expect(computeStockLote(await movimientosNormalizadosDeLote('l2'))).toBe(100)
  })

  it('un consumo offline en la unidad anterior, sincronizado después, cuenta convertido', async () => {
    await convertirUnidadConsumo('g', { hasta: 'unidad', factor: 100, actualizarPresentacion: true })
    movimientosT.seed([...movimientosT.all(), mov('l1', 'consumo', 1, 'caja')])
    expect(computeStockLote(await movimientosNormalizadosDeLote('l1'))).toBe(200)
  })

  it('rechaza una conversión que no da entero y no escribe nada', async () => {
    await expect(
      convertirUnidadConsumo('g', { hasta: 'paquete', factor: 0.5, actualizarPresentacion: false }),
    ).rejects.toThrow(/múltiplo/)
    expect(cambiosT.all()).toEqual([])
    expect(minimosT.all()[0].stockMinimo).toBe(1)
  })

  it('solo administración', async () => {
    useAuthStore.setState({ usuario: { ...admin, rol: 'personal' }, isReady: true })
    await expect(
      convertirUnidadConsumo('g', { hasta: 'unidad', factor: 100, actualizarPresentacion: true }),
    ).rejects.toThrow(/administrador/)
  })
})
