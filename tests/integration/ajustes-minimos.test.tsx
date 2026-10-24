import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Insumo, Lugar, MinimoLugar } from '../../src/lib/db'
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
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      categorias: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      borradores: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useAuthStore } from '../../src/stores/authStore'
import { MinimosPorInsumoSection } from '../../src/features/ajustes/components/MinimosPorInsumoSection'
import { EditarInsumoForm } from '../../src/features/insumos/components/EditarInsumoForm'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { esperarQueLaRuedaNoCambie } from '../helpers/rueda'

/**
 * Spec 019 T021 (US3, FR-014–FR-021, UI §5): editor de stock mínimo con
 * buscador, de a 25 filas, y la misma regla de lugar que la edición del
 * insumo.
 */
const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar & { id?: string }>
const lugaresT = db.lugares as unknown as MemoryTable<Lugar>

function insumo(id: string, nombre: string, overrides: Partial<Insumo> = {}): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'Cirugía',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: false,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: 5,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

const admin = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'admin@x.cl',
  nombre: 'Admin Uno',
  rol: 'administrador' as const,
  autenticadoEn: 'x',
}

/** 30 insumos: "Guantes de nitrilo" y 29 "Insumo NN". */
function treintaInsumos(): Insumo[] {
  return [
    insumo('g', 'Guantes de nitrilo'),
    ...Array.from({ length: 29 }, (_, i) =>
      insumo(`i${i}`, `Insumo ${String(i + 1).padStart(2, '0')}`),
    ),
  ]
}

let lugarActivo: string | 'todos' = LUGAR_1

function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all().filter((i) => !i.dadoDeBajaEn),
    insumosDadosDeBaja: insumosT.all().filter((i) => !!i.dadoDeBajaEn),
    minimosLugar: minimosT.all(),
    categorias: [],
    lotes: [],
    movimientos: [],
    isReady: true,
  })
  useLugarStore.setState({ lugares: lugaresT.all(), lugarActivoId: lugarActivo, isReady: true })
}

function sembrar(lugares: Lugar[], activo: string | 'todos' = LUGAR_1) {
  lugarActivo = activo
  insumosT.seed(treintaInsumos())
  minimosT.seed([])
  lugaresT.seed(lugares)
  reflejarStore()
}

function cambiarLugar(activo: string | 'todos') {
  lugarActivo = activo
  act(() => reflejarStore())
}

const campo = (nombre: string) => screen.getByLabelText(`Stock mínimo de ${nombre}`)
const fila = (nombre: string) => campo(nombre).closest('li') as HTMLElement

beforeEach(() => {
  onMemoryDbChange(reflejarStore)
  useAuthStore.setState({ usuario: admin, isReady: true })
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
})

afterEach(() => {
  onMemoryDbChange(null)
  useAuthStore.setState({ usuario: null, isReady: true })
})

describe('Editor de stock mínimo por insumo (spec 019 US3)', () => {
  it('muestra 25 filas ordenadas y "Ver más" con las que quedan', () => {
    sembrar([lugar1, lugar2])
    render(<MinimosPorInsumoSection />)

    expect(screen.getAllByLabelText(/^Stock mínimo de /)).toHaveLength(25)
    expect(screen.getByText('30 insumos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 5)' }))
    expect(screen.getAllByLabelText(/^Stock mínimo de /)).toHaveLength(30)
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument()
  })

  it('busca sin tildes ni mayúsculas, cuenta coincidencias y avisa si no hay', () => {
    sembrar([lugar1, lugar2])
    render(<MinimosPorInsumoSection />)
    const buscador = screen.getByLabelText('Buscar insumo')

    fireEvent.change(buscador, { target: { value: 'GUANTÉS' } })
    expect(screen.getAllByLabelText(/^Stock mínimo de /)).toHaveLength(1)
    expect(screen.getByText('1 insumo')).toBeInTheDocument()

    fireEvent.change(buscador, { target: { value: 'xyz' } })
    expect(screen.getByText('Ningún insumo coincide con “xyz”')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(screen.getAllByLabelText(/^Stock mínimo de /)).toHaveLength(25)
  })

  it('al cambiar la búsqueda vuelve a la primera tanda', () => {
    sembrar([lugar1, lugar2])
    render(<MinimosPorInsumoSection />)
    fireEvent.click(screen.getByRole('button', { name: /Ver más/ }))
    fireEvent.change(screen.getByLabelText('Buscar insumo'), { target: { value: 'insumo' } })
    expect(screen.getAllByLabelText(/^Stock mínimo de /)).toHaveLength(25)
    expect(screen.getByText('29 insumos')).toBeInTheDocument()
  })

  it('con el lugar A activo guarda el mínimo del lugar, sin tocar el catálogo', async () => {
    sembrar([lugar1, lugar2])
    render(<MinimosPorInsumoSection />)
    expect(screen.getByText(/Mínimos de/)).toHaveTextContent('Mínimos de Clínica.')
    expect(within(fila('Guantes de nitrilo')).getByText('General')).toBeInTheDocument()
    expect(campo('Guantes de nitrilo')).toHaveAttribute('placeholder', 'General (5)')

    fireEvent.change(campo('Guantes de nitrilo'), { target: { value: '20' } })
    fireEvent.blur(campo('Guantes de nitrilo'))

    await waitFor(() =>
      expect(minimosT.all()).toEqual([
        expect.objectContaining({
          insumoId: 'g',
          lugarId: LUGAR_1,
          stockMinimo: 20,
          sincronizado: false,
        }),
      ]),
    )
    expect(insumosT.all().find((i) => i.id === 'g')!.stockMinimo).toBe(5)
    await waitFor(() =>
      expect(within(fila('Guantes de nitrilo')).getByText('Propio')).toBeInTheDocument(),
    )
    expect(campo('Guantes de nitrilo')).toHaveValue(20)
  })

  it('borrar un mínimo propio vuelve al general del catálogo', async () => {
    sembrar([lugar1, lugar2])
    minimosT.seed([
      { insumoId: 'g', lugarId: LUGAR_1, tenantId: TENANT_1, stockMinimo: 12, sincronizado: true },
    ])
    reflejarStore()
    render(<MinimosPorInsumoSection />)
    expect(campo('Guantes de nitrilo')).toHaveValue(12)

    fireEvent.change(campo('Guantes de nitrilo'), { target: { value: '' } })
    fireEvent.blur(campo('Guantes de nitrilo'))

    await waitFor(() =>
      expect(minimosT.all()[0]).toMatchObject({ stockMinimo: null, sincronizado: false }),
    )
    await waitFor(() =>
      expect(within(fila('Guantes de nitrilo')).getByText('General')).toBeInTheDocument(),
    )
  })

  it('al cambiar de lugar muestra los valores del otro lugar', () => {
    sembrar([lugar1, lugar2])
    minimosT.seed([
      { insumoId: 'g', lugarId: LUGAR_1, tenantId: TENANT_1, stockMinimo: 12, sincronizado: true },
    ])
    reflejarStore()
    render(<MinimosPorInsumoSection />)
    expect(campo('Guantes de nitrilo')).toHaveValue(12)

    cambiarLugar(LUGAR_2)
    expect(campo('Guantes de nitrilo')).toHaveValue(null)
    expect(within(fila('Guantes de nitrilo')).getByText('General')).toBeInTheDocument()
    expect(screen.getByText(/Mínimos de/)).toHaveTextContent('Box Las Condes')
  })

  it('en "Todos" es solo lectura y muestra cada lugar', () => {
    sembrar([lugar1, lugar2], 'todos')
    minimosT.seed([
      { insumoId: 'g', lugarId: LUGAR_2, tenantId: TENANT_1, stockMinimo: 8, sincronizado: true },
    ])
    reflejarStore()
    render(<MinimosPorInsumoSection />)

    expect(screen.queryAllByLabelText(/^Stock mínimo de /)).toHaveLength(0)
    expect(
      screen.getByText('Elige un lugar en el encabezado para editar los mínimos.'),
    ).toBeInTheDocument()
    const guantes = screen.getByText('Guantes de nitrilo').closest('li') as HTMLElement
    expect(within(guantes).getByText('Clínica: 5 (general)')).toBeInTheDocument()
    expect(within(guantes).getByText('Box Las Condes: 8 (propio)')).toBeInTheDocument()
  })

  it('con un solo lugar edita el mínimo del catálogo, sin insignias ni lugar', async () => {
    sembrar([lugar1])
    render(<MinimosPorInsumoSection />)

    expect(screen.queryByText(/Mínimos de/)).not.toBeInTheDocument()
    expect(within(fila('Guantes de nitrilo')).queryByText('General')).not.toBeInTheDocument()
    expect(campo('Guantes de nitrilo')).toHaveValue(5)

    fireEvent.change(campo('Guantes de nitrilo'), { target: { value: '9' } })
    fireEvent.blur(campo('Guantes de nitrilo'))

    await waitFor(() => expect(insumosT.all().find((i) => i.id === 'g')!.stockMinimo).toBe(9))
    expect(minimosT.all()).toHaveLength(0)
  })

  it('rechaza un negativo o un decimal en unidades enteras, sin guardar', async () => {
    sembrar([lugar1, lugar2])
    render(<MinimosPorInsumoSection />)

    fireEvent.change(campo('Guantes de nitrilo'), { target: { value: '2.5' } })
    fireEvent.blur(campo('Guantes de nitrilo'))
    expect(await within(fila('Guantes de nitrilo')).findByRole('alert')).toHaveTextContent(
      'no admite decimales',
    )

    fireEvent.change(campo('Guantes de nitrilo'), { target: { value: '-1' } })
    fireEvent.blur(campo('Guantes de nitrilo'))
    expect(await within(fila('Guantes de nitrilo')).findByRole('alert')).toHaveTextContent(
      'mayor o igual a 0',
    )
    expect(minimosT.all()).toHaveLength(0)
  })

  it('la edición del insumo en el mismo lugar muestra el mismo mínimo (SC-004)', async () => {
    sembrar([lugar1, lugar2])
    const { unmount } = render(<MinimosPorInsumoSection />)
    fireEvent.change(campo('Guantes de nitrilo'), { target: { value: '20' } })
    fireEvent.blur(campo('Guantes de nitrilo'))
    await waitFor(() => expect(minimosT.all()).toHaveLength(1))
    unmount()

    render(
      <EditarInsumoForm
        insumo={insumosT.all().find((i) => i.id === 'g')!}
        onGuardado={() => {}}
        onCancelar={() => {}}
      />,
    )
    expect(screen.getByLabelText('Stock mínimo en Clínica')).toHaveValue(20)
  })

  it('la rueda del mouse no cambia el mínimo (spec 018)', async () => {
    sembrar([lugar1])
    render(<MinimosPorInsumoSection />)
    esperarQueLaRuedaNoCambie(campo('Guantes de nitrilo'), '8')
    await waitFor(() => expect(insumosT.all().find((i) => i.id === 'g')!.stockMinimo).toBe(8))
  })
})
