import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { Lote, Lugar, Proveedor, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
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
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { proveedorFalso } from '../helpers/proveedor'
import { TENANT_1 } from '../helpers/tenancy'
import { SALUDO_PEDIDO_POR_DEFECTO } from '../../src/features/compras/lib/pedido'
import type { ConfiguracionAlertas } from '../../src/lib/db'

const proveedoresT = db.proveedores as unknown as MemoryTable<Proveedor>
const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const configT = db.configuracionAlertas as unknown as MemoryTable<ConfiguracionAlertas>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin Uno',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = {
  ...admin,
  id: 'personal-1',
  nombre: 'Personal',
  rol: 'personal',
}

const sur = proveedorFalso({
  id: 'sur',
  nombre: 'Dental Sur',
  whatsapp: '56912345678',
  contacto: 'Paula',
})
const norte = proveedorFalso({ id: 'norte', nombre: 'Casa Norte' })

function reflejarStore() {
  useInventoryStore.setState({
    proveedores: proveedoresT.all().filter((p) => !p.eliminadoEn),
    lotes: lotesT.all(),
    isReady: true,
  })
  useLugarStore.setState({
    lugares: lugaresT.all(),
    lugarActivoId: lugar1.id,
    isReady: true,
  })
}

function abrirSeccion() {
  render(<AjustesView />)
  fireEvent.click(screen.getByRole('button', { name: 'Proveedores' }))
}

const filas = () => screen.getAllByRole('button', { name: /^Editar / })
const hoja = () => screen.getByRole('dialog')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  onMemoryDbChange(reflejarStore)
  useAlertasStore.setState({
    nivelesAvisoDias: [30, 7, 1],
    saludoPedido: SALUDO_PEDIDO_POR_DEFECTO,
    isReady: true,
  })
  configT.seed([])
  useAuthStore.setState({ usuario: admin, isReady: true })
  proveedoresT.seed([sur, norte])
  lugaresT.seed([{ ...lugar1, proveedorPredeterminadoId: 'sur' }])
  lotesT.seed([])
  reflejarStore()
})

afterEach(() => onMemoryDbChange(null))

/** Spec 021 T039 (US3-1..8, FR-010..FR-016). */
describe('Ajustes → Proveedores', () => {
  it('la tarjeta va entre Categorías e Insumos dados de baja, con su resumen', () => {
    render(<AjustesView />)
    const tarjetas = within(
      screen.getByRole('list', { name: 'Secciones de Ajustes' }),
    )
      .getAllByRole('button')
      .map((b) => b.textContent)
    const i = tarjetas.findIndex((t) => t?.startsWith('Proveedores'))
    expect(tarjetas[i]).toBe('Proveedores2 proveedores')
    expect(tarjetas[i - 1]).toMatch(/^Categorías/)
    expect(tarjetas[i + 1]).toMatch(/^Insumos dados de baja/)
  })

  it('lista los activos en orden, con WhatsApp, contacto y "Predeterminado"', () => {
    abrirSeccion()
    expect(filas().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar Casa Norte',
      'Editar Dental Sur',
    ])
    const filaSur = filas()[1]
    expect(filaSur).toHaveTextContent('+56 9 1234 5678 · Paula')
    expect(within(filaSur).getByText('Predeterminado')).toBeInTheDocument()
  })

  it('crea uno con WhatsApp y lo deja predeterminado; un nombre repetido avisa', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }))
    fireEvent.change(within(hoja()).getByLabelText('Nombre'), {
      target: { value: ' dental súr ' },
    })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(
      await within(hoja()).findByText('Ya existe un proveedor con ese nombre.'),
    ).toBeInTheDocument()

    fireEvent.change(within(hoja()).getByLabelText('Nombre'), {
      target: { value: 'Ápice' },
    })
    fireEvent.change(within(hoja()).getByLabelText('WhatsApp'), {
      target: { value: '9 8765 4321' },
    })
    fireEvent.click(
      within(hoja()).getByRole('switch', {
        name: `Predeterminado en ${lugar1.nombre}`,
      }),
    )
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    const nuevo = proveedoresT.all().find((p) => p.nombre === 'Ápice')!
    expect(nuevo).toMatchObject({
      whatsapp: '56987654321',
      sincronizado: false,
    })
    expect(lugaresT.all()[0]).toMatchObject({
      proveedorPredeterminadoId: nuevo.id,
      sincronizado: false,
    })
    expect(
      screen.getByRole('button', { name: 'Editar Ápice' }),
    ).toHaveTextContent('+56 9 8765 4321')
  })

  it('renombra y cambia el contacto', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Dental Sur' }))
    fireEvent.change(within(hoja()).getByLabelText('Nombre'), {
      target: { value: 'Dental Sur Ltda.' },
    })
    fireEvent.change(within(hoja()).getByLabelText('Contacto'), {
      target: { value: 'Marta' },
    })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(proveedoresT.all().find((p) => p.id === 'sur')).toMatchObject({
      nombre: 'Dental Sur Ltda.',
      contacto: 'Marta',
      whatsapp: '56912345678',
    })
  })

  it('con dos lugares, el predeterminado es por lugar', async () => {
    lugaresT.seed([
      { ...lugar1, proveedorPredeterminadoId: 'sur' },
      { ...lugar2, proveedorPredeterminadoId: null },
    ])
    reflejarStore()
    abrirSeccion()
    expect(
      within(filas()[1]).getByText(`Predeterminado · ${lugar1.nombre}`),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar Casa Norte' }))
    fireEvent.click(
      within(hoja()).getByRole('switch', {
        name: `Predeterminado en ${lugar2.nombre}`,
      }),
    )
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    expect(lugaresT.all().map((l) => l.proveedorPredeterminadoId)).toEqual([
      'sur',
      'norte',
    ])
  })

  it('desactivar lo saca de la lista y del predeterminado; se reactiva desde "Desactivados"', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Dental Sur' }))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    expect(filas().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar Casa Norte',
    ])
    expect(lugaresT.all()[0].proveedorPredeterminadoId).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Desactivados (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }))
    await waitFor(() => expect(filas()).toHaveLength(2))
  })

  it('eliminar: con confirmación si no tiene lotes; con lotes no se ofrece', async () => {
    lotesT.seed([{ id: 'l1', proveedorId: 'sur' } as Lote])
    reflejarStore()
    abrirSeccion()

    fireEvent.click(screen.getByRole('button', { name: 'Editar Dental Sur' }))
    expect(
      within(hoja()).queryByRole('button', { name: 'Eliminar' }),
    ).not.toBeInTheDocument()
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Cerrar' }))

    fireEvent.click(screen.getByRole('button', { name: 'Editar Casa Norte' }))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Eliminar' }))
    expect(
      within(hoja()).getByText(
        '¿Eliminar «Casa Norte»? No tiene lotes registrados.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Eliminar' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    expect(
      proveedoresT.all().find((p) => p.id === 'norte')?.eliminadoEn,
    ).not.toBeNull()
    expect(filas().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Editar Dental Sur',
    ])
  })

  it('con más de 25 proveedores muestra "Ver más"', () => {
    proveedoresT.seed(
      Array.from({ length: 30 }, (_, i) =>
        proveedorFalso({
          id: `p${i}`,
          nombre: `Proveedor ${String(i).padStart(2, '0')}`,
        }),
      ),
    )
    reflejarStore()
    abrirSeccion()
    expect(filas()).toHaveLength(25)
    fireEvent.click(screen.getByRole('button', { name: /Ver más/ }))
    expect(filas()).toHaveLength(30)
  })

  it('el personal no ve la tarjeta en el índice', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(<AjustesView />)
    expect(
      screen.queryByRole('button', { name: 'Proveedores' }),
    ).not.toBeInTheDocument()
  })

  it('el personal que llega por la URL vuelve al índice', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    window.history.replaceState(null, '', '/#ajustes/proveedores')
    render(<AjustesView />)
    expect(
      screen.queryByRole('button', { name: /Agregar proveedor/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ajustes' }),
    ).toBeInTheDocument()
  })
})

/** Spec 022 T025 (US5, FR-021..FR-023). */
describe('Ajustes → Proveedores → Mensaje del pedido', () => {
  const campo = () => screen.getByLabelText('Mensaje del pedido') as HTMLTextAreaElement

  it('muestra el saludo de la clienta con su contador; Guardar y Restablecer deshabilitados', () => {
    abrirSeccion()
    expect(campo().value).toBe(SALUDO_PEDIDO_POR_DEFECTO)
    expect(screen.getByText(`${SALUDO_PEDIDO_POR_DEFECTO.length}/500`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Restablecer' })).toBeDisabled()
  })

  it('editar y guardar lo deja para subir y lo confirma', async () => {
    abrirSeccion()
    fireEvent.change(campo(), { target: { value: 'Hola Paula, ¿tienen esto?' } })
    expect(screen.getByText('25/500')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByText('Saludo guardado.')
    expect(configT.all()[0]).toMatchObject({
      saludoPedido: 'Hola Paula, ¿tienen esto?',
      sincronizado: false,
    })
  })

  it('con un saludo propio, Restablecer vuelve al de la clienta', async () => {
    useAlertasStore.setState({ saludoPedido: 'Hola Paula' })
    abrirSeccion()
    expect(campo().value).toBe('Hola Paula')

    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }))
    await screen.findByText('Saludo restablecido.')
    expect(configT.all()[0]).toMatchObject({ saludoPedido: null, sincronizado: false })

    // La liveQuery trae el valor efectivo y el campo se reinicia.
    useAlertasStore.setState({ saludoPedido: SALUDO_PEDIDO_POR_DEFECTO })
    await waitFor(() => expect(campo().value).toBe(SALUDO_PEDIDO_POR_DEFECTO))
    expect(screen.getByRole('button', { name: 'Restablecer' })).toBeDisabled()
  })

  it('el campo no admite más de 500 caracteres', () => {
    abrirSeccion()
    expect(campo()).toHaveAttribute('maxLength', '500')
  })
})
