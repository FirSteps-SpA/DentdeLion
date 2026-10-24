import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import type { Insumo, Lote, Movimiento } from '../../src/lib/db'

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
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

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
  stockMinimo: 10,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}

const lote: Lote = {
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  id: 'lote-1',
  insumoId: insumo.id,
  numeroLote: 'A-1',
  proveedor: 'Proveedor X',
  proveedorId: null,
  fechaCaducidad: '2028-01-01',
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: new Date().toISOString(),
}

function ingreso(cantidad: number): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'ingreso',
    loteId: lote.id,
    cantidad,
    usuarioId: 'user-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
  }
}

function consumo(cantidad: number): Movimiento {
  return {
    tratamientoRealizadoId: null,
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id: crypto.randomUUID(),
    tipo: 'consumo',
    loteId: lote.id,
    cantidad,
    usuarioId: 'user-1',
    movimientoOrigenId: null,
    creadoEn: new Date().toISOString(),
    sincronizado: true,
  }
}

afterEach(() => {
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [], isReady: true })
  useAuthStore.setState({ usuario: null, isReady: true })
})

describe('AlertasView reactivity (FR-011)', () => {
  it('reflects a new movimiento without remounting the component', () => {
    useAuthStore.setState({
      usuario: {
        tenantId: TENANT_1,
        desactivadoEn: null,
        id: 'user-1',
        email: 'a@a.com',
        nombre: 'Persona',
        rol: 'personal',
        autenticadoEn: new Date().toISOString(),
      },
      isReady: true,
    })
    useInventoryStore.setState({
      insumos: [insumo],
      lotes: [lote],
      movimientos: [ingreso(15)],
      isReady: true,
    })

    render(<AlertasView />)

    expect(
      screen.getByText(/Ningún insumo está por debajo de su stock mínimo/),
    ).toBeInTheDocument()

    // Simulate a new consumo movimiento being written locally (e.g. by
    // ConsumoForm) — AlertasView must re-render with the updated alert list
    // purely from the Zustand store update, with no remount/prop change.
    act(() => {
      useInventoryStore.setState({
        insumos: [insumo],
        lotes: [lote],
        movimientos: [ingreso(15), consumo(10)],
        isReady: true,
      })
    })

    expect(screen.getByText(/Anestesia local/)).toBeInTheDocument()
    expect(
      screen.queryByText(/Ningún insumo está por debajo de su stock mínimo/),
    ).not.toBeInTheDocument()
  })

  it('no longer shows the stock-mínimo/niveles-de-aviso config controls, even for an administrador (spec 010 FR-006/007/008)', () => {
    useAuthStore.setState({
      usuario: {
        tenantId: TENANT_1,
        desactivadoEn: null,
        id: 'admin-1',
        email: 'admin@a.com',
        nombre: 'Admin',
        rol: 'administrador',
        autenticadoEn: new Date().toISOString(),
      },
      isReady: true,
    })
    useInventoryStore.setState({
      insumos: [insumo],
      lotes: [lote],
      movimientos: [ingreso(15)],
      isReady: true,
    })

    render(<AlertasView />)

    expect(
      screen.queryByText('Configurar stock mínimo por insumo'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Configurar niveles de aviso de caducidad'),
    ).not.toBeInTheDocument()
  })
})
