import { describe, expect, it } from 'vitest'
import {
  codigoDeError,
  confirmacionValida,
  nombreRespaldo,
  validarAccion,
} from '../../../supabase/functions/plataforma/logica'

/** Spec 031 T004 (contracts/api.md). */
const ID = '11111111-1111-4111-8111-111111111111'

describe('validarAccion', () => {
  it('acepta cada acción con su forma, normalizando textos y correo', () => {
    expect(validarAccion({ accion: 'listar' })).toEqual({ accion: 'listar' })
    expect(
      validarAccion({
        accion: 'crear_cliente',
        nombre: '  Clínica   X ',
        lugar: 'Sede',
        correo: ' A@B.CL ',
      }),
    ).toEqual({
      accion: 'crear_cliente',
      nombre: 'Clínica X',
      lugar: 'Sede',
      correo: 'a@b.cl',
    })
    expect(
      validarAccion({
        accion: 'invitar',
        tenantId: ID,
        correo: 'a@b.cl',
        rol: 'personal',
      }),
    ).toMatchObject({ rol: 'personal' })
    expect(
      validarAccion({
        accion: 'eliminar_cliente',
        tenantId: ID,
        confirmacion: 'X',
      }),
    ).toMatchObject({ tenantId: ID })
    expect(
      validarAccion({ accion: 'borrar_cuentas', usuarioIds: [ID] }),
    ).toEqual({ accion: 'borrar_cuentas', usuarioIds: [ID] })
  })

  it.each([
    ['sin cuerpo', null],
    ['acción desconocida', { accion: 'borrar_todo' }],
    ['tenant no uuid', { accion: 'detalle', tenantId: 'x' }],
    [
      'nombre largo',
      {
        accion: 'crear_cliente',
        nombre: 'x'.repeat(81),
        lugar: 'S',
        correo: 'a@b.cl',
      },
    ],
    [
      'correo inválido',
      {
        accion: 'crear_cliente',
        nombre: 'C',
        lugar: 'S',
        correo: 'no-es-correo',
      },
    ],
    [
      'rol inválido',
      { accion: 'invitar', tenantId: ID, correo: 'a@b.cl', rol: 'dueño' },
    ],
    ['sin confirmación', { accion: 'eliminar_usuario', usuarioId: ID }],
    ['cuentas vacías', { accion: 'borrar_cuentas', usuarioIds: [] }],
    ['cuenta no uuid', { accion: 'borrar_cuentas', usuarioIds: [ID, 'x'] }],
  ])('rechaza: %s', (_caso, cuerpo) => {
    expect(validarAccion(cuerpo)).toBeNull()
  })
})

describe('confirmacionValida', () => {
  it('ignora mayúsculas y espacios de los bordes; no acepta vacío', () => {
    expect(confirmacionValida('  clínica  x ', 'Clínica X')).toBe(true)
    expect(confirmacionValida('Clinica X', 'Clínica X')).toBe(false)
    expect(confirmacionValida('', '')).toBe(false)
  })
})

describe('codigoDeError', () => {
  it('traduce los códigos de las funciones SQL y lo demás es error interno', () => {
    expect(codigoDeError('unica_administradora')).toBe('unica_administradora')
    expect(codigoDeError('ERROR: correo_en_otro_tenant')).toBe(
      'correo_en_otro_tenant',
    )
    expect(codigoDeError('quedan 3 filas en lotes')).toBe('error_interno')
    expect(codigoDeError(undefined)).toBe('error_interno')
  })
})

describe('nombreRespaldo', () => {
  it('sin tildes ni símbolos, con la fecha', () => {
    expect(
      nombreRespaldo('Clínica Ñuñoa & Co.', new Date('2026-11-23T12:00:00Z')),
    ).toBe('respaldo-clinica-nunoa-co-2026-11-23.json')
  })
})
