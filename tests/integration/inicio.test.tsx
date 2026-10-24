import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Insumo, ItemCompra, Lote, Movimiento } from '../../src/lib/db'

vi.mock('../../src/lib/db', () => ({
  db: {
    insumos: { add: vi.fn() },
    lotes: { add: vi.fn() },
    movimientos: { add: vi.fn() },
    configuracionAlertas: {
      get: async () => undefined,
      put: async () => undefined,
    },
  },
}))

vi.mock('../../src/stores/authStore', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/stores/authStore')>()
  return { ...actual, getUsuarioActualId: () => 'u1' }
})

import { AppShell } from '../../src/app/AppShell'
import type { Vista } from '../../src/app/navegacion'
import { InicioView } from '../../src/features/inicio/components/InicioView'
import { resumenInicio } from '../../src/features/inicio/lib/resumenInicio'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const enDias = (d: number) => {
  const hoy = new Date()
  return new Date(
    Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + d),
  )
    .toISOString()
    .slice(0, 10)
}
function insumo(
  id: string,
  nombre: string,
  extra: Partial<Insumo> = {},
): Insumo {
  return {
    unidadCompra: 'u',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'General',
    unidadMedida: 'u',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: 'x',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...extra,
  }
}
const lote = (id: string, insumoId: string, fecha: string | null): Lote => ({
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id,
  insumoId,
  numeroLote: id.toUpperCase(),
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: fecha,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: 'x',
})
const ingreso = (loteId: string, cantidad: number): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  id: `m-${loteId}`,
  tipo: 'ingreso',
  loteId,
  cantidad,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: 'x',
  sincronizado: true,
})
const item: ItemCompra = {
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'c1',
  nombre: 'Microbrush',
  cantidad: 2,
  nota: null,
  insumoId: null,
  estado: 'pendiente',
  creadoPor: 'u1',
  creadoEn: 'x',
  compradoPor: null,
  compradoEn: null,
}

function Harness() {
  const [vista, setVista] = useState<Vista>('inicio')
  return (
    <AppShell vista={vista} onCambiarVista={setVista}>
      {vista === 'inicio' && <InicioView onNavegar={setVista} />}
      {vista === 'compras' && <ComprasView />}
      {vista === 'alertas' && <AlertasView />}
    </AppShell>
  )
}

function sembrar() {
  const insumos = [
    insumo('a', 'Anestesia articaína', { stockMinimo: 10 }),
    insumo('g', 'Guantes nitrilo', { stockMinimo: 5, caduca: false }),
    insumo('x', 'Ácido grabador'),
    ...Array.from({ length: 4 }, (_, i) =>
      insumo(`n${i}`, `Extra ${i}`, { stockMinimo: 3 }),
    ),
  ]
  const lotes = [
    lote('la', 'a', enDias(3)),
    lote('lg', 'g', null),
    lote('lx', 'x', enDias(-2)),
  ]
  const movimientos = [ingreso('la', 4), ingreso('lg', 2), ingreso('lx', 1)]
  useInventoryStore.setState({
    insumos,
    lotes,
    movimientos,
    itemsCompra: [item],
    isReady: true,
  })
  return { insumos, lotes, movimientos }
}

beforeEach(() => {
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'u1',
      email: 's@x.cl',
      nombre: 'Sofía León',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  useAlertasStore.setState({
    nivelesAvisoDias: [30, 7, 1],
    preferenciaStockBajo: true,
    preferenciaCaducidad: true,
  })
})

afterEach(() => {
  useInventoryStore.setState({
    insumos: [],
    lotes: [],
    movimientos: [],
    itemsCompra: [],
    isReady: true,
  })
})

describe('Inicio (spec 013 US3)', () => {
  it('saluda y muestra los 4 KPIs con los números del resumen', () => {
    const datos = sembrar()
    const esperado = resumenInicio({
      ...datos,
      itemsCompra: [item],
      nivelesAvisoDias: [30, 7, 1],
      preferencias: { stockBajo: true, caducidad: true },
    })
    render(<Harness />)

    expect(
      screen.getByRole('heading', { name: '¡Hola, Sofía!' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `Productos bajo mínimo: ${esperado.bajoMinimo}. Ver Alertas`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `Próximos a vencer: ${esperado.porVencer}. Ver Alertas`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `Para comprar: ${esperado.paraComprar}. Ver Compras`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `Alertas: ${esperado.alertas}. Ver Alertas`,
      }),
    ).toBeInTheDocument()
  })

  it('las tarjetas llevan a Alertas y a Compras', () => {
    sembrar()
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', { name: /^Productos bajo mínimo/ }),
    )
    expect(
      screen.getByRole('heading', { name: 'Stock bajo' }),
    ).toBeInTheDocument()

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole(
        'button',
        { name: /Inicio/ },
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: /^Para comprar/ }))
    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument()
  })

  it('la lista de alertas tiene a lo sumo 5 ítems y "Ver todas" lleva a Alertas', () => {
    sembrar()
    render(<Harness />)

    const lista = screen.getByRole('region', { name: 'Alertas' })
    expect(within(lista).getAllByRole('listitem').length).toBeLessThanOrEqual(5)
    expect(within(lista).getByText('Ácido grabador')).toBeInTheDocument()
    fireEvent.click(within(lista).getByRole('button', { name: /Ver todas/ }))
    expect(
      screen.getByRole('heading', { name: 'Próximos a caducar' }),
    ).toBeInTheDocument()
  })

  it('muestra los próximos vencimientos y la tarjeta de compra', () => {
    sembrar()
    render(<Harness />)

    const vencimientos = screen.getByRole('region', {
      name: 'Próximos vencimientos',
    })
    // Spec 018 FR-007: "caducado hace", como en Alertas.
    expect(
      within(vencimientos).getByText(/caducado hace 2 días/),
    ).toBeInTheDocument()
    expect(
      within(vencimientos).getByText(/vence en 3 días/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver lista de compra' }))
    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument()
  })

  it('spec 018: alertas y vencimientos sin lote; tocar uno abre el detalle y cerrarlo vuelve', () => {
    sembrar()
    render(<Harness />)

    const alertas = screen.getByRole('region', { name: 'Alertas' })
    const vencimientos = screen.getByRole('region', { name: 'Próximos vencimientos' })
    for (const region of [alertas, vencimientos]) {
      expect(region.textContent).not.toMatch(/Lote|LA|LX/)
    }
    expect(
      within(vencimientos).getByText(new RegExp(`· vence en 3 días`)),
    ).toBeInTheDocument()

    fireEvent.click(
      within(vencimientos).getByRole('button', { name: /Ver detalle de Anestesia articaína/ }),
    )
    const hoja = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    expect(within(hoja).getByText(/Lote LA/)).toBeInTheDocument()
    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '¡Hola, Sofía!' })).toBeInTheDocument()
  })

  it('spec 018: un insumo sin stock dice "Sin stock", nunca "Stock crítico"', () => {
    sembrar()
    render(<Harness />)

    const alertas = screen.getByRole('region', { name: 'Alertas' })
    const extra = within(alertas).getByRole('button', { name: /Ver detalle de Extra 0/ })
    expect(within(extra).getByText('Sin stock')).toBeInTheDocument()
    expect(alertas.textContent).not.toMatch(/Stock crítico/)
  })

  it('sin datos: ceros, "Todo en orden" y sin tarjeta de compra', () => {
    useInventoryStore.setState({
      insumos: [],
      lotes: [],
      movimientos: [],
      itemsCompra: [],
      isReady: true,
    })
    render(<Harness />)

    expect(
      screen.getByRole('button', {
        name: 'Productos bajo mínimo: 0. Ver Alertas',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Todo en orden')).toBeInTheDocument()
    expect(screen.getByText('Sin vencimientos próximos')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ver lista de compra' }),
    ).not.toBeInTheDocument()
  })
})
