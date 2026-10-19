import { describe, expect, it } from 'vitest'
import { validarNombreLugar } from '../../../src/features/ajustes/lib/lugares'
import { lugar1, lugar2 } from '../../helpers/lugarFalso'

/** Spec 014 T045 (FR-005, Edge Case "Nombre duplicado"). */
describe('validarNombreLugar', () => {
  const lugares = [lugar1, lugar2]

  it('exige 1 a 60 caracteres', () => {
    expect(validarNombreLugar('   ', lugares)).toMatch(/Ingresa/)
    expect(validarNombreLugar('x'.repeat(61), lugares)).toMatch(/60/)
    expect(validarNombreLugar('Box Centro', lugares)).toBeNull()
  })

  it('rechaza un nombre repetido en el tenant sin distinguir mayúsculas ni espacios', () => {
    expect(validarNombreLugar('  box las condes ', lugares)).toMatch(/Ya existe/)
  })

  it('al renombrar, el propio lugar no cuenta como duplicado', () => {
    expect(validarNombreLugar('BOX LAS CONDES', lugares, lugar2.id)).toBeNull()
  })
})
