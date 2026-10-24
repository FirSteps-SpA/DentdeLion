import { describe, expect, it } from 'vitest'
import type {
  ConfiguracionAlertas,
  Insumo,
  ItemCompra,
} from '../../../src/lib/db'
import type { CostoUnitario } from '../../../src/features/insumos/lib/precio'
import type { ItemSugerido } from '../../../src/features/compras/lib/sugeridos'
import {
  SALUDO_PEDIDO_POR_DEFECTO,
  claveManual,
  claveSugerido,
  construirMensajePedido,
  enlaceWhatsApp,
  itemsDelPedido,
  resumirSeleccion,
  saludoEfectivo,
  valorItem,
  type ItemPedido,
} from '../../../src/features/compras/lib/pedido'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 50,
    tenantId: TENANT_1,
    id: 'i1',
    nombre: 'Anestesia Articaína',
    categoria: 'Anestesia',
    unidadMedida: 'cartucho',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: 100,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function manual(overrides: Partial<ItemCompra>): ItemCompra {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: 'm1',
    nombre: 'Eyectores',
    cantidad: 3,
    nota: 'los azules',
    insumoId: null,
    estado: 'pendiente',
    creadoPor: 'user-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    compradoPor: null,
    compradoEn: null,
    ...overrides,
  }
}

function sugerido(ins: Insumo, presentaciones: number | null): ItemSugerido {
  return {
    insumo: ins,
    stockBajo: presentaciones !== null,
    caducado: presentaciones === null,
    presentacionesSugeridas: presentaciones,
  }
}

function costo(valor: number): CostoUnitario {
  return { costo: valor, loteId: 'l1', fecha: '2026-01-01T00:00:00.000Z' }
}

function pedido(overrides: Partial<ItemPedido>): ItemPedido {
  return {
    clave: 's:lugar:i1',
    origen: 'sugerido',
    nombre: 'Anestesia Articaína',
    lugarId: LUGAR_1,
    insumo: insumo({}),
    cantidad: 2,
    unidadCompra: 'caja',
    ...overrides,
  }
}

describe('saludoEfectivo (spec 022 FR-021)', () => {
  const base: ConfiguracionAlertas = {
    id: 'global',
    tenantId: TENANT_1,
    nivelesAvisoDias: [30],
    sincronizado: true,
  }

  it('usa el de la clienta sin fila, sin campo, con null o solo espacios', () => {
    expect(saludoEfectivo(undefined)).toBe(SALUDO_PEDIDO_POR_DEFECTO)
    expect(saludoEfectivo(base)).toBe(SALUDO_PEDIDO_POR_DEFECTO)
    expect(saludoEfectivo({ ...base, saludoPedido: null })).toBe(
      SALUDO_PEDIDO_POR_DEFECTO,
    )
    expect(saludoEfectivo({ ...base, saludoPedido: '   ' })).toBe(
      SALUDO_PEDIDO_POR_DEFECTO,
    )
  })

  it('usa el del tenant, recortado', () => {
    expect(saludoEfectivo({ ...base, saludoPedido: '  Hola Paula ' })).toBe(
      'Hola Paula',
    )
  })
})

describe('itemsDelPedido (spec 022 R2)', () => {
  it('arma sugeridos y luego manuales con su clave', () => {
    const articaina = insumo({})
    const guantes = insumo({
      id: 'i2',
      nombre: 'Guantes',
      unidadCompra: 'caja',
      contenido: 100,
    })
    const items = itemsDelPedido(
      [{ item: sugerido(articaina, 2), lugarId: LUGAR_1 }],
      [
        manual({}),
        manual({
          id: 'm2',
          nombre: 'Guantes M',
          insumoId: 'i2',
          cantidad: null,
        }),
      ],
      [articaina, guantes],
    )
    expect(items.map((i) => i.clave)).toEqual([
      claveSugerido(LUGAR_1, 'i1'),
      claveManual('m1'),
      claveManual('m2'),
    ])
    expect(items[0]).toMatchObject({
      origen: 'sugerido',
      cantidad: 2,
      unidadCompra: 'caja',
    })
    expect(items[1]).toMatchObject({
      origen: 'manual',
      insumo: null,
      unidadCompra: null,
      cantidad: 3,
    })
    expect(items[2]).toMatchObject({
      insumo: guantes,
      unidadCompra: 'caja',
      cantidad: null,
    })
  })

  it('un manual vinculado a un insumo dado de baja queda sin insumo', () => {
    const [item] = itemsDelPedido(
      [],
      [manual({ insumoId: 'baja' })],
      [insumo({})],
    )
    expect(item.insumo).toBeNull()
  })

  it('las claves distinguen lugares', () => {
    expect(claveSugerido(LUGAR_1, 'i1')).not.toBe(claveSugerido(LUGAR_2, 'i1'))
  })
})

describe('valorItem (spec 022 R3)', () => {
  const costos = new Map([['i1', costo(300)]])

  it('sugerido: cajas × costo unitario × contenido actual', () => {
    // 2 cajas × $300 el cartucho × 50 cartuchos por caja.
    expect(valorItem(pedido({}), costos)).toEqual({
      tipo: 'monto',
      monto: 30000,
    })
  })

  it('usa el contenido actual aunque el lote con precio fuera de otra presentación', () => {
    const cajaNueva = insumo({ contenido: 100 })
    expect(valorItem(pedido({ insumo: cajaNueva }), costos)).toEqual({
      tipo: 'monto',
      monto: 60000,
    })
  })

  it('sugerido solo caducado: sin cantidad', () => {
    expect(valorItem(pedido({ cantidad: null }), costos)).toEqual({
      tipo: 'sin-cantidad',
    })
  })

  it('manual sin insumo o insumo sin compras con precio: sin precio', () => {
    expect(
      valorItem(pedido({ origen: 'manual', insumo: null }), costos),
    ).toEqual({
      tipo: 'sin-precio',
    })
    expect(valorItem(pedido({}), new Map())).toEqual({ tipo: 'sin-precio' })
  })

  it('sin precio gana a sin cantidad', () => {
    expect(valorItem(pedido({ insumo: null, cantidad: null }), costos)).toEqual(
      {
        tipo: 'sin-precio',
      },
    )
  })

  it('precio 0 cuenta como precio', () => {
    expect(valorItem(pedido({}), new Map([['i1', costo(0)]]))).toEqual({
      tipo: 'monto',
      monto: 0,
    })
  })

  it('manual vinculado: su cantidad en unidades de compra', () => {
    expect(
      valorItem(pedido({ origen: 'manual', cantidad: 3 }), costos),
    ).toEqual({
      tipo: 'monto',
      monto: 45000,
    })
  })
})

describe('resumirSeleccion (spec 022 FR-004)', () => {
  it('suma solo lo seleccionado, sin redondear, y cuenta lo que no suma', () => {
    const costos = new Map([
      ['i1', costo(300.4)],
      ['i2', costo(10)],
    ])
    const items = [
      pedido({ clave: 'a' }),
      pedido({
        clave: 'b',
        insumo: insumo({ id: 'i2', contenido: 1 }),
        cantidad: 3,
      }),
      pedido({ clave: 'c', insumo: null }),
      pedido({ clave: 'd', cantidad: null }),
      pedido({ clave: 'e' }),
    ]
    expect(
      resumirSeleccion(items, new Set(['a', 'b', 'c', 'd']), costos),
    ).toEqual({
      seleccionados: 4,
      subtotal: 2 * 300.4 * 50 + 30,
      sinPrecio: 1,
      sinCantidad: 1,
    })
  })

  it('sin selección, todo en cero', () => {
    expect(resumirSeleccion([pedido({})], new Set(), new Map())).toEqual({
      seleccionados: 0,
      subtotal: 0,
      sinPrecio: 0,
      sinCantidad: 0,
    })
  })
})

describe('construirMensajePedido (spec 022 R5)', () => {
  const items = [
    pedido({}),
    pedido({
      clave: 'm',
      origen: 'manual',
      nombre: 'Eyectores',
      insumo: null,
      unidadCompra: null,
      cantidad: 3,
    }),
    pedido({ clave: 'x', nombre: 'Fresas diamante', cantidad: null }),
  ]

  it('saludo, línea en blanco y un renglón por ítem con su cantidad', () => {
    expect(construirMensajePedido('Hola', items)).toBe(
      [
        'Hola',
        '',
        '- Anestesia Articaína — 2 cajas',
        '- Eyectores — 3',
        '- Fresas diamante',
      ].join('\n'),
    )
  })

  it('nunca lleva precios ni el origen', () => {
    const mensaje = construirMensajePedido(SALUDO_PEDIDO_POR_DEFECTO, items)
    expect(mensaje).not.toMatch(/\$|Sugerido|Manual|azules/)
  })

  it('en "Todos", cada renglón lleva su lugar', () => {
    const nombres = new Map([
      [LUGAR_1, 'Providencia'],
      [LUGAR_2, 'Las Condes'],
    ])
    const mensaje = construirMensajePedido(
      'Hola',
      [pedido({}), pedido({ clave: 'y', lugarId: LUGAR_2 })],
      nombres,
    )
    expect(mensaje.split('\n').slice(2)).toEqual([
      '- Anestesia Articaína — 2 cajas (Providencia)',
      '- Anestesia Articaína — 2 cajas (Las Condes)',
    ])
  })
})

describe('enlaceWhatsApp (spec 022 R4)', () => {
  it('con número abre ese chat', () => {
    expect(enlaceWhatsApp('56912345678', 'Hola')).toBe(
      'https://wa.me/56912345678?text=Hola',
    )
  })

  it('sin número deja elegir el chat', () => {
    expect(enlaceWhatsApp(null, 'Hola')).toBe('https://wa.me/?text=Hola')
  })

  it('codifica tildes, ñ, &, #, ? y saltos de línea', () => {
    const mensaje = '¿Tienen?\n- Paños & gasas #2'
    const enlace = enlaceWhatsApp('56912345678', mensaje)
    expect(enlace).not.toMatch(/[\n&#ñ¿ ]|\?.*\?/)
    expect(decodeURIComponent(enlace.split('?text=')[1])).toBe(mensaje)
  })
})
