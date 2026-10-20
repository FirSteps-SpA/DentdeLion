import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TratamientoRealizado, UsuarioActual } from '../../src/lib/db'
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
import { HistorialTratamientos } from '../../src/features/tratamientos/components/HistorialTratamientos'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'

/**
 * Spec 016 US5 (T044, FR-019): historial por período con totales sin
 * anulados, "Deshacer" y el lugar de cada registro en "Todos".
 */
const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>

const usuario: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'p1',
  email: 'p@x.cl',
  nombre: 'Paula',
  rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

// Jueves 15 de octubre de 2026, 15:00 hora local (la semana empieza el lunes 12).
const ahora = new Date(2026, 9, 15, 15, 0)

function registro(id: string, creadoEn: Date, extra: Partial<TratamientoRealizado> = {}): TratamientoRealizado {
  return {
    id,
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    tratamientoId: 't1',
    nombre: `Tratamiento ${id}`,
    precio: 45000,
    porcentajeProfesional: 40,
    materiales: [],
    costoMateriales: 3480,
    costoCompleto: true,
    gananciaEstimada: 14520,
    usuarioId: 'p1',
    creadoEn: creadoEn.toISOString(),
    anuladoEn: null,
    anuladoPor: null,
    sincronizado: true,
    anulacionSincronizada: true,
    ...extra,
  }
}

function reflejar() {
  useTratamientosStore.setState({ realizados: realizadosT.all(), isReady: true })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(ahora)
  useAuthStore.setState({ usuario, isReady: true })
  useLugarStore.setState({ lugares: [lugar1, lugar2], lugarActivoId: LUGAR_1, isReady: true })
  realizadosT.seed([
    registro('a', new Date(2026, 9, 15, 9)),
    registro('b', new Date(2026, 9, 13, 9), { gananciaEstimada: 10000 }),
    registro('c', new Date(2026, 9, 2, 9)),
    registro('d', new Date(2026, 9, 15, 11), { lugarId: LUGAR_2 }),
  ])
  reflejar()
  onMemoryDbChange(reflejar)
})

afterEach(() => {
  onMemoryDbChange(null)
  vi.useRealTimers()
})

describe('historial de tratamientos (US5)', () => {
  it('filtra por período del lugar activo y suma los totales', () => {
    render(<HistorialTratamientos />)
    expect(screen.getByText('Tratamiento a')).toBeInTheDocument()
    expect(screen.queryByText('Tratamiento b')).not.toBeInTheDocument()
    expect(screen.queryByText('Tratamiento d')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
    expect(screen.getByText('Tratamiento b')).toBeInTheDocument()
    expect(screen.getByText('$24.520')).toBeInTheDocument()
    expect(screen.queryByText('Tratamiento c')).not.toBeInTheDocument()
  })

  it('Deshacer anula el registro, lo tacha y lo saca de los totales', async () => {
    render(<HistorialTratamientos />)
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer Tratamiento a' }))
    await waitFor(() => expect(screen.getByText('Anulado por Paula')).toBeInTheDocument())
    expect(screen.getByText('Tratamiento a')).toHaveClass('line-through')
    expect(screen.queryByRole('button', { name: 'Deshacer Tratamiento a' })).not.toBeInTheDocument()
    expect(realizadosT.all().find((r) => r.id === 'a')).toMatchObject({ anuladoPor: 'p1' })
  })

  it('en "Todos" muestra el lugar de cada registro', () => {
    useLugarStore.setState({ lugarActivoId: 'todos' })
    render(<HistorialTratamientos />)
    expect(screen.getByText('Tratamiento d')).toBeInTheDocument()
    expect(screen.getByText(/· Box Las Condes/)).toBeInTheDocument()
  })
})
