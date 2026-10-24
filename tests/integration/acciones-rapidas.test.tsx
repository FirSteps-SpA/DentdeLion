import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type {
  Marca,
  CambioInsumo,
  Insumo,
  Lote,
  Movimiento,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      categorias: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useAvisosStore, DURACION_AVISO_MS } from '../../src/stores/avisosStore'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { AlertasView } from '../../src/features/alertas/components/AlertasView'
import { ConsumoForm } from '../../src/features/insumos/components/ConsumoForm'
import { AvisosConsumo } from '../../src/app/AvisosConsumo'
import { computeStockLote } from '../../src/features/insumos/lib/stock'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>

function fechaEnDias(dias: number): string {
  const hoy = new Date()
  const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function insumo(
  id: string,
  nombre: string,
  overrides: Partial<Insumo> = {},
): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'Cirugía',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
    ...overrides,
  }
}

function lote(id: string, insumoId: string, dias: number | null): Lote {
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
    numeroLote: id.toUpperCase(),
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad: dias === null ? null : fechaEnDias(dias),
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
  }
}

function ingreso(loteId: string, cantidad: number): Movimiento {
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
    usuarioId: 'seed',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

const personal: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'personal-1',
  email: 'p@x.cl',
  nombre: 'Personal',
  rol: 'personal',
  autenticadoEn: 'x',
}
const admin: UsuarioActual = {
  ...personal,
  id: 'admin-1',
  rol: 'administrador',
}

/** Mirrors inventoryStore's liveQuery subscriptions (activos only). */
function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all().filter((i) => !i.dadoDeBajaEn),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    cambiosInsumo: cambiosT.all(),
    marcas: (db.marcas as unknown as MemoryTable<Marca>).all(),
    isReady: true,
  })
}

function seed() {
  insumosT.seed([
    insumo('a', 'Anestesia'),
    insumo('b', 'Bisturí'),
    insumo('c', 'Composite Viejo', { categoria: 'Restauración' }),
    insumo('d', 'Dique de Goma'),
    insumo('u', 'Aguja Única'),
  ])
  lotesT.seed([
    lote('a1', 'a', 60),
    lote('a2', 'a', 120),
    lote('b-cad', 'b', -3),
    lote('b-vig', 'b', 30),
    lote('c-cad', 'c', -10),
    lote('d1', 'd', 30),
    lote('u1', 'u', 30),
  ])
  movimientosT.seed([
    ingreso('a1', 5),
    ingreso('a2', 3),
    ingreso('b-cad', 2),
    ingreso('b-vig', 4),
    ingreso('c-cad', 2),
    ingreso('u1', 1),
  ])
  cambiosT.seed([])
  reflejarStore()
}

function stock(loteId: string): number {
  return computeStockLote(movimientosT.all().filter((m) => m.loteId === loteId))
}

function Harness() {
  const [vista, setVista] = useState<'inventario' | 'alertas'>('inventario')
  return (
    <div>
      <button type="button" onClick={() => setVista('inventario')}>
        Ir a Inventario
      </button>
      <button type="button" onClick={() => setVista('alertas')}>
        Ir a Alertas
      </button>
      {vista === 'inventario' ? <InventarioView /> : <AlertasView />}
      <AvisosConsumo />
    </div>
  )
}

function tarjeta(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest('li')!
}

beforeEach(() => {
  onMemoryDbChange(reflejarStore)
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
  useAuthStore.setState({ usuario: personal, isReady: true })
  useAvisosStore.setState({ avisos: [] })
  seed()
})

afterEach(() => {
  onMemoryDbChange(null)
  for (const a of useAvisosStore.getState().avisos)
    useAvisosStore.getState().descartar(a.id)
  vi.useRealTimers()
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('Consumir 1 (User Story 1)', () => {
  it('consumes 1 from the earliest vigente lot, attributed, with vibration and a notice', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
    render(<Harness />)

    fireEvent.click(
      within(tarjeta('Anestesia')).getByRole('button', {
        name: /Consumir 1 caja de Anestesia/,
      }),
    )

    await screen.findByText('Consumido 1 caja de Anestesia')
    expect(stock('a1')).toBe(4)
    expect(stock('a2')).toBe(3)
    expect(
      movimientosT.all().find((m) => m.tipo === 'consumo')?.usuarioId,
    ).toBe('personal-1')
    expect(within(tarjeta('Anestesia')).getByText('7 caja')).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalled()
  })

  it('never consumes from an expired lot', async () => {
    render(<Harness />)

    fireEvent.click(
      within(tarjeta('Bisturí')).getByRole('button', { name: /Consumir 1/ }),
    )

    await screen.findByText('Consumido 1 caja de Bisturí')
    expect(stock('b-cad')).toBe(2)
    expect(stock('b-vig')).toBe(3)
  })

  it('disables the button with the reason for expired-only and empty stock', () => {
    render(<Harness />)

    const c = within(tarjeta('Composite Viejo')).getByRole('button', {
      name: /Solo stock caducado/,
    })
    const d = within(tarjeta('Dique de Goma')).getByRole('button', {
      name: /Sin stock/,
    })
    expect(c).toBeDisabled()
    expect(c).toHaveTextContent('Solo stock caducado')
    expect(d).toBeDisabled()
    expect(d).toHaveTextContent('Sin stock')
  })

  it('two rapid taps on a 1-unit lot write a single consumo (never below 0)', async () => {
    render(<Harness />)
    const boton = within(tarjeta('Aguja Única')).getByRole('button', {
      name: /Consumir 1/,
    })

    fireEvent.click(boton)
    fireEvent.click(boton)

    await screen.findByText('Consumido 1 caja de Aguja Única')
    await waitFor(() =>
      expect(
        within(tarjeta('Aguja Única')).getByRole('button', {
          name: /Sin stock/,
        }),
      ).toBeDisabled(),
    )
    expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(
      1,
    )
    expect(stock('u1')).toBe(0)
  })

  it('updates the summary counts after a consume (FR-005)', async () => {
    const insumoMin = insumo('m', 'Mascarilla', { stockMinimo: 2 })
    insumosT.seed([...insumosT.all(), insumoMin])
    lotesT.seed([...lotesT.all(), lote('m1', 'm', 90)])
    movimientosT.seed([...movimientosT.all(), ingreso('m1', 2)])
    reflejarStore()
    render(<Harness />)
    const resumenStock = () =>
      screen
        .getAllByText('Bajo Stock')
        .find((el) => el.closest('button')?.textContent?.match(/\d/))!
        .closest('button')!

    const antes = resumenStock().textContent
    fireEvent.click(
      within(tarjeta('Mascarilla')).getByRole('button', { name: /Consumir 1/ }),
    )
    await screen.findByText('Consumido 1 caja de Mascarilla')

    expect(resumenStock().textContent).not.toBe(antes)
    expect(
      within(tarjeta('Mascarilla')).getByText('Bajo Stock'),
    ).toBeInTheDocument()
  })
})

describe('Deshacer (User Story 2)', () => {
  it('undoes exactly one unit per notice, survives navigation, and expires at 8 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness />)
    const boton = () =>
      within(tarjeta('Anestesia')).getByRole('button', { name: /Consumir 1/ })

    for (let n = 0; n < 3; n++) {
      fireEvent.click(boton())
      await waitFor(() =>
        expect(useAvisosStore.getState().avisos).toHaveLength(n + 1),
      )
    }
    expect(stock('a1')).toBe(2)

    const deshacerBotones = screen.getAllByRole('button', {
      name: /Deshacer consumo de Anestesia/,
    })
    expect(deshacerBotones).toHaveLength(3)
    fireEvent.click(deshacerBotones[2])
    fireEvent.click(deshacerBotones[2])
    await screen.findByText('Consumo revertido')
    expect(stock('a1')).toBe(3)

    fireEvent.click(screen.getByText('Ir a Alertas'))
    fireEvent.click(screen.getByText('Ir a Inventario'))
    expect(
      screen.getAllByRole('button', { name: /Deshacer consumo de Anestesia/ }),
    ).toHaveLength(2)

    const ajustes = () => movimientosT.all().filter((m) => m.tipo === 'ajuste')
    expect(ajustes()).toHaveLength(1)

    act(() => vi.advanceTimersByTime(DURACION_AVISO_MS))
    expect(
      screen.queryAllByRole('button', { name: /Deshacer consumo/ }),
    ).toHaveLength(0)
    expect(ajustes()).toHaveLength(1)
  })
})

describe('Menú y edición (User Story 3)', () => {
  it('shows only Ver detalle / Consumir otra cantidad to personal, via ⋮ or long press', () => {
    vi.useFakeTimers()
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Bisturí' }),
    )
    let menu = screen.getByRole('dialog', { name: 'Bisturí' })
    expect(within(menu).getByText('Ver detalle')).toBeInTheDocument()
    expect(within(menu).getByText('Consumir otra cantidad')).toBeInTheDocument()
    expect(within(menu).queryByText('Editar')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Eliminar')).not.toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('button', { name: 'Cerrar' }))

    const area = screen.getByText('Bisturí').closest('button')!
    fireEvent.pointerDown(area, { clientX: 5, clientY: 5 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.pointerUp(area)
    menu = screen.getByRole('dialog', { name: 'Bisturí' })
    expect(within(menu).queryByText('Editar')).not.toBeInTheDocument()
  })

  it('Consumir otra cantidad opens the full form preselected and closes after consuming', async () => {
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Bisturí' }),
    )
    fireEvent.click(screen.getByText('Consumir otra cantidad'))
    const panel = screen.getByRole('dialog', { name: 'Consumir Bisturí' })
    const select = await within(panel).findByLabelText(/Lote/)
    expect(
      within(panel).queryByPlaceholderText('Nombre del insumo'),
    ).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'b-cad' } })
    fireEvent.change(within(panel).getByLabelText(/Cantidad a consumir/), {
      target: { value: '1' },
    })
    fireEvent.click(
      within(panel).getByRole('button', { name: 'Confirmar consumo' }),
    )

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(stock('b-cad')).toBe(1)
  })

  it('admin edits stock mínimo, sees Bajo Stock, and field errors keep filters and input', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'an' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Anestesia' }),
    )
    fireEvent.click(screen.getByText('Editar'))
    const form = screen.getByRole('dialog', { name: 'Editar insumo' })
    expect(within(form).getByLabelText('Nombre comercial')).toHaveValue(
      'Anestesia',
    )

    fireEvent.change(within(form).getByLabelText('Nombre comercial'), {
      target: { value: ' bisturí ' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    expect(
      await within(form).findByText('Ya existe otro insumo con ese nombre.'),
    ).toBeInTheDocument()
    expect(within(form).getByLabelText('Nombre comercial')).toHaveValue(
      ' bisturí ',
    )

    fireEvent.change(within(form).getByLabelText('Nombre comercial'), {
      target: { value: 'Anestesia' },
    })
    fireEvent.change(within(form).getByLabelText(/Stock mínimo/), {
      target: { value: '20' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(
      within(tarjeta('Anestesia')).getByText('Bajo Stock'),
    ).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nombre del insumo')).toHaveValue('an')
    expect(cambiosT.all()).toEqual([
      expect.objectContaining({ campo: 'stockMinimo', valorNuevo: 20 }),
    ])
  })

  it('Cancelar discards the edit', () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Anestesia' }),
    )
    fireEvent.click(screen.getByText('Editar'))
    const form = screen.getByRole('dialog', { name: 'Editar insumo' })
    fireEvent.change(within(form).getByLabelText('Nombre comercial'), {
      target: { value: 'Otro' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText('Anestesia')).toBeInTheDocument()
    expect(cambiosT.all()).toHaveLength(0)
  })
})

describe('Baja (User Story 4)', () => {
  it('warns about remaining stock; cancel keeps it; confirm removes it everywhere', async () => {
    useAuthStore.setState({ usuario: admin })
    const { unmount } = render(<Harness />)
    // Spec 020 R5: el detalle se abre en una hoja; se cierra antes de usar el menú.
    fireEvent.click(screen.getByText('Bisturí'))
    const detalle = screen.getByRole('dialog', { name: 'Detalle del insumo' })
    fireEvent.click(within(detalle).getByRole('button', { name: 'Cerrar' }))

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Bisturí' }),
    )
    fireEvent.click(screen.getByText('Eliminar'))
    let dialogo = screen.getByRole('dialog', { name: 'Eliminar insumo' })
    expect(
      within(dialogo).getByText('Aún quedan 6 caja en stock.'),
    ).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(
      screen.getByRole('button', { name: 'Más opciones de Bisturí' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Bisturí' }),
    )
    fireEvent.click(screen.getByText('Eliminar'))
    dialogo = screen.getByRole('dialog', { name: 'Eliminar insumo' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() =>
      expect(screen.queryAllByText('Bisturí')).toHaveLength(0),
    )
    expect(
      screen.queryByRole('dialog', { name: 'Detalle del insumo' }),
    ).not.toBeInTheDocument()
    expect(
      movimientosT
        .all()
        .filter(
          (m) => lotesT.all().find((l) => l.id === m.loteId)?.insumoId === 'b',
        ),
    ).toHaveLength(2)
    expect(movimientosT.all().some((m) => m.tipo === 'ajuste')).toBe(false)

    fireEvent.click(screen.getByText('Ir a Alertas'))
    expect(screen.queryByText(/Bisturí/)).not.toBeInTheDocument()
    unmount()

    render(<ConsumoForm />)
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Bis' },
    })
    expect(screen.queryByText(/Bisturí/)).not.toBeInTheDocument()
  })
})

/** Spec 023 T030 (US1-3, FR-008/FR-009). */
describe('Edición — marca (spec 023)', () => {
  it('administración cambia la marca y queda un cambio marcaId', async () => {
    ;(db.marcas as unknown as MemoryTable<Marca>).seed([
      {
        id: 'tres',
        tenantId: TENANT_1,
        nombre: '3M',
        creadoPor: 'admin-1',
        creadoEn: '2026-10-24T10:00:00.000Z',
        desactivadoEn: null,
        eliminadoEn: null,
        sincronizado: true,
      },
    ])
    reflejarStore()
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    fireEvent.click(screen.getByText('Editar'))
    const form = screen.getByRole('dialog', { name: 'Editar insumo' })
    expect(within(form).getByLabelText('Marca (opcional)')).toHaveTextContent('Sin marca')

    fireEvent.click(within(form).getByLabelText('Marca (opcional)'))
    fireEvent.change(screen.getByLabelText('Buscar marca'), { target: { value: '3m' } })
    fireEvent.click(screen.getByRole('option', { name: '3M' }))
    expect(within(form).getByLabelText('Marca (opcional)')).toHaveTextContent('3M')
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cambiosT.all()).toEqual([
      expect.objectContaining({ campo: 'marcaId', valorAnterior: null, valorNuevo: 'tres' }),
    ])
    expect(insumosT.all().find((i) => i.id === 'a')?.marcaId).toBe('tres')
  })
})

