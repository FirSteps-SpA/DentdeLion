import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, ItemCompra } from '../../../src/lib/db'
import type { ItemSugerido } from '../../../src/features/compras/lib/sugeridos'
import {
  construirTextoCompartir,
  copiarAlPortapapeles,
  puedeCompartir,
} from '../../../src/features/compras/lib/compartir'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    tenantId: TENANT_1,
    id: 'i1',
    nombre: 'Guantes M',
    categoria: 'Protección',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function itemCompra(overrides: Partial<ItemCompra>): ItemCompra {
  return {
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    id: 'item-1',
    nombre: 'Torundas',
    cantidad: null,
    nota: null,
    insumoId: null,
    estado: 'pendiente',
    creadoPor: 'user-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    compradoPor: null,
    compradoEn: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('construirTextoCompartir', () => {
  it('lists sugeridos and manuales, con cantidad y origen', () => {
    const sugeridos: ItemSugerido[] = [
      { insumo: insumo({ nombre: 'Guantes M' }), stockBajo: true, caducado: false },
    ]
    const manuales = [itemCompra({ nombre: 'Torundas', cantidad: 3 })]

    const texto = construirTextoCompartir(sugeridos, manuales)

    expect(texto).toContain('Guantes M (Sugerido)')
    expect(texto).toContain('Torundas x3 (Manual)')
  })

  it('produces an empty string with no pending items', () => {
    expect(construirTextoCompartir([], [])).toBe('')
  })
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
