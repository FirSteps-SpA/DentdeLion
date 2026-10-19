import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'

let movimientosPorLote: Record<string, Movimiento[]> = {}
const movimientosAdd = vi.fn(async (movimiento: Movimiento) => {
  const lista = movimientosPorLote[movimiento.loteId] ?? []
  movimientosPorLote[movimiento.loteId] = [...lista, movimiento]
})

vi.mock('../../src/lib/db', () => ({
  db: {
    movimientos: {
      where: () => ({
        equals: (loteId: string) => ({
          toArray: async () => movimientosPorLote[loteId] ?? [],
        }),
      }),
      add: (...args: [Movimiento]) => movimientosAdd(...args),
    },
    // Spec 015: sin lote conocido, los movimientos se leen sin convertir.
    lotes: { get: async () => undefined },
  },
}))

vi.mock('../../src/stores/authStore', () => ({
  getUsuarioActualId: () => 'user-1',  // Spec 014: tenant de la clínica original (literal: el factory se iza).
  tenantActualOFallar: () => '00000000-0000-4000-8000-000000000001',
}))

import { ConsumoForm } from '../../src/features/insumos/components/ConsumoForm'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const insumo: Insumo = {
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
}

const loteProximo: Lote = {
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'lote-proximo',
  insumoId: insumo.id,
  numeroLote: 'A-1',
  proveedor: 'Proveedor X',
  fechaCaducidad: '2026-12-01',
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: new Date().toISOString(),
}

const loteLejano: Lote = {
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'lote-lejano',
  insumoId: insumo.id,
  numeroLote: 'A-2',
  proveedor: 'Proveedor X',
  fechaCaducidad: '2028-01-01',
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: new Date().toISOString(),
}

function ingreso(loteId: string, cantidad: number): Movimiento {
  return {
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId,
    cantidad,
    usuarioId: 'user-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
  }
}

afterEach(() => {
  vi.clearAllMocks()
  movimientosPorLote = {}
  useInventoryStore.setState({ insumos: [], lotes: [], isReady: true })
})

async function seleccionarInsumo() {
  render(<ConsumoForm />)
  fireEvent.change(screen.getByLabelText('Buscar insumo'), {
    target: { value: 'Anestesia' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Anestesia local/ }))
  await screen.findByLabelText(/Lote/)
}

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('ConsumoForm (User Story 2, quickstart Scenarios 2-3)', () => {
  it('descuenta por defecto del lote con fecha de caducidad más próxima (FR-006)', async () => {
    movimientosPorLote = {
      [loteProximo.id]: [ingreso(loteProximo.id, 5)],
      [loteLejano.id]: [ingreso(loteLejano.id, 20)],
    }
    useInventoryStore.setState({
      insumos: [insumo],
      lotes: [loteLejano, loteProximo],
      isReady: true,
    })

    await seleccionarInsumo()

    fireEvent.change(screen.getByLabelText(/Cantidad a consumir/), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar consumo' }))

    await waitFor(() => expect(movimientosAdd).toHaveBeenCalledTimes(1))
    expect(movimientosAdd.mock.calls[0][0]).toMatchObject({
      tipo: 'consumo',
      loteId: loteProximo.id,
      cantidad: 3,
      usuarioId: 'user-1',
    })
    expect(await screen.findByText(/registrado/)).toBeInTheDocument()
  })

  it('rechaza el sobreconsumo sin escribir movimiento y sin cambiar el stock (FR-007, SC-003)', async () => {
    movimientosPorLote = {
      [loteProximo.id]: [ingreso(loteProximo.id, 5)],
    }
    useInventoryStore.setState({
      insumos: [insumo],
      lotes: [loteProximo],
      isReady: true,
    })

    await seleccionarInsumo()

    fireEvent.change(screen.getByLabelText(/Cantidad a consumir/), {
      target: { value: '100' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar consumo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Stock insuficiente/,
    )
    expect(movimientosAdd).not.toHaveBeenCalled()
    expect(movimientosPorLote[loteProximo.id]).toHaveLength(1)
  })
})
