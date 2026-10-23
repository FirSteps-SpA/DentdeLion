import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  CambioTratamiento,
  Insumo,
  Lote,
  Tratamiento,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import {
  porcentajesPorLugar,
  proyectarTratamientos,
} from '../../src/features/tratamientos/lib/proyeccion'
import { TratamientosView } from '../../src/features/tratamientos/components/TratamientosView'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { esperarQueLaRuedaNoCambie } from '../helpers/rueda'

/**
 * Spec 016 US1/US2 (T021, T026): catálogo con precio por lugar, montos con
 * "Ganancia estimada" del DS §27 y permisos.
 */
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const tratamientosT = db.tratamientos as unknown as MemoryTable<Tratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Ana',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}
const personal: UsuarioActual = { ...admin, id: 'p1', nombre: 'Paula', rol: 'personal' }

function insumo(id: string, nombre: string, unidadMedida: string): Insumo {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    categoria: 'Restauración',
    unidadMedida,
    unidadCompra: unidadMedida,
    contenido: 1,
    permiteDecimales: unidadMedida === 'g',
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
  }
}

function lote(id: string, insumoId: string, precioCompra: number | null): Lote {
  return {
    id,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId,
    numeroLote: id,
    proveedor: 'P',
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: insumoId === 'res' ? 'g' : insumoId === 'art' ? 'cartucho' : 'unidad',
    precioCompra,
  }
}

function porcentaje(lugarId: string, valor: number): CambioTratamiento {
  return {
    id: `pct-${lugarId}`,
    tenantId: TENANT_1,
    tratamientoId: null,
    lugarId,
    campo: 'porcentajeProfesional',
    valorAnterior: null,
    valorNuevo: valor,
    usuarioId: 'admin-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
    rechazadoEn: null,
  }
}

function reflejar() {
  const cambios = cambiosT.all()
  useTratamientosStore.setState({
    tratamientos: proyectarTratamientos(tratamientosT.all(), cambios),
    porcentajes: porcentajesPorLugar(cambios),
    cambiosTratamiento: cambios,
    isReady: true,
  })
}

let reloj = Date.parse('2026-10-19T10:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime((reloj += 60_000))
  useAuthStore.setState({ usuario: admin, isReady: true })
  useLugarStore.setState({ lugares: [lugar1, lugar2], lugarActivoId: LUGAR_1, isReady: true })
  const insumos = [
    insumo('art', 'Articaína', 'cartucho'),
    insumo('res', 'Resina A2', 'g'),
    insumo('otros', 'Otros', 'unidad'),
  ]
  const lotes = [lote('a1', 'art', 650), lote('r1', 'res', 1200), lote('o1', 'otros', 430)]
  insumosT.seed(insumos)
  lotesT.seed(lotes)
  tratamientosT.seed([])
  cambiosT.seed([porcentaje(LUGAR_1, 40), porcentaje(LUGAR_2, 50)])
  useInventoryStore.setState({
    insumos,
    insumosDadosDeBaja: [],
    lotes,
    movimientos: [],
    cambiosInsumo: [],
    cambiosLote: [],
    isReady: true,
  })
  reflejar()
  onMemoryDbChange(reflejar)
})

afterEach(() => {
  onMemoryDbChange(null)
  vi.useRealTimers()
})

async function crearRestauracion() {
  render(<TratamientosView />)
  fireEvent.click(screen.getByRole('button', { name: /Tratamiento$/ }))
  const form = await screen.findByRole('dialog', { name: 'Nuevo tratamiento' })
  fireEvent.change(within(form).getByLabelText('Nombre'), {
    target: { value: 'Restauración clase II' },
  })
  fireEvent.change(within(form).getByLabelText('Precio en Clínica'), { target: { value: '45000' } })
  fireEvent.change(within(form).getByLabelText('Precio en Box Las Condes'), {
    target: { value: '50000' },
  })
  for (const [buscar, nombre] of [
    ['Arti', 'Articaína'],
    ['Resi', 'Resina A2'],
    ['Otr', 'Otros'],
  ]) {
    fireEvent.change(within(form).getByLabelText('Agregar material'), { target: { value: buscar } })
    fireEvent.click(within(form).getByRole('button', { name: nombre }))
  }
  fireEvent.change(within(form).getByLabelText('Resina A2 (g)'), { target: { value: '2' } })
  return form
}

describe('crear y ver tratamientos (US1)', () => {
  it('la administración crea uno con precios por lugar y materiales', async () => {
    const form = await crearRestauracion()
    expect(within(form).getByText('$3.480')).toBeInTheDocument()
    expect(within(form).getByText('$14.520')).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Restauración clase II')).toBeInTheDocument()
    const proyectado = useTratamientosStore.getState().tratamientos[0]
    expect(proyectado.precios.get(LUGAR_1)).toBe(45000)
    expect(proyectado.precios.get(LUGAR_2)).toBe(50000)
  })

  it('personal ve la lista y los montos, pero no crea ni edita', async () => {
    const form = await crearRestauracion()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    act(() => useAuthStore.setState({ usuario: personal, isReady: true }))

    expect(screen.queryByRole('button', { name: /Tratamiento$/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Restauración clase II'))
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.getAllByText('$14.520').length).toBeGreaterThan(0)
  })

  it('sin precio en el lugar dice "Sin precio en este lugar"', async () => {
    const form = await crearRestauracion()
    fireEvent.change(within(form).getByLabelText('Precio en Clínica'), { target: { value: '' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByText(/Sin precio en este lugar/).length).toBeGreaterThan(0)
  })

  it('desactivar lo oculta de la lista', async () => {
    const form = await crearRestauracion()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    vi.setSystemTime((reloj += 60_000))
    fireEvent.click(screen.getByText('Restauración clase II'))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const edicion = await screen.findByRole('dialog', { name: 'Editar tratamiento' })
    fireEvent.click(within(edicion).getByRole('button', { name: 'Desactivar' }))
    await waitFor(() =>
      expect(useTratamientosStore.getState().tratamientos[0].activo).toBe(false),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
    expect(screen.queryByText('Restauración clase II')).not.toBeInTheDocument()
  })
})

describe('costo y ganancia estimada (US2)', () => {
  it('el ejemplo del DS en el detalle, y otro % en otro lugar', async () => {
    const form = await crearRestauracion()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    fireEvent.click(screen.getByText('Restauración clase II'))
    const detalle = screen.getByRole('heading', { name: 'Restauración clase II' }).closest('div')!
      .parentElement!
    expect(within(detalle).getByText('$45.000')).toBeInTheDocument()
    expect(within(detalle).getByText('$18.000')).toBeInTheDocument()
    expect(within(detalle).getByText('$3.480')).toBeInTheDocument()
    expect(within(detalle).getByText('Ganancia estimada')).toBeInTheDocument()
    expect(within(detalle).getByText('$14.520')).toBeInTheDocument()
    // FR-010: "utilidad" solo aparece en la nota que aclara que no lo es.
    for (const elemento of screen.queryAllByText(/utilidad/i)) {
      expect(elemento.textContent).toMatch(/No es utilidad contable/)
    }

    act(() => useLugarStore.setState({ lugarActivoId: LUGAR_2 }))
    // Las Condes: $50.000 × 50 % − $3.480.
    expect(await screen.findAllByText('$21.520')).not.toHaveLength(0)
  })

  it('un material sin precio deja el costo "desde" y avisa', async () => {
    lotesT.seed([lote('a1', 'art', 650), lote('o1', 'otros', 430)])
    useInventoryStore.setState({ lotes: lotesT.all() })
    const form = await crearRestauracion()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText(/desde \$1\.080/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Restauración clase II'))
    expect(screen.getByText(/No incluye materiales sin precio/)).toBeInTheDocument()
  })

  it('sin % en el lugar pide definirlo', async () => {
    cambiosT.seed([])
    act(() => reflejar())
    const form = await crearRestauracion()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getAllByText(/Define el % profesional del lugar/).length).toBeGreaterThan(0)
  })

  it('el costo se recalcula si cambia el costo unitario (US2-6)', async () => {
    const form = await crearRestauracion()
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    act(() =>
      useInventoryStore.setState({
        lotes: [
          ...lotesT.all(),
          { ...lote('a2', 'art', 1650), creadoEn: '2026-02-01T00:00:00.000Z' },
        ],
      }),
    )
    // Anestesia a $1.650: $4.480 de materiales.
    expect(await screen.findByText(/\$4\.480/)).toBeInTheDocument()
  })
})

describe('rueda del mouse (spec 018 FR-005)', () => {
  it('no cambia el precio por lugar ni la cantidad de un material', async () => {
    const form = await crearRestauracion()
    esperarQueLaRuedaNoCambie(within(form).getByLabelText('Precio en Clínica'), '45000')
    esperarQueLaRuedaNoCambie(within(form).getByLabelText('Resina A2 (g)'), '2')
  })
})
