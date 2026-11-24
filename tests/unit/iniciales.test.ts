import { describe, expect, it } from 'vitest'
import { iniciales, primerNombre } from '../../src/app/iniciales'

describe('iniciales y saludo (spec 032)', () => {
  it('toma las dos primeras palabras', () => {
    expect(iniciales('Sofía León')).toBe('SL')
    expect(primerNombre('Sofía León')).toBe('Sofía')
  })

  it('salta los títulos abreviados con punto', () => {
    expect(iniciales('Dra. Ana Pérez')).toBe('AP')
    expect(primerNombre('Dr. Juan')).toBe('Juan')
  })

  it('si el nombre es solo un título, lo usa', () => {
    expect(iniciales('Dra.')).toBe('D')
    expect(primerNombre('  ')).toBe('')
  })
})
