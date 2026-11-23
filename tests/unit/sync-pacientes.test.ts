import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PacienteRegistro, TratamientoRealizado, UsuarioActual } from '../../src/lib/db'
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
type Fila = { id?: string } & Record<string, unknown>
const remoto: Record<string, Map<string, Fila>> = {}
const llamadas: string[] = []
const esAdminRemoto = true

const tabla = (nombre: string) => (remoto[nombre] ??= new Map())
const clave = (nombre: unknown) =>
  String(nombre).trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ')

let rechazarPacientes: null | { code: string; message: string } = null

function escribir(nombre: string, fila: Fila): { code: string; message: string } | null {
  if (nombre === 'pacientes_registro') {
    if (rechazarPacientes) return rechazarPacientes
    if (!tabla('tratamientos_realizados').has(String(fila.registro_id)))
      return { code: '23503', message: 'violates foreign key constraint' }
    tabla(nombre).set(String(fila.registro_id), structuredClone(fila))
    return null
  }
  if (nombre === 'categorias_tratamiento') {
    if (!esAdminRemoto) return { code: '42501', message: 'new row violates row-level security policy' }
    tabla(nombre).set(String(fila.id), { ...structuredClone(fila), clave: clave(fila.nombre) })
    return null
  }
  // FK compuesta hacia categorias_tratamiento.
  const categoriaId = fila.categoria_tratamiento_id
  if (categoriaId && !tabla('categorias_tratamiento').has(String(categoriaId))) {
    return { code: '23503', message: 'violates foreign key constraint' }
  }
  if (!tabla(nombre).has(String(fila.id))) tabla(nombre).set(String(fila.id), structuredClone(fila))
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
    async maybeSingle() {
      const [fila] = [...tabla(nombre).values()].filter((f) => filtros.every((pasa) => pasa(f)))
      return { data: fila ? structuredClone(fila) : null, error: null, status: 200 }
    },
    then(resolver: (r: unknown) => unknown, rechazar?: (e: unknown) => unknown) {
      const data = [...tabla(nombre).values()]
        .filter((f) => filtros.every((pasa) => pasa(f)))
        .sort((a, b) => (String(a.id ?? a.registro_id) < String(b.id ?? b.registro_id) ? -1 : 1))
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
import { lugar1 } from '../helpers/lugarFalso'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>
const pacientesT = db.pacientesRegistro as unknown as MemoryTable<PacienteRegistro>

const personal: UsuarioActual = {
  id: 'p1', tenantId: TENANT_1, email: 'p@x.cl', nombre: 'Ana', rol: 'personal',
  autenticadoEn: '2026-01-01T00:00:00.000Z', desactivadoEn: null,
}

function registro(id: string, extra: Partial<TratamientoRealizado> = {}): TratamientoRealizado {
  return {
    id, tenantId: TENANT_1, lugarId: LUGAR_1, tratamientoId: 't1', nombre: 'Resina',
    precio: 20000, porcentajeProfesional: 40, categoriaId: null, categoriaNombre: null,
    materiales: [], costoMateriales: 0, costoCompleto: true, gananciaEstimada: 8000,
    usuarioId: 'p1', creadoEn: '2026-11-23T10:00:00.000Z', anuladoEn: null, anuladoPor: null,
    sincronizado: false, anulacionSincronizada: true, ...extra,
  }
}

function paciente(registroId: string, extra: Partial<PacienteRegistro> = {}): PacienteRegistro {
  return {
    registroId, tenantId: TENANT_1, autorId: 'p1', paciente: 'Juan Pérez',
    actualizadoPor: 'p1', actualizadoEn: '2026-11-23T10:00:00.000Z', sincronizado: false, ...extra,
  }
}

function filaRemota(p: PacienteRegistro): Fila {
  return {
    registro_id: p.registroId, tenant_id: p.tenantId, autor_id: p.autorId, paciente: p.paciente,
    actualizado_por: p.actualizadoPor, actualizado_en: p.actualizadoEn,
  }
}

beforeEach(() => {
  for (const nombre of Object.keys(remoto)) delete remoto[nombre]
  llamadas.length = 0
  rechazarPacientes = null
  realizadosT.seed([])
  pacientesT.seed([])
  ;(db.lugares as unknown as MemoryTable<typeof lugar1>).seed([lugar1])
  useAuthStore.setState({ usuario: personal, isReady: true })
})

/** Spec 028 T007 (research.md R4, R5; FR-002, FR-007). */
describe('sincronización de pacientes', () => {
  it('sube el paciente después de su registro, sin pasar por el registro', async () => {
    realizadosT.seed([registro('r1')])
    pacientesT.seed([paciente('r1')])

    await runSyncBatch()

    const i = (l: string) => llamadas.indexOf(l)
    expect(i('tratamientos_realizados:upsert')).toBeLessThan(i('pacientes_registro:upsert'))
    expect(tabla('pacientes_registro').get('r1')).toMatchObject({ paciente: 'Juan Pérez', autor_id: 'p1' })
    expect(JSON.stringify(tabla('tratamientos_realizados').get('r1'))).not.toContain('Juan')
    expect(pacientesT.all()[0].sincronizado).toBe(true)
  })

  it('el pull reemplaza los sincronizados por los visibles y conserva los pendientes', async () => {
    tabla('pacientes_registro').set('r2', filaRemota(paciente('r2', { paciente: 'María' })))
    pacientesT.seed([
      paciente('viejo', { sincronizado: true }),
      paciente('pend', { paciente: 'Pendiente' }),
    ])
    realizadosT.seed([registro('pend', { sincronizado: true })])
    rechazarPacientes = { code: '08006', message: 'sin red' } // el pendiente no sube en este ciclo

    await runSyncBatch()

    const ids = pacientesT.all().map((p) => p.registroId).sort()
    expect(ids).toEqual(['pend', 'r2'])
    expect(pacientesT.all().find((p) => p.registroId === 'pend')?.sincronizado).toBe(false)
  })

  it('un rechazo por permisos o por registro anulado borra el pendiente del dispositivo', async () => {
    realizadosT.seed([registro('r1', { sincronizado: true })])
    tabla('tratamientos_realizados').set('r1', { id: 'r1' })
    for (const error of [
      { code: '42501', message: 'new row violates row-level security policy' },
      { code: 'P0001', message: 'registro_anulado' },
    ]) {
      pacientesT.seed([paciente('r1')])
      rechazarPacientes = error
      await runSyncBatch()
      expect(pacientesT.all()).toHaveLength(0)
    }
  })
})
