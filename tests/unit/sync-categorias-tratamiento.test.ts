import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioTratamiento,
  CategoriaTratamiento,
  TratamientoRealizado,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
    ),
  }
})

// ---- Supabase falso con las reglas de la spec 026 (contracts/supabase-schema.md) ----
type Fila = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, Fila>> = {}
const llamadas: string[] = []
let esAdminRemoto = true

const tabla = (nombre: string) => (remoto[nombre] ??= new Map())
const clave = (nombre: unknown) =>
  String(nombre).trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ')

function escribir(nombre: string, fila: Fila): { code: string; message: string } | null {
  if (nombre === 'categorias_tratamiento') {
    if (!esAdminRemoto) return { code: '42501', message: 'new row violates row-level security policy' }
    const repetida = [...tabla(nombre).values()].some(
      (otra) => otra.id !== fila.id && otra.clave === clave(fila.nombre),
    )
    if (repetida) return { code: '23505', message: 'categorias_tratamiento_clave_por_tenant' }
    tabla(nombre).set(fila.id, { ...structuredClone(fila), clave: clave(fila.nombre) })
    return null
  }
  // FK compuesta hacia categorias_tratamiento.
  const categoriaId = fila.categoria_tratamiento_id
  if (categoriaId && !tabla('categorias_tratamiento').has(String(categoriaId))) {
    return { code: '23503', message: 'violates foreign key constraint' }
  }
  if (!tabla(nombre).has(fila.id)) tabla(nombre).set(fila.id, structuredClone(fila))
  return null
}

function seleccion(nombre: string) {
  const filtros: ((f: Fila) => boolean)[] = []
  let limite = Infinity
  const consulta = {
    order: () => consulta,
    gt(columna: string, valor: string) {
      filtros.push((f) => String(f[columna]) > valor)
      return consulta
    },
    eq(columna: string, valor: unknown) {
      filtros.push((f) => f[columna] === valor)
      return consulta
    },
    is(columna: string, valor: unknown) {
      filtros.push((f) => (f[columna] ?? null) === valor)
      return consulta
    },
    limit(n: number) {
      limite = n
      return consulta
    },
    then(resolver: (r: unknown) => unknown, rechazar?: (e: unknown) => unknown) {
      const data = [...tabla(nombre).values()]
        .filter((f) => filtros.every((pasa) => pasa(f)))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, limite)
        .map((f) => structuredClone(f))
      return Promise.resolve({ data, error: null, status: 200 }).then(resolver, rechazar)
    },
  }
  return consulta
}

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(filas: Fila | Fila[]) {
        llamadas.push(`${nombre}:upsert`)
        const lista = Array.isArray(filas) ? filas : [filas]
        for (const fila of lista) {
          const error = escribir(nombre, fila)
          if (error) return { error, status: 400 }
        }
        return { error: null, status: 201 }
      },
      async insert(fila: Fila) {
        llamadas.push(`${nombre}:insert`)
        const error = escribir(nombre, fila)
        return error ? { error, status: 409 } : { error: null, status: 201 }
      },
      update: () => ({ eq: async () => ({ error: null, status: 204 }) }),
      select: () => seleccion(nombre),
    }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

vi.mock('../../src/lib/supabase/perfiles', () => ({
  fetchPerfilPropio: async () => null,
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { useAvisosStore } from '../../src/stores/avisosStore'
import { lugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const categoriasT = db.categoriasTratamiento as unknown as MemoryTable<CategoriaTratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>
const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>

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

function categoria(overrides: Partial<CategoriaTratamiento> = {}): CategoriaTratamiento {
  return {
    id: 'cat-1',
    tenantId: TENANT_1,
    nombre: 'Blanqueamiento',
    creadoPor: 'admin-1',
    creadoEn: '2026-11-23T10:00:00.000Z',
    desactivadoEn: null,
    sincronizado: false,
    rechazadoEn: null,
    ...overrides,
  }
}

function porcentajeCategoria(overrides: Partial<CambioTratamiento> = {}): CambioTratamiento {
  return {
    id: 'pc-1',
    tenantId: TENANT_1,
    tratamientoId: null,
    lugarId: LUGAR_1,
    categoriaId: 'cat-1',
    campo: 'porcentajeCategoria',
    valorAnterior: null,
    valorNuevo: 50,
    usuarioId: 'admin-1',
    creadoEn: '2026-11-23T11:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
    ...overrides,
  }
}

function registro(overrides: Partial<TratamientoRealizado> = {}): TratamientoRealizado {
  return {
    id: 'r1',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    tratamientoId: 't1',
    nombre: 'Evaluación inicial',
    precio: 20000,
    porcentajeProfesional: 50,
    categoriaId: 'cat-1',
    categoriaNombre: 'Blanqueamiento',
    materiales: [],
    costoMateriales: 0,
    costoCompleto: true,
    gananciaEstimada: 10000,
    usuarioId: 'admin-1',
    creadoEn: '2026-11-23T12:00:00.000Z',
    anuladoEn: null,
    anuladoPor: null,
    sincronizado: false,
    anulacionSincronizada: true,
    ...overrides,
  }
}

function filaRemota(c: CategoriaTratamiento): Fila {
  return {
    id: c.id,
    tenant_id: c.tenantId,
    nombre: c.nombre,
    clave: clave(c.nombre),
    creado_por: c.creadoPor,
    creado_en: c.creadoEn,
    desactivado_en: c.desactivadoEn,
  }
}

beforeEach(() => {
  for (const nombre of Object.keys(remoto)) delete remoto[nombre]
  llamadas.length = 0
  esAdminRemoto = true
  for (const t of [categoriasT, cambiosT, realizadosT]) t.seed([])
  ;(db.lugares as unknown as MemoryTable<typeof lugar1>).seed([lugar1])
  useAvisosStore.setState({ avisos: [] })
  useAuthStore.setState({ usuario: admin, isReady: true })
})

/** Spec 026 T008 (research.md R8). */
describe('sincronización de categorías de tratamientos', () => {
  it('sube la categoría antes que su % y el registro que la usa, con las columnas nuevas', async () => {
    categoriasT.seed([categoria()])
    cambiosT.seed([porcentajeCategoria()])
    realizadosT.seed([registro()])

    await runSyncBatch()

    const indice = (l: string) => llamadas.indexOf(l)
    expect(indice('categorias_tratamiento:upsert')).toBeGreaterThanOrEqual(0)
    expect(indice('categorias_tratamiento:upsert')).toBeLessThan(indice('cambios_tratamiento:upsert'))
    expect(indice('categorias_tratamiento:upsert')).toBeLessThan(
      indice('tratamientos_realizados:upsert'),
    )
    expect(categoriasT.all()[0].sincronizado).toBe(true)
    expect(tabla('cambios_tratamiento').get('pc-1')).toMatchObject({
      campo: 'porcentajeCategoria',
      categoria_tratamiento_id: 'cat-1',
      lugar_id: LUGAR_1,
      tratamiento_id: null,
    })
    expect(tabla('tratamientos_realizados').get('r1')).toMatchObject({
      categoria_tratamiento_id: 'cat-1',
      categoria_nombre: 'Blanqueamiento',
    })
  })

  it('baja las sembradas del servidor y las columnas nuevas de cambios y registros', async () => {
    tabla('categorias_tratamiento').set(
      'sem-1',
      filaRemota(categoria({ id: 'sem-1', nombre: 'Evaluación', creadoPor: null })),
    )
    tabla('cambios_tratamiento').set('pc-srv', {
      id: 'pc-srv',
      tenant_id: TENANT_1,
      tratamiento_id: null,
      lugar_id: LUGAR_1,
      categoria_tratamiento_id: 'sem-1',
      campo: 'porcentajeCategoria',
      valor_anterior: null,
      valor_nuevo: 50,
      usuario_id: 'admin-2',
      creado_en: '2026-11-23T11:00:00.000Z',
    })

    await runSyncBatch()

    expect(categoriasT.all()).toEqual([
      expect.objectContaining({ id: 'sem-1', nombre: 'Evaluación', creadoPor: null, sincronizado: true }),
    ])
    expect(cambiosT.all().find((c) => c.id === 'pc-srv')).toMatchObject({ categoriaId: 'sem-1' })
  })

  it('un cambio rechazado por permisos vuelve a la versión del servidor, con aviso', async () => {
    tabla('categorias_tratamiento').set('cat-1', filaRemota(categoria({ nombre: 'Blanqueamiento' })))
    categoriasT.seed([categoria({ nombre: 'Estética', sincronizado: false })])
    esAdminRemoto = false // el push falla por permisos…
    useAuthStore.setState({ usuario: admin, isReady: true })

    await runSyncBatch()

    // …así que vuelve a la versión del servidor, con aviso.
    expect(categoriasT.all()[0]).toMatchObject({ nombre: 'Blanqueamiento', sincronizado: true })
    expect(useAvisosStore.getState().avisos[0]).toMatchObject({ tipo: 'categoria-rechazada' })
  })

  it('un nombre repetido en el servidor deja la nueva rechazada, con aviso, y su % también', async () => {
    tabla('categorias_tratamiento').set(
      'otra',
      filaRemota(categoria({ id: 'otra', nombre: 'Blanqueamiento', sincronizado: true })),
    )
    categoriasT.seed([categoria({ nombre: ' blanqueamiento ' })])
    cambiosT.seed([porcentajeCategoria()])

    await runSyncBatch()

    expect(categoriasT.all().find((c) => c.id === 'cat-1')?.rechazadoEn).not.toBeNull()
    expect(cambiosT.all().find((c) => c.id === 'pc-1')?.rechazadoEn).not.toBeNull()
    expect(tabla('cambios_tratamiento').has('pc-1')).toBe(false)
    expect(useAvisosStore.getState().avisos[0]).toMatchObject({
      tipo: 'categoria-tratamiento-repetida',
      insumoNombre: ' blanqueamiento ',
    })
  })

  it('un registro con una categoría rechazada sube sin la referencia y con su nombre', async () => {
    categoriasT.seed([categoria({ rechazadoEn: '2026-11-23T10:30:00.000Z' })])
    realizadosT.seed([registro()])

    await runSyncBatch()

    expect(tabla('tratamientos_realizados').get('r1')).toMatchObject({
      categoria_tratamiento_id: null,
      categoria_nombre: 'Blanqueamiento',
    })
  })

  it('personal no sube categorías (no las puede crear)', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    esAdminRemoto = false
    categoriasT.seed([categoria({ creadoPor: 'personal-1' })])

    await runSyncBatch()

    expect(tabla('categorias_tratamiento').size).toBe(0)
    expect(categoriasT.all()[0].rechazadoEn).not.toBeNull()
  })
})
