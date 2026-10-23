import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioTratamiento,
  Insumo,
  Tratamiento,
  UsuarioActual,
} from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      insumos: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  cambiarActivo,
  crearTratamiento,
  editarTratamiento,
  fijarPorcentajeLugar,
  validarTratamiento,
} from '../../../src/features/tratamientos/lib/catalogo'
import {
  porcentajesPorLugar,
  proyectarTratamientos,
} from '../../../src/features/tratamientos/lib/proyeccion'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const tratamientosT = db.tratamientos as unknown as MemoryTable<Tratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Ana',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

function insumo(id: string, unidadMedida: string): Insumo {
  return {
    id,
    tenantId: TENANT_1,
    nombre: id === 'art' ? 'Articaína' : 'Resina',
    categoria: 'X',
    unidadMedida,
    unidadCompra: unidadMedida,
    contenido: 1,
    permiteDecimales: unidadMedida === 'g',
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
  }
}

const restauracion = {
  nombre: 'Restauración clase II',
  materiales: [
    { insumoId: 'art', cantidad: 1 },
    { insumoId: 'res', cantidad: 2 },
  ],
  precios: { [LUGAR_1]: 45000, [LUGAR_2]: 50000 },
}

const proyectados = async () =>
  proyectarTratamientos(await db.tratamientos.toArray(), await db.cambiosTratamiento.toArray())

// El ledger se ordena por `(creadoEn, id)`: cada operación en un ms distinto,
// como en la realidad (mismo criterio que el test de restaurarInsumo).
let reloj = Date.parse('2026-10-19T10:00:00.000Z')
const avanzar = () => vi.setSystemTime((reloj += 1000))
afterEach(() => vi.useRealTimers())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  avanzar()
  useAuthStore.setState({ usuario: admin, isReady: true })
  insumosT.seed([insumo('art', 'cartucho'), insumo('res', 'g')])
  tratamientosT.seed([])
  cambiosT.seed([])
})

describe('validarTratamiento (FR-001)', () => {
  const insumos = new Map([
    ['art', insumo('art', 'cartucho')],
    ['res', insumo('res', 'g')],
  ])

  it('acepta un tratamiento válido', () => {
    expect(validarTratamiento(restauracion, [], insumos)).toEqual({})
  })

  it('rechaza nombre vacío o duplicado sin distinguir mayúsculas ni espacios', () => {
    expect(validarTratamiento({ ...restauracion, nombre: '  ' }, [], insumos)).toHaveProperty('nombre')
    const existente = {
      id: 'otro',
      nombre: 'RESTAURACIÓN CLASE II',
      activo: true,
      materiales: [],
      precios: new Map(),
      creadoEn: '',
      creadoPor: '',
    }
    expect(
      validarTratamiento({ ...restauracion, nombre: ' restauración clase ii ' }, [existente], insumos),
    ).toHaveProperty('nombre')
    // Editando el mismo tratamiento no choca consigo mismo.
    expect(validarTratamiento(restauracion, [existente], insumos, 'otro')).toEqual({})
  })

  it('rechaza cantidades ≤ 0, decimales en unidades enteras e insumos repetidos', () => {
    for (const materiales of [
      [{ insumoId: 'art', cantidad: 0 }],
      [{ insumoId: 'art', cantidad: 1.5 }],
      [
        { insumoId: 'art', cantidad: 1 },
        { insumoId: 'art', cantidad: 2 },
      ],
    ]) {
      expect(validarTratamiento({ ...restauracion, materiales }, [], insumos)).toHaveProperty(
        'materiales',
      )
    }
    expect(
      validarTratamiento({ ...restauracion, materiales: [{ insumoId: 'res', cantidad: 1.5 }] }, [], insumos),
    ).toEqual({})
  })

  it('rechaza precios negativos', () => {
    expect(
      validarTratamiento({ ...restauracion, precios: { [LUGAR_1]: -1 } }, [], insumos),
    ).toHaveProperty('precios')
  })
})

describe('crear, editar y desactivar (US1, FR-003)', () => {
  it('crea la fila y un cambio por campo y por precio', async () => {
    await crearTratamiento(restauracion)
    expect(tratamientosT.all()).toHaveLength(1)
    expect(cambiosT.all().map((c) => [c.campo, c.lugarId])).toEqual([
      ['nombre', null],
      ['activo', null],
      ['materiales', null],
      ['precio', LUGAR_1],
      ['precio', LUGAR_2],
    ])
    const [t] = await proyectados()
    expect(t.materiales).toEqual([
      { insumoId: 'art', cantidad: 1, unidad: 'cartucho' },
      { insumoId: 'res', cantidad: 2, unidad: 'g' },
    ])
    expect(t.precios.get(LUGAR_2)).toBe(50000)
  })

  it('al editar escribe solo lo que cambió, con el valor anterior', async () => {
    const id = await crearTratamiento(restauracion)
    const antes = cambiosT.all().length
    avanzar()
    await editarTratamiento(id, { ...restauracion, precios: { [LUGAR_1]: 47000, [LUGAR_2]: null } })
    const nuevos = cambiosT.all().slice(antes)
    expect(nuevos.map((c) => [c.campo, c.lugarId, c.valorAnterior, c.valorNuevo])).toEqual([
      ['precio', LUGAR_1, 45000, 47000],
      ['precio', LUGAR_2, 50000, null],
    ])
    avanzar()
    await editarTratamiento(id, { ...restauracion, precios: { [LUGAR_1]: 47000, [LUGAR_2]: null } })
    expect(cambiosT.all()).toHaveLength(antes + 2)
  })

  it('desactivar y reactivar; repetirlo no escribe', async () => {
    const id = await crearTratamiento(restauracion)
    avanzar()
    await cambiarActivo(id, false)
    avanzar()
    await cambiarActivo(id, false)
    expect((await proyectados())[0].activo).toBe(false)
    avanzar()
    await cambiarActivo(id, true)
    expect((await proyectados())[0].activo).toBe(true)
    expect(cambiosT.all().filter((c) => c.campo === 'activo')).toHaveLength(3)
  })

  it('personal no crea ni edita', async () => {
    useAuthStore.setState({ usuario: { ...admin, rol: 'personal' }, isReady: true })
    await expect(crearTratamiento(restauracion)).rejects.toThrow(/administrador/)
    expect(tratamientosT.all()).toEqual([])
  })
})

describe('fijarPorcentajeLugar (US4, FR-012)', () => {
  it('escribe un cambio del lugar sin tratamiento', async () => {
    await fijarPorcentajeLugar(LUGAR_1, 40, null)
    expect(cambiosT.all()[0]).toMatchObject({
      campo: 'porcentajeProfesional',
      tratamientoId: null,
      lugarId: LUGAR_1,
      valorAnterior: null,
      valorNuevo: 40,
      usuarioId: 'admin-1',
    })
    expect(porcentajesPorLugar(cambiosT.all()).get(LUGAR_1)).toBe(40)
  })

  it('valida 0–100, no escribe si no cambia y exige administración', async () => {
    await expect(fijarPorcentajeLugar(LUGAR_1, 120, null)).rejects.toThrow(/entre 0 y 100/)
    await fijarPorcentajeLugar(LUGAR_1, 40, 40)
    expect(cambiosT.all()).toEqual([])
    useAuthStore.setState({ usuario: { ...admin, rol: 'personal' }, isReady: true })
    await expect(fijarPorcentajeLugar(LUGAR_1, 30, 40)).rejects.toThrow(/administrador/)
  })
})
