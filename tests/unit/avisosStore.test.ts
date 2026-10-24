import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const deshacerConsumo = vi.fn(async (id: string) => {
  void id
  return null
})

vi.mock('../../src/features/insumos/lib/consumoRapido', () => ({
  deshacerConsumo: (id: string) => deshacerConsumo(id),
}))

import {
  DURACION_AVISO_MS,
  DURACION_MATERIAL_CREADO_MS,
  DURACION_REVERTIDO_MS,
  useAvisosStore,
  type NuevoAviso,
} from '../../src/stores/avisosStore'

function aviso(n: number): NuevoAviso {
  return {
    tipo: 'consumo',
    movimientoId: `mov-${n}`,
    loteId: 'lote-1',
    insumoNombre: `Insumo ${n}`,
    unidadMedida: 'caja',
  }
}

function avisoMaterialCreado(nombre: string): NuevoAviso {
  return {
    tipo: 'material-creado',
    movimientoId: null,
    loteId: null,
    insumoNombre: nombre,
    unidadMedida: null,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  useAvisosStore.setState({ avisos: [] })
  deshacerConsumo.mockClear()
})

afterEach(() => {
  for (const a of useAvisosStore.getState().avisos)
    useAvisosStore.getState().descartar(a.id)
  vi.useRealTimers()
})

describe('avisosStore (spec 007 FR-006/FR-009)', () => {
  it('expires a notice at exactly 8 seconds', () => {
    useAvisosStore.getState().agregar(aviso(1))

    vi.advanceTimersByTime(DURACION_AVISO_MS - 1)
    expect(useAvisosStore.getState().avisos).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useAvisosStore.getState().avisos).toHaveLength(0)
  })

  it('keeps at most 3 notices, evicting the oldest', () => {
    for (let n = 1; n <= 4; n++) useAvisosStore.getState().agregar(aviso(n))

    const nombres = useAvisosStore.getState().avisos.map((a) => a.insumoNombre)
    expect(nombres).toEqual(['Insumo 2', 'Insumo 3', 'Insumo 4'])
  })

  it('undoes once, marks the notice reverted and removes it 2 s later', async () => {
    useAvisosStore.getState().agregar(aviso(1))
    const id = useAvisosStore.getState().avisos[0].id

    await useAvisosStore.getState().deshacer(id)
    await useAvisosStore.getState().deshacer(id)

    expect(deshacerConsumo).toHaveBeenCalledTimes(1)
    expect(deshacerConsumo).toHaveBeenCalledWith('mov-1')
    expect(useAvisosStore.getState().avisos[0].estado).toBe('revertido')
    vi.advanceTimersByTime(DURACION_REVERTIDO_MS)
    expect(useAvisosStore.getState().avisos).toHaveLength(0)
  })

  it('does nothing when undoing an expired notice', async () => {
    useAvisosStore.getState().agregar(aviso(1))
    const id = useAvisosStore.getState().avisos[0].id
    vi.advanceTimersByTime(DURACION_AVISO_MS)

    await useAvisosStore.getState().deshacer(id)

    expect(deshacerConsumo).not.toHaveBeenCalled()
  })

  it('restores the pending state if the undo write fails', async () => {
    deshacerConsumo.mockRejectedValueOnce(new Error('boom'))
    useAvisosStore.getState().agregar(aviso(1))
    const id = useAvisosStore.getState().avisos[0].id

    await expect(useAvisosStore.getState().deshacer(id)).rejects.toThrow('boom')
    expect(useAvisosStore.getState().avisos[0].estado).toBe('pendiente')
  })

  it('expires a material-creado notice at 4 seconds (spec 008)', () => {
    useAvisosStore.getState().agregar(avisoMaterialCreado('Fresa'))

    vi.advanceTimersByTime(DURACION_MATERIAL_CREADO_MS - 1)
    expect(useAvisosStore.getState().avisos).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(useAvisosStore.getState().avisos).toHaveLength(0)
  })

  it('a material-creado does not evict any of 3 consumo avisos — it is discarded instead', () => {
    for (let n = 1; n <= 3; n++) useAvisosStore.getState().agregar(aviso(n))

    useAvisosStore.getState().agregar(avisoMaterialCreado('Fresa'))

    const avisos = useAvisosStore.getState().avisos
    expect(avisos.map((a) => a.insumoNombre)).toEqual([
      'Insumo 1',
      'Insumo 2',
      'Insumo 3',
    ])
  })

  it('a new consumo evicts an informative material-creado before any consumo', () => {
    useAvisosStore.getState().agregar(aviso(1))
    useAvisosStore.getState().agregar(aviso(2))
    useAvisosStore.getState().agregar(avisoMaterialCreado('Fresa'))

    useAvisosStore.getState().agregar(aviso(3))

    const avisos = useAvisosStore.getState().avisos
    expect(avisos.map((a) => a.insumoNombre)).toEqual([
      'Insumo 1',
      'Insumo 2',
      'Insumo 3',
    ])
    expect(avisos.every((a) => a.tipo === 'consumo')).toBe(true)
  })

  it('spec 023: los avisos de marcas son informativos y ceden su lugar a un consumo', () => {
    useAvisosStore.getState().agregar(aviso(1))
    useAvisosStore.getState().agregar(aviso(2))
    useAvisosStore.getState().agregar({
      tipo: 'marca-no-eliminada',
      movimientoId: null,
      loteId: null,
      insumoNombre: '3M',
      unidadMedida: null,
    })
    useAvisosStore.getState().agregar(aviso(3))

    expect(useAvisosStore.getState().avisos.map((a) => a.tipo)).toEqual([
      'consumo',
      'consumo',
      'consumo',
    ])

    useAvisosStore.setState({ avisos: [] })
    for (let n = 1; n <= 3; n++) useAvisosStore.getState().agregar(aviso(n))
    useAvisosStore.getState().agregar({
      tipo: 'marca-repetida',
      movimientoId: null,
      loteId: null,
      insumoNombre: 'GC',
      unidadMedida: null,
    })
    expect(useAvisosStore.getState().avisos.every((a) => a.tipo === 'consumo')).toBe(true)
  })
})
