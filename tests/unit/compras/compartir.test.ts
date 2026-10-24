import { afterEach, describe, expect, it, vi } from 'vitest'
import { copiarAlPortapapeles, puedeCompartir } from '../../../src/features/compras/lib/compartir'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('puedeCompartir', () => {
  it('reflects the presence of navigator.share', () => {
    vi.stubGlobal('navigator', { share: vi.fn() })
    expect(puedeCompartir()).toBe(true)

    vi.stubGlobal('navigator', {})
    expect(puedeCompartir()).toBe(false)
  })
})

describe('copiarAlPortapapeles', () => {
  it('returns true when navigator.clipboard.writeText resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copiarAlPortapapeles('texto')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('texto')
  })

  it('returns false when it throws', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copiarAlPortapapeles('texto')).resolves.toBe(false)
  })

  it('returns false when there is no clipboard API', async () => {
    vi.stubGlobal('navigator', {})

    await expect(copiarAlPortapapeles('texto')).resolves.toBe(false)
  })
})
