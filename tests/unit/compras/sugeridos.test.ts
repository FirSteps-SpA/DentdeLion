import { describe, expect, it } from 'vitest'
import { computeItemsSugeridos } from '../../../src/features/compras/lib/sugeridos'
import type { Insumo, Lote, Movimiento } from '../../../src/lib/db'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

function makeInsumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Guantes de nitrilo',
    categoria: 'Protección',
    unidadMedida: 'caja',
    permiteDecimales: false,
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
    fechaCaducidad: '2027-01-01',
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeMovimiento(overrides: Partial<Movimiento>): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
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

// Construye la fecha a partir de los componentes LOCALES de hoy (sin pasar
// por un instante UTC): `caducidad.ts`'s `diasEntre` compara contra
// `Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())` — hacerlo
// distinto (p. ej. `Date.now() ± 24h` seguido de `.toISOString()`) puede
// desfasarse un día en cualquier huso horario detrás de UTC.
function fechaLocalEnDias(dias: number): string {
  const hoy = new Date()
  const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias)
  const yyyy = fecha.getFullYear()
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const AYER = fechaLocalEnDias(-1)
const EN_10_DIAS = fechaLocalEnDias(10)

describe('computeItemsSugeridos', () => {
  it('flags an insumo with stock bajo, sin caducado', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 10 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: EN_10_DIAS })
    const movimientos = [makeMovimiento({ loteId: 'l1', cantidad: 5 })]

    const items = computeItemsSugeridos([insumo], [lote], movimientos)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ stockBajo: true, caducado: false })
  })

  it('flags an insumo with a lote caducado con stock, aunque el stock total supere el mínimo', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 5 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: AYER })
    const movimientos = [makeMovimiento({ loteId: 'l1', cantidad: 20 })]

    const items = computeItemsSugeridos([insumo], [lote], movimientos)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ stockBajo: false, caducado: true })
  })

  it('flags an insumo once with both booleans when it meets both conditions', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: 10 })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: AYER })
    const movimientos = [makeMovimiento({ loteId: 'l1', cantidad: 3 })]

    const items = computeItemsSugeridos([insumo], [lote], movimientos)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ stockBajo: true, caducado: true })
  })

  it('does not flag an insumo without stock mínimo nor lotes caducados', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: null })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: EN_10_DIAS })
    const movimientos = [makeMovimiento({ loteId: 'l1', cantidad: 100 })]

    expect(computeItemsSugeridos([insumo], [lote], movimientos)).toEqual([])
  })

  it('does not treat a lote "próximo a caducar" (not yet expired) as caducado', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: null })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: EN_10_DIAS })
    const movimientos = [makeMovimiento({ loteId: 'l1', cantidad: 5 })]

    expect(computeItemsSugeridos([insumo], [lote], movimientos)).toEqual([])
  })

  it('does not count a lote sin stock disponible as caducado', () => {
    const insumo = makeInsumo({ id: 'i1', stockMinimo: null })
    const lote = makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: AYER })
    const movimientos = [
      makeMovimiento({ loteId: 'l1', tipo: 'ingreso', cantidad: 5 }),
      makeMovimiento({ loteId: 'l1', tipo: 'consumo', cantidad: 5 }),
    ]

    expect(computeItemsSugeridos([insumo], [lote], movimientos)).toEqual([])
  })
})
