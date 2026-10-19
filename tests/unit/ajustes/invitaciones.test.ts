import { describe, expect, it } from 'vitest'
import { enlaceDeInvitacion, enlacesCompartir } from '../../../src/features/ajustes/lib/invitaciones'
import { validarPassword } from '../../../src/features/auth/invitacion'

/** Spec 014 T052 (FR-019, research.md R5). */
describe('enlace de invitación', () => {
  it('lleva el token en ?invitacion=', () => {
    expect(enlaceDeInvitacion('a b', 'https://dentdelion.app')).toBe(
      'https://dentdelion.app/?invitacion=a%20b',
    )
  })

  it('arma correo y WhatsApp en español con el enlace', () => {
    const enlace = 'https://dentdelion.app/?invitacion=T'
    const { mailto, whatsapp } = enlacesCompartir(enlace, 'Clínica Sonrisas')
    const correo = decodeURIComponent(mailto)
    expect(correo).toContain('subject=Invitación a Dentdelion de Clínica Sonrisas')
    expect(correo).toContain(enlace)
    expect(correo).toContain('vence en 7 días')
    expect(decodeURIComponent(whatsapp)).toContain(enlace)
    expect(whatsapp.startsWith('https://wa.me/?text=')).toBe(true)
  })
})

describe('validarPassword (regla de Auth: 10+ caracteres, letras y números)', () => {
  it('acepta una contraseña válida que coincide', () => {
    expect(validarPassword('Clave12345', 'Clave12345')).toBeNull()
  })

  it('rechaza las cortas, sin números o sin letras, y las que no coinciden', () => {
    expect(validarPassword('Clave123', 'Clave123')).toMatch(/10 caracteres/)
    expect(validarPassword('SoloLetrasAqui', 'SoloLetrasAqui')).toMatch(/10 caracteres/)
    expect(validarPassword('1234567890', '1234567890')).toMatch(/10 caracteres/)
    expect(validarPassword('Clave12345', 'Clave12346')).toMatch(/no coinciden/)
  })
})
