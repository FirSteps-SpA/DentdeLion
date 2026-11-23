import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Spec 029 T007 — cliente de `estimar-materiales` (research.md R6, FR-012). */
const invoke = vi.hoisted(() => vi.fn())
vi.mock('../../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: { functions: { invoke } }, error: null }),
}))

import { estimarMateriales } from '../../../src/features/tratamientos/lib/estimacion'

const conCodigo = (status: number, codigo: string) => ({
  data: null,
  error: { context: new Response(JSON.stringify({ codigo }), { status }) },
})

beforeEach(() => invoke.mockReset())
afterEach(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }))

describe('estimarMateriales', () => {
  it('envía solo el nombre y hasta 20 ids', async () => {
    invoke.mockResolvedValue({ data: { reconocido: true, sugerencias: [] }, error: null })
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`)
    await estimarMateriales('  Resina ', ids)
    expect(invoke).toHaveBeenCalledWith('estimar-materiales', {
      body: { tratamiento: 'Resina', insumoIds: ids.slice(0, 20) },
    })
  })

  it('devuelve las sugerencias, o no_reconocido', async () => {
    const sugerencias = [{ insumoId: 'a', cantidad: 1, nota: 'x' }]
    invoke.mockResolvedValueOnce({ data: { reconocido: true, sugerencias }, error: null })
    expect(await estimarMateriales('Resina', ['a'])).toEqual(sugerencias)
    invoke.mockResolvedValueOnce({ data: { reconocido: false, sugerencias: [] }, error: null })
    expect(await estimarMateriales('Poema', ['a'])).toBe('no_reconocido')
  })

  it.each([
    [429, 'limite_diario', 'limite_diario'],
    [503, 'no_configurado', 'no_configurado'],
    [403, 'solo_administracion', 'solo_administracion'],
    [502, 'error_modelo', 'error'],
    [404, 'materiales_invalidos', 'error'],
  ])('HTTP %i %s → %s', async (status, codigo, esperado) => {
    invoke.mockResolvedValue(conCodigo(status, codigo))
    expect(await estimarMateriales('Resina', ['a'])).toBe(esperado)
  })

  it('sin red no llama a la función', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    expect(await estimarMateriales('Resina', ['a'])).toBe('sin_conexion')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('un error sin respuesta del servidor es sin_conexion', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('fetch failed') })
    expect(await estimarMateriales('Resina', ['a'])).toBe('sin_conexion')
  })
})
