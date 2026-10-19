import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CambioLote, Insumo, Lote, Movimiento, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { RecibirItemForm } from '../../src/features/compras/components/RecibirItemForm'
import { InventarioTabla } from '../../src/features/insumos/components/InventarioTabla'
import type { EstadoInsumo } from '../../src/features/insumos/lib/estado'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

/**
 * Spec 015 US3 (T043): precio opcional al recibir, por unidad de compra o
 * total, y costo unitario en la tabla. Todo con personal (Clarifications Q3).
 */
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const cambiosLoteT = db.cambiosLote as unknown as MemoryTable<CambioLote>

const personal: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'personal-1',
  email: 'p@x.cl',
  nombre: 'Paula',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

const base: Insumo = {
  id: 'art',
  tenantId: TENANT_1,
  nombre: 'Articaína 4%',
  categoria: 'Cirugía',
  unidadMedida: 'cartucho',
  unidadCompra: 'caja',
  contenido: 50,
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}

function renderRecepcion(insumo: Insumo) {
  const onRecibido = vi.fn()
  render(
    <RecibirItemForm
      insumo={insumo}
      itemCompraId={null}
      onRecibido={onRecibido}
      onCancelar={() => {}}
    />,
  )
  return onRecibido
}

/** Las mismas interacciones de una recepción de la 2.3.0: cantidad, lote, proveedor, confirmar. */
function recepcionMinima(cantidad: string): number {
  const acciones = [
    () => fireEvent.change(screen.getByLabelText(/^Cantidad/), { target: { value: cantidad } }),
    () => fireEvent.change(screen.getByLabelText('Número de lote'), { target: { value: 'L1' } }),
    () => fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'Prov' } }),
    () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' })),
  ]
  for (const accion of acciones) accion()
  return acciones.length
}

beforeEach(() => {
  usarLugar1()
  useAuthStore.setState({ usuario: personal, isReady: true })
  lotesT.seed([])
  movimientosT.seed([])
  cambiosLoteT.seed([])
  useInventoryStore.setState({
    insumos: [],
    insumosDadosDeBaja: [],
    lotes: [],
    movimientos: [],
    cambiosInsumo: [],
    cambiosLote: [],
    isReady: true,
  })
})

describe('precio al recibir (US3-1..3)', () => {
  it('por caja: muestra total y costo por cartucho, y guarda el precio por caja', async () => {
    const onRecibido = renderRecepcion(base)
    fireEvent.change(screen.getByLabelText(/^Cantidad/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Precio por caja'), { target: { value: '32500' } })

    expect(screen.getByText('2 cajas = 100 cartuchos')).toBeInTheDocument()
    expect(screen.getByText('2 × $32.500 = $65.000 · $650 por cartucho')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Número de lote'), { target: { value: 'L1' } })
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'Septodont' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await waitFor(() => expect(onRecibido).toHaveBeenCalled())
    expect(lotesT.all()[0]).toMatchObject({ precioCompra: 32500, cantidadIngresada: 2 })
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 100, usuarioId: 'personal-1' })
  })

  it('total pagado por cartuchos sueltos: el precio por caja sale del contenido', async () => {
    const onRecibido = renderRecepcion(base)
    fireEvent.click(screen.getByRole('button', { name: 'Cartuchos' }))
    fireEvent.change(screen.getByLabelText(/^Cantidad/), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Total' }))
    fireEvent.change(screen.getByLabelText('Total pagado'), { target: { value: '21000' } })
    expect(screen.getByText('0,6 × $35.000 = $21.000 · $700 por cartucho')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Número de lote'), { target: { value: 'L2' } })
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: 'Septodont' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar recepción' }))

    await waitFor(() => expect(onRecibido).toHaveBeenCalled())
    expect(lotesT.all()[0].precioCompra).toBeCloseTo(35000)
    expect(movimientosT.all()[0]).toMatchObject({ cantidad: 30 })
  })

  it('sin precio se guarda igual y queda "sin precio" (FR-014)', async () => {
    const onRecibido = renderRecepcion(base)
    recepcionMinima('1')
    await waitFor(() => expect(onRecibido).toHaveBeenCalled())
    expect(lotesT.all()[0].precioCompra).toBeNull()
  })

  it('SC-002: recibir N cajas toma las mismas interacciones que antes de la spec', async () => {
    const sinPresentacion: Insumo = { ...base, id: 'legado', unidadCompra: 'cartucho', contenido: 1 }

    const legado = renderRecepcion(sinPresentacion)
    const pasosLegado = recepcionMinima('100')
    await waitFor(() => expect(legado).toHaveBeenCalled())
    document.body.innerHTML = ''

    const conCajas = renderRecepcion(base)
    const pasosCajas = recepcionMinima('2')
    await waitFor(() => expect(conCajas).toHaveBeenCalled())

    expect(pasosCajas).toBe(pasosLegado)
    // Y sin calcular a mano: suma 100 cartuchos en ambos casos.
    expect(movimientosT.all().map((m) => m.cantidad)).toEqual([100, 100])
  })
})

describe('costo unitario en la tabla (US3-4..6, FR-017)', () => {
  const lote = (overrides: Partial<Lote>): Lote => ({
    id: 'l1',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId: 'art',
    numeroLote: 'A1',
    proveedor: 'Septodont',
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: 2,
    unidadIngresada: 'caja',
    contenido: 50,
    unidadConsumo: 'cartucho',
    precioCompra: 32500,
    ...overrides,
  })
  const fila = (insumo: Insumo) => ({
    estadoInsumo: {
      insumo,
      stockTotal: 100,
      loteMasProximoAVencer: null,
      estado: 'ok',
    } as unknown as EstadoInsumo,
    disponibilidad: { ok: false as const, motivo: 'sin-stock' as const },
    posibleDuplicado: false,
  })

  function renderTabla(insumos: Insumo[]) {
    render(
      <InventarioTabla
        filas={insumos.map(fila)}
        onOpen={() => {}}
        onConsumirUno={() => {}}
        onAbrirMenu={() => {}}
      />,
    )
  }

  it('muestra el costo del último ingreso con precio y "Sin precio" si no hay', () => {
    const sinPrecio: Insumo = { ...base, id: 'otro', nombre: 'Guantes' }
    useInventoryStore.setState({
      insumos: [base, sinPrecio],
      lotes: [
        lote({}),
        lote({ id: 'l2', creadoEn: '2026-02-01T00:00:00.000Z', precioCompra: 35000 }),
        lote({ id: 'l3', creadoEn: '2026-03-01T00:00:00.000Z', precioCompra: null }),
      ],
    })
    renderTabla([base, sinPrecio])

    const filaArt = screen.getByText('Articaína 4%').closest('tr')!
    expect(within(filaArt).getByText('$700')).toBeInTheDocument()
    expect(within(filaArt).getByText('Caja × 50 cartuchos')).toBeInTheDocument()
    const filaGuantes = screen.getByText('Guantes').closest('tr')!
    expect(within(filaGuantes).getByText('Sin precio')).toBeInTheDocument()
  })
})

describe('corregir el precio de un lote (US5, FR-015)', () => {
  const loteSinPrecio: Lote = {
    id: 'l1',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    insumoId: 'art',
    numeroLote: 'A1',
    proveedor: 'Septodont',
    fechaCaducidad: null,
    codigoFabricante: null,
    estado: 'activo',
    creadoEn: '2026-01-01T00:00:00.000Z',
    cantidadIngresada: 2,
    unidadIngresada: 'caja',
    contenido: 50,
    unidadConsumo: 'cartucho',
    precioCompra: null,
  }

  function reflejar() {
    useInventoryStore.setState({ cambiosLote: cambiosLoteT.all() })
  }

  it('personal agrega el precio; el costo se actualiza y queda en el historial', async () => {
    const { onMemoryDbChange } = await import('../helpers/memoryDb')
    const { InsumoDetalle } = await import('../../src/features/insumos/components/InsumoDetalle')
    lotesT.seed([loteSinPrecio])
    useInventoryStore.setState({ insumos: [base], lotes: [loteSinPrecio] })
    onMemoryDbChange(reflejar)
    try {
      render(
        <InsumoDetalle insumo={base} lotes={[loteSinPrecio]} movimientos={[]} onClose={() => {}} />,
      )
      expect(screen.getAllByText('Sin precio').length).toBeGreaterThan(0)

      fireEvent.click(screen.getByRole('button', { name: 'Editar precio del lote A1' }))
      const dialogo = await screen.findByRole('dialog', { name: 'Precio del lote A1' })
      fireEvent.change(within(dialogo).getByLabelText('Precio por caja'), {
        target: { value: '30000' },
      })
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar precio' }))

      await waitFor(() => expect(cambiosLoteT.all()).toHaveLength(1))
      expect(cambiosLoteT.all()[0]).toMatchObject({
        loteId: 'l1',
        valorAnterior: null,
        valorNuevo: 30000,
        usuarioId: 'personal-1',
        sincronizado: false,
      })
      expect(lotesT.all()[0].precioCompra).toBeNull()
      expect(await screen.findByText('$600 por cartucho')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Editar precio del lote A1' }))
      const otraVez = await screen.findByRole('dialog', { name: 'Precio del lote A1' })
      expect(within(otraVez).getByText(/sin precio → \$30\.000 · Paula/)).toBeInTheDocument()
    } finally {
      onMemoryDbChange(null)
    }
  })

  it('dos correcciones sin red convergen a la última, en cualquier orden de llegada', async () => {
    const { InsumoDetalle } = await import('../../src/features/insumos/components/InsumoDetalle')
    const temprano: CambioLote = {
      id: 'z',
      tenantId: TENANT_1,
      loteId: 'l1',
      campo: 'precioCompra',
      valorAnterior: null,
      valorNuevo: 30000,
      usuarioId: 'otra',
      creadoEn: '2026-01-05T10:00:00.000Z',
      sincronizado: true,
    }
    const tarde: CambioLote = {
      ...temprano,
      id: 'a',
      valorNuevo: 35000,
      usuarioId: 'personal-1',
      creadoEn: '2026-01-05T11:00:00.000Z',
    }
    for (const orden of [
      [temprano, tarde],
      [tarde, temprano],
    ]) {
      useInventoryStore.setState({ insumos: [base], lotes: [loteSinPrecio], cambiosLote: orden })
      const { unmount } = render(
        <InsumoDetalle insumo={base} lotes={[loteSinPrecio]} movimientos={[]} onClose={() => {}} />,
      )
      expect(screen.getByText('$700 por cartucho')).toBeInTheDocument()
      unmount()
    }
  })
})
