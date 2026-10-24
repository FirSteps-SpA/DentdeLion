import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
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
      borradores: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { editarInsumo, MENSAJE_USAR_CONVERSION } from '../../src/features/insumos/lib/catalogo'
import { AltaMaterialView } from '../../src/features/insumos/components/AltaMaterialView'
import { EditarInsumoForm } from '../../src/features/insumos/components/EditarInsumoForm'
import { InsumoDetalle } from '../../src/features/insumos/components/InsumoDetalle'
import { computeStockLote } from '../../src/features/insumos/lib/stock'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

/**
 * Spec 015 US1 (T027): la presentación se define en el alta (cualquier rol,
 * FR-006/US1-7), se edita solo por administración sin tocar el stock
 * (FR-007) y se muestra a todos (FR-005, US1-6).
 */
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>

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

const articaina: Insumo = {
  id: 'art',
  tenantId: TENANT_1,
  nombre: 'Articaína 4%',
  categoria: 'Cirugía',
  unidadMedida: 'cartucho',
  unidadCompra: 'caja',
  contenido: 50,
  permiteDecimales: false,
  caduca: true,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 10,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}
const loteArticaina: Lote = {
  id: 'l1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  insumoId: 'art',
  numeroLote: 'A1',
  proveedor: 'Septodont',
  proveedorId: null,
  fechaCaducidad: '2027-01-01',
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-01-02T00:00:00.000Z',
  cantidadIngresada: 2,
  unidadIngresada: 'caja',
  contenido: 50,
  unidadConsumo: 'cartucho',
  precioCompra: null,
}
const ingreso: Movimiento = {
  tratamientoRealizadoId: null,
  id: 'm1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  tipo: 'ingreso',
  loteId: 'l1',
  cantidad: 100,
  unidad: 'cartucho',
  usuarioId: 'admin-1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-02T00:00:00.000Z',
  sincronizado: true,
}

function renderAlta() {
  const onCreated = vi.fn()
  render(
    <AltaMaterialView
      onCreated={onCreated}
      onCancel={() => {}}
      onAbrirExistente={() => {}}
    />,
  )
  return onCreated
}

async function llenarNombreYCategoria(nombre: string) {
  await screen.findByLabelText('Nombre del material')
  fireEvent.change(screen.getByLabelText('Nombre del material'), {
    target: { value: nombre },
  })
  fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Cirugía' } })
}

beforeEach(() => {
  usarLugar1()
  insumosT.seed([])
  lotesT.seed([])
  movimientosT.seed([])
  cambiosT.seed([])
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [], categorias: [], isReady: true })
})

describe('alta con presentación (US1-1, US1-7)', () => {
  it.each([
    ['administración', admin],
    ['personal', personal],
  ])('%s define Caja × 50 cartuchos', async (_rol, usuario) => {
    useAuthStore.setState({ usuario, isReady: true })
    const onCreated = renderAlta()
    await llenarNombreYCategoria('Articaína 4%')

    fireEvent.change(screen.getByLabelText('Unidad de consumo'), {
      target: { value: 'cartucho' },
    })
    fireEvent.change(screen.getByLabelText('Se compra por'), { target: { value: 'caja' } })
    fireEvent.change(screen.getByLabelText(/^Contenido/), { target: { value: '50' } })
    expect(screen.getByText('Caja × 50 cartuchos')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(insumosT.all()[0]).toMatchObject({
      unidadMedida: 'cartucho',
      unidadCompra: 'caja',
      contenido: 50,
    })
  })

  it('un Kit sin unidad de compra distinta no pide contenido (US1-2)', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    const onCreated = renderAlta()
    await llenarNombreYCategoria('Kit de blanqueamiento')
    fireEvent.change(screen.getByLabelText('Unidad de consumo'), { target: { value: 'kit' } })

    expect(screen.queryByLabelText(/^Contenido/)).not.toBeInTheDocument()
    expect(screen.getByText(/^Presentación:/)).toHaveTextContent('Presentación: Kit')

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(insumosT.all()[0]).toMatchObject({
      unidadMedida: 'kit',
      unidadCompra: 'kit',
      contenido: 1,
    })
  })

  it('rechaza un contenido vacío al comprar por otra unidad', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    const onCreated = renderAlta()
    await llenarNombreYCategoria('Guantes')
    fireEvent.change(screen.getByLabelText('Unidad de consumo'), { target: { value: 'unidad' } })
    fireEvent.change(screen.getByLabelText('Se compra por'), { target: { value: 'caja' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText(/Indica cuántas unidades trae/)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })
})

describe('edición de la presentación (US1-3, FR-006, FR-007)', () => {
  beforeEach(() => {
    insumosT.seed([articaina])
    lotesT.seed([loteArticaina])
    movimientosT.seed([ingreso])
    useInventoryStore.setState({
      insumos: [articaina],
      lotes: [loteArticaina],
      movimientos: [ingreso],
      isReady: true,
    })
  })

  it('cambiar a cajas de 100 deja un cambio auditable y no toca el stock', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    const onGuardado = vi.fn()
    render(<EditarInsumoForm insumo={articaina} onGuardado={onGuardado} onCancelar={() => {}} />)

    // Con movimientos, la unidad de consumo no se edita aquí (FR-007a).
    expect(screen.queryByLabelText('Unidad de consumo')).not.toBeInTheDocument()
    expect(screen.getByText(/Convertir unidad/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^Contenido/), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())

    const cambios = cambiosT.all()
    expect(cambios).toHaveLength(1)
    expect(cambios[0]).toMatchObject({
      campo: 'contenido',
      valorAnterior: 50,
      valorNuevo: 100,
      usuarioId: 'admin-1',
      factor: null,
    })
    expect(insumosT.all()[0].contenido).toBe(100)
    expect(movimientosT.all()).toEqual([ingreso])
    expect(computeStockLote(movimientosT.all())).toBe(100)
  })

  it('editar la unidad de consumo de un insumo con lotes exige la conversión', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    await expect(editarInsumo('art', { unidadMedida: 'unidad' })).rejects.toThrow(
      MENSAJE_USAR_CONVERSION,
    )
    expect(cambiosT.all()).toEqual([])
  })

  it('personal no modifica la presentación', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    await expect(editarInsumo('art', { contenido: 100 })).rejects.toThrow(/administrador/)
  })

  it('el detalle muestra la presentación a cualquier rol (US1-6)', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(
      <InsumoDetalle
        insumo={articaina}
        lotes={[loteArticaina]}
        movimientos={[ingreso]}
        onClose={() => {}}
      />,
    )
    const detalle = screen.getByRole('heading', { name: 'Articaína 4%' }).parentElement!
    expect(within(detalle).getByText('Presentación: Caja × 50 cartuchos')).toBeInTheDocument()
  })
})
