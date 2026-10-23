import { describe, expect, it } from 'vitest'
import {
  SECCIONES_AJUSTES,
  esIdSeccion,
  resumenSeccion,
  seccionesVisibles,
  type DatosResumen,
} from '../../../src/features/ajustes/lib/secciones'

/** Spec 019 T002 (FR-001, FR-011, research.md R2, UI §2). */
describe('SECCIONES_AJUSTES', () => {
  it('sigue el orden del índice', () => {
    expect(SECCIONES_AJUSTES.map((s) => s.id)).toEqual([
      'perfil',
      'lugares',
      'avisos',
      'categorias',
      'baja',
    ])
  })

  it('la administración ve las cinco en orden; el personal solo perfil y avisos', () => {
    expect(seccionesVisibles('administrador').map((s) => s.id)).toEqual([
      'perfil',
      'lugares',
      'avisos',
      'categorias',
      'baja',
    ])
    expect(seccionesVisibles('personal').map((s) => s.id)).toEqual(['perfil', 'avisos'])
  })

  it('titula por rol solo las secciones con partes de administración', () => {
    const titulos = Object.fromEntries(
      SECCIONES_AJUSTES.map((s) => [s.id, [s.titulo(true), s.titulo(false)]]),
    )
    expect(titulos).toEqual({
      perfil: ['Perfil y equipo', 'Perfil'],
      lugares: ['Lugares de trabajo', 'Lugares de trabajo'],
      avisos: ['Notificaciones y avisos', 'Notificaciones'],
      categorias: ['Categorías', 'Categorías'],
      baja: ['Insumos dados de baja', 'Insumos dados de baja'],
    })
  })

  it('esIdSeccion acepta solo los ids del registro', () => {
    for (const s of SECCIONES_AJUSTES) expect(esIdSeccion(s.id)).toBe(true)
    expect(esIdSeccion('proveedores')).toBe(false)
    expect(esIdSeccion('')).toBe(false)
    expect(esIdSeccion('x')).toBe(false)
  })
})

/** Spec 019 T006 (FR-002, research.md R3). */
describe('resumenSeccion', () => {
  const listos: DatosResumen = {
    usuario: { nombre: 'Admin Uno', rol: 'administrador' },
    lugaresActivos: 3,
    categoriasActivas: 12,
    insumosDadosDeBaja: 3,
    notificaciones: { stockBajo: true, caducidad: true },
    nivelesAvisoDias: [7, 30, 15],
  }

  it('perfil: nombre y rol', () => {
    expect(resumenSeccion('perfil', listos)).toBe('Admin Uno · Administradora')
    expect(
      resumenSeccion('perfil', { ...listos, usuario: { nombre: 'Personal Uno', rol: 'personal' } }),
    ).toBe('Personal Uno · Personal')
  })

  it('lugares, categorías y dados de baja con singular, plural y cero', () => {
    expect(resumenSeccion('lugares', { ...listos, lugaresActivos: 1 })).toBe('1 lugar')
    expect(resumenSeccion('lugares', listos)).toBe('3 lugares')
    expect(resumenSeccion('categorias', { ...listos, categoriasActivas: 1 })).toBe('1 categoría')
    expect(resumenSeccion('categorias', listos)).toBe('12 categorías')
    expect(resumenSeccion('categorias', { ...listos, categoriasActivas: 0 })).toBe(
      'Sin categorías',
    )
    expect(resumenSeccion('baja', { ...listos, insumosDadosDeBaja: 1 })).toBe(
      '1 insumo dado de baja',
    )
    expect(resumenSeccion('baja', listos)).toBe('3 insumos dados de baja')
    expect(resumenSeccion('baja', { ...listos, insumosDadosDeBaja: 0 })).toBe(
      'Sin insumos dados de baja',
    )
  })

  it('avisos para personal: qué notificaciones están activadas', () => {
    const personal = { ...listos, usuario: { nombre: 'P', rol: 'personal' as const } }
    const con = (stockBajo: boolean, caducidad: boolean) =>
      resumenSeccion('avisos', { ...personal, notificaciones: { stockBajo, caducidad } })
    expect(con(true, true)).toBe('Stock bajo y caducidad')
    expect(con(true, false)).toBe('Solo stock bajo')
    expect(con(false, true)).toBe('Solo caducidad')
    expect(con(false, false)).toBe('Desactivadas')
  })

  it('avisos para administración suma los niveles, de mayor a menor', () => {
    expect(resumenSeccion('avisos', listos)).toBe(
      'Stock bajo y caducidad · Avisos a 30, 15 y 7 días',
    )
    expect(resumenSeccion('avisos', { ...listos, nivelesAvisoDias: [30] })).toBe(
      'Stock bajo y caducidad · Aviso a 30 días',
    )
    expect(resumenSeccion('avisos', { ...listos, nivelesAvisoDias: [] })).toBe(
      'Stock bajo y caducidad',
    )
  })

  it('null mientras los datos de la sección no están listos', () => {
    expect(resumenSeccion('perfil', { ...listos, usuario: null })).toBeNull()
    expect(resumenSeccion('lugares', { ...listos, lugaresActivos: null })).toBeNull()
    expect(resumenSeccion('categorias', { ...listos, categoriasActivas: null })).toBeNull()
    expect(resumenSeccion('baja', { ...listos, insumosDadosDeBaja: null })).toBeNull()
    expect(resumenSeccion('avisos', { ...listos, notificaciones: null })).toBeNull()
  })
})
