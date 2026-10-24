import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CambioTratamiento, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})
vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import { porcentajesPorLugar } from '../../src/features/tratamientos/lib/proyeccion'
import { LugaresSection } from '../../src/features/ajustes/components/LugaresSection'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { esperarQueLaRuedaNoCambie } from '../helpers/rueda'

/**
 * Spec 016 US4 (T041, FR-012): % profesional por lugar en Ajustes → Lugares,
 * con el % de la clínica como resto y el historial del porcentaje.
 */
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

function reflejar() {
  const cambios = cambiosT.all()
  useTratamientosStore.setState({
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
  cambiosT.seed([])
  reflejar()
  onMemoryDbChange(reflejar)
})

afterEach(() => {
  onMemoryDbChange(null)
  vi.useRealTimers()
})

async function fijar(valor: string) {
  fireEvent.click(screen.getByRole('button', { name: '% profesional de Clínica' }))
  const panel = await screen.findByRole('dialog', { name: '% profesional en Clínica' })
  fireEvent.change(within(panel).getByLabelText('% profesional (0–100)'), {
    target: { value: valor },
  })
  return panel
}

describe('% profesional del lugar (US4)', () => {
  it('se fija, muestra el % de la clínica y queda en el historial', async () => {
    render(<LugaresSection />)
    expect(screen.getAllByText('Sin % profesional')).toHaveLength(2)

    const panel = await fijar('40')
    expect(within(panel).getByText('Clínica: 60 %')).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Profesional 40 % · Clínica 60 %')).toBeInTheDocument()

    vi.setSystemTime((reloj += 60_000))
    const otra = await fijar('45')
    fireEvent.click(within(otra).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '% profesional de Clínica' }))
    })
    const historial = await screen.findByRole('dialog', { name: '% profesional en Clínica' })
    expect(within(historial).getByText(/40 % → 45 % · Ana/)).toBeInTheDocument()
    expect(within(historial).getByText(/sin % → 40 % · Ana/)).toBeInTheDocument()
    expect(cambiosT.all().map((c) => c.lugarId)).toEqual([LUGAR_1, LUGAR_1])
  })

  it('rechaza un porcentaje fuera de 0–100', async () => {
    render(<LugaresSection />)
    const panel = await fijar('120')
    fireEvent.click(within(panel).getByRole('button', { name: 'Guardar' }))
    expect(await within(panel).findByText(/entre 0 y 100/)).toBeInTheDocument()
    expect(cambiosT.all()).toEqual([])
  })
})

describe('rueda del mouse (spec 018 FR-005)', () => {
  it('no cambia el % profesional', async () => {
    render(<LugaresSection />)
    const panel = await fijar('40')
    esperarQueLaRuedaNoCambie(within(panel).getByLabelText('% profesional (0–100)'), '40')
  })
})
