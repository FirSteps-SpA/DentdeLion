import { describe, expect, it, vi } from 'vitest'
import type { CambioInsumo, Insumo, Lote, Movimiento } from '../../src/lib/db'

vi.mock('../../src/lib/sync/reportar', () => ({ reportarErrorSync: vi.fn() }))

import { reportarErrorSync } from '../../src/lib/sync/reportar'
import {
  cantidadEnUnidadActual,
  computeStockLote,
  factoresDeUnidad,
  normalizarMovimientos,
} from '../../src/features/insumos/lib/stock'
import { TENANT_1, LUGAR_1 } from '../helpers/tenancy'

const insumo = (unidadMedida: string): Insumo => ({
  id: 'i1',
  tenantId: TENANT_1,
  nombre: 'Guantes',
  categoria: 'Protección',
  unidadMedida,
  unidadCompra: unidadMedida,
  contenido: 1,
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
})

let n = 0
function conversion(
  desde: string,
  hasta: string,
  factor: number | null,
  creadoEn: string,
  extra: Partial<CambioInsumo> = {},
): CambioInsumo {
  n += 1
  return {
    id: `c${n}`,
    tenantId: TENANT_1,
    insumoId: 'i1',
    campo: 'unidadMedida',
    valorAnterior: desde,
    valorNuevo: hasta,
    factor,
    usuarioId: 'admin',
    creadoEn,
    sincronizado: true,
    rechazadoEn: null,
    ...extra,
  }
}

function mov(tipo: Movimiento['tipo'], cantidad: number, unidad: string): Movimiento {
  n += 1
  return {
    id: `m${n}`,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    tipo,
    loteId: 'l1',
    cantidad,
    unidad,
    usuarioId: 'u1',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

const lote = { id: 'l1', insumoId: 'i1' } as Pick<Lote, 'id' | 'insumoId'>

describe('factoresDeUnidad (spec 015 R3)', () => {
  it('sin cambios, la unidad actual vale 1', () => {
    expect([...factoresDeUnidad(insumo('caja'), [])]).toEqual([['caja', 1]])
  })

  it('un cambio de etiqueta anterior a la spec (sin factor) vale 1', () => {
    const f = factoresDeUnidad(insumo('unidad'), [
      conversion('caja', 'unidad', null, '2026-01-02T00:00:00.000Z'),
    ])
    expect(f.get('caja')).toBe(1)
    expect(f.get('unidad')).toBe(1)
  })

  it('caja → unidad ×100: una caja vale 100 unidades', () => {
    const f = factoresDeUnidad(insumo('unidad'), [
      conversion('caja', 'unidad', 100, '2026-01-02T00:00:00.000Z'),
    ])
    expect(f.get('caja')).toBe(100)
    expect(f.get('unidad')).toBe(1)
  })

  it('compone una cadena caja → unidad ×100 → paquete ×0,1', () => {
    const f = factoresDeUnidad(insumo('paquete'), [
      conversion('caja', 'unidad', 100, '2026-01-02T00:00:00.000Z'),
      conversion('unidad', 'paquete', 0.1, '2026-01-03T00:00:00.000Z'),
    ])
    expect(f.get('caja')).toBeCloseTo(10)
    expect(f.get('unidad')).toBeCloseTo(0.1)
    expect(f.get('paquete')).toBe(1)
  })

  it('normaliza pieza → unidad en el ledger', () => {
    const f = factoresDeUnidad(insumo('caja'), [
      conversion('pieza', 'caja', 0.5, '2026-01-02T00:00:00.000Z'),
    ])
    expect(f.get('unidad')).toBe(0.5)
  })

  it('dos conversiones concurrentes desde caja dan lo mismo en cualquier orden de llegada', () => {
    const a = conversion('caja', 'unidad', 100, '2026-01-02T10:00:00.000Z')
    const b = conversion('caja', 'paquete', 10, '2026-01-02T10:05:00.000Z')
    const f1 = factoresDeUnidad(insumo('paquete'), [a, b])
    const f2 = factoresDeUnidad(insumo('paquete'), [b, a])
    expect([...f1].sort()).toEqual([...f2].sort())
    // Gana la última (paquete): 1 caja = 10 paquetes y 1 unidad = 0,1 paquete.
    expect(f1.get('caja')).toBeCloseTo(10)
    expect(f1.get('unidad')).toBeCloseTo(0.1)
  })

  it('una conversión rechazada no cambia la unidad, pero resuelve sus movimientos', () => {
    const f = factoresDeUnidad(insumo('caja'), [
      conversion('caja', 'unidad', 100, '2026-01-02T00:00:00.000Z', {
        rechazadoEn: '2026-01-03T00:00:00.000Z',
      }),
    ])
    expect(f.get('caja')).toBe(1)
    expect(f.get('unidad')).toBeCloseTo(0.01)
  })
})

describe('cantidadEnUnidadActual y normalizarMovimientos (spec 015 R4)', () => {
  it('un consumo offline en la unidad anterior cuenta convertido', () => {
    const cambios = [conversion('caja', 'unidad', 100, '2026-01-02T00:00:00.000Z')]
    const movimientos = [mov('ingreso', 3, 'caja'), mov('consumo', 1, 'caja'), mov('consumo', 5, 'unidad')]
    const normalizados = normalizarMovimientos(movimientos, [lote], [insumo('unidad')], cambios)
    expect(normalizados.map((m) => m.cantidad)).toEqual([300, 100, 5])
    expect(normalizados.map((m) => m.cantidadOriginal)).toEqual([3, 1, 5])
    expect(computeStockLote(normalizados)).toBe(195)
  })

  it('una unidad desconocida vale 1; solo se reporta si hubo una conversión real', () => {
    vi.mocked(reportarErrorSync).mockClear()
    const sinConversion = factoresDeUnidad(insumo('mL'), [])
    expect(cantidadEnUnidadActual(mov('ingreso', 4, 'unidad'), sinConversion)).toBe(4)
    expect(reportarErrorSync).not.toHaveBeenCalled()

    const conConversion = factoresDeUnidad(insumo('unidad'), [
      conversion('caja', 'unidad', 100, '2026-01-02T00:00:00.000Z'),
    ])
    expect(cantidadEnUnidadActual(mov('ingreso', 4, 'frasco'), conConversion)).toBe(4)
    expect(reportarErrorSync).toHaveBeenCalledTimes(1)
  })
})
