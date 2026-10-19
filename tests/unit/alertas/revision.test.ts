import { describe, expect, it, vi } from 'vitest'

const updateMock = vi.fn().mockResolvedValue(undefined)

vi.mock('../../../src/lib/db', () => ({
  db: {
    lotes: {
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}))

import {
  lotesEnRevision,
  marcarLoteResuelto,
} from '../../../src/features/alertas/lib/revision'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

function makeInsumo(overrides: Partial<Insumo>): Insumo {
  return {
    tenantId: TENANT_1,
    id: 'insumo-1',
    nombre: 'Anestesia local',
    categoria: 'Farmacia',
    unidadMedida: 'mL',
    permiteDecimales: true,
    caduca: true,
    codigoFabricante: null,
    creadoEn: new Date().toISOString(),
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function makeLote(overrides: Partial<Lote>): Lote {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'insumo-1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    fechaCaducidad: '2027-01-01',
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeMovimiento(overrides: Partial<Movimiento>): Movimiento {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId: 'lote-1',
    cantidad: 1,
    usuarioId: 'usuario-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
    ...overrides,
  }
}

describe('lotesEnRevision', () => {
  it('lists a lote en revisión with its negative stockDerivado', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ id: 'l1', estado: 'revision' })
    const movimientos = [
      makeMovimiento({ loteId: 'l1', tipo: 'ingreso', cantidad: 5 }),
      makeMovimiento({ loteId: 'l1', tipo: 'consumo', cantidad: 8 }),
    ]

    const alertas = lotesEnRevision([insumo], [lote], movimientos)

    expect(alertas).toHaveLength(1)
    expect(alertas[0].stockDerivado).toBe(-3)
  })

  it('excludes lotes with estado activo', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ id: 'l1', estado: 'activo' })
    const movimientos = [makeMovimiento({ loteId: 'l1', cantidad: 5 })]

    expect(lotesEnRevision([insumo], [lote], movimientos)).toEqual([])
  })
})

describe('marcarLoteResuelto', () => {
  it('writes estado: activo for the given lote', async () => {
    await marcarLoteResuelto('lote-x')

    expect(updateMock).toHaveBeenCalledWith('lote-x', { estado: 'activo' })
  })
})
