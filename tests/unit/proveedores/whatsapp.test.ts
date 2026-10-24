import { describe, expect, it } from 'vitest'
import {
  formatearWhatsapp,
  normalizarWhatsapp,
} from '../../../src/features/proveedores/lib/whatsapp'

/** Spec 021 T033 (research.md R10, FR-015). */
describe('normalizarWhatsapp', () => {
  it.each([
    ['9 1234 5678', '56912345678'],
    ['+56 9 1234-5678', '56912345678'],
    ['56912345678', '56912345678'],
    ['(9) 1234 5678', '56912345678'],
    ['+54 11 1234 5678', '541112345678'],
  ])('%j → %j', (texto, valor) => {
    expect(normalizarWhatsapp(texto)).toEqual({ ok: true, valor })
  })

  it('vacío es "sin WhatsApp"', () => {
    expect(normalizarWhatsapp('   ')).toEqual({ ok: true, valor: null })
  })

  it('rechaza números cortos o demasiado largos', () => {
    expect(normalizarWhatsapp('123')).toEqual({ ok: false })
    expect(normalizarWhatsapp('+1234567890123456')).toEqual({ ok: false })
  })
})

describe('formatearWhatsapp', () => {
  it('formatea celulares chilenos y deja el resto con +', () => {
    expect(formatearWhatsapp('56912345678')).toBe('+56 9 1234 5678')
    expect(formatearWhatsapp('541112345678')).toBe('+541112345678')
  })
})
