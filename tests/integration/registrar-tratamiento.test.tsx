import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  CambioTratamiento,
  Insumo,
  Lote,
  Movimiento,
  Tratamiento,
  TratamientoRealizado,
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
import { useAvisosStore } from '../../src/stores/avisosStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import {
  porcentajesPorLugar,
  proyectarTratamientos,
} from '../../src/features/tratamientos/lib/proyeccion'
import { TratamientosView } from '../../src/features/tratamientos/components/TratamientosView'
import { AvisosConsumo } from '../../src/app/AvisosConsumo'
import { computeStockLote } from '../../src/features/insumos/lib/stock'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'

/**
 * Spec 016 US3 (T038): registrar con cantidades estándar o ajustadas,
 * faltantes (también "solo caducado"), material dado de baja, deshacer desde
 * el aviso, "Todos" pide lugar, personal registra y SC-001 (≤ 3 toques).
 */
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const tratamientosT = db.tratamientos as unknown as MemoryTable<Tratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>
const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>

const personal: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'p1',
  email: 'p@x.cl',
  nombre: 'Paula',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

function insumo(id: string, nombre: string, unidadMedida: string, extra: Partial<Insumo> = {}): Insumo {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    categoria: 'X',
    unidadMedida,
    unidadCompra: unidadMedida,
    contenido: 1,
    permiteDecimales: unidadMedida === 'g',
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    marcaId: null,
    creadoPor: null,
    ...extra,
  }
}

function lote(id: string, insumoId: string, fechaCaducidad: string | null, lugarId = LUGAR_1): Lote {
  return {
    id,
    tenantId: TENANT_1,
    lugarId,
    insumoId,
    numeroLote: id,
    proveedor: 'P',
    proveedorId: null,
    fechaCaducidad,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: null,
    unidadIngresada: null,
    contenido: 1,
    unidadConsumo: insumoId === 'art' ? 'cartucho' : 'g',
    precioCompra: insumoId === 'art' ? 650 : 1200,
  }
}

function ingreso(loteId: string, cantidad: number, unidad: string, lugarId = LUGAR_1): Movimiento {
  return {
    id: `ing-${loteId}`,
    tenantId: TENANT_1,
    lugarId,
    trasladoId: null,
    tipo: 'ingreso',
    loteId,
    cantidad,
    unidad,
    tratamientoRealizadoId: null,
    usuarioId: 'p1',
    movimientoOrigenId: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
  }
}

let n = 0
function cambio(campo: CambioTratamiento['campo'], valorNuevo: CambioTratamiento['valorNuevo'], extra: Partial<CambioTratamiento> = {}): CambioTratamiento {
  n += 1
  return {
    id: `c${n}`,
    tenantId: TENANT_1,
    tratamientoId: 't1',
    lugarId: null,
    campo,
    valorAnterior: null,
    valorNuevo,
    usuarioId: 'admin',
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
    rechazadoEn: null,
    ...extra,
  }
}

function reflejar() {
  const cambios = cambiosT.all()
  useInventoryStore.setState({
    insumos: insumosT.all().filter((i) => !i.dadoDeBajaEn),
    insumosDadosDeBaja: insumosT.all().filter((i) => !!i.dadoDeBajaEn),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    cambiosInsumo: [],
    cambiosLote: [],
    isReady: true,
  })
  useTratamientosStore.setState({
    tratamientos: proyectarTratamientos(tratamientosT.all(), cambios),
    porcentajes: porcentajesPorLugar(cambios),
    cambiosTratamiento: cambios,
    realizados: realizadosT.all(),
    isReady: true,
  })
}

const stock = (loteId: string) =>
  computeStockLote(movimientosT.all().filter((m) => m.loteId === loteId && m.lugarId === LUGAR_1))

beforeEach(() => {
  useAuthStore.setState({ usuario: personal, isReady: true })
  useLugarStore.setState({ lugares: [lugar1, lugar2], lugarActivoId: LUGAR_1, isReady: true })
  useAvisosStore.setState({ avisos: [] })
  insumosT.seed([insumo('art', 'Articaína', 'cartucho'), insumo('res', 'Resina A2', 'g')])
  lotesT.seed([lote('a1', 'art', '2027-01-01'), lote('r1', 'res', '2027-01-01')])
  movimientosT.seed([ingreso('a1', 10, 'cartucho'), ingreso('r1', 5, 'g')])
  tratamientosT.seed([
    {
      id: 't1',
      tenantId: TENANT_1,
      creadoPor: 'admin',
      creadoEn: '2026-01-01T00:00:00.000Z',
      sincronizado: true,
      rechazadoEn: null,
    },
  ])
  cambiosT.seed([
    cambio('nombre', 'Restauración clase II'),
    cambio('activo', true),
    cambio('materiales', [
      { insumoId: 'art', cantidad: 1, unidad: 'cartucho' },
      { insumoId: 'res', cantidad: 2, unidad: 'g' },
    ]),
    cambio('precio', 45000, { lugarId: LUGAR_1 }),
    cambio('porcentajeProfesional', 40, { tratamientoId: null, lugarId: LUGAR_1 }),
  ])
  realizadosT.seed([])
  reflejar()
  onMemoryDbChange(reflejar)
})

afterEach(() => {
  onMemoryDbChange(null)
  for (const aviso of useAvisosStore.getState().avisos) useAvisosStore.getState().descartar(aviso.id)
})

function Pantalla() {
  return (
    <>
      <TratamientosView />
      <AvisosConsumo />
    </>
  )
}

describe('registrar un tratamiento realizado (US3)', () => {
  it('SC-001: con las cantidades estándar, 2 toques desde la lista; descuenta y avisa', async () => {
    render(<Pantalla />)
    let toques = 0
    const tocar = (el: HTMLElement) => {
      toques += 1
      fireEvent.click(el)
    }
    tocar(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    expect(within(panel).getByText(/Ganancia estimada/)).toBeInTheDocument()
    tocar(within(panel).getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(realizadosT.all()).toHaveLength(1))
    expect(toques).toBeLessThanOrEqual(3)
    expect(stock('a1')).toBe(9)
    expect(stock('r1')).toBe(3)
    expect(realizadosT.all()[0]).toMatchObject({ usuarioId: 'p1', gananciaEstimada: 18000 - 3050 })
    expect(await screen.findByText('Registrado: Restauración clase II')).toBeInTheDocument()
  })

  it('las cantidades se ajustan antes de confirmar', async () => {
    render(<Pantalla />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    fireEvent.change(within(panel).getByLabelText('Resina A2 (g)'), { target: { value: '3' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(realizadosT.all()).toHaveLength(1))
    expect(stock('r1')).toBe(2)
  })

  it('con faltante avisa cuánto hay y no deja registrar hasta ajustar (FR-015)', async () => {
    render(<Pantalla />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    fireEvent.change(within(panel).getByLabelText('Resina A2 (g)'), { target: { value: '7' } })
    expect(within(panel).getByText(/Disponible: 5 g · Falta 2 g/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Registrar' })).toBeDisabled()
    fireEvent.change(within(panel).getByLabelText('Resina A2 (g)'), { target: { value: '5' } })
    expect(within(panel).getByRole('button', { name: 'Registrar' })).toBeEnabled()
  })

  it('si solo hay stock caducado lo dice', async () => {
    lotesT.seed([lote('a1', 'art', '2020-01-01'), lote('r1', 'res', '2027-01-01')])
    act(() => reflejar())
    render(<Pantalla />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    expect(within(panel).getByText(/Solo hay stock caducado/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Registrar' })).toBeDisabled()
  })

  it('un material dado de baja no se descuenta', async () => {
    insumosT.seed([
      insumo('art', 'Articaína', 'cartucho', { dadoDeBajaEn: '2026-02-01' }),
      insumo('res', 'Resina A2', 'g'),
    ])
    act(() => reflejar())
    render(<Pantalla />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    expect(within(panel).getByText(/Dado de baja: no se descuenta/)).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(realizadosT.all()).toHaveLength(1))
    expect(stock('a1')).toBe(10)
  })

  it('"Deshacer" del aviso revierte los consumos y anula el registro', async () => {
    render(<Pantalla />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Deshacer registro de Restauración clase II' }),
    )
    await waitFor(() => expect(realizadosT.all()[0].anuladoPor).toBe('p1'))
    expect(stock('a1')).toBe(10)
    expect(stock('r1')).toBe(5)
  })

  it('en "Todos" primero pide el lugar', async () => {
    act(() => useLugarStore.setState({ lugarActivoId: 'todos' }))
    lotesT.seed([...lotesT.all(), lote('a2', 'art', null, LUGAR_2), lote('r2', 'res', null, LUGAR_2)])
    movimientosT.seed([
      ...movimientosT.all(),
      ingreso('a2', 3, 'cartucho', LUGAR_2),
      ingreso('r2', 3, 'g', LUGAR_2),
    ])
    act(() => reflejar())
    render(<Pantalla />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Restauración clase II' }))
    const elegir = await screen.findByRole('dialog', { name: '¿En qué lugar?' })
    fireEvent.click(within(elegir).getByText('Box Las Condes'))
    const panel = await screen.findByRole('dialog', { name: 'Registrar Restauración clase II' })
    expect(within(panel).getByText('Lugar: Box Las Condes')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(realizadosT.all()[0]?.lugarId).toBe(LUGAR_2))
  })
})
