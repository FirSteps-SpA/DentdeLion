import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioInsumo, Insumo, UsuarioActual } from '../../src/lib/db'
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

// ---- fake Supabase: in-memory tables + RLS on cambios_insumo ----
type RemoteRow = { id: string } & Record<string, unknown>
const remoto: Record<string, Map<string, RemoteRow>> = {}
const roles: Record<string, 'administrador' | 'personal'> = {}
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
        if (redCaida)
          return { error: { code: 'NETWORK', message: 'fetch failed' } }
        const lista = Array.isArray(rows) ? rows : [rows]
        if (nombre === 'cambios_insumo') {
          if (
            lista.some((row) => !tabla('insumos').has(row.insumo_id as string))
          ) {
            return {
              error: { code: '23503', message: 'foreign key violation' },
            }
          }
          if (
            lista.some(
              (row) => roles[row.usuario_id as string] !== 'administrador',
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
        const resultado = Promise.resolve({
          data: redCaida
            ? null
            : [...tabla(nombre).values()].map((r) => structuredClone(r)),
          error: redCaida ? { message: 'fetch failed' } : null,
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
import {
  editarInsumo,
  darDeBajaInsumo,
} from '../../src/features/insumos/lib/catalogo'
import { useAuthStore } from '../../src/stores/authStore'
import { useAvisosStore } from '../../src/stores/avisosStore'
import { TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>

// ---- two simulated devices sharing the fake backend ----
type Dispositivo = {
  insumos: Insumo[]
  cambios: CambioInsumo[]
  usuario: UsuarioActual
}
const dispositivos: Record<'A' | 'B', Dispositivo> = {} as Record<
  'A' | 'B',
  Dispositivo
>

function usuario(id: string): UsuarioActual {
  return {
    tenantId: TENANT_1,
    desactivadoEn: null,
    id,
    email: `${id}@x.cl`,
    nombre: id,
    rol: roles[id],
    autenticadoEn: 'x',
  }
}

async function en<T>(d: 'A' | 'B', fn: () => Promise<T>): Promise<T> {
  insumosT.seed(dispositivos[d].insumos)
  cambiosT.seed(dispositivos[d].cambios)
  useAuthStore.setState({ usuario: dispositivos[d].usuario, isReady: true })
  const r = await fn()
  dispositivos[d] = {
    insumos: insumosT.all(),
    cambios: cambiosT.all(),
    usuario: useAuthStore.getState().usuario!,
  }
  return r
}

const insumoE: Insumo = {
  unidadCompra: 'caja',
  contenido: 1,
  tenantId: TENANT_1,
  id: 'e',
  nombre: 'Guantes',
  categoria: 'Cirugía',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}
const otraCategoria: Insumo = {
  ...insumoE,
  id: 'otro',
  nombre: 'Fresa',
  categoria: 'Fresas',
}
const terceraCategoria: Insumo = {
  ...insumoE,
  id: 'otro2',
  nombre: 'Composite',
  categoria: 'Restauración',
}

beforeEach(() => {
  for (const key of Object.keys(remoto)) delete remoto[key]
  redCaida = false
  roles['admin-a'] = 'administrador'
  roles['admin-b'] = 'administrador'
  const base = [insumoE, otraCategoria, terceraCategoria]
  for (const row of base) {
    tabla('insumos').set(row.id, {
      id: row.id,
      nombre: row.nombre,
      categoria: row.categoria,
      unidad_medida: row.unidadMedida,
      permite_decimales: row.permiteDecimales,
      caduca: row.caduca,
      codigo_fabricante: null,
      creado_en: row.creadoEn,
      stock_minimo: null,
      dado_de_baja_en: null,
      dado_de_baja_por: null,
    })
  }
  dispositivos.A = { insumos: base, cambios: [], usuario: usuario('admin-a') }
  dispositivos.B = { insumos: base, cambios: [], usuario: usuario('admin-b') }
  useAvisosStore.setState({ avisos: [] })
  vi.useRealTimers()
})

function filaDe(d: 'A' | 'B', id = 'e'): Insumo {
  return dispositivos[d].insumos.find((i) => i.id === id)!
}

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('sync of cambios_insumo (spec 007 FR-021a/FR-021b)', () => {
  it('converges per field on both devices and keeps the losing cambio', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-23T10:00:00.000Z'))
    await en('A', () => editarInsumo('e', { nombre: 'Guantes Nitrilo' }))
    await en('A', () => editarInsumo('e', { categoria: 'Fresas' }))
    vi.setSystemTime(new Date('2026-09-23T10:05:00.000Z'))
    await en('B', () => editarInsumo('e', { stockMinimo: 10 }))
    await en('B', () => editarInsumo('e', { categoria: 'Restauración' }))
    vi.useRealTimers()

    await en('B', runSyncBatch)
    await en('A', runSyncBatch)
    await en('B', runSyncBatch)

    for (const d of ['A', 'B'] as const) {
      expect(filaDe(d)).toMatchObject({
        nombre: 'Guantes Nitrilo',
        stockMinimo: 10,
        categoria: 'Restauración',
      })
    }
    expect(filaDe('A')).toEqual(filaDe('B'))
    const categorias = [...tabla('cambios_insumo').values()].filter(
      (c) => c.campo === 'categoria',
    )
    expect(categorias.map((c) => c.valor_nuevo).sort()).toEqual([
      'Fresas',
      'Restauración',
    ])
  })

  it('a baja wins over a concurrent edit on the other device', async () => {
    await en('A', () => editarInsumo('e', { nombre: 'Editado offline' }))
    await en('B', () => darDeBajaInsumo('e'))

    await en('B', runSyncBatch)
    await en('A', runSyncBatch)
    await en('B', runSyncBatch)

    expect(filaDe('A').dadoDeBajaPor).toBe('admin-b')
    expect(filaDe('B').dadoDeBajaPor).toBe('admin-b')
    expect(filaDe('A').nombre).toBe('Editado offline')
  })

  it('syncs an insumo created and edited offline in the first cycle (no FK failure)', async () => {
    const nuevo: Insumo = { ...insumoE, id: 'nuevo', nombre: 'Nuevo' }
    dispositivos.A.insumos = [...dispositivos.A.insumos, nuevo]
    await en('A', () => editarInsumo('nuevo', { stockMinimo: 2 }))

    await en('A', runSyncBatch)

    expect(dispositivos.A.cambios.every((c) => c.sincronizado)).toBe(true)
    expect(tabla('insumos').get('nuevo')).toMatchObject({ stock_minimo: null })
    expect(filaDe('A', 'nuevo').stockMinimo).toBe(2)
  })

  it('a network error leaves cambios pending without marking them rejected', async () => {
    await en('A', () => editarInsumo('e', { nombre: 'Pendiente' }))
    redCaida = true

    await en('A', runSyncBatch)

    expect(dispositivos.A.cambios[0]).toMatchObject({
      sincronizado: false,
      rechazadoEn: null,
    })
    expect(filaDe('A').nombre).toBe('Pendiente')
  })

  it('marks a permission-rejected cambio, reverts it, notifies and refreshes the role', async () => {
    await en('A', () => editarInsumo('e', { nombre: 'Sin permiso' }))
    await en('B', () => editarInsumo('e', { stockMinimo: 7 }))
    roles['admin-a'] = 'personal'

    await en('A', runSyncBatch)
    await en('B', runSyncBatch)
    await en('A', runSyncBatch)

    const cambioA = dispositivos.A.cambios.find((c) => c.campo === 'nombre')!
    expect(cambioA.rechazadoEn).not.toBeNull()
    expect(cambioA.sincronizado).toBe(false)
    expect(tabla('cambios_insumo').has(cambioA.id)).toBe(false)
    expect(filaDe('A')).toMatchObject({ nombre: 'Guantes', stockMinimo: 7 })
    expect(filaDe('B')).toMatchObject({ nombre: 'Guantes', stockMinimo: 7 })
    expect(tabla('insumos').get('e')).toMatchObject({ nombre: 'Guantes' })
    expect(dispositivos.A.usuario.rol).toBe('personal')
    expect(
      useAvisosStore
        .getState()
        .avisos.filter((a) => a.tipo === 'cambio-rechazado'),
    ).toHaveLength(1)
  })
})
