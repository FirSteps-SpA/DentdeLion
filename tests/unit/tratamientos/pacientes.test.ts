import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PacienteRegistro, TratamientoRealizado, UsuarioActual } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      tratamientosRealizados: new MemoryTable(),
      pacientesRegistro: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  filtrarPorPaciente,
  guardarPaciente,
  normalizarPaciente,
  pacienteVisible,
  puedeEditarPaciente,
} from '../../../src/features/tratamientos/lib/pacientes'
import { LUGAR_1, TENANT_1 } from '../../helpers/tenancy'

const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>
const pacientesT = db.pacientesRegistro as unknown as MemoryTable<PacienteRegistro>

const autora: UsuarioActual = {
  id: 'p1', tenantId: TENANT_1, email: 'a@x.cl', nombre: 'Ana', rol: 'personal',
  autenticadoEn: 'x', desactivadoEn: null,
}
const otra: UsuarioActual = { ...autora, id: 'p2', nombre: 'Bea' }
const admin: UsuarioActual = { ...autora, id: 'adm', rol: 'administrador' }

function registro(extra: Partial<TratamientoRealizado> = {}): TratamientoRealizado {
  return {
    id: 'r1', tenantId: TENANT_1, lugarId: LUGAR_1, tratamientoId: 't1', nombre: 'Resina',
    precio: 20000, porcentajeProfesional: 40, categoriaId: null, categoriaNombre: null,
    materiales: [], costoMateriales: 0, costoCompleto: true, gananciaEstimada: 8000,
    usuarioId: 'p1', creadoEn: '2026-11-23T10:00:00.000Z', anuladoEn: null, anuladoPor: null,
    sincronizado: true, anulacionSincronizada: true, ...extra,
  }
}

beforeEach(() => {
  realizadosT.seed([registro()])
  pacientesT.seed([])
  useAuthStore.setState({ usuario: autora, isReady: true })
})

/** Spec 028 T005 (FR-001, FR-005, FR-010, FR-012). */
describe('normalizarPaciente', () => {
  it('recorta, colapsa espacios, corta a 60 y vacío es null', () => {
    expect(normalizarPaciente('  Juan   Pérez ')).toBe('Juan Pérez')
    expect(normalizarPaciente('x'.repeat(70))).toHaveLength(60)
    expect(normalizarPaciente('   ')).toBeNull()
  })
})

describe('visibilidad y edición', () => {
  it('lo ve el autor y la administración, no otra persona', () => {
    const fila = { autorId: 'p1' }
    expect(pacienteVisible(fila, autora)).toBe(true)
    expect(pacienteVisible(fila, admin)).toBe(true)
    expect(pacienteVisible(fila, otra)).toBe(false)
    expect(pacienteVisible(undefined, autora)).toBe(false)
    expect(pacienteVisible(fila, null)).toBe(false)
  })

  it('lo editan autor y administración si el registro no está anulado', () => {
    expect(puedeEditarPaciente(registro(), autora)).toBe(true)
    expect(puedeEditarPaciente(registro(), admin)).toBe(true)
    expect(puedeEditarPaciente(registro(), otra)).toBe(false)
    expect(puedeEditarPaciente(registro({ anuladoEn: 'x', anuladoPor: 'p1' }), autora)).toBe(false)
  })
})

describe('guardarPaciente', () => {
  it('el autor lo agrega, lo corrige y lo quita (null), sin subir', async () => {
    await guardarPaciente('r1', ' Juan Peres ')
    expect(pacientesT.all()[0]).toMatchObject({
      registroId: 'r1', autorId: 'p1', paciente: 'Juan Peres', actualizadoPor: 'p1', sincronizado: false,
    })
    await guardarPaciente('r1', 'Juan Pérez')
    expect(pacientesT.all()[0].paciente).toBe('Juan Pérez')
    await guardarPaciente('r1', '')
    expect(pacientesT.all()[0].paciente).toBeNull()
  })

  it('la administración lo corrige con su autoría de cambio; el autor sigue siendo quien registró', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    await guardarPaciente('r1', 'Ana Soto')
    expect(pacientesT.all()[0]).toMatchObject({ autorId: 'p1', actualizadoPor: 'adm' })
  })

  it('otra persona o un registro anulado: rechaza sin escribir y sin el texto en el mensaje', async () => {
    useAuthStore.setState({ usuario: otra, isReady: true })
    const error = await guardarPaciente('r1', 'Secreto').catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).not.toContain('Secreto')
    realizadosT.seed([registro({ anuladoEn: 'x', anuladoPor: 'p1' })])
    useAuthStore.setState({ usuario: autora, isReady: true })
    await expect(guardarPaciente('r1', 'Juan')).rejects.toThrow(/anulado/)
    expect(pacientesT.all()).toHaveLength(0)
  })

  it('sin fila y sin texto no escribe nada', async () => {
    await guardarPaciente('r1', '   ')
    expect(pacientesT.all()).toHaveLength(0)
  })
})

describe('filtrarPorPaciente', () => {
  const registros = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const pacientes = new Map([['a', 'Juan Pérez'], ['b', 'María  José']])
  it('sin mayúsculas, tildes ni espacios extra; vacío = todos', () => {
    expect(filtrarPorPaciente(registros, pacientes, 'PEREZ').map((r) => r.id)).toEqual(['a'])
    expect(filtrarPorPaciente(registros, pacientes, ' maría  josé ').map((r) => r.id)).toEqual(['b'])
    expect(filtrarPorPaciente(registros, pacientes, '')).toHaveLength(3)
  })
})
