import { describe, expect, it } from 'vitest'
import { computeEstadoInsumo } from '../../../src/features/insumos/lib/estado'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

const HOY = new Date('2026-09-09T12:00:00Z')
const NIVELES = [30, 7, 1]

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
    id: crypto.randomUUID(),
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
    fechaCaducidad: fechaEnDias(60),
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeIngreso(loteId: string, cantidad: number): Movimiento {
  return {
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

describe('computeEstadoInsumo', () => {
  it('resolves ok when nothing is caducado, próximo, or bajo stock', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 5 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(90) })
    const movimientos = [makeIngreso('l1', 10)]

    const [resultado] = computeEstadoInsumo([insumo], [lote], movimientos, NIVELES, HOY)

    expect(resultado.estado).toBe('ok')
    expect(resultado.stockTotal).toBe(10)
    expect(resultado.loteMasProximoAVencer?.id).toBe('l1')
  })

  it('resolves bajo-stock when stock is below mínimo and nothing is próximo/caducado', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 20 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(90) })
    const movimientos = [makeIngreso('l1', 5)]

    const [resultado] = computeEstadoInsumo([insumo], [lote], movimientos, NIVELES, HOY)

    expect(resultado.estado).toBe('bajo-stock')
  })

  it('resolves proximo-a-caducar for a lote within a configured nivel', () => {
    const insumo = makeInsumo({ id: 'i1' })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(5) })
    const movimientos = [makeIngreso('l1', 10)]

    const [resultado] = computeEstadoInsumo([insumo], [lote], movimientos, NIVELES, HOY)

    expect(resultado.estado).toBe('proximo-a-caducar')
  })

  it('resolves caducado for an already-expired lote with stock disponible', () => {
    const insumo = makeInsumo({ id: 'i1' })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(-2) })
    const movimientos = [makeIngreso('l1', 10)]

    const [resultado] = computeEstadoInsumo([insumo], [lote], movimientos, NIVELES, HOY)

    expect(resultado.estado).toBe('caducado')
  })

  it('prioritizes caducado over bajo-stock when both apply', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 20 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(-1) })
    const movimientos = [makeIngreso('l1', 3)]

    const [resultado] = computeEstadoInsumo([insumo], [lote], movimientos, NIVELES, HOY)

    expect(resultado.estado).toBe('caducado')
  })

  it('prioritizes proximo-a-caducar over bajo-stock when both apply', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 20 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(5) })
    const movimientos = [makeIngreso('l1', 3)]

    const [resultado] = computeEstadoInsumo([insumo], [lote], movimientos, NIVELES, HOY)

    expect(resultado.estado).toBe('proximo-a-caducar')
  })
})
