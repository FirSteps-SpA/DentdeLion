import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Marca, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      marcas: new MemoryTable(),
      insumos: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { SelectorMarca } from '../../src/features/marcas/components/SelectorMarca'
import { TENANT_1 } from '../helpers/tenancy'

const marcasT = db.marcas as unknown as MemoryTable<Marca>

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

function marca(id: string, nombre: string, extra: Partial<Marca> = {}): Marca {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    creadoPor: 'admin-1',
    creadoEn: '2026-10-24T10:00:00.000Z',
    desactivadoEn: null,
    eliminadoEn: null,
    sincronizado: true,
    ...extra,
  }
}

const tresM = marca('tres', '3M')
const ivoclar = marca('ivoclar', 'Ívoclar')
const gc = marca('gc', 'GC', { desactivadoEn: '2026-10-01T00:00:00.000Z' })

function reflejarStore() {
  useInventoryStore.setState({
    marcas: marcasT.all().filter((m) => !m.eliminadoEn),
    isReady: true,
  })
}

/** Un formulario mínimo con el selector y el valor elegido a la vista. */
function Campo({ inicial = null }: { inicial?: string | null }) {
  const [valor, setValor] = useState<string | null>(inicial)
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="campo-marca">Marca</label>
      <SelectorMarca id="campo-marca" valor={valor} onCambio={setValor} />
      <output aria-label="Elegida">{valor ?? 'ninguna'}</output>
      <input aria-label="Otro campo" defaultValue="escrito" />
    </form>
  )
}

const abrir = () => fireEvent.click(screen.getByLabelText('Marca'))
const buscador = () => screen.getByLabelText('Buscar marca')
const opciones = () => within(screen.getByRole('listbox')).getAllByRole('option')

beforeEach(() => {
  onMemoryDbChange(reflejarStore)
  marcasT.seed([tresM, ivoclar, gc])
  useAuthStore.setState({ usuario: personal, isReady: true })
  reflejarStore()
})

afterEach(() => onMemoryDbChange(null))

/** Spec 023 T024 (US1-1..3, FR-005/006). */
describe('SelectorMarca — elegir', () => {
  it('sin valor dice "Sin marca"; con valor muestra el nombre', () => {
    const { unmount } = render(<Campo />)
    expect(screen.getByLabelText('Marca')).toHaveTextContent('Sin marca')
    unmount()
    render(<Campo inicial="tres" />)
    expect(screen.getByLabelText('Marca')).toHaveTextContent('3M')
  })

  it('"Sin marca" va primero; luego las activas en orden, sin las desactivadas', () => {
    render(<Campo />)
    abrir()
    expect(opciones().map((o) => o.textContent)).toEqual(['Sin marca', '3M', 'Ívoclar'])
    expect(opciones()[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('filtra sin tildes ni mayúsculas y elige', () => {
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: 'IVO' } })
    expect(opciones().map((o) => o.textContent)).toEqual(['Ívoclar', 'Agregar marca «IVO»'])
    fireEvent.click(opciones()[0])
    expect(screen.getByLabelText('Elegida')).toHaveTextContent('ivoclar')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('"Sin marca" quita la marca elegida', () => {
    render(<Campo inicial="tres" />)
    abrir()
    fireEvent.click(opciones()[0])
    expect(screen.getByLabelText('Elegida')).toHaveTextContent('ninguna')
  })

  it('el valor actual desactivado se muestra como desactivada', () => {
    render(<Campo inicial="gc" />)
    expect(screen.getByLabelText('Marca')).toHaveTextContent('«GC» (desactivada)')
  })

  it('teclado: flechas recorren, Enter elige, Escape cierra sin cambiar', () => {
    render(<Campo />)
    abrir()
    fireEvent.keyDown(buscador(), { key: 'ArrowDown' })
    fireEvent.keyDown(buscador(), { key: 'Enter' })
    expect(screen.getByLabelText('Elegida')).toHaveTextContent('tres')

    abrir()
    fireEvent.keyDown(buscador(), { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByLabelText('Elegida')).toHaveTextContent('tres')
  })
})

/** Spec 023 T033 (US2-1..4, FR-007). */
describe('SelectorMarca — agregar', () => {
  it('sin coincidencia ofrece "Agregar marca «…»", la crea y la deja elegida', async () => {
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: '  Dentsply   Sirona ' } })
    const agregar = screen.getByRole('option', { name: /Agregar marca «Dentsply Sirona»/ })
    fireEvent.click(agregar)

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    const creada = marcasT.all().find((m) => m.nombre === 'Dentsply Sirona')
    expect(creada).toMatchObject({ creadoPor: 'personal-1', sincronizado: false })
    expect(screen.getByLabelText('Elegida')).toHaveTextContent(creada!.id)
    expect(screen.getByLabelText('Otro campo')).toHaveValue('escrito')
  })

  it('" 3m " no ofrece agregar: coincide con 3M', () => {
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: ' 3m ' } })
    expect(screen.queryByRole('option', { name: /Agregar marca/ })).toBeNull()
    expect(opciones().map((o) => o.textContent)).toEqual(['3M'])
  })

  it('una desactivada avisa; "Reactivar y usar" solo para administración', async () => {
    const { unmount } = render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: 'gc' } })
    expect(screen.getByText('«GC» está desactivada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivar y usar' })).toBeNull()
    expect(screen.queryByRole('option', { name: /Agregar marca/ })).toBeNull()
    unmount()

    useAuthStore.setState({ usuario: admin, isReady: true })
    render(<Campo />)
    abrir()
    fireEvent.change(buscador(), { target: { value: 'gc' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar y usar' }))

    await waitFor(() => expect(screen.getByLabelText('Elegida')).toHaveTextContent('gc'))
    expect(marcasT.all().find((m) => m.id === 'gc')).toMatchObject({
      desactivadoEn: null,
      sincronizado: false,
    })
  })

  it('con el catálogo vacío invita a escribir una marca', () => {
    marcasT.seed([])
    reflejarStore()
    render(<Campo />)
    abrir()
    expect(
      screen.getByText('Todavía no hay marcas. Escribe el nombre para agregar una.'),
    ).toBeInTheDocument()
  })
})
