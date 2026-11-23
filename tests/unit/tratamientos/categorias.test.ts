import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioTratamiento,
  CategoriaTratamiento,
  Insumo,
  Tratamiento,
  UsuarioActual,
} from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      insumos: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      categoriasTratamiento: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  crearCategoriaTratamiento,
  guardarCategoriaTratamiento,
  reactivarCategoriaTratamiento,
  validarNombreCategoriaTratamiento,
} from '../../../src/features/tratamientos/lib/categorias'
import { crearTratamiento, editarTratamiento } from '../../../src/features/tratamientos/lib/catalogo'
import {
  claveCategoriaLugar,
  porcentajesPorCategoria,
  proyectarTratamientos,
} from '../../../src/features/tratamientos/lib/proyeccion'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

const categoriasT = db.categoriasTratamiento as unknown as MemoryTable<CategoriaTratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>
const tratamientosT = db.tratamientos as unknown as MemoryTable<Tratamiento>
const insumosT = db.insumos as unknown as MemoryTable<Insumo>

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Ana',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}
const personal: UsuarioActual = { ...admin, id: 'p-1', rol: 'personal' }

function categoria(overrides: Partial<CategoriaTratamiento> = {}): CategoriaTratamiento {
  return {
    id: 'eval',
    tenantId: TENANT_1,
    nombre: 'Evaluación',
    creadoPor: null,
    creadoEn: '2026-11-23T00:00:00.000Z',
    desactivadoEn: null,
    sincronizado: true,
    rechazadoEn: null,
    ...overrides,
  }
}

beforeEach(() => {
  categoriasT.seed([categoria(), categoria({ id: 'rest', nombre: 'Restauración' })])
  cambiosT.seed([])
  tratamientosT.seed([])
  insumosT.seed([])
  useAuthStore.setState({ usuario: admin, isReady: true })
})

/** Spec 026 T011/T020 (FR-002, FR-003, FR-009). */
describe('validarNombreCategoriaTratamiento (FR-003)', () => {
  const existentes = [categoria(), categoria({ id: 'x', nombre: 'Vieja', rechazadoEn: 'y' })]

  it('rechaza vacío, largo, repetido por clave y el reservado', () => {
    expect(validarNombreCategoriaTratamiento('  ', existentes)).toMatch(/hasta 40/)
    expect(validarNombreCategoriaTratamiento('x'.repeat(41), existentes)).toMatch(/hasta 40/)
    expect(validarNombreCategoriaTratamiento(' evaluacion ', existentes)).toMatch(/Ya existe/)
    expect(validarNombreCategoriaTratamiento('sin categoria', existentes)).toMatch(/reservado/)
  })

  it('acepta el propio nombre al editar y el de una rechazada', () => {
    expect(validarNombreCategoriaTratamiento('EVALUACIÓN', existentes, 'eval')).toBeNull()
    expect(validarNombreCategoriaTratamiento('Vieja', existentes)).toBeNull()
  })
})

describe('crear, renombrar y (des)activar (FR-002)', () => {
  it('administración crea una categoría activa sin subir', async () => {
    const { id } = await crearCategoriaTratamiento('  Blanqueamiento ')
    expect(categoriasT.all().find((c) => c.id === id)).toMatchObject({
      nombre: 'Blanqueamiento',
      creadoPor: 'admin-1',
      desactivadoEn: null,
      sincronizado: false,
    })
  })

  it('rechaza un nombre repetido y a personal', async () => {
    await expect(crearCategoriaTratamiento('restauracion')).rejects.toThrow(/Ya existe/)
    useAuthStore.setState({ usuario: personal, isReady: true })
    await expect(crearCategoriaTratamiento('Otra')).rejects.toThrow(/administrador/)
    expect(categoriasT.all()).toHaveLength(2)
  })

  it('renombra en el lugar y marca la fila para subir', async () => {
    await guardarCategoriaTratamiento('eval', { nombre: 'Evaluación y diagnóstico' })
    expect(categoriasT.all().find((c) => c.id === 'eval')).toMatchObject({
      nombre: 'Evaluación y diagnóstico',
      sincronizado: false,
    })
  })

  it('no renombra a un nombre de otra', async () => {
    await expect(guardarCategoriaTratamiento('eval', { nombre: 'Restauración' })).rejects.toThrow(
      /Ya existe/,
    )
  })

  it('desactiva y reactiva', async () => {
    await guardarCategoriaTratamiento('eval', { activa: false })
    expect(categoriasT.all().find((c) => c.id === 'eval')?.desactivadoEn).not.toBeNull()
    await reactivarCategoriaTratamiento('eval')
    expect(categoriasT.all().find((c) => c.id === 'eval')?.desactivadoEn).toBeNull()
  })
})

describe('% por lugar (FR-009)', () => {
  it('escribe solo los % que cambian; null vuelve al general', async () => {
    await guardarCategoriaTratamiento('eval', { porcentajes: { [LUGAR_1]: 50, [LUGAR_2]: null } })
    expect(cambiosT.all()).toHaveLength(1)
    expect(cambiosT.all()[0]).toMatchObject({
      campo: 'porcentajeCategoria',
      categoriaId: 'eval',
      lugarId: LUGAR_1,
      tratamientoId: null,
      valorAnterior: null,
      valorNuevo: 50,
      usuarioId: 'admin-1',
    })

    await guardarCategoriaTratamiento('eval', { porcentajes: { [LUGAR_1]: 50 } })
    expect(cambiosT.all()).toHaveLength(1)

    // Sin la pausa, el null y el 50 pueden empatar en `creadoEn` y ganar el 50
    // por el id (falló así en el CI del PR #31).
    await pausa()
    await guardarCategoriaTratamiento('eval', { porcentajes: { [LUGAR_1]: null } })
    expect(porcentajesPorCategoria(cambiosT.all()).has(claveCategoriaLugar('eval', LUGAR_1))).toBe(
      false,
    )
  })

  it('un % fuera de rango no guarda nada, tampoco el nombre', async () => {
    await expect(
      guardarCategoriaTratamiento('eval', { nombre: 'Otra', porcentajes: { [LUGAR_1]: 120 } }),
    ).rejects.toThrow(/entre 0 y 100/)
    expect(cambiosT.all()).toHaveLength(0)
    expect(categoriasT.all().find((c) => c.id === 'eval')?.nombre).toBe('Evaluación')
  })

  it('personal no fija %', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    await expect(
      guardarCategoriaTratamiento('eval', { porcentajes: { [LUGAR_1]: 50 } }),
    ).rejects.toThrow(/administrador/)
  })
})

/** El ledger desempata por `(creadoEn, id)`: cada edición en su propio milisegundo. */
const pausa = () => new Promise((resolver) => setTimeout(resolver, 3))

describe('categoría del tratamiento (FR-005, FR-006)', () => {
  const input = { nombre: 'Evaluación inicial', materiales: [], precios: { [LUGAR_1]: 20000 } }

  it('crear con categoría escribe el cambio; editar solo si cambia; null la quita', async () => {
    const id = await crearTratamiento({ ...input, categoriaId: 'eval' })
    const proyectar = () =>
      proyectarTratamientos(tratamientosT.all(), cambiosT.all()).find((t) => t.id === id)!
    expect(proyectar().categoriaId).toBe('eval')

    const antes = cambiosT.all().length
    await pausa()
    await editarTratamiento(id, { ...input, categoriaId: 'eval' })
    expect(cambiosT.all()).toHaveLength(antes)

    await pausa()
    await editarTratamiento(id, { ...input, categoriaId: 'rest' })
    expect(cambiosT.all().at(-1)).toMatchObject({
      campo: 'categoria',
      valorAnterior: 'eval',
      valorNuevo: 'rest',
      tratamientoId: id,
    })

    await pausa()
    await editarTratamiento(id, { ...input, categoriaId: null })
    expect(proyectar().categoriaId).toBeNull()

    // Sin `categoriaId` en el input (versiones de formulario sin el campo): no la toca.
    await pausa()
    await editarTratamiento(id, { ...input, categoriaId: 'eval' })
    await pausa()
    await editarTratamiento(id, input)
    expect(proyectar().categoriaId).toBe('eval')
  })

  it('crear sin categoría no escribe cambio de categoría', async () => {
    await crearTratamiento(input)
    expect(cambiosT.all().some((c) => c.campo === 'categoria')).toBe(false)
  })
})
