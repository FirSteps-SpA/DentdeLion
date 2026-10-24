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
  Borrador,
  Categoria,
  Insumo,
  Lote,
  Movimiento,
  UsuarioActual,
  Proveedor,
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
      categorias: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      borradores: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

const scan = vi.fn()
const stop = vi.fn()
vi.mock('../../src/lib/scanner/useBarcodeScanner', () => ({
  useBarcodeScanner: () => ({
    scan: (...args: unknown[]) => scan(...args),
    stop: () => stop(),
  }),
}))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useAvisosStore } from '../../src/stores/avisosStore'
import { darDeBajaInsumo } from '../../src/features/insumos/lib/catalogo'
import { InventarioView } from '../../src/features/insumos/components/InventarioView'
import { SearchPicker } from '../../src/features/insumos/components/SearchPicker'
import { AvisosConsumo } from '../../src/app/AvisosConsumo'
import { TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'
import { usarProveedorPredeterminado } from '../helpers/proveedor'
import { esperarQueLaRuedaNoCambie } from '../helpers/rueda'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const proveedoresT = db.proveedores as unknown as MemoryTable<Proveedor>
const marcasT = db.marcas as unknown as MemoryTable<Marca>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'pieza',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
    categoria: 'Fresas',
    unidadMedida: 'pieza',
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

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', rol: 'personal' }

function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all().filter((i) => !i.dadoDeBajaEn),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    cambiosInsumo: [],
    categorias: categoriasT.all(),
    marcas: marcasT.all().filter((m) => !m.eliminadoEn),
    isReady: true,
  })
}

/**
 * Combines InventarioView + a bare `SearchPicker` behind a nav so "opened
 * from a search other than Inventario" scenarios can be exercised (spec 009
 * retired `RegistroForm`; `SearchPicker`'s "Crear insumo nuevo" is the
 * generic entry point it and `ConsumoForm` both share).
 */
function Harness() {
  const [vista, setVista] = useState<'inventario' | 'registrar'>('inventario')
  const [mensaje, setMensaje] = useState<string | null>(null)
  return (
    <div>
      <button type="button" onClick={() => setVista('inventario')}>
        Ir a Inventario
      </button>
      <button type="button" onClick={() => setVista('registrar')}>
        Ir a Registrar
      </button>
      {vista === 'inventario' ? (
        <InventarioView />
      ) : (
        <div className="flex flex-col gap-3">
          {mensaje && <p role="status">{mensaje}</p>}
          <SearchPicker
            onSelect={(selected, opciones) => {
              setMensaje(
                opciones?.conLoteInicial
                  ? `Lote de "${selected.nombre}" registrado.`
                  : null,
              )
            }}
          />
        </div>
      )}
      <AvisosConsumo />
    </div>
  )
}

beforeEach(() => {
  onMemoryDbChange(reflejarStore)
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
  useAuthStore.setState({ usuario: personal, isReady: true })
  useAvisosStore.setState({ avisos: [] })
  insumosT.seed([])
  categoriasT.seed([])
  lotesT.seed([])
  movimientosT.seed([])
  borradoresT.seed([])
  marcasT.seed([])
  scan.mockReset()
  stop.mockReset()
  reflejarStore()
})

afterEach(() => {
  onMemoryDbChange(null)
  for (const a of useAvisosStore.getState().avisos)
    useAvisosStore.getState().descartar(a.id)
  vi.useRealTimers()
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)
// Spec 021: el lugar 1 tiene un proveedor predeterminado, que viene elegido.
beforeEach(() => {
  usarProveedorPredeterminado(proveedoresT)
})

describe('AltaMaterialView — US1 (alta sin stock)', () => {
  it('"+ Material" focuses the name input and never requests the camera (FR-003/FR-020)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    expect(screen.getByLabelText('Nombre del material')).toHaveFocus()
    expect(scan).not.toHaveBeenCalled()
  })

  it('lists the 4 precargadas + "Sin categoría" last, no create option for personal (SC-004/FR-010)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    const opciones = within(screen.getByLabelText('Categoría')).getAllByRole(
      'option',
    )
    expect(opciones.map((o) => o.textContent)).toEqual([
      'Elige una categoría',
      'Cirugía',
      'Fresas',
      'Restauración',
      'Tratamientos pulpares',
      'Sin categoría',
    ])
  })

  it('saves a no-stock material: "Sin stock", under the Fresas chip, with the material-creado aviso', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Fresa diamante 856' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Fresas' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('«Fresa diamante 856» agregado al inventario')
    const tarjeta = screen.getByText('Fresa diamante 856').closest('li')!
    expect(
      within(tarjeta).getByRole('button', { name: /Sin stock/ }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Fresas' }))
    expect(screen.getByText('Fresa diamante 856')).toBeInTheDocument()
  })

  it('increases the Bajo Stock summary count right after saving, no reload (FR-022)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Fresa diamante 856' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Fresas' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nuevo Material' }),
      ).not.toBeInTheDocument(),
    )

    const caducidadCard = screen.getByText('Caducados/Próximos').closest('button')!
    const resumen = caducidadCard.parentElement!
    const stockBajoCard = within(resumen).getByText('Bajo Stock').closest('button')!
    expect(within(stockBajoCard).getByText('1')).toBeInTheDocument()
  })

  it('shows the empty/duplicate-name field error and keeps the other values', async () => {
    insumosT.seed([
      insumo({
        id: 'composite',
        nombre: 'Composite A2',
        categoria: 'restauracion',
        codigoFabricante: '7790001',
      }),
    ])
    reflejarStore()
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(
      await screen.findByText('Ingresa el nombre del material.'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'composite a2' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Fresas' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(
      await screen.findByText('Ya existe un material activo con ese nombre.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del material')).toHaveValue(
      'composite a2',
    )
    expect(screen.getByLabelText('Categoría')).toHaveValue('Fresas')
  })

  it('Cancel with data asks for confirmation, and filters survive (FR-023/FR-022)', async () => {
    render(<Harness />)
    fireEvent.change(screen.getByPlaceholderText('Nombre del insumo'), {
      target: { value: 'buscando' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Algo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    const dialogo = screen.getByRole('dialog', { name: '¿Descartar este material?' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nuevo Material' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByPlaceholderText('Nombre del insumo')).toHaveValue(
      'buscando',
    )
  })

  it('restores the borrador after unmount/remount (FR-024)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Recuperable' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(borradoresT.all()).toHaveLength(1)
    unmount()

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    expect(
      await screen.findByText('Recuperamos tu alta sin terminar'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del material')).toHaveValue(
      'Recuperable',
    )
  })

  it('cancelling from Registrar with a prefilled name leaves no orphan borrador (FR-024)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Ir a Registrar'))
    fireEvent.change(screen.getByLabelText('Buscar insumo'), {
      target: { value: 'Hilo sutura' },
    })
    await screen.findByText(/No se encontraron insumos/)
    fireEvent.click(screen.getByRole('button', { name: 'Crear insumo nuevo' }))
    await screen.findByRole('heading', { name: 'Nuevo Material' })
    expect(screen.getByLabelText('Nombre del material')).toHaveValue(
      'Hilo sutura',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nuevo Material' }),
      ).not.toBeInTheDocument(),
    )
    expect(borradoresT.all()).toHaveLength(0)

    fireEvent.click(screen.getByText('Ir a Inventario'))
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    expect(
      screen.queryByText('Recuperamos tu alta sin terminar'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del material')).toHaveValue('')
  })
})

describe('AltaMaterialView — US2 (stock inicial + primer lote)', () => {
  it('hides the lote section at 0 and shows it after "Sumar uno"; button label changes', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    expect(screen.queryByLabelText('Número de lote')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])

    expect(screen.getByLabelText('Número de lote')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Guardar e Ingresar' }),
    ).toBeInTheDocument()
  })

  it('hides the date field when "¿Caduca?" is off', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])
    expect(screen.getByLabelText('Fecha de vencimiento')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: /¿Caduca\?/ }))

    expect(screen.queryByLabelText('Fecha de vencimiento')).not.toBeInTheDocument()
  })

  // 10 sequential Stepper clicks + a full save is slow under full-suite load.
  it('saving 10 cartuchos shows "10" on the card and one lote in the detail', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Anestesia X' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Cirugía' },
    })
    fireEvent.change(screen.getByLabelText('Unidad de consumo'), {
      target: { value: 'cartucho' },
    })
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])
    }
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'A123' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), {
      target: { value: '2027-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar e Ingresar' }))

    await screen.findByText('«Anestesia X» agregado al inventario')
    expect(
      within(screen.getByText('Anestesia X').closest('li')!).getByText(
        '10 cartucho',
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Anestesia X'))
    const detalle = screen.getByText('Stock total: 10 cartucho').closest('div')!
    expect(within(detalle).getByText(/Lote A123/)).toBeInTheDocument()
  }, 15000)

  it('spec 015: 2 cajas de 50 muestran "2 cajas = 100 cartuchos" y suman 100 (US2-1)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Articaína' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Cirugía' } })
    fireEvent.change(screen.getByLabelText('Unidad de consumo'), {
      target: { value: 'cartucho' },
    })
    fireEvent.change(screen.getByLabelText('Se compra por'), { target: { value: 'caja' } })
    fireEvent.change(screen.getByLabelText(/^Contenido/), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('Stock inicial (cajas)'), { target: { value: '2' } })
    expect(screen.getByText('2 cajas = 100 cartuchos')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Número de lote'), { target: { value: 'A1' } })
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), {
      target: { value: '2027-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar e Ingresar' }))

    await screen.findByText('«Articaína» agregado al inventario')
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 100, unidad: 'cartucho' })
    expect(lotesT.all()[0]).toMatchObject({ cantidadIngresada: 2, unidadIngresada: 'caja' })
  }, 15000)

  it('yesterday opens the confirm dialog and, after "Guardar igual", counts in the caducidad summary', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Vencido X' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Cirugía' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'V1' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), {
      target: { value: '2020-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar e Ingresar' }))

    const dialogo = await screen.findByRole('dialog', {
      name: 'Este lote ingresaría ya caducado',
    })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar igual' }))

    await screen.findByText('«Vencido X» agregado al inventario')
    const caducidadCard = screen.getByText('Caducados/Próximos').closest('button')!
    expect(within(caducidadCard).getByText('1')).toBeInTheDocument()
  })

  it("today's date does not open the confirm dialog", async () => {
    const hoy = new Date().toISOString().slice(0, 10)
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Justo Hoy' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Cirugía' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'H1' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), {
      target: { value: hoy },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar e Ingresar' }))

    await screen.findByText('«Justo Hoy» agregado al inventario')
    expect(
      screen.queryByRole('dialog', { name: 'Este lote ingresaría ya caducado' }),
    ).not.toBeInTheDocument()
  })

  it('creating from Registrar with stock inicial shows the success message and returns to the search', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Ir a Registrar'))
    fireEvent.change(screen.getByLabelText('Buscar insumo'), {
      target: { value: 'Hilo sutura' },
    })
    await screen.findByText(/No se encontraron insumos/)
    fireEvent.click(screen.getByRole('button', { name: 'Crear insumo nuevo' }))
    await screen.findByRole('heading', { name: 'Nuevo Material' })

    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Fresas' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L-1' },
    })
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), {
      target: { value: '2027-01-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar e Ingresar' }))

    expect(
      await screen.findByText('Lote de "Hilo sutura" registrado.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar insumo')).toBeInTheDocument()
  })
})

describe('AltaMaterialView — US3 (categoría nueva, solo administrador)', () => {
  it('an admin creates "ortodoncia": chip in Inventario and option in EditarInsumoForm', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Alambre Ortodoncia' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: '__nueva-categoria__' },
    })
    fireEvent.change(screen.getByLabelText('Nombre de la nueva categoría'), {
      target: { value: 'Ortodoncia' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('«Alambre Ortodoncia» agregado al inventario')
    expect(categoriasT.all()).toHaveLength(1)
    expect(categoriasT.all()[0]).toMatchObject({ nombre: 'Ortodoncia' })
    expect(screen.getByRole('button', { name: 'Ortodoncia' })).toBeInTheDocument()
  })

  it('"FRESAS" as new resolves to the existing option, with a hint and no duplicate', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: '__nueva-categoria__' },
    })
    fireEvent.change(screen.getByLabelText('Nombre de la nueva categoría'), {
      target: { value: 'FRESAS' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }))

    expect(
      await screen.findByText('Ya existía: se usará «Fresas»'),
    ).toBeInTheDocument()
    const opciones = within(screen.getByLabelText('Categoría')).getAllByRole(
      'option',
    )
    expect(opciones.filter((o) => o.textContent === 'Fresas')).toHaveLength(1)
  })

  it('cancelling after choosing a new category leaves db.categorias empty', async () => {
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: '__nueva-categoria__' },
    })
    fireEvent.change(screen.getByLabelText('Nombre de la nueva categoría'), {
      target: { value: 'Implantes' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Usar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    const dialogo = screen.getByRole('dialog', { name: '¿Descartar este material?' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Nuevo Material' }),
      ).not.toBeInTheDocument(),
    )
    expect(categoriasT.all()).toHaveLength(0)
  })

  it('personal never sees "+ Crear nueva categoría"; saving with "Sin categoría" shows that chip', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    const opciones = within(screen.getByLabelText('Categoría')).getAllByRole(
      'option',
    )
    expect(opciones.some((o) => o.textContent === '+ Crear nueva categoría')).toBe(
      false,
    )

    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Cera rosa' },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Sin categoría' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('«Cera rosa» agregado al inventario')
    expect(
      screen.getByRole('button', { name: 'Sin categoría' }),
    ).toBeInTheDocument()
  })
})

describe('AltaMaterialView — US4 (duplicados, código, escaneo)', () => {
  beforeEach(() => {
    insumosT.seed([
      insumo({
        id: 'composite',
        nombre: 'Composite A2',
        categoria: 'Restauración',
        codigoFabricante: '7790001',
      }),
    ])
    reflejarStore()
  })

  it('typing "compo" suggests the existing material and opens its detail, keeping the borrador', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'compo' },
    })

    fireEvent.click(
      await screen.findByText('«Composite A2» · Restauración — Ver'),
    )

    expect(screen.getByText(/Stock total/)).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Nuevo Material' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    expect(screen.getByLabelText('Nombre del material')).toHaveValue('compo')
  })

  it('typing the existing code and blurring shows the duplicate-code warning', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    const codigo = screen.getByLabelText('Código de barras (opcional)')
    fireEvent.change(codigo, { target: { value: '7790001' } })
    fireEvent.blur(codigo)

    expect(
      await screen.findByText('Este código ya corresponde a «Composite A2».'),
    ).toBeInTheDocument()
  })

  it('hides the scan option for this release — no "Escanear" control anywhere in the alta flow (spec 011 FR-008/FR-009)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    expect(
      screen.queryByRole('button', { name: 'Escanear' }),
    ).not.toBeInTheDocument()
    expect(scan).not.toHaveBeenCalled()
  })

  it('flags "Posible duplicado" on the newer of two same-name insumos, admin only, and clears it on baja', async () => {
    const viejo = insumo({
      id: 'guantes-1',
      nombre: 'Guantes M',
      creadoEn: '2026-01-01T00:00:00.000Z',
    })
    const nuevo = insumo({
      id: 'guantes-2',
      nombre: 'guantes m',
      creadoEn: '2026-02-01T00:00:00.000Z',
    })
    insumosT.seed([...insumosT.all(), viejo, nuevo])
    reflejarStore()

    useAuthStore.setState({ usuario: admin })
    const { rerender } = render(<Harness />)
    expect(
      within(screen.getByText('guantes m').closest('li')!).getByText(
        'Posible duplicado',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByText('Guantes M').closest('li')!).queryByText(
        'Posible duplicado',
      ),
    ).not.toBeInTheDocument()

    useAuthStore.setState({ usuario: personal })
    rerender(<Harness />)
    expect(screen.queryByText('Posible duplicado')).not.toBeInTheDocument()

    useAuthStore.setState({ usuario: admin })
    await darDeBajaInsumo('guantes-1')
    rerender(<Harness />)
    await waitFor(() =>
      expect(screen.queryByText('Posible duplicado')).not.toBeInTheDocument(),
    )
  })
})

describe('AltaMaterialView — Polish (touch targets, FR-025)', () => {
  it('every interactive control in the form uses touch-target sizing', async () => {
    insumosT.seed([insumo({ id: 'composite', nombre: 'Composite A2' })])
    reflejarStore()
    useAuthStore.setState({ usuario: admin })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')

    expect(screen.getByLabelText('Categoría').className).toMatch(
      /touch-target/,
    )

    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'compo' },
    })
    const sugerencia = await screen.findByText('«Composite A2» · Fresas — Ver')
    expect(sugerencia.closest('button')!.className).toMatch(/touch-target/)
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: 'Otro material' },
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: '__nueva-categoria__' },
    })

    // Spec 015: la sección "Unidades" usa selectores de 48 px (Constitución III).
    const unidades = screen.getByRole('group', { name: 'Unidades' })
    for (const selector of within(unidades).getAllByRole('combobox')) {
      expect(selector.className).toMatch(/touch-target/)
    }
    expect(
      screen.getByRole('button', { name: 'Volver a la lista' }).className,
    ).toMatch(/touch-target/)
    expect(screen.getByRole('button', { name: 'Usar' }).className).toMatch(
      /touch-target/,
    )
    expect(
      screen.getByRole('switch', { name: /¿Caduca\?/ }).className,
    ).toMatch(/touch-target/)
    expect(
      screen.getByRole('button', { name: /Guardar e Ingresar/ }).className,
    ).toMatch(/touch-target/)
  })
})

describe('interruptor "¿Caduca?" (spec 018 US4)', () => {
  it('con primer lote, va entre "Proveedor" y "Fecha de vencimiento" (orden visual y de foco)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.click(screen.getAllByRole('button', { name: 'Sumar uno' })[1])

    const proveedor = screen.getByLabelText('Proveedor')
    const interruptor = screen.getByRole('switch', { name: /¿Caduca\?/ })
    const fecha = screen.getByLabelText('Fecha de vencimiento')
    const SIGUE = Node.DOCUMENT_POSITION_FOLLOWING
    expect(proveedor.compareDocumentPosition(interruptor) & SIGUE).toBeTruthy()
    expect(interruptor.compareDocumentPosition(fecha) & SIGUE).toBeTruthy()
    // Nada enfocable entre el interruptor y la fecha.
    const enfocables = Array.from(
      document.querySelectorAll<HTMLElement>('button, input, select, textarea'),
    )
    expect(enfocables.indexOf(fecha)).toBe(enfocables.indexOf(interruptor) + 1)

    fireEvent.click(interruptor)
    expect(screen.queryByLabelText('Fecha de vencimiento')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /¿Caduca\?/ }))
    expect(screen.getByLabelText('Fecha de vencimiento')).toBeInTheDocument()
  })

  it('sin stock inicial sigue disponible (es un dato del insumo)', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    expect(screen.queryByLabelText('Fecha de vencimiento')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /¿Caduca\?/ })).toBeInTheDocument()
  })
})

describe('rueda del mouse (spec 018 FR-005)', () => {
  it('no cambia el stock inicial ni el mínimo del alta', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    esperarQueLaRuedaNoCambie(screen.getByLabelText(/^Stock inicial/), '200')
    esperarQueLaRuedaNoCambie(screen.getByLabelText('Stock mínimo (opcional)'), '5')
  })
})

/** Spec 023 T030/T034 (US1-1, US2-2, FR-005..FR-007). */
describe('AltaMaterialView — marca (spec 023)', () => {
  async function abrirAlta(nombre: string) {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Material' }))
    await screen.findByLabelText('Nombre del material')
    fireEvent.change(screen.getByLabelText('Nombre del material'), {
      target: { value: nombre },
    })
    fireEvent.change(screen.getByLabelText('Categoría'), {
      target: { value: 'Restauración' },
    })
  }

  it('el campo viene en "Sin marca" y se guarda sin tocarlo', async () => {
    await abrirAlta('Composite Z250')
    expect(screen.getByLabelText('Marca (opcional)')).toHaveTextContent('Sin marca')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('«Composite Z250» agregado al inventario')
    expect(insumosT.all()[0].marcaId).toBeNull()
  })

  it('el personal agrega una marca nueva desde el alta, sin perder lo escrito', async () => {
    await abrirAlta('Composite Z350')
    fireEvent.click(screen.getByLabelText('Marca (opcional)'))
    fireEvent.change(screen.getByLabelText('Buscar marca'), { target: { value: '3M' } })
    fireEvent.click(screen.getByRole('option', { name: /Agregar marca «3M»/ }))

    await waitFor(() =>
      expect(screen.getByLabelText('Marca (opcional)')).toHaveTextContent('3M'),
    )
    expect(screen.getByLabelText('Nombre del material')).toHaveValue('Composite Z350')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('«Composite Z350» agregado al inventario')
    const [marca] = marcasT.all()
    expect(marca).toMatchObject({ nombre: '3M', creadoPor: 'personal-1', sincronizado: false })
    expect(insumosT.all()[0].marcaId).toBe(marca.id)
  })
})

