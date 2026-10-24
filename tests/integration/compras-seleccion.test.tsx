import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type {
  Borrador,
  Insumo,
  ItemCompra,
  Lote,
  Movimiento,
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
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'
import { itemManual, sugeridoConPrecio } from '../helpers/compras'

const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

function cargar(
  sugeridos: ReturnType<typeof sugeridoConPrecio>[],
  manuales: ItemCompra[] = [],
) {
  const insumos: Insumo[] = sugeridos.map((s) => s.insumo)
  const lotes: Lote[] = sugeridos.map((s) => s.lote)
  const movimientos: Movimiento[] = sugeridos.map((s) => s.ingreso)
  useInventoryStore.setState({
    insumos,
    lotes,
    movimientos,
    itemsCompra: manuales,
    cambiosLote: [],
    cambiosInsumo: [],
    minimosLugar: [],
    proveedores: [],
    isReady: true,
  })
}

/** El texto visible de la barra del pedido, sin espacios duplicados. */
function barra(): string {
  return (
    screen.getByRole('region', { name: 'Pedido' }).textContent ?? ''
  ).replace(/\s+/g, ' ')
}

beforeEach(() => {
  borradoresT.seed([])
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'usuario-1',
      email: 'a@x.cl',
      nombre: 'Ana',
      rol: 'administrador',
      autenticadoEn: '2026-01-01T00:00:00.000Z',
    },
    isReady: true,
  })
  usarLugar1()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const articaina = () => sugeridoConPrecio('i1', 'Articaína', 2, 15000)
const guantes = () => sugeridoConPrecio('i2', 'Guantes', 3, 5990)
const fresas = () => sugeridoConPrecio('i3', 'Fresas', 1, null)

describe('Compras — selección y subtotal (spec 022 US1)', () => {
  it('cada ítem tiene su casilla y al abrir no hay nada marcado', async () => {
    cargar([articaina(), guantes()], [itemManual({})])
    render(<ComprasView />)

    for (const nombre of ['Articaína', 'Guantes', 'Torundas']) {
      expect(screen.getByLabelText(`Seleccionar ${nombre}`)).not.toBeChecked()
    }
    expect(barra()).toContain('Selecciona lo que vas a pedir')
    expect(
      screen.getByRole('button', { name: 'Enviar por WhatsApp' }),
    ).toBeDisabled()
  })

  it('suma cantidad × precio de lo marcado y muestra el monto de cada ítem', async () => {
    cargar([articaina(), guantes(), fresas()])
    render(<ComprasView />)

    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    fireEvent.click(screen.getByLabelText('Seleccionar Guantes'))

    // 2 × $15.000 + 3 × $5.990 = $47.970
    await waitFor(() => expect(barra()).toContain('2 seleccionados'))
    expect(barra()).toMatch(/Subtotal estimado.*\$47\.970/)
    expect(screen.getByText('$30.000')).toBeInTheDocument()
    expect(screen.getByText('$17.970')).toBeInTheDocument()
    expect(
      screen.getByRole('group', {
        name: 'Subtotal estimado (precios de la última compra): $47.970',
      }),
    ).toBeInTheDocument()
  })

  it('lo que no tiene precio o cantidad no suma y se cuenta aparte', async () => {
    cargar(
      [articaina(), fresas()],
      [itemManual({ nombre: 'Torundas', cantidad: null })],
    )
    render(<ComprasView />)

    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    fireEvent.click(screen.getByLabelText('Seleccionar Fresas'))
    fireEvent.click(screen.getByLabelText('Seleccionar Torundas'))

    await waitFor(() => expect(barra()).toContain('3 seleccionados'))
    expect(barra()).toContain('2 sin precio')
    expect(barra()).toContain('$30.000')
    expect(screen.getAllByText('Sin precio')).toHaveLength(2)
  })

  it('"Seleccionar todo" marca todo y, de nuevo, desmarca todo', async () => {
    cargar([articaina(), guantes()], [itemManual({})])
    render(<ComprasView />)
    const todo = screen.getByLabelText('Seleccionar todo') as HTMLInputElement

    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    await waitFor(() => expect(todo.indeterminate).toBe(true))

    fireEvent.click(todo)
    await waitFor(() => expect(barra()).toContain('3 seleccionados'))
    expect(todo).toBeChecked()

    fireEvent.click(todo)
    await waitFor(() =>
      expect(barra()).toContain('Selecciona lo que vas a pedir'),
    )
  })

  it('la selección sigue al volver a abrir Compras (FR-003)', async () => {
    cargar([articaina(), guantes()])
    const primero = render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Guantes'))
    await waitFor(() =>
      expect(
        borradoresT.all().find((b) => b.id === 'seleccion-compras'),
      ).toBeTruthy(),
    )
    primero.unmount()

    render(<ComprasView />)
    await waitFor(() =>
      expect(screen.getByLabelText('Seleccionar Guantes')).toBeChecked(),
    )
    expect(screen.getByLabelText('Seleccionar Articaína')).not.toBeChecked()
  })

  it('un ítem que sale de la lista deja de sumar', async () => {
    const torundas = itemManual({ cantidad: 2 })
    cargar([articaina()], [torundas])
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    fireEvent.click(screen.getByLabelText('Seleccionar Torundas'))
    await waitFor(() => expect(barra()).toContain('2 seleccionados'))

    act(() => {
      useInventoryStore.setState({
        itemsCompra: [{ ...torundas, estado: 'comprado' }],
      })
    })
    await waitFor(() => expect(barra()).toContain('1 seleccionado'))
    expect(
      within(screen.getByRole('region', { name: 'Pedido' })).getByText(
        '$30.000',
      ),
    ).toBeInTheDocument()
  })
})

describe('Compras — copiar y compartir lo seleccionado (spec 022 US3)', () => {
  it('Copiar deja en el portapapeles el pedido con solo lo marcado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    cargar(
      [articaina(), guantes(), fresas()],
      [itemManual({ cantidad: 3 }), itemManual({ id: 'm2', nombre: 'Gasas' })],
    )
    render(<ComprasView />)

    fireEvent.click(screen.getByLabelText('Seleccionar Guantes'))
    fireEvent.click(screen.getByLabelText('Seleccionar Torundas'))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const texto = writeText.mock.calls[0][0] as string
    expect(texto.split('\n')).toEqual([
      'Hola, ¿cómo están? Me gustaría saber si tienen los siguientes materiales, fechas de vencimiento y sus precios, por favor',
      '',
      '- Guantes — 3 cajas',
      '- Torundas — 3',
    ])
    await screen.findByText('Lista copiada al portapapeles.')
  })

  it('Compartir usa el mismo mensaje', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    cargar([articaina(), guantes()])
    render(<ComprasView />)

    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    fireEvent.click(screen.getByRole('button', { name: 'Compartir' }))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share.mock.calls[0][0].text).toMatch(/\n\n- Articaína — 2 cajas$/)
  })

  it('si el portapapeles falla, lo avisa', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('x')) },
    })
    cargar([articaina()])
    render(<ComprasView />)

    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }))

    await screen.findByText('No se pudo copiar la lista.')
  })
})
