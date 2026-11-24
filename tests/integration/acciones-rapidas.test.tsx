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
import { EditarInsumoForm } from '../../src/features/insumos/components/EditarInsumoForm'
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

/** Spec 025: "Consumir" abre la hoja; devuelve el panel cuando el lote ya cargó. */
async function abrirConsumo(nombre: string): Promise<HTMLElement> {
  fireEvent.click(
    within(tarjeta(nombre)).getByRole('button', { name: `Consumir ${nombre}` }),
  )
  const panel = screen.getByRole('dialog', { name: `Consumir ${nombre}` })
  await within(panel).findByLabelText(/Lote/)
  return panel
}

async function confirmarConsumo(panel: HTMLElement, cantidad?: string) {
  if (cantidad !== undefined) {
    fireEvent.change(within(panel).getByLabelText(/Cantidad a consumir/), {
      target: { value: cantidad },
    })
  }
  fireEvent.click(within(panel).getByRole('button', { name: 'Confirmar consumo' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('Consumir (spec 025 User Story 1)', () => {
  it('abre la hoja con cantidad 1 sin registrar nada; confirmar consume 1 del vigente más próximo', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
    render(<Harness />)

    const panel = await abrirConsumo('Anestesia')
    expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(0)
    expect(
      within(panel).queryByPlaceholderText('Nombre del insumo'),
    ).not.toBeInTheDocument()
    expect(within(panel).getByLabelText(/Cantidad a consumir/)).toHaveValue(1)
    expect(within(panel).getByLabelText(/Lote/)).toHaveValue('a1')

    await confirmarConsumo(panel)

    await screen.findByText('Consumido 1 caja de Anestesia')
    expect(stock('a1')).toBe(4)
    expect(stock('a2')).toBe(3)
    expect(
      movimientosT.all().find((m) => m.tipo === 'consumo')?.usuarioId,
    ).toBe('personal-1')
    expect(within(tarjeta('Anestesia')).getByText('7 cajas')).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalled()
  })

  it('consume otra cantidad y el aviso la muestra', async () => {
    render(<Harness />)

    await confirmarConsumo(await abrirConsumo('Anestesia'), '4')

    await screen.findByText('Consumido 4 cajas de Anestesia')
    expect(stock('a1')).toBe(1)
  })

  it('cerrar la hoja sin confirmar no registra nada', async () => {
    render(<Harness />)

    const panel = await abrirConsumo('Anestesia')
    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(0)
  })

  it('con un lote vencido y otro vigente propone el vigente (FR-005)', async () => {
    render(<Harness />)

    const panel = await abrirConsumo('Bisturí')
    expect(within(panel).getByLabelText(/Lote/)).toHaveValue('b-vig')
    expect(within(panel).queryByText('Lote vencido')).not.toBeInTheDocument()
    await confirmarConsumo(panel)

    expect(stock('b-cad')).toBe(2)
    expect(stock('b-vig')).toBe(3)
  })

  it('elegir a mano el lote vencido lo marca y lo consume', async () => {
    render(<Harness />)

    const panel = await abrirConsumo('Bisturí')
    fireEvent.change(within(panel).getByLabelText(/Lote/), { target: { value: 'b-cad' } })
    expect(within(panel).getByText('Lote vencido')).toBeInTheDocument()
    await confirmarConsumo(panel)

    expect(stock('b-cad')).toBe(1)
  })

  it('con solo stock vencido, "Consumir" se habilita y la hoja dice "Lote vencido" (Clarifications)', async () => {
    render(<Harness />)

    const boton = within(tarjeta('Composite Viejo')).getByRole('button', {
      name: 'Consumir Composite Viejo',
    })
    expect(boton).toBeEnabled()
    const panel = await abrirConsumo('Composite Viejo')
    expect(within(panel).getByLabelText(/Lote/)).toHaveValue('c-cad')
    expect(within(panel).getByText('Lote vencido')).toBeInTheDocument()
  })

  it('sin stock, el botón queda deshabilitado con "Sin stock" (FR-008)', () => {
    render(<Harness />)

    const d = within(tarjeta('Dique de Goma')).getByRole('button', {
      name: /Sin stock/,
    })
    expect(d).toBeDisabled()
    expect(d).toHaveTextContent('Sin stock')
  })

  it('con stock fraccionario menor que 1 se habilita y deja consumirlo (FR-009)', async () => {
    insumosT.seed([
      ...insumosT.all(),
      insumo('g', 'Gel', { unidadMedida: 'mL', unidadCompra: 'mL', permiteDecimales: true }),
    ])
    lotesT.seed([...lotesT.all(), lote('g1', 'g', 90)])
    movimientosT.seed([...movimientosT.all(), { ...ingreso('g1', 0.5), unidad: 'mL' }])
    reflejarStore()
    render(<Harness />)

    await confirmarConsumo(await abrirConsumo('Gel'), '0.5')

    expect(stock('g1')).toBe(0)
    await waitFor(() =>
      expect(
        within(tarjeta('Gel')).getByRole('button', { name: /Sin stock/ }),
      ).toBeDisabled(),
    )
  })

  it('rechaza una cantidad mayor que el lote sin registrar y la hoja sigue abierta', async () => {
    render(<Harness />)

    const panel = await abrirConsumo('Aguja Única')
    fireEvent.change(within(panel).getByLabelText(/Cantidad a consumir/), {
      target: { value: '2' },
    })
    fireEvent.click(within(panel).getByRole('button', { name: 'Confirmar consumo' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent(/Stock insuficiente/)
    expect(movimientosT.all().filter((m) => m.tipo === 'consumo')).toHaveLength(0)
  })

  it('conserva la búsqueda al volver al listado (FR-006)', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'Anes' },
    })

    await confirmarConsumo(await abrirConsumo('Anestesia'))

    expect(screen.getByPlaceholderText('Nombre del insumo')).toHaveValue('Anes')
    expect(screen.queryByText('Bisturí')).not.toBeInTheDocument()
  })

  it('updates the summary counts after a consume (FR-005 spec 007)', async () => {
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
    await confirmarConsumo(await abrirConsumo('Mascarilla'))
    await screen.findByText('Consumido 1 caja de Mascarilla')

    expect(resumenStock().textContent).not.toBe(antes)
    expect(
      within(tarjeta('Mascarilla')).getByText('Bajo Stock'),
    ).toBeInTheDocument()
  })
})

describe('Deshacer (spec 025 User Story 2)', () => {
  it('undoes exactly one consume per notice, survives navigation, and expires at 8 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness />)

    for (let n = 0; n < 3; n++) {
      await confirmarConsumo(await abrirConsumo('Anestesia'))
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
  it('personal solo ve "Ver detalle", sin "Consumir otra cantidad" (spec 025), via ⋮ or long press', () => {
    vi.useFakeTimers()
    render(<Harness />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Más opciones de Bisturí' }),
    )
    let menu = screen.getByRole('dialog', { name: 'Bisturí' })
    expect(within(menu).getByText('Ver detalle')).toBeInTheDocument()
    expect(within(menu).queryByText('Consumir otra cantidad')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Editar')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Eliminar')).not.toBeInTheDocument()
    fireEvent.click(within(menu).getByRole('button', { name: 'Cerrar' }))

    const area = screen.getByText('Bisturí').closest('button')!
    fireEvent.pointerDown(area, { clientX: 5, clientY: 5 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.pointerUp(area)
    menu = screen.getByRole('dialog', { name: 'Bisturí' })
    expect(within(menu).queryByText('Consumir otra cantidad')).not.toBeInTheDocument()
    expect(within(menu).queryByText('Editar')).not.toBeInTheDocument()
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
      within(dialogo).getByText('Aún quedan 6 cajas en stock.'),
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

/** Spec 032 US1 (FR-004..FR-006). */
describe('Edición — mínimo en dos unidades y código oculto (spec 032)', () => {
  it('escribe el mínimo en jeringas, guarda en mL y conserva el código guardado', async () => {
    insumosT.seed(
      insumosT.all().map((i) =>
        i.id === 'a'
          ? {
              ...i,
              unidadMedida: 'mL',
              unidadCompra: 'jeringa',
              contenido: 3,
              permiteDecimales: true,
              codigoFabricante: '7790001',
              stockMinimo: null,
            }
          : i,
      ),
    )
    reflejarStore()
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Anestesia' }))
    fireEvent.click(screen.getByText('Editar'))
    const form = screen.getByRole('dialog', { name: 'Editar insumo' })
    expect(within(form).queryByLabelText(/Código de fabricante/)).not.toBeInTheDocument()

    fireEvent.change(within(form).getByLabelText('Stock mínimo en jeringas'), {
      target: { value: '1' },
    })
    expect(within(form).getByLabelText('Stock mínimo en mL')).toHaveValue(3)
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cambiosT.all()).toEqual([
      expect.objectContaining({ campo: 'stockMinimo', valorAnterior: null, valorNuevo: 3 }),
    ])
    expect(insumosT.all().find((i) => i.id === 'a')).toMatchObject({
      stockMinimo: 3,
      codigoFabricante: '7790001',
    })
  })
})

/** Spec 024 US2 (FR-005..FR-008). */
describe('Edición — stock por lote (spec 024)', () => {
  function abrirEdicion(nombre: string): HTMLElement {
    fireEvent.click(screen.getByRole('button', { name: `Más opciones de ${nombre}` }))
    fireEvent.click(screen.getByText('Editar'))
    return screen.getByRole('dialog', { name: 'Editar insumo' })
  }

  it('administración pone en 0 el lote vencido y el insumo deja de estar Caducado', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    expect(within(tarjeta('Bisturí')).getByText('Caducado')).toBeInTheDocument()

    const form = abrirEdicion('Bisturí')
    const seccion = within(form).getByRole('group', { name: 'Stock por lote' })
    expect(within(seccion).getByText('Vencido')).toBeInTheDocument()
    const vencido = within(seccion).getByLabelText('Cantidad del lote B-CAD')
    expect(vencido).toHaveValue(2)
    expect(within(seccion).getByLabelText('Cantidad del lote B-VIG')).toHaveValue(4)

    fireEvent.change(vencido, { target: { value: '0' } })
    expect(within(seccion).getByText('Ajuste: −2 cajas')).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(movimientosT.all().filter((m) => m.tipo === 'ajuste')).toEqual([
      expect.objectContaining({ loteId: 'b-cad', cantidad: -2, usuarioId: 'admin-1' }),
    ])
    expect(stock('b-cad')).toBe(0)
    expect(within(tarjeta('Bisturí')).queryByText('Caducado')).toBeNull()
    expect(cambiosT.all()).toEqual([])
  })

  it('una cantidad con decimales no guarda nada, tampoco el nombre', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    const form = abrirEdicion('Bisturí')

    fireEvent.change(within(form).getByLabelText('Nombre comercial'), {
      target: { value: 'Bisturí 15' },
    })
    fireEvent.change(within(form).getByLabelText('Cantidad del lote B-VIG'), {
      target: { value: '1.5' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))

    expect(await within(form).findByText('Esta unidad no admite decimales.')).toBeInTheDocument()
    expect(cambiosT.all()).toEqual([])
    expect(movimientosT.all().some((m) => m.tipo === 'ajuste')).toBe(false)
  })

  it('el personal no ve la corrección de stock', () => {
    useAuthStore.setState({ usuario: personal })
    render(
      <EditarInsumoForm
        insumo={insumosT.all().find((i) => i.id === 'b')!}
        onGuardado={() => {}}
        onCancelar={() => {}}
        onEliminado={() => {}}
      />,
    )
    expect(screen.queryByRole('group', { name: 'Stock por lote' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Eliminar insumo' })).toBeNull()
  })
})

/** Spec 024 US3 (FR-009). */
describe('Edición — eliminar desde Editar (spec 024)', () => {
  it('cancelar conserva lo editado; confirmar da de baja como desde el menú', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Bisturí' }))
    fireEvent.click(screen.getByText('Editar'))
    const form = screen.getByRole('dialog', { name: 'Editar insumo' })
    fireEvent.change(within(form).getByLabelText('Nombre comercial'), {
      target: { value: 'Bisturí 15' },
    })

    fireEvent.click(within(form).getByRole('button', { name: 'Eliminar insumo' }))
    let dialogo = screen.getByRole('dialog', { name: 'Eliminar insumo' })
    expect(within(dialogo).getByText('Aún quedan 6 cajas en stock.')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Eliminar insumo' })).toBeNull()
    expect(within(form).getByLabelText('Nombre comercial')).toHaveValue('Bisturí 15')

    fireEvent.click(within(form).getByRole('button', { name: 'Eliminar insumo' }))
    dialogo = screen.getByRole('dialog', { name: 'Eliminar insumo' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryAllByText(/Bisturí/)).toHaveLength(0)
    expect(cambiosT.all()).toEqual([expect.objectContaining({ insumoId: 'b', campo: 'baja' })])
  })
})

