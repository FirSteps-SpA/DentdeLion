import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Insumo, Marca, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      lotes: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      movimientos: new MemoryTable(),
      categorias: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { lugar1 } from '../helpers/lugarFalso'
import { TENANT_1 } from '../helpers/tenancy'

const marcasT = db.marcas as unknown as MemoryTable<Marca>
const insumosT = db.insumos as unknown as MemoryTable<Insumo>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin Uno',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', nombre: 'Personal', rol: 'personal' }

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

const insumo = (id: string, marcaId: string | null, dadoDeBajaEn: string | null = null) =>
  ({ id, tenantId: TENANT_1, nombre: id, categoria: 'Resinas', marcaId, dadoDeBajaEn }) as Insumo

function reflejarStore() {
  const todos = insumosT.all()
  useInventoryStore.setState({
    marcas: marcasT.all().filter((m) => !m.eliminadoEn),
    insumos: todos.filter((i) => !i.dadoDeBajaEn),
    insumosDadosDeBaja: todos.filter((i) => !!i.dadoDeBajaEn),
    isReady: true,
  })
  useLugarStore.setState({ lugares: [lugar1], lugarActivoId: lugar1.id, isReady: true })
}

function abrirSeccion() {
  render(<AjustesView />)
  fireEvent.click(screen.getByRole('button', { name: 'Marcas' }))
}

const filas = () => screen.getAllByRole('button', { name: /^Editar / })
const hoja = () => screen.getByRole('dialog')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  onMemoryDbChange(reflejarStore)
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
  useAuthStore.setState({ usuario: admin, isReady: true })
  marcasT.seed([
    marca('tres', '3M'),
    marca('gc', 'GC'),
    marca('libre', 'Libre'),
    marca('dentsply', 'Dentsply', { desactivadoEn: '2026-10-01T00:00:00.000Z' }),
  ])
  insumosT.seed([
    insumo('z350', 'tres'),
    insumo('adhesivo', 'tres'),
    insumo('fuji', 'gc', '2026-10-01T00:00:00.000Z'),
  ])
  reflejarStore()
})

afterEach(() => {
  onMemoryDbChange(null)
  useInventoryStore.setState({ marcas: [], insumos: [], insumosDadosDeBaja: [] })
})

/** Spec 023 T043 (US4-1..6, FR-015..FR-019). */
describe('Ajustes → Marcas', () => {
  it('la tarjeta va entre Proveedores e Insumos dados de baja, con su resumen', () => {
    render(<AjustesView />)
    const tarjetas = within(screen.getByRole('list', { name: 'Secciones de Ajustes' }))
      .getAllByRole('button')
      .map((b) => b.textContent)
    const i = tarjetas.findIndex((t) => t?.startsWith('Marcas'))
    expect(tarjetas[i]).toBe('Marcas3 marcas')
    expect(tarjetas[i - 1]).toMatch(/^Proveedores/)
    expect(tarjetas[i + 1]).toMatch(/^Insumos dados de baja/)
  })

  it('lista las activas en orden con la cantidad de insumos (contando los dados de baja)', () => {
    abrirSeccion()
    expect(filas().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar 3M',
      'Editar GC',
      'Editar Libre',
    ])
    expect(filas()[0]).toHaveTextContent('2 insumos')
    expect(filas()[1]).toHaveTextContent('1 insumo')
    expect(filas()[2]).toHaveTextContent('Sin insumos')
  })

  it('crea una marca; un nombre repetido avisa', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar marca' }))
    fireEvent.change(within(hoja()).getByLabelText('Nombre'), { target: { value: ' 3m ' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(await within(hoja()).findByText('Ya existe una marca con ese nombre.')).toBeInTheDocument()

    fireEvent.change(within(hoja()).getByLabelText('Nombre'), { target: { value: 'Ivoclar' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(marcasT.all().find((m) => m.nombre === 'Ivoclar')).toMatchObject({
      creadoPor: 'admin-1',
      sincronizado: false,
    })
  })

  it('renombra una marca', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Libre' }))
    fireEvent.change(within(hoja()).getByLabelText('Nombre'), { target: { value: 'Kerr' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(marcasT.all().find((m) => m.id === 'libre')?.nombre).toBe('Kerr')
  })

  it('Eliminar solo sin insumos y con confirmación', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Editar GC' }))
    expect(within(hoja()).queryByRole('button', { name: 'Eliminar' })).toBeNull()
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Cerrar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Editar Libre' }))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Eliminar' }))
    expect(within(hoja()).getByText('¿Eliminar «Libre»? No la usa ningún insumo.')).toBeInTheDocument()
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(marcasT.all().find((m) => m.id === 'libre')?.eliminadoEn).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar Libre' })).toBeNull()
  })

  it('desactiva una marca y la reactiva desde "Desactivadas"', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Editar 3M' }))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Editar 3M' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Desactivadas (2)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar 3M' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar 3M' })).toBeInTheDocument())
  })

  it('con 26 marcas aparece "Ver más"', () => {
    marcasT.seed(
      Array.from({ length: 26 }, (_, n) => marca(`m${n}`, `Marca ${String(n).padStart(2, '0')}`)),
    )
    reflejarStore()
    abrirSeccion()
    expect(filas()).toHaveLength(25)
    fireEvent.click(screen.getByRole('button', { name: /Ver más/ }))
    expect(filas()).toHaveLength(26)
  })

  it('el personal no ve la tarjeta ni entra por la URL', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    window.history.replaceState(null, '', '/#ajustes/marcas')
    render(<AjustesView />)
    expect(screen.queryByRole('button', { name: 'Agregar marca' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcas' })).toBeNull()
  })
})
