import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioTratamiento,
  Movimiento,
  Tratamiento,
  TratamientoRealizado,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import { crearClienteFalso, crearEstado, reiniciar } from '../helpers/clienteFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()]))),
  }
})

const estado = crearEstado()
const client = crearClienteFalso(estado)

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

/**
 * Spec 016 T018 (research.md R6, contracts/supabase-schema.md §5): catálogo
 * de tratamientos con rechazo por rol, registros antes que sus consumos y
 * anulaciones como update.
 */
const tratamientosT = db.tratamientos as unknown as MemoryTable<Tratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>
const realizadosT = db.tratamientosRealizados as unknown as MemoryTable<TratamientoRealizado>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

const tratamiento: Tratamiento = {
  id: 't1',
  tenantId: TENANT_1,
  creadoPor: 'B',
  creadoEn: '2026-10-19T10:00:00.000Z',
  sincronizado: false,
  rechazadoEn: null,
}

function cambio(id: string, usuarioId: string): CambioTratamiento {
  return {
    id,
    tenantId: TENANT_1,
    tratamientoId: 't1',
    lugarId: null,
    campo: 'nombre',
    valorAnterior: null,
    valorNuevo: 'Restauración',
    usuarioId,
    creadoEn: '2026-10-19T10:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
  }
}

function realizado(extra: Partial<TratamientoRealizado> = {}): TratamientoRealizado {
  return {
    id: 'r1',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    tratamientoId: 't1',
    nombre: 'Restauración',
    precio: 45000,
    porcentajeProfesional: 40,
    materiales: [],
    costoMateriales: 0,
    costoCompleto: true,
    gananciaEstimada: 18000,
    usuarioId: 'B',
    creadoEn: '2026-10-19T11:00:00.000Z',
    anuladoEn: null,
    anuladoPor: null,
    sincronizado: false,
    anulacionSincronizada: true,
    ...extra,
  }
}

const consumo: Movimiento = {
  id: 'm1',
  tenantId: TENANT_1,
  lugarId: LUGAR_1,
  trasladoId: null,
  tipo: 'consumo',
  loteId: 'l1',
  cantidad: 1,
  unidad: 'cartucho',
  tratamientoRealizadoId: 'r1',
  usuarioId: 'B',
  movimientoOrigenId: null,
  creadoEn: '2026-10-19T11:00:00.000Z',
  sincronizado: false,
}

function sesion(rol: 'administrador' | 'personal') {
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'B',
      email: 'b@x.cl',
      nombre: 'Bea',
      rol,
      autenticadoEn: 'x',
    },
    isReady: true,
  })
}

beforeEach(() => {
  reiniciar(estado)
  tratamientosT.seed([tratamiento])
  cambiosT.seed([cambio('cB', 'B'), cambio('cA', 'A')])
  realizadosT.seed([])
  movimientosT.seed([])
  sesion('administrador')
})

describe('sync de tratamientos (spec 016)', () => {
  it('sube el alta y los cambios propios y los marca subidos', async () => {
    await runSyncBatch()
    expect(estado.upserts.filter((u) => u.tabla === 'tratamientos').flatMap((u) => u.filas)).toEqual([
      expect.objectContaining({ id: 't1', creado_por: 'B', tenant_id: TENANT_1 }),
    ])
    const subidos = estado.upserts
      .filter((u) => u.tabla === 'cambios_tratamiento')
      .flatMap((u) => u.filas.map((f) => f.id))
    expect(subidos).toEqual(['cB'])
    expect(tratamientosT.all()[0].sincronizado).toBe(true)
    expect(cambiosT.all().find((c) => c.id === 'cB')?.sincronizado).toBe(true)
    expect(cambiosT.all().find((c) => c.id === 'cA')?.sincronizado).toBe(false)
  })

  it('un rechazo por rol marca rechazadoEn y no es error del ciclo', async () => {
    const rls = { code: '42501', message: 'new row violates row-level security policy' }
    estado.rechazarFila.tratamientos = () => rls
    estado.rechazarFila.cambios_tratamiento = () => rls
    await runSyncBatch()
    expect(tratamientosT.all()[0].rechazadoEn).not.toBeNull()
    expect(cambiosT.all().find((c) => c.id === 'cB')?.rechazadoEn).not.toBeNull()
  })

  it('sube el registro antes que sus consumos, con el vínculo', async () => {
    sesion('personal')
    realizadosT.seed([realizado()])
    movimientosT.seed([consumo])
    await runSyncBatch()
    const tablas = estado.upserts.map((u) => u.tabla)
    expect(tablas.indexOf('tratamientos_realizados')).toBeLessThan(tablas.indexOf('movimientos'))
    const movimientoSubido = estado.upserts.find((u) => u.tabla === 'movimientos')?.filas[0]
    expect(movimientoSubido).toMatchObject({ tratamiento_realizado_id: 'r1' })
    expect(realizadosT.all()[0].sincronizado).toBe(true)
  })

  it('una anulación de un registro ya subido viaja como update', async () => {
    realizadosT.seed([
      realizado({
        sincronizado: true,
        anuladoEn: '2026-10-19T12:00:00.000Z',
        anuladoPor: 'B',
        anulacionSincronizada: false,
      }),
    ])
    estado.remoto.tratamientos_realizados = new Map([
      ['r1', { id: 'r1', anulado_en: null, anulado_por: null } as never],
    ])
    await runSyncBatch()
    expect(estado.updates).toEqual([
      {
        tabla: 'tratamientos_realizados',
        id: 'r1',
        cambios: { anulado_en: '2026-10-19T12:00:00.000Z', anulado_por: 'B' },
      },
    ])
    expect(realizadosT.all()[0].anulacionSincronizada).toBe(true)
  })

  it('registrado y deshecho sin red: sube una sola vez, ya anulado (SC-005)', async () => {
    realizadosT.seed([
      realizado({
        anuladoEn: '2026-10-19T11:05:00.000Z',
        anuladoPor: 'B',
        anulacionSincronizada: false,
      }),
    ])
    const ajuste: Movimiento = {
      ...consumo,
      id: 'm2',
      tipo: 'ajuste',
      movimientoOrigenId: 'm1',
      creadoEn: '2026-10-19T11:05:00.000Z',
    }
    movimientosT.seed([consumo, ajuste])
    await runSyncBatch()
    await runSyncBatch()

    const subidas = estado.upserts.filter((u) => u.tabla === 'tratamientos_realizados')
    expect(subidas).toHaveLength(1)
    expect(subidas[0].filas[0]).toMatchObject({ id: 'r1', anulado_en: '2026-10-19T11:05:00.000Z', anulado_por: 'B' })
    expect(estado.updates).toEqual([])
    expect(realizadosT.all()[0]).toMatchObject({ sincronizado: true, anulacionSincronizada: true })
    const movimientos = estado.upserts.filter((u) => u.tabla === 'movimientos').flatMap((u) => u.filas)
    expect(movimientos.map((m) => (m as { id: string }).id).sort()).toEqual(['m1', 'm2'])
  })

  it('baja tratamientos, cambios y registros de otros dispositivos', async () => {
    estado.remoto.tratamientos = new Map([
      ['t2', { id: 't2', tenant_id: TENANT_1, creado_por: 'C', creado_en: '2026-10-18T00:00:00.000Z' }],
    ])
    estado.remoto.cambios_tratamiento = new Map([
      [
        'p1',
        {
          id: 'p1',
          tenant_id: TENANT_1,
          tratamiento_id: null,
          lugar_id: LUGAR_1,
          campo: 'porcentajeProfesional',
          valor_anterior: null,
          valor_nuevo: 40,
          usuario_id: 'C',
          creado_en: '2026-10-18T00:00:00.000Z',
        },
      ],
    ])
    estado.remoto.tratamientos_realizados = new Map([
      ['r9', { ...realizadoRow(), id: 'r9' }],
    ])
    await runSyncBatch()
    expect(tratamientosT.all().map((t) => t.id).sort()).toEqual(['t1', 't2'])
    expect(cambiosT.all().find((c) => c.id === 'p1')).toMatchObject({
      campo: 'porcentajeProfesional',
      lugarId: LUGAR_1,
      valorNuevo: 40,
      sincronizado: true,
    })
    expect(realizadosT.all().find((r) => r.id === 'r9')).toMatchObject({
      precio: 45000,
      gananciaEstimada: 18000,
      sincronizado: true,
    })
  })
})

function realizadoRow() {
  return {
    id: 'r9',
    tenant_id: TENANT_1,
    lugar_id: LUGAR_1,
    tratamiento_id: 't1',
    nombre: 'Restauración',
    precio: '45000',
    porcentaje_profesional: '40',
    materiales: [],
    costo_materiales: '0',
    costo_completo: true,
    ganancia_estimada: '18000',
    usuario_id: 'C',
    creado_en: '2026-10-18T00:00:00.000Z',
    anulado_en: null,
    anulado_por: null,
  }
}
