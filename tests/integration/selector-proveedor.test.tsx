import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { Insumo, Lote, Proveedor, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      insumos: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { SelectorProveedor } from '../../src/features/proveedores/components/SelectorProveedor'
import { RecibirItemForm } from '../../src/features/compras/components/RecibirItemForm'
import { lugar1 } from '../helpers/lugarFalso'
import { proveedorFalso } from '../helpers/proveedor'
import { TENANT_1 } from '../helpers/tenancy'

const proveedoresT = db.proveedores as unknown as MemoryTable<Proveedor>
const lotesT = db.lotes as unknown as MemoryTable<Lote>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', rol: 'personal' }

const sur = proveedorFalso({ id: 'sur', nombre: 'Dental Sur' })
const norte = proveedorFalso({ id: 'norte', nombre: 'Ápice Norte' })
const viejo = proveedorFalso({
  id: 'viejo',
  nombre: 'Casa Vieja',
  desactivadoEn: '2026-05-01',
})

function reflejarStore() {
  useInventoryStore.setState({
    proveedores: proveedoresT.all().filter((p) => !p.eliminadoEn),
    isReady: true,
  })
}

/** Un formulario mínimo con el selector y el valor elegido a la vista. */
function Campo({ inicial = null }: { inicial?: string | null }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviado()
      }}
    >
      <label htmlFor="campo-proveedor">Proveedor</label>
      <SelectorProveedor
        id="campo-proveedor"
        valor={valor}
        onCambio={setValor}
      />
      <output aria-label="Elegido">{valor ?? ''}</output>
      <input aria-label="Otro campo" defaultValue="escrito" />
    </form>
  )
}
const enviado = vi.fn()

const abrir = () => fireEvent.click(screen.getByLabelText('Proveedor'))
const buscador = () => screen.getByLabelText('Buscar proveedor')
const opciones = () =>
  within(screen.getByRole('listbox')).getAllByRole('option')

beforeEach(() => {
  onMemoryDbChange(reflejarStore)
  proveedoresT.seed([sur, norte, viejo])
  lotesT.seed([])
  useAuthStore.setState({ usuario: personal, isReady: true })
  reflejarStore()
  enviado.mockReset()
})

afterEach(() => onMemoryDbChange(null))

/** Spec 021 T021 (US1-1..3, FR-005/006). */
describe('SelectorProveedor — elegir', () => {
  it('sin valor dice "Elige un proveedor"; con valor muestra el nombre', () => {
    const { unmount } = render(<Campo />)
    expect(screen.getByLabelText('Proveedor')).toHaveTextContent(
      'Elige un proveedor',
    )
    unmount()
    render(<Campo inicial="sur" />)
    expect(screen.getByLabelText('Proveedor')).toHaveTextContent('Dental Sur')
  })

  it('lista los activos en orden alfabético y filtra sin tildes ni mayúsculas', () => {
    render(<Campo />)
    abrir()
    expect(buscador()).toHaveFocus()
    expect(opciones().map((o) => o.textContent)).toEqual([
      'Ápice Norte',
      'Dental Sur',
    ])

    fireEvent.change(buscador(), { target: { value: 'APICE' } })
    // "APICE" no es el nombre completo de nadie: también se ofrece agregarlo.
    expect(opciones().map((o) => o.textContent)).toEqual([
      'Ápice Norte',
      'Agregar proveedor «APICE»',
    ])

    fireEvent.click(opciones()[0])
    expect(screen.getByLabelText('Elegido')).toHaveTextContent('norte')
    expect(screen.queryByLabelText('Buscar proveedor')).not.toBeInTheDocument()
  })

  it('teclado: flechas recorren, Enter elige sin enviar el formulario, Escape cierra sin cambiar', () => {
    render(<Campo inicial="sur" />)
    abrir()
    fireEvent.keyDown(buscador(), { key: 'ArrowDown' })
    expect(buscador()).toHaveAttribute(
      'aria-activedescendant',
      opciones()[1].id,
    )
    fireEvent.keyDown(buscador(), { key: 'ArrowUp' })
    fireEvent.keyDown(buscador(), { key: 'Escape' })
    expect(screen.getByLabelText('Elegido')).toHaveTextContent('sur')

    abrir()
    fireEvent.keyDown(buscador(), { key: 'Enter' })
    expect(screen.getByLabelText('Elegido')).toHaveTextContent('norte')
    expect(enviado).not.toHaveBeenCalled()
  })

  it('las opciones miden al menos 48 px y marcan la elegida', () => {
    render(<Campo inicial="sur" />)
    abrir()
    for (const opcion of opciones())
      expect(opcion.className).toMatch(/min-h-12/)
    expect(opciones()[1]).toHaveAttribute('aria-selected', 'true')
  })
})

/** Spec 021 T027 (US2-1..5, FR-008). */
describe('SelectorProveedor — agregar', () => {
  it('un nombre nuevo se agrega, queda elegido y el resto del formulario sigue igual', async () => {
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: '  Casa   Norte ' } })
    const agregar = screen.getByRole('option', {
      name: 'Agregar proveedor «Casa Norte»',
    })
    fireEvent.click(agregar)

    await waitFor(() =>
      expect(screen.queryByLabelText('Buscar proveedor')).toBeNull(),
    )
    const nuevo = proveedoresT.all().find((p) => p.nombre === 'Casa Norte')
    expect(nuevo).toMatchObject({
      creadoPor: 'personal-1',
      sincronizado: false,
    })
    expect(screen.getByLabelText('Elegido')).toHaveTextContent(nuevo!.id)
    expect(screen.getByLabelText('Proveedor')).toHaveTextContent('Casa Norte')
    expect(screen.getByLabelText('Otro campo')).toHaveValue('escrito')
  })

  it('con la misma clave que uno activo no ofrece agregar: se elige el existente', () => {
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: ' dental  súr' } })
    expect(
      screen.queryByRole('option', { name: /Agregar proveedor/ }),
    ).not.toBeInTheDocument()
    fireEvent.keyDown(buscador(), { key: 'Enter' })
    expect(screen.getByLabelText('Elegido')).toHaveTextContent('sur')
    expect(proveedoresT.all()).toHaveLength(3)
  })

  it('el nombre de un desactivado avisa; solo administración puede reactivarlo y usarlo', async () => {
    const { unmount } = render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: 'casa vieja' } })
    expect(
      screen.getByText(/«Casa Vieja» está desactivado/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Reactivar y usar' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Agregar proveedor/ }),
    ).not.toBeInTheDocument()
    unmount()

    useAuthStore.setState({ usuario: admin, isReady: true })
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: 'casa vieja' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar y usar' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Elegido')).toHaveTextContent('viejo'),
    )
    expect(
      proveedoresT.all().find((p) => p.id === 'viejo')?.desactivadoEn,
    ).toBeNull()
  })

  it('con el catálogo vacío invita a escribir para agregar', () => {
    proveedoresT.seed([])
    reflejarStore()
    render(<Campo />)
    abrir()
    expect(
      screen.getByText(
        'Todavía no hay proveedores. Escribe el nombre para agregar uno.',
      ),
    ).toBeInTheDocument()
  })
})

/** Spec 021 (US1-1, FR-006): el predeterminado del lugar en la recepción. */
describe('Recibir con el predeterminado del lugar', () => {
  const insumo: Insumo = {
    id: 'i1',
    tenantId: TENANT_1,
    nombre: 'Guantes',
    categoria: 'Cirugía',
    unidadMedida: 'caja',
    unidadCompra: 'caja',
    contenido: 1,
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
  }

  beforeEach(() => {
    useLugarStore.setState({
      lugares: [{ ...lugar1, proveedorPredeterminadoId: 'sur' }],
      lugarActivoId: lugar1.id,
      isReady: true,
    })
  })

  it('viene elegido, se guarda sin tocarlo, y Escape en el selector no cierra la recepción', async () => {
    const onRecibido = vi.fn()
    render(
      <RecibirItemForm
        insumo={insumo}
        itemCompraId={null}
        onRecibido={onRecibido}
        onCancelar={() => {}}
      />,
    )
    expect(screen.getByLabelText('Proveedor')).toHaveTextContent('Dental Sur')

    abrir()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('Buscar proveedor')).not.toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Recibir Guantes' }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))
    await waitFor(() => expect(onRecibido).toHaveBeenCalled())
    expect(lotesT.all()[0]).toMatchObject({
      proveedorId: 'sur',
      proveedor: 'Dental Sur',
    })
  })

  it('sin predeterminado pide elegir con el aviso de siempre', async () => {
    useLugarStore.setState({ lugares: [lugar1] })
    render(
      <RecibirItemForm
        insumo={insumo}
        itemCompraId={null}
        onRecibido={() => {}}
        onCancelar={() => {}}
      />,
    )
    fireEvent.change(screen.getByLabelText('Número de lote'), {
      target: { value: 'L9' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))
    expect(await screen.findByText('Ingresa el proveedor.')).toBeInTheDocument()
    expect(lotesT.all()).toHaveLength(0)
  })
})
