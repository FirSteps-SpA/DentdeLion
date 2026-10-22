import { beforeEach, describe, expect, it, vi } from 'vitest'
import { consultaFalsa } from '../helpers/consultaFalsa'
import type { Categoria, Insumo, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { authFalso } from '../helpers/authFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      configuracionClinica: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      categorias: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      estadoSync: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
    }),
  }
})

// ---- fake Supabase: in-memory tables + RLS on categorias ----
type RemoteRow = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, RemoteRow>> = {}
const roles: Record<string, 'administrador' | 'personal'> = {}
const llamadas: string[] = []
/** Filas que el RLS falso rechaza aunque su autor sea administrador. */
const rechazarIds = new Set<string>()
let redCaida = false

function tabla(nombre: string) {
  remoto[nombre] ??= new Map()
  return remoto[nombre]
}

const client = {
  auth: authFalso,
  from(nombre: string) {
    return {
      async upsert(rows: RemoteRow | RemoteRow[]) {
        llamadas.push(nombre)
        if (redCaida)
          return { error: { code: 'NETWORK', message: 'fetch failed' } }
        const lista = Array.isArray(rows) ? rows : [rows]
        if (nombre === 'categorias') {
          if (
            lista.some(
              (row) =>
                roles[row.creado_por as string] !== 'administrador' ||
                rechazarIds.has(row.id),
            )
          ) {
            return {
              error: {
                code: '42501',
                message: 'new row violates row-level security policy',
              },
            }
          }
        }
        for (const row of lista) tabla(nombre).set(row.id, structuredClone(row))
        return { error: null }
      },
      select() {
        const resultado = consultaFalsa({
          filas: () => [...tabla(nombre).values()],
          error: () => (redCaida ? { message: 'fetch failed' } : null),
        })
        return Object.assign(resultado, {
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        })
      },
    }
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

vi.mock('../../src/lib/supabase/perfiles', () => ({
  fetchPerfilPropio: async (_client: unknown, userId: string) => ({
    id: userId,
    nombre: 'x',
    rol: roles[userId],
  }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { useAvisosStore } from '../../src/stores/avisosStore'
import { TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>

function categoria(overrides: Partial<Categoria>): Categoria {
  return {
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Ortodoncia',
    creadoPor: 'admin-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
    desactivadoEn: null,
    ...overrides,
  }
}

function insumo(overrides: Partial<Insumo>): Insumo {
  return {
    unidadCompra: 'pieza',
    contenido: 1,
    tenantId: TENANT_1,
    id: crypto.randomUUID(),
    nombre: 'Insumo',
    categoria: 'Implantes',
    unidadMedida: 'pieza',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: null,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  for (const key of Object.keys(remoto)) delete remoto[key]
  llamadas.length = 0
  rechazarIds.clear()
  redCaida = false
  roles['admin-1'] = 'administrador'
  roles['admin-2'] = 'administrador'
  insumosT.seed([])
  categoriasT.seed([])
  useAuthStore.setState({ usuario: admin, isReady: true })
  useAvisosStore.setState({ avisos: [] })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('pushCategorias (spec 008 contracts/supabase-schema.md step 0)', () => {
  it('pushes an unsynced row and marks it synced', async () => {
    categoriasT.seed([categoria({ id: 'cat-1', creadoPor: 'admin-1' })])

    await runSyncBatch()

    expect(categoriasT.all()[0].sincronizado).toBe(true)
    expect(tabla('categorias').get('cat-1')).toMatchObject({ nombre: 'Ortodoncia' })
  })

  it('falls back to row-by-row on a batch RLS error, marking only the failing row rechazadoEn', async () => {
    categoriasT.seed([
      categoria({ id: 'cat-ok', nombre: 'Ortodoncia', creadoPor: 'admin-1' }),
      categoria({ id: 'cat-rechazada', nombre: 'Implantes', creadoPor: 'admin-1' }),
    ])
    rechazarIds.add('cat-rechazada')

    await runSyncBatch()

    const ok = categoriasT.all().find((c) => c.id === 'cat-ok')!
    const rechazada = categoriasT.all().find((c) => c.id === 'cat-rechazada')!
    expect(ok).toMatchObject({ sincronizado: true, rechazadoEn: null })
    expect(rechazada.sincronizado).toBe(false)
    expect(rechazada.rechazadoEn).not.toBeNull()
    expect(tabla('categorias').has('cat-rechazada')).toBe(false)
  })

  it('a network error marks nothing', async () => {
    categoriasT.seed([categoria({ id: 'cat-1', creadoPor: 'admin-1' })])
    redCaida = true

    await runSyncBatch()

    expect(categoriasT.all()[0]).toMatchObject({
      sincronizado: false,
      rechazadoEn: null,
    })
  })

  it('pushes a renamed/deactivated category with its desactivado_en (spec 010)', async () => {
    categoriasT.seed([
      categoria({
        id: 'cat-1',
        nombre: 'Ortodoncia Renombrada',
        creadoPor: 'admin-1',
        sincronizado: false,
        desactivadoEn: '2026-09-24T00:00:00.000Z',
      }),
    ])

    await runSyncBatch()

    expect(categoriasT.all()[0].sincronizado).toBe(true)
    expect(tabla('categorias').get('cat-1')).toMatchObject({
      nombre: 'Ortodoncia Renombrada',
      desactivado_en: '2026-09-24T00:00:00.000Z',
    })
  })
})

describe('moverASinCategoria (research.md R4)', () => {
  it('moves insumos with the rejected clave to "Sin categoría" before insumos is upserted', async () => {
    categoriasT.seed([
      categoria({ id: 'cat-rechazada', nombre: 'Implantes', creadoPor: 'admin-2' }),
    ])
    roles['admin-2'] = 'personal'
    useAuthStore.setState({ usuario: { ...admin, id: 'admin-2' } })
    const ins = insumo({ id: 'i1', categoria: 'Implantes' })
    insumosT.seed([ins])

    await runSyncBatch()

    expect((await db.insumos.get('i1'))?.categoria).toBe('Sin categoría')
    const indiceCategorias = llamadas.indexOf('categorias')
    const indiceInsumos = llamadas.indexOf('insumos')
    expect(indiceCategorias).toBeGreaterThanOrEqual(0)
    expect(indiceCategorias).toBeLessThan(indiceInsumos)
    // Converges remotely too: the (now Sin categoría) row is what gets pushed.
    expect(tabla('insumos').get('i1')).toMatchObject({ categoria: 'Sin categoría' })
  })

  it('leaves an insumo untouched when the rejected clave is also a precargada', async () => {
    categoriasT.seed([
      categoria({ id: 'cat-rechazada', nombre: 'Fresas', creadoPor: 'admin-2' }),
    ])
    roles['admin-2'] = 'personal'
    useAuthStore.setState({ usuario: { ...admin, id: 'admin-2' } })
    const ins = insumo({ id: 'i1', categoria: 'Fresas' })
    insumosT.seed([ins])

    await runSyncBatch()

    expect((await db.insumos.get('i1'))?.categoria).toBe('Fresas')
  })
})

describe('rejection notifications (mirrors notificarRechazos)', () => {
  it('emits one aviso per rejected category and refreshes the role', async () => {
    categoriasT.seed([
      categoria({ id: 'cat-rechazada', nombre: 'Implantes', creadoPor: 'admin-2' }),
    ])
    roles['admin-2'] = 'personal'
    useAuthStore.setState({ usuario: { ...admin, id: 'admin-2' } })

    await runSyncBatch()

    const avisos = useAvisosStore
      .getState()
      .avisos.filter((a) => a.tipo === 'categoria-rechazada')
    expect(avisos).toHaveLength(1)
    expect(avisos[0].insumoNombre).toBe('Implantes')
    expect(useAuthStore.getState().usuario?.rol).toBe('personal')
  })
})

describe('pullCategorias', () => {
  it('merges remote rows without resurrecting a locally rejected one', async () => {
    // A row this device already rejected locally...
    categoriasT.seed([
      categoria({
        id: 'cat-1',
        nombre: 'Implantes',
        creadoPor: 'admin-2',
        sincronizado: false,
        rechazadoEn: '2026-01-01T00:00:00.000Z',
      }),
    ])
    // ...but the remote table still (or again) has a copy of it.
    tabla('categorias').set('cat-1', {
      id: 'cat-1',
      nombre: 'Implantes',
      creado_por: 'admin-2',
      creado_en: '2026-01-01T00:00:00.000Z',
    })
    // A second, unrelated remote row should merge in normally.
    tabla('categorias').set('cat-2', {
      id: 'cat-2',
      nombre: 'Ortodoncia',
      creado_por: 'admin-1',
      creado_en: '2026-01-01T00:00:00.000Z',
    })

    await runSyncBatch()

    const local1 = await db.categorias.get('cat-1')
    expect(local1?.rechazadoEn).not.toBeNull()
    const local2 = await db.categorias.get('cat-2')
    expect(local2).toMatchObject({ nombre: 'Ortodoncia', sincronizado: true })
  })

  it('pulls a remote desactivado_en into the local row (spec 010)', async () => {
    tabla('categorias').set('cat-3', {
      id: 'cat-3',
      nombre: 'Endodoncia',
      creado_por: 'admin-1',
      creado_en: '2026-01-01T00:00:00.000Z',
      desactivado_en: '2026-09-24T00:00:00.000Z',
    })

    await runSyncBatch()

    const local3 = await db.categorias.get('cat-3')
    expect(local3?.desactivadoEn).toBe('2026-09-24T00:00:00.000Z')
  })
})
