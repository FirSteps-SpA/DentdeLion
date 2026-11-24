import { describe, expect, it } from 'vitest'
import {
  AYUDAS,
  ORDEN_AYUDAS,
  ayudaParaRol,
  tituloAyuda,
} from '../../../src/features/ayuda/contenido'
import { SECCIONES_AJUSTES } from '../../../src/features/ajustes/lib/secciones'

/** Spec 030 T003 (FR-002, FR-004, FR-007, SC-001). */
describe('contenido de la ayuda', () => {
  it('hay ayuda para las 7 vistas y para cada sección de Ajustes salvo la guía, en orden', () => {
    expect(ORDEN_AYUDAS).toHaveLength(15)
    expect(new Set(ORDEN_AYUDAS).size).toBe(15)
    expect(Object.keys(AYUDAS).sort()).toEqual([...ORDEN_AYUDAS].sort())
    expect(ORDEN_AYUDAS.filter((id) => id.startsWith('ajustes:'))).toEqual(
      SECCIONES_AJUSTES.filter((s) => s.id !== 'guia' && s.id !== 'plataforma').map((s) => `ajustes:${s.id}`),
    )
  })

  it.each(ORDEN_AYUDAS)('%s es breve y completa', (id) => {
    const ayuda = AYUDAS[id]
    expect(ayuda.paraQue.length).toBeGreaterThan(20)
    expect(ayuda.tareas.length).toBeGreaterThan(0)
    expect(ayuda.tareas.length).toBeLessThanOrEqual(6)
    for (const tarea of ayuda.tareas) {
      expect(tarea.pasos.length).toBeGreaterThan(0)
      for (const paso of tarea.pasos) expect(paso.length).toBeLessThanOrEqual(130)
    }
  })

  it('personal no ve tareas ni consejos de administración, ni pantallas solo de administración', () => {
    const inventario = ayudaParaRol(AYUDAS.inventario, 'personal')!
    expect(inventario.tareas.some((t) => t.soloAdministracion)).toBe(false)
    expect(inventario.tareas.map((t) => t.nombre)).not.toContain('Editar o eliminar un material')
    expect(inventario.consejos.some((c) => c.soloAdministracion)).toBe(false)
    expect(ayudaParaRol(AYUDAS['ajustes:lugares'], 'personal')).toBeNull()
    expect(ayudaParaRol(AYUDAS.inventario, 'administrador')).toBe(AYUDAS.inventario)
  })

  it('cada pantalla visible para personal le deja al menos una tarea', () => {
    for (const id of ORDEN_AYUDAS) {
      const ayuda = ayudaParaRol(AYUDAS[id], 'personal')
      if (ayuda) expect(ayuda.tareas.length, id).toBeGreaterThan(0)
    }
  })

  it('titula por rol como el índice de Ajustes', () => {
    expect(tituloAyuda('ajustes:perfil', 'administrador')).toBe('Perfil y equipo')
    expect(tituloAyuda('ajustes:perfil', 'personal')).toBe('Perfil')
    expect(tituloAyuda('ajustes:avisos', 'personal')).toBe('Notificaciones')
    expect(tituloAyuda('compras', 'personal')).toBe('Compras')
  })
})
