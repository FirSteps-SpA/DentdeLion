import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { Insumo, Lote, MinimoLugar, Movimiento, UsuarioActual } from '../../src/lib/db'

vi.mock('../../src/lib/db', () => ({
  db: {
    insumos: { get: async () => undefined, update: async () => undefined },
    lotes: { update: async () => undefined },
    configuracionAlertas: { get: async () => undefined, put: async () => undefined },
  },
}))

import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { usarDosLugares, usarLugar1 } from '../helpers/lugarFalso'

/**
 * Spec 018 — Alertas: textos de caducidad sin lote (US2, FR-006–FR-010),
 * "Sin stock" (US3, FR-011) y detalle del insumo desde la alerta (FR-009).
 */

// Mediodía en Chile: el "hoy" local es el 22 de octubre en cualquier zona razonable.
const AHORA = new Date('2026-10-22T15:00:00Z')

const persona: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'user-1',
  email: 'a@a.com',
  nombre: 'Persona',
  rol: 'personal',
  autenticadoEn: AHORA.toISOString(),
}

function insumo(id: string, nombre: string, extra: Partial<Insumo> = {}): Insumo {
  return {
    unidadCompra: 'unidad',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'Farmacia',
    unidadMedida: 'unidad',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: AHORA.toISOString(),
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...extra,
  }
}

function lote(id: string, insumoId: string, numeroLote: string, fecha: string | null): Lote {
  return {
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: 'unidad',
    precioCompra: null,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id,
    insumoId,
    numeroLote,
    proveedor: 'Proveedor X',
    fechaCaducidad: fecha,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: AHORA.toISOString(),
  }
}

function ingreso(loteId: string, cantidad: number, lugarId = LUGAR_1): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'user-1',
    movimientoOrigenId: null,
    creadoEn: AHORA.toISOString(),
    sincronizado: true,
  }
}

function consumo(loteId: string, cantidad: number, lugarId = LUGAR_1): Movimiento {
  return { ...ingreso(loteId, cantidad, lugarId), id: crypto.randomUUID(), tipo: 'consumo' }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AHORA)
  useAuthStore.setState({ usuario: persona, isReady: true })
  useAlertasStore.setState({ nivelesAvisoDias: [90, 30, 7, 1], isReady: true })
  usarLugar1()
})

afterEach(() => {
  vi.useRealTimers()
  useInventoryStore.setState({
    insumos: [],
    lotes: [],
    movimientos: [],
    minimosLugar: [],
    isReady: true,
  })
  useAuthStore.setState({ usuario: null, isReady: true })
})

function seccion(titulo: string): HTMLElement {
  return screen.getByRole('heading', { name: titulo }).closest('section') as HTMLElement
}

describe('Alertas de caducidad (spec 018 US2)', () => {
  const lidocaina = insumo('lido', 'Lidocaína 2 %')
  const guantes = insumo('guantes', 'Guantes M')
  const resina = insumo('resina', 'Resina A2')
  const lotes = [
    lote('l1', 'lido', 'L-1', '2026-11-03'), // +12 días
    lote('l2', 'lido', 'L-2', '2027-01-05'), // +75 días
    lote('g1', 'guantes', 'G-1', '2026-10-22'), // hoy
    lote('r1', 'resina', 'R-1', '2026-10-17'), // −5 días
  ]

  beforeEach(() => {
    useInventoryStore.setState({
      insumos: [lidocaina, guantes, resina],
      lotes,
      movimientos: lotes.map((l) => ingreso(l.id, 10)),
      minimosLugar: [],
      isReady: true,
    })
  })

  it('muestra nombre, fecha legible y tiempo restante, sin lote ni nivel', () => {
    render(<AlertasView />)
    const caducidad = seccion('Próximos a caducar')

    expect(within(caducidad).getByText(/3 nov 2026 · vence en 12 días/)).toBeInTheDocument()
    expect(within(caducidad).getByText(/5 ene 2027 · vence en 2 meses/)).toBeInTheDocument()
    expect(within(caducidad).getByText(/22 oct 2026 · vence hoy/)).toBeInTheDocument()
    expect(within(caducidad).getByText(/17 oct 2026 · caducado hace 5 días/)).toBeInTheDocument()
    expect(within(caducidad).getAllByText('Lidocaína 2 %')).toHaveLength(2)

    expect(caducidad.textContent).not.toMatch(/lote/i)
    expect(caducidad.textContent).not.toMatch(/nivel/)
    expect(caducidad.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(caducidad.textContent).not.toMatch(/L-1|L-2|G-1|R-1/)
  })

  it('mantiene la etiqueta y el color de caducado', () => {
    render(<AlertasView />)
    const renglon = screen.getByRole('button', { name: /Ver detalle de Resina A2/ })
    const badge = within(renglon).getByText('Caducado')
    expect(badge.closest('span')?.className).toMatch(/bg-danger-bg/)
  })

  it('tocar una alerta abre el detalle con los lotes y cerrarlo vuelve a Alertas', () => {
    render(<AlertasView />)
    const [renglon] = screen.getAllByRole('button', { name: /Ver detalle de Lidocaína 2 %/ })
    fireEvent.click(renglon)

    const hoja = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    expect(within(hoja).getByText(/Lote L-1/)).toBeInTheDocument()
    expect(within(hoja).getByText(/Lote L-2/)).toBeInTheDocument()
    // La hoja trae su "Cerrar"; el detalle no repite el suyo.
    expect(within(hoja).queryByLabelText('Cerrar detalle')).not.toBeInTheDocument()

    fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos a caducar' })).toBeInTheDocument()
  })

  it('la etiqueta del nivel de 1 día va en singular', () => {
    useInventoryStore.setState({
      insumos: [guantes],
      lotes: [lote('g2', 'guantes', 'G-2', '2026-10-23')],
      movimientos: [ingreso('g2', 10)],
      minimosLugar: [],
      isReady: true,
    })
    render(<AlertasView />)
    const renglon = screen.getByRole('button', { name: /Ver detalle de Guantes M/ })
    expect(within(renglon).getByText('vence en 1 día', { exact: false })).toBeInTheDocument()
    expect(within(renglon).getByText('1 día')).toBeInTheDocument()
  })

  it('los renglones son objetivos táctiles de 48 px (Constitución III)', () => {
    render(<AlertasView />)
    for (const renglon of screen.getAllByRole('button', { name: /Ver detalle de/ })) {
      expect(renglon.className).toMatch(/touch-target/)
    }
  })
})

describe('Alertas de stock bajo (spec 018 US3)', () => {
  const algodon = insumo('algodon', 'Algodón', { caduca: false, stockMinimo: 5 })
  const eyectores = insumo('eyectores', 'Eyectores', { caduca: false, stockMinimo: 5 })

  it('con stock 0 dice "Sin stock" y con algo bajo el mínimo, "Bajo mínimo"', () => {
    const lotes = [lote('a1', 'algodon', 'A-1', null), lote('e1', 'eyectores', 'E-1', null)]
    useInventoryStore.setState({
      insumos: [algodon, eyectores],
      lotes,
      movimientos: [ingreso('a1', 3), consumo('a1', 3), ingreso('e1', 2)],
      minimosLugar: [],
      isReady: true,
    })
    render(<AlertasView />)

    const sinStock = screen.getByRole('button', { name: /Ver detalle de Algodón/ })
    expect(within(sinStock).getByText('Sin stock').closest('span')?.className).toMatch(
      /bg-danger-bg/,
    )
    expect(within(sinStock).queryByText('Bajo mínimo')).not.toBeInTheDocument()

    const bajo = screen.getByRole('button', { name: /Ver detalle de Eyectores/ })
    expect(within(bajo).getByText('Bajo mínimo').closest('span')?.className).toMatch(
      /bg-warning-30-bg/,
    )

    fireEvent.click(bajo)
    expect(screen.getByRole('dialog', { name: 'Detalle del insumo' })).toBeInTheDocument()
  })

  it('en "Todos", cada lugar con su etiqueta, su chip y sus lotes en el detalle', () => {
    usarDosLugares('todos')
    const loteL1 = lote('a1', 'algodon', 'A-1', null)
    const loteL2 = { ...lote('a2', 'algodon', 'A-2', null), lugarId: LUGAR_2 }
    const minimos: MinimoLugar[] = []
    useInventoryStore.setState({
      insumos: [algodon],
      lotes: [loteL1, loteL2],
      movimientos: [
        ingreso('a1', 3),
        consumo('a1', 3),
        ingreso('a2', 2, LUGAR_2),
      ],
      minimosLugar: minimos,
      isReady: true,
    })
    render(<AlertasView />)

    const renglones = within(seccion('Stock bajo')).getAllByRole('button', {
      name: /Ver detalle de Algodón/,
    })
    expect(renglones).toHaveLength(2)
    const clinica = renglones.find((r) => within(r).queryByText('Clínica'))!
    const box = renglones.find((r) => within(r).queryByText('Box Las Condes'))!
    expect(within(clinica).getByText('Sin stock')).toBeInTheDocument()
    expect(within(box).getByText('Bajo mínimo')).toBeInTheDocument()

    fireEvent.click(box)
    const hoja = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    expect(within(hoja).getByText(/Lote A-2/)).toBeInTheDocument()
    expect(within(hoja).queryByText(/Lote A-1/)).not.toBeInTheDocument()
  })
})
