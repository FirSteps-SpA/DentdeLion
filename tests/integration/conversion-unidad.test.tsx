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
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      categorias: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

vi.mock('../../src/lib/haptics', () => ({ vibrarLeve: () => {} }))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { EditarInsumoForm } from '../../src/features/insumos/components/EditarInsumoForm'
import { InsumoDetalle } from '../../src/features/insumos/components/InsumoDetalle'
import { consumirUno } from '../../src/features/insumos/lib/consumoRapido'
import { trasladar } from '../../src/features/insumos/lib/traslado'
import {
  computeStockLote,
  movimientosNormalizadosDeLote,
  normalizarMovimientos,
} from '../../src/features/insumos/lib/stock'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { useLugarStore } from '../../src/stores/lugarStore'

/**
 * Spec 015 T063 (FR-007a, Q1, quickstart 10–12): conversión de la unidad de
 * consumo desde la edición del insumo, y que consumo rápido, traslado y un
 * movimiento offline en la unidad anterior sigan dando el stock correcto.
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
  nombre: 'Ana',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

const guantes: Insumo = {
  id: 'g',
  tenantId: TENANT_1,
  nombre: 'Guantes',
  categoria: 'Protección',
  unidadMedida: 'caja',
  unidadCompra: 'caja',
  contenido: 1,
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: 2,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}
const lote: Lote = {
  id: 'l1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  insumoId: 'g',
  numeroLote: 'G1',
  proveedor: 'P',
  fechaCaducidad: null,
  codigoFabricante: null,
  estado: 'activo',
  creadoEn: '2026-01-01T00:00:00.000Z',
  cantidadIngresada: 3,
  unidadIngresada: 'caja',
  contenido: 1,
  unidadConsumo: 'caja',
  precioCompra: null,
}
const ingreso: Movimiento = {
  id: 'm1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  tipo: 'ingreso',
  loteId: 'l1',
  cantidad: 3,
  unidad: 'caja',
  usuarioId: 'admin-1',
  movimientoOrigenId: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
}

function reflejar() {
  const insumos = insumosT.all()
  useInventoryStore.setState({
    insumos,
    lotes: lotesT.all(),
    cambiosInsumo: cambiosT.all(),
    movimientos: normalizarMovimientos(movimientosT.all(), lotesT.all(), insumos, cambiosT.all()),
    isReady: true,
  })
}

async function convertirDesdeElFormulario(cantidad: string) {
  const onGuardado = vi.fn()
  render(<EditarInsumoForm insumo={insumosT.all()[0]} onGuardado={onGuardado} onCancelar={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Convertir unidad' }))
  const dialogo = await screen.findByRole('dialog', { name: 'Cambiar unidad de consumo' })
  fireEvent.change(within(dialogo).getByLabelText('A'), { target: { value: 'unidad' } })
  fireEvent.change(within(dialogo).getByLabelText(/^1 caja = ¿cuántas unidades\?/), {
    target: { value: cantidad },
  })
  return { dialogo, onGuardado }
}

beforeEach(() => {
  useAuthStore.setState({ usuario: admin, isReady: true })
  useLugarStore.setState({ lugares: [lugar1, lugar2], lugarActivoId: LUGAR_1, isReady: true })
  insumosT.seed([guantes])
  lotesT.seed([lote])
  movimientosT.seed([ingreso])
  cambiosT.seed([])
  reflejar()
  onMemoryDbChange(reflejar)
  return () => onMemoryDbChange(null)
})

describe('Convertir unidad (US1-4, FR-007a)', () => {
  it('3 cajas → 300 unidades con vista previa, mínimo convertido y presentación propuesta', async () => {
    const { dialogo, onGuardado } = await convertirDesdeElFormulario('100')

    expect(within(dialogo).getByText('1 caja = 100 unidades')).toBeInTheDocument()
    expect(
      within(dialogo).getByText(/Stock actual: 3 cajas → 300 unidades/),
    ).toBeInTheDocument()
    expect(within(dialogo).getByText('Mínimo: 2 cajas → 200 unidades')).toBeInTheDocument()
    expect(within(dialogo).getByText('Presentación: Caja × 100 unidades')).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Convertir' }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())

    expect(insumosT.all()[0]).toMatchObject({
      unidadMedida: 'unidad',
      unidadCompra: 'caja',
      contenido: 100,
      stockMinimo: 200,
    })
    expect(cambiosT.all().find((c) => c.campo === 'unidadMedida')).toMatchObject({
      valorAnterior: 'caja',
      valorNuevo: 'unidad',
      factor: 100,
      usuarioId: 'admin-1',
    })
    expect(movimientosT.all()).toEqual([ingreso])
  })

  it('el historial muestra el ingreso en cajas y la conversión', async () => {
    const { dialogo, onGuardado } = await convertirDesdeElFormulario('100')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Convertir' }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())
    document.body.innerHTML = ''

    const { movimientos } = useInventoryStore.getState()
    render(
      <InsumoDetalle insumo={insumosT.all()[0]} lotes={[lote]} movimientos={movimientos} onClose={() => {}} />,
    )
    expect(screen.getByText(/Stock total: 300 unidad/)).toBeInTheDocument()
    expect(screen.getByText(/Ingreso: 3 cajas = 300 unidades/)).toBeInTheDocument()
    expect(
      screen.getByText(/Unidad cambiada de Caja a Unidad \(1 caja = 100 unidades\)/),
    ).toBeInTheDocument()
  })

  it('cartucho → caja con 120 cartuchos se rechaza y no escribe nada (quickstart 12)', async () => {
    insumosT.seed([{ ...guantes, unidadMedida: 'cartucho', unidadCompra: 'cartucho', stockMinimo: null }])
    movimientosT.seed([{ ...ingreso, cantidad: 120, unidad: 'cartucho' }])
    lotesT.seed([{ ...lote, unidadConsumo: 'cartucho' }])
    reflejar()
    const onGuardado = vi.fn()
    render(<EditarInsumoForm insumo={insumosT.all()[0]} onGuardado={onGuardado} onCancelar={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Convertir unidad' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar unidad de consumo' })
    fireEvent.change(within(dialogo).getByLabelText('A'), { target: { value: 'caja' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Invertir' }))
    fireEvent.change(within(dialogo).getByLabelText(/^1 caja = ¿cuántas cartuchos\?/), {
      target: { value: '50' },
    })

    expect(within(dialogo).getByRole('alert')).toHaveTextContent(/no es múltiplo/)
    expect(within(dialogo).getByRole('button', { name: 'Convertir' })).toBeDisabled()
    expect(cambiosT.all()).toEqual([])
  })
})

describe('stock tras convertir (R4)', () => {
  beforeEach(async () => {
    const { convertirUnidadConsumo } = await import('../../src/features/insumos/lib/conversion')
    await convertirUnidadConsumo('g', { hasta: 'unidad', factor: 100, actualizarPresentacion: true })
  })

  it('"Consumir 1" descuenta una unidad, no una caja', async () => {
    await consumirUno(insumosT.all()[0])
    const consumo = movimientosT.all().find((m) => m.tipo === 'consumo')
    expect(consumo).toMatchObject({ cantidad: 1, unidad: 'unidad' })
    expect(computeStockLote(await movimientosNormalizadosDeLote('l1'))).toBe(299)
  })

  it('un traslado valida contra el stock convertido y viaja en la unidad actual', async () => {
    ;(db.lugares as unknown as MemoryTable<typeof lugar1>).seed([lugar1, lugar2])
    await expect(
      trasladar(insumosT.all()[0], { loteId: 'l1', origenId: LUGAR_1, destinoId: LUGAR_2, cantidad: 250 }),
    ).resolves.toHaveLength(2)
    const par = movimientosT.all().filter((m) => m.trasladoId)
    expect(par.map((m) => m.unidad)).toEqual(['unidad', 'unidad'])
    const normalizados = await movimientosNormalizadosDeLote('l1')
    expect(computeStockLote(normalizados.filter((m) => m.lugarId === LUGAR_1))).toBe(50)
    expect(computeStockLote(normalizados.filter((m) => m.lugarId === LUGAR_2))).toBe(250)
  })

  it('un consumo registrado sin red en cajas, que llega por sync, cuenta como 100', async () => {
    movimientosT.seed([
      ...movimientosT.all(),
      { ...ingreso, id: 'offline', tipo: 'consumo', cantidad: 1, unidad: 'caja', usuarioId: 'otra' },
    ])
    expect(computeStockLote(await movimientosNormalizadosDeLote('l1'))).toBe(200)
  })
})
