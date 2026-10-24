import { describe, expect, it } from 'vitest'
import { computeAlertasCaducidad } from '../../../src/features/alertas/lib/caducidad'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

const HOY = new Date('2026-09-09T12:00:00Z')

function fechaEnDias(dias: number): string {
  const fecha = new Date(HOY)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function makeInsumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'mL',
    contenido: 1,
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
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'insumo-1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    proveedorId: null,
    fechaCaducidad: fechaEnDias(30),
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeIngreso(loteId: string, cantidad: number): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'usuario-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
  }
}

const NIVELES = [30, 7, 1]

describe('computeAlertasCaducidad', () => {
  it('assigns the 30-day tier to a lote 25 days from expiry', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ fechaCaducidad: fechaEnDias(25) })
    const movimientos = [makeIngreso(lote.id, 10)]

    const alertas = computeAlertasCaducidad(
      [insumo],
      [lote],
      movimientos,
      NIVELES,
      HOY,
    )

    expect(alertas).toHaveLength(1)
    expect(alertas[0].nivel).toBe(30)
  })

  it('assigns the 7-day tier to a lote 5 days from expiry (not 30)', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ fechaCaducidad: fechaEnDias(5) })
    const movimientos = [makeIngreso(lote.id, 10)]

    const alertas = computeAlertasCaducidad(
      [insumo],
      [lote],
      movimientos,
      NIVELES,
      HOY,
    )

    expect(alertas[0].nivel).toBe(7)
  })

  it('assigns the 1-day tier to a lote expiring today', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ fechaCaducidad: fechaEnDias(0) })
    const movimientos = [makeIngreso(lote.id, 10)]

    const alertas = computeAlertasCaducidad(
      [insumo],
      [lote],
      movimientos,
      NIVELES,
      HOY,
    )

    expect(alertas[0].nivel).toBe(1)
  })

  it('marks an already-expired lote as caducado', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ fechaCaducidad: fechaEnDias(-3) })
    const movimientos = [makeIngreso(lote.id, 10)]

    const alertas = computeAlertasCaducidad(
      [insumo],
      [lote],
      movimientos,
      NIVELES,
      HOY,
    )

    expect(alertas[0].nivel).toBe('caducado')
  })

  it('generates no alert for a lote outside every configured nivel', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ fechaCaducidad: fechaEnDias(90) })
    const movimientos = [makeIngreso(lote.id, 10)]

    expect(
      computeAlertasCaducidad([insumo], [lote], movimientos, NIVELES, HOY),
    ).toEqual([])
  })

  it('excludes lotes of an insumo marked as caduca: false', () => {
    const insumo = makeInsumo({ caduca: false })
    const lote = makeLote({ fechaCaducidad: fechaEnDias(0) })
    const movimientos = [makeIngreso(lote.id, 10)]

    expect(
      computeAlertasCaducidad([insumo], [lote], movimientos, NIVELES, HOY),
    ).toEqual([])
  })

  it('excludes a lote with no stock disponible, regardless of fecha', () => {
    const insumo = makeInsumo({})
    const lote = makeLote({ fechaCaducidad: fechaEnDias(-1) })
    const movimientos = [
      makeIngreso(lote.id, 10),
      {
        id: crypto.randomUUID(),
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        trasladoId: null,
        tipo: 'consumo' as const,
        loteId: lote.id,
        cantidad: 10,
        unidad: 'unidad',
        tratamientoRealizadoId: null,
        usuarioId: 'usuario-1',
        movimientoOrigenId: null,
        creadoEn: new Date().toISOString(),
        sincronizado: true,
      },
    ]

    expect(
      computeAlertasCaducidad([insumo], [lote], movimientos, NIVELES, HOY),
    ).toEqual([])
  })
})
