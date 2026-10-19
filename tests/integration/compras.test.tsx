import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  Borrador,
  Categoria,
  Insumo,
  ItemCompra,
  Lote,
  Movimiento,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      categorias: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      borradores: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const borradoresT = db.borradores as unknown as MemoryTable<Borrador>
const itemsCompraT = db.itemsCompra as unknown as MemoryTable<ItemCompra>

const HOY = new Date()

function fechaEnDias(dias: number): string {
  const fecha = new Date(HOY)
  fecha.setDate(fecha.getDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

function makeInsumo(overrides: Partial<Insumo>): Insumo {
  return {
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
    categoria: 'Cirugía',
    unidadMedida: 'pieza',
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
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: crypto.randomUUID(),
    insumoId: 'insumo-1',
    numeroLote: 'L1',
    proveedor: 'Proveedor X',
    fechaCaducidad: fechaEnDias(90),
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: new Date().toISOString(),
    ...overrides,
  }
}

function makeIngreso(loteId: string, cantidad: number): Movimiento {
  return {
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

function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all().filter((i) => !i.dadoDeBajaEn),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    cambiosInsumo: [],
    categorias: categoriasT.all(),
    itemsCompra: itemsCompraT.all(),
    isReady: true,
  })
}

const personal: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'usuario-1',
  email: 'p@x.cl',
  nombre: 'Personal',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  onMemoryDbChange(reflejarStore)
  useAuthStore.setState({ usuario: personal, isReady: true })
  insumosT.seed([])
  categoriasT.seed([])
  lotesT.seed([])
  movimientosT.seed([])
  borradoresT.seed([])
  itemsCompraT.seed([])
  reflejarStore()
})

afterEach(() => {
  useInventoryStore.setState({
    insumos: [],
    lotes: [],
    movimientos: [],
    itemsCompra: [],
    isReady: true,
  })
  vi.unstubAllGlobals()
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('ComprasView — Sugeridos por el Sistema (User Story 1)', () => {
  it('shows an insumo with stock bajo under "Stock Mínimo" (FR-004)', () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 5)])
    reflejarStore()

    render(<ComprasView />)

    expect(screen.getByText('Guantes M')).toBeInTheDocument()
    expect(screen.getByText('Stock Mínimo')).toBeInTheDocument()
    expect(screen.queryByText('Caducado')).not.toBeInTheDocument()
  })

  it('shows an insumo with a lote caducado con stock under "Caducado", aunque el stock total supere el mínimo (FR-005)', () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Anestesia X', stockMinimo: 5 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(-2) })])
    movimientosT.seed([makeIngreso('l1', 20)])
    reflejarStore()

    render(<ComprasView />)

    expect(screen.getByText('Anestesia X')).toBeInTheDocument()
    expect(screen.getByText('Caducado')).toBeInTheDocument()
    expect(screen.queryByText('Stock Mínimo')).not.toBeInTheDocument()
  })

  it('shows the empty state when no insumo qualifies (FR-002)', () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Insumo Ok', stockMinimo: null })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 10)])
    reflejarStore()

    render(<ComprasView />)

    expect(
      screen.getByText('No hay materiales sugeridos por ahora.'),
    ).toBeInTheDocument()
  })

  it('computes the list from local store state alone, sin depender de la red', () => {
    // ComprasView solo lee inventoryStore (síncrono, sin fetch) — la misma
    // aserción de "sin conexión" que el resto de las vistas de este proyecto:
    // no hay ningún efecto de red que mockear (spec Acceptance Scenario 6).
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 5)])
    reflejarStore()

    render(<ComprasView />)

    expect(screen.getByText('Guantes M')).toBeInTheDocument()
  })
})

describe('ComprasView — Marcar un ítem sugerido como recibido (User Story 2)', () => {
  it('receiving enough stock removes it from Sugeridos, adds a lote + movimiento de ingreso (FR-009/FR-010/FR-014)', async () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20, caduca: false })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: null })])
    movimientosT.seed([makeIngreso('l1', 5)])
    reflejarStore()

    render(<ComprasView />)
    expect(screen.getByText('Guantes M')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Guantes M como comprado o recibido/ }),
    )
    await screen.findByRole('heading', { name: 'Recibir Guantes M' })
    // Sin campo de fecha porque el insumo no caduca.
    expect(screen.queryByLabelText('Fecha de vencimiento')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Cantidad (pieza)'), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L-2' },
    })
    fireEvent.change(screen.getByLabelText('Proveedor'), {
      target: { value: 'Proveedor Y' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await waitFor(() => expect(lotesT.all()).toHaveLength(2))
    expect(movimientosT.all()).toHaveLength(2)
    await waitFor(() =>
      expect(screen.queryByText('Guantes M')).not.toBeInTheDocument(),
    )
  })

  it('opens ConfirmarLoteCaducadoDialog for a past fecha de vencimiento; "Guardar igual" completes the reception', async () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Anestesia X', stockMinimo: 5 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: fechaEnDias(-2) })])
    movimientosT.seed([makeIngreso('l1', 20)])
    reflejarStore()

    render(<ComprasView />)
    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Anestesia X como comprado o recibido/ }),
    )
    await screen.findByRole('heading', { name: 'Recibir Anestesia X' })

    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L-2' },
    })
    fireEvent.change(screen.getByLabelText('Proveedor'), {
      target: { value: 'Proveedor Y' },
    })
    // -3 días (no -1): margen suficiente para que la fecha quede en el
    // pasado sin importar el desfase UTC/huso local de `fechaEnDias` — igual
    // que el resto de esta suite usa -2 para "ya caducado".
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), {
      target: { value: fechaEnDias(-3) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await screen.findByRole('heading', { name: 'Este lote ingresaría ya caducado' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar igual' }))

    await waitFor(() => expect(lotesT.all()).toHaveLength(2))
  })

  it('cancelling the form adds no stock and keeps the item in Sugeridos', async () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 5)])
    reflejarStore()

    render(<ComprasView />)
    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Guantes M como comprado o recibido/ }),
    )
    await screen.findByRole('heading', { name: 'Recibir Guantes M' })

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Recibir Guantes M' }),
      ).not.toBeInTheDocument(),
    )
    expect(lotesT.all()).toHaveLength(1)
    expect(screen.getByText('Guantes M')).toBeInTheDocument()
  })

  it('applies the reception locally without a backend (sin conexión, FR-024)', async () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20, caduca: false })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1', fechaCaducidad: null })])
    movimientosT.seed([makeIngreso('l1', 5)])
    reflejarStore()

    render(<ComprasView />)
    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Guantes M como comprado o recibido/ }),
    )
    await screen.findByRole('heading', { name: 'Recibir Guantes M' })
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L-2' },
    })
    fireEvent.change(screen.getByLabelText('Proveedor'), {
      target: { value: 'Proveedor Y' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await waitFor(() => expect(movimientosT.all()).toHaveLength(2))
    expect(movimientosT.all().find((m) => m.tipo === 'ingreso' && m.loteId !== 'l1')).toMatchObject(
      { sincronizado: false },
    )
  })
})

describe('ComprasView — Agregar y gestionar ítems manuales (User Story 3)', () => {
  it('adds a manual item without a matching insumo; it shows up with the Manual badge (FR-015)', async () => {
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Ítem Manual' }))
    await screen.findByRole('heading', { name: 'Añadir Ítem Manual' })
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Torundas de algodón' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    await screen.findByText('Torundas de algodón')
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('suggests an existing material while typing and links it on selection (FR-016)', async () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Composite A2' })])
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(screen.getByRole('button', { name: 'Añadir Ítem Manual' }))
    await screen.findByRole('heading', { name: 'Añadir Ítem Manual' })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'compo' } })

    fireEvent.click(await screen.findByText(/Composite A2/))
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }))

    await waitFor(() =>
      expect(itemsCompraT.all()[0]).toMatchObject({ insumoId: 'i1' }),
    )
  })

  it('marking a vinculado manual item as recibido opens the reception form and updates its stock (FR-009)', async () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Composite A2', caduca: false })])
    itemsCompraT.seed([
      {
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        id: 'item-1',
        nombre: 'Composite A2',
        cantidad: null,
        nota: null,
        insumoId: 'i1',
        estado: 'pendiente',
        creadoPor: 'otro-usuario',
        creadoEn: new Date().toISOString(),
        compradoPor: null,
        compradoEn: null,
      },
    ])
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Composite A2 como comprado o recibido/ }),
    )
    await screen.findByRole('heading', { name: 'Recibir Composite A2' })
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L-3' },
    })
    fireEvent.change(screen.getByLabelText('Proveedor'), {
      target: { value: 'Proveedor Z' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await waitFor(() => expect(lotesT.all()).toHaveLength(1))
    expect(itemsCompraT.all()[0]).toMatchObject({ estado: 'comprado' })
    await waitFor(() =>
      expect(screen.queryByText('Composite A2')).not.toBeInTheDocument(),
    )
  })

  it('an unvinculado manual item marcado como recibido ofrece crear material o marcar sin inventario (FR-012)', async () => {
    itemsCompraT.seed([
      {
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        id: 'item-1',
        nombre: 'Hilo sutura',
        cantidad: null,
        nota: null,
        insumoId: null,
        estado: 'pendiente',
        creadoPor: 'usuario-1',
        creadoEn: new Date().toISOString(),
        compradoPor: null,
        compradoEn: null,
      },
    ])
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Hilo sutura como comprado o recibido/ }),
    )
    await screen.findByText('Este ítem no está vinculado a ningún material del catálogo.')
    expect(screen.getByRole('button', { name: 'Crear material' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como comprado sin inventario' }))

    await waitFor(() =>
      expect(itemsCompraT.all()[0]).toMatchObject({ estado: 'comprado' }),
    )
    expect(insumosT.all()).toHaveLength(0)
  })

  it('creating a material from an unvinculado manual item marks it comprado (FR-012, research.md R6)', async () => {
    itemsCompraT.seed([
      {
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        id: 'item-1',
        nombre: 'Hilo sutura',
        cantidad: null,
        nota: null,
        insumoId: null,
        estado: 'pendiente',
        creadoPor: 'usuario-1',
        creadoEn: new Date().toISOString(),
        compradoPor: null,
        compradoEn: null,
      },
    ])
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(
      screen.getByRole('button', { name: /Marcar Hilo sutura como comprado o recibido/ }),
    )
    await screen.findByRole('button', { name: 'Crear material' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear material' }))

    await screen.findByRole('heading', { name: 'Nuevo Material' })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Fresas' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(insumosT.all()).toHaveLength(1))
    expect(insumosT.all()[0].nombre).toBe('Hilo sutura')
    await waitFor(() =>
      expect(itemsCompraT.all()[0]).toMatchObject({ estado: 'comprado' }),
    )
  })

  it('eliminating a manual item added by another account removes it without touching inventory (FR-018)', () => {
    itemsCompraT.seed([
      {
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        id: 'item-1',
        nombre: 'Guantes talla M',
        cantidad: null,
        nota: null,
        insumoId: null,
        estado: 'pendiente',
        creadoPor: 'otro-usuario',
        creadoEn: new Date().toISOString(),
        compradoPor: null,
        compradoEn: null,
      },
    ])
    reflejarStore()
    render(<ComprasView />)
    expect(screen.getByText('Guantes talla M')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Más opciones de Guantes talla M' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(screen.queryByText('Guantes talla M')).not.toBeInTheDocument()
    expect(itemsCompraT.all()[0].estado).toBe('eliminado')
    expect(lotesT.all()).toHaveLength(0)
    expect(movimientosT.all()).toHaveLength(0)
  })
})

describe('ComprasView — Compartir la lista de compras (User Story 4)', () => {
  it('shares the pending items text via navigator.share when available (FR-021)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 5)])
    itemsCompraT.seed([
      {
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        id: 'item-1',
        nombre: 'Torundas',
        cantidad: 3,
        nota: null,
        insumoId: null,
        estado: 'pendiente',
        creadoPor: 'usuario-1',
        creadoEn: new Date().toISOString(),
        compradoPor: null,
        compradoEn: null,
      },
    ])
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(screen.getByRole('button', { name: 'Compartir Lista' }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const texto = share.mock.calls[0][0].text as string
    expect(texto).toContain('Guantes M (Sugerido)')
    expect(texto).toContain('Torundas x3 (Manual)')
  })

  it('offers a copy fallback when navigator.share is unavailable (FR-023)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 5)])
    reflejarStore()
    render(<ComprasView />)

    fireEvent.click(screen.getByRole('button', { name: 'Compartir Lista' }))

    await screen.findByText(/no ofrece un mecanismo de compartir/)
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    await screen.findByText('Lista copiada al portapapeles.')
  })

  it('disables "Compartir Lista" with no pending items (FR-022)', () => {
    reflejarStore()
    render(<ComprasView />)

    expect(screen.getByRole('button', { name: 'Compartir Lista' })).toBeDisabled()
  })
})

describe('ComprasView — Polish: touch targets (FR-026)', () => {
  it('sizes the hand-rolled checkbox and menu buttons with touch-target (≥48×48px)', () => {
    insumosT.seed([makeInsumo({ id: 'i1', nombre: 'Guantes M', stockMinimo: 20 })])
    lotesT.seed([makeLote({ id: 'l1', insumoId: 'i1' })])
    movimientosT.seed([makeIngreso('l1', 5)])
    itemsCompraT.seed([
      {
        tenantId: TENANT_1,
        lugarId: LUGAR_1,
        id: 'item-1',
        nombre: 'Torundas',
        cantidad: null,
        nota: null,
        insumoId: null,
        estado: 'pendiente',
        creadoPor: 'usuario-1',
        creadoEn: new Date().toISOString(),
        compradoPor: null,
        compradoEn: null,
      },
    ])
    reflejarStore()
    render(<ComprasView />)

    expect(
      screen.getByRole('button', { name: /Marcar Guantes M como comprado o recibido/ }),
    ).toHaveClass('touch-target')
    expect(
      screen.getByRole('button', { name: /Marcar Torundas como comprado o recibido/ }),
    ).toHaveClass('touch-target')
    expect(
      screen.getByRole('button', { name: 'Más opciones de Torundas' }),
    ).toHaveClass('touch-target')
  })
})
