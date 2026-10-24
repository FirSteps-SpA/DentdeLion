import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { db, type Insumo, type Lote, type Movimiento } from '../../src/lib/db'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { SelectorLugar } from '../../src/app/SelectorLugar'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1, lugar2, usarDosLugares, usarLugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 014 T039 (US2): con dos lugares, el selector cambia todo lo que se ve
 * sin recargar, y lo de un lugar no afecta al otro. Con un solo lugar no hay
 * selector. El lugar elegido se recuerda en el dispositivo (Dexie real en
 * memoria, `fake-indexeddb`).
 */
const insumo: Insumo = {
  unidadCompra: 'cartucho',
  contenido: 1,
  id: 'insumo-1',
  tenantId: TENANT_1,
  nombre: 'Anestesia local',
  categoria: 'Farmacia',
  unidadMedida: 'cartucho',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 5,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}

const lote = (id: string, lugarId: string): Lote => ({
  cantidadIngresada: null,
  unidadIngresada: null,
  contenido: 1,
  unidadConsumo: 'unidad',
  precioCompra: null,
  id,
  tenantId: TENANT_1,
  lugarId,
  insumoId: insumo.id,
  numeroLote: id,
  proveedor: 'P',
  proveedorId: null,
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-01-01T00:00:00.000Z',
})

const ingreso = (loteId: string, lugarId: string, cantidad: number): Movimiento => ({
  tratamientoRealizadoId: null,
  unidad: 'unidad',
  id: crypto.randomUUID(),
  tenantId: TENANT_1,
  lugarId,
  trasladoId: null,
  tipo: 'ingreso',
  loteId,
  cantidad,
  usuarioId: 'u1',
  movimientoOrigenId: null,
  creadoEn: '2026-10-01T00:00:00.000Z',
  sincronizado: true,
})

function sembrar() {
  // Lugar 1: 10 cartuchos (sobre el mínimo). Lugar 2: 2 (bajo el mínimo).
  useInventoryStore.setState({
    insumos: [insumo],
    lotes: [lote('l1', LUGAR_1), lote('l2', LUGAR_2)],
    movimientos: [ingreso('l1', LUGAR_1, 10), ingreso('l2', LUGAR_2, 2)],
    itemsCompra: [],
    minimosLugar: [],
    isReady: true,
  })
}

beforeEach(() => {
  useAuthStore.setState({
    usuario: {
      id: 'u1',
      tenantId: TENANT_1,
      desactivadoEn: null,
      email: 'u@x.cl',
      nombre: 'U',
      rol: 'personal',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
  sembrar()
})

afterEach(() => {
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [], minimosLugar: [] })
  useLugarStore.setState({ lugares: [], lugarActivoId: null, isReady: false })
})

const SIN_ALERTA = /Ningún insumo está por debajo de su stock mínimo/

describe('varios lugares (spec 014 US2)', () => {
  it('cambiar de lugar cambia las alertas sin recargar, y un lugar no afecta al otro', () => {
    usarDosLugares(LUGAR_1)
    render(
      <>
        <SelectorLugar />
        <AlertasView />
      </>,
    )
    expect(screen.getByText(SIN_ALERTA)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Lugar de trabajo: Clínica/ }))
    const menu = screen.getByRole('dialog', { name: 'Lugar de trabajo' })
    fireEvent.click(within(menu).getByRole('button', { name: /Box Las Condes/ }))

    expect(screen.getByRole('button', { name: /Lugar de trabajo: Box Las Condes/ })).toBeInTheDocument()
    expect(screen.queryByText(SIN_ALERTA)).not.toBeInTheDocument()
    expect(screen.getByText(/Anestesia local/)).toBeInTheDocument()
  })

  it('un mínimo propio del lugar cambia solo las alertas de ese lugar (FR-007)', () => {
    usarDosLugares(LUGAR_1)
    useInventoryStore.setState({
      minimosLugar: [
        { insumoId: insumo.id, lugarId: LUGAR_1, tenantId: TENANT_1, stockMinimo: 20, sincronizado: true },
      ],
    })
    render(<AlertasView />)
    expect(screen.queryByText(SIN_ALERTA)).not.toBeInTheDocument()

    act(() => useLugarStore.setState({ lugarActivoId: LUGAR_2 }))
    // En el lugar 2 rige el mínimo del catálogo (5) y hay 2: sigue la alerta,
    // pero por el stock del lugar 2, no por el mínimo del lugar 1.
    expect(screen.getByText(/Anestesia local/)).toBeInTheDocument()
  })

  it('con un solo lugar no hay selector, solo su nombre (US2-5)', () => {
    usarLugar1()
    render(<SelectorLugar />)

    expect(screen.queryByRole('button', { name: /Lugar de trabajo/ })).not.toBeInTheDocument()
    expect(screen.getByText('Clínica')).toBeInTheDocument()
  })

  it('recuerda el lugar elegido en el dispositivo (US2-6)', async () => {
    await db.usuarioActual.put(useAuthStore.getState().usuario!)
    await db.lugares.bulkPut([lugar1, lugar2])

    await useLugarStore.getState().setLugarActivo(LUGAR_2)
    useLugarStore.setState({ lugares: [], lugarActivoId: null, isReady: false })

    const detener = useLugarStore.getState().subscribe()
    await esperarA(() => useLugarStore.getState().isReady)
    expect(useLugarStore.getState().lugarActivoId).toBe(LUGAR_2)
    detener()
  })
})

async function esperarA(condicion: () => boolean) {
  for (let i = 0; i < 50 && !condicion(); i++) {
    await new Promise((r) => setTimeout(r, 10))
  }
}
