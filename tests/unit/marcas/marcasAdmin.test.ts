import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Marca, UsuarioActual } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      marcas: new MemoryTable(),
      insumos: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  MENSAJE_NOMBRE_REPETIDO,
  MENSAJE_NOMBRE_VACIO,
  MarcaDesactivada,
  crearMarca,
  desactivarMarca,
  eliminarMarca,
  reactivarMarca,
  renombrarMarca,
} from '../../../src/features/marcas/lib/marcasAdmin'
import { TENANT_1 } from '../../helpers/tenancy'

const marcasT = db.marcas as unknown as MemoryTable<Marca>
const insumosT = db.insumos as unknown as MemoryTable<Insumo>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', rol: 'personal' }

function marca(id: string, nombre: string, extra: Partial<Marca> = {}): Marca {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    creadoPor: 'admin-1',
    creadoEn: '2026-10-24T10:00:00.000Z',
    desactivadoEn: null,
    eliminadoEn: null,
    sincronizado: true,
    ...extra,
  }
}

const insumo = (id: string, marcaId: string | null, dadoDeBajaEn: string | null = null) =>
  ({ id, tenantId: TENANT_1, nombre: id, marcaId, dadoDeBajaEn }) as Insumo

beforeEach(() => {
  marcasT.seed([
    marca('tres', '3M'),
    marca('gc', 'GC', { desactivadoEn: '2026-10-01T00:00:00.000Z' }),
    marca('libre', 'Libre'),
  ])
  insumosT.seed([])
  useAuthStore.setState({ usuario: admin, isReady: true })
})

/** Spec 023 T031 (US2-1..4, FR-002, FR-007). */
describe('crearMarca', () => {
  it('cualquier miembro crea una marca local pendiente de subir', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    const nueva = await crearMarca({ nombre: '  Ivoclar   Vivadent ' })
    expect(nueva).toMatchObject({
      nombre: 'Ivoclar Vivadent',
      tenantId: TENANT_1,
      creadoPor: 'personal-1',
      desactivadoEn: null,
      eliminadoEn: null,
      sincronizado: false,
    })
    expect(marcasT.all()).toHaveLength(4)
  })

  it('un nombre vacío o solo espacios se rechaza', async () => {
    await expect(crearMarca({ nombre: '   ' })).rejects.toThrow(MENSAJE_NOMBRE_VACIO)
    await expect(crearMarca({ nombre: 'x'.repeat(61) })).rejects.toThrow(MENSAJE_NOMBRE_VACIO)
  })

  it('" 3m " devuelve la existente; en Ajustes (estricto) se rechaza', async () => {
    expect((await crearMarca({ nombre: ' 3m ' })).id).toBe('tres')
    await expect(crearMarca({ nombre: '3m' }, { estricto: true })).rejects.toThrow(
      MENSAJE_NOMBRE_REPETIDO,
    )
    expect(marcasT.all()).toHaveLength(3)
  })

  it('con el nombre de una desactivada lanza MarcaDesactivada', async () => {
    await expect(crearMarca({ nombre: 'gc' })).rejects.toBeInstanceOf(MarcaDesactivada)
  })
})

/** Spec 023 T042 (US4, FR-016, FR-019). */
describe('administrar marcas', () => {
  it('renombrar: a un nombre libre sí; a uno repetido no', async () => {
    await renombrarMarca('libre', 'Dentsply')
    expect(marcasT.all().find((m) => m.id === 'libre')).toMatchObject({
      nombre: 'Dentsply',
      sincronizado: false,
    })
    await expect(renombrarMarca('libre', ' 3M ')).rejects.toThrow(MENSAJE_NOMBRE_REPETIDO)
    // Repetir el propio nombre con otras mayúsculas no choca consigo misma.
    await renombrarMarca('tres', '3m')
    expect(marcasT.all().find((m) => m.id === 'tres')?.nombre).toBe('3m')
  })

  it('desactivar y reactivar', async () => {
    await desactivarMarca('tres')
    expect(marcasT.all().find((m) => m.id === 'tres')?.desactivadoEn).not.toBeNull()
    await reactivarMarca('tres')
    expect(marcasT.all().find((m) => m.id === 'tres')).toMatchObject({
      desactivadoEn: null,
      sincronizado: false,
    })
  })

  it('eliminar: sin insumos sí; con insumos (también dados de baja) no', async () => {
    insumosT.seed([insumo('i1', 'tres', '2026-10-01T00:00:00.000Z')])
    await expect(eliminarMarca('tres')).rejects.toThrow('la usa 1 insumo')
    expect(marcasT.all().find((m) => m.id === 'tres')?.eliminadoEn).toBeNull()

    await eliminarMarca('libre')
    expect(marcasT.all().find((m) => m.id === 'libre')?.eliminadoEn).not.toBeNull()
    await expect(renombrarMarca('libre', 'Otra')).rejects.toThrow('Esa marca ya no existe.')
  })

  it('el personal no puede renombrar, desactivar, reactivar ni eliminar', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    await expect(renombrarMarca('tres', 'X')).rejects.toThrow('Solo un administrador')
    await expect(desactivarMarca('tres')).rejects.toThrow('Solo un administrador')
    await expect(reactivarMarca('gc')).rejects.toThrow('Solo un administrador')
    await expect(eliminarMarca('libre')).rejects.toThrow('Solo un administrador')
    expect(marcasT.all().every((m) => m.sincronizado)).toBe(true)
  })
})
