import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioActual } from '../../src/lib/db'
import {
  crearClienteFalso,
  crearEstado,
  reiniciar,
} from '../helpers/clienteFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
    ),
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
import { TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

function usuario(rol: UsuarioActual['rol']): UsuarioActual {
  return { tenantId: TENANT_1, desactivadoEn: null, id: 'u1', email: 'u@x.cl', nombre: 'U', rol, autenticadoEn: 'x' }
}

const rechazoRls = {
  code: '42501',
  message: 'new row violates row-level security policy',
}

/**
 * Filas de configuración global con el contrato de research.md R5. La de
 * `configuracionClinica` dejó de sincronizarse en la spec 014 (la reemplazan
 * los lugares de trabajo) y la spec 021 la eliminó.
 */
const casos = [
  {
    nombre: 'configuracionAlertas',
    tablaRemota: 'configuracion_alertas',
    local: (sincronizado: boolean) => ({
      id: 'global' as const,
      tenantId: TENANT_1,
      nivelesAvisoDias: [10],
      horasAvisoPendientes: 6,
      sincronizado,
    }),
    remota: {
      id: 'global',
      tenant_id: TENANT_1,
      niveles_aviso_dias: [30],
      horas_aviso_pendientes: 48,
    },
    leer: () => db.configuracionAlertas.get('global'),
    escribir: (fila: object) => db.configuracionAlertas.put(fila as never),
    valorLocal: { nivelesAvisoDias: [10] },
    valorRemoto: { nivelesAvisoDias: [30], horasAvisoPendientes: 48 },
  },
]

const upsertsDe = (tabla: string) => estado.upserts.filter((u) => u.tabla === tabla)

beforeEach(async () => {
  reiniciar(estado)
  await db.configuracionAlertas.clear()
})

describe.each(casos)('$nombre: subir solo si cambió y lo cambió un administrador (R5)', (caso) => {
  it('(a) con rol personal no sube un cambio pendiente', async () => {
    useAuthStore.setState({ usuario: usuario('personal'), isReady: true })
    await caso.escribir(caso.local(false))

    await runSyncBatch()

    expect(upsertsDe(caso.tablaRemota)).toEqual([])
  })

  it('(b) como administrador sube el cambio pendiente y lo marca', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await caso.escribir(caso.local(false))

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('ok')
    expect(upsertsDe(caso.tablaRemota)).toHaveLength(1)
    expect(await caso.leer()).toMatchObject({ ...caso.valorLocal, sincronizado: true })
  })

  it('(c) como administrador no vuelve a subir una fila ya sincronizada', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await caso.escribir(caso.local(true))

    await runSyncBatch()

    expect(upsertsDe(caso.tablaRemota)).toEqual([])
  })

  it('(d) un error que no es de permisos deja el cambio pendiente y el ciclo en error', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await caso.escribir(caso.local(false))
    estado.errorUpsert[caso.tablaRemota] = { code: '500', message: 'internal error' }

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('error')
    expect((await caso.leer())?.sincronizado).toBe(false)
  })

  it('(e) como administrador, el pull no pisa un cambio local sin subir', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await caso.escribir(caso.local(false))
    estado.remoto[caso.tablaRemota] = new Map([['global', { ...caso.remota }]])
    // El push falla por red: el cambio local sigue pendiente al llegar al pull.
    estado.errorUpsert[caso.tablaRemota] = { message: 'Failed to fetch' }

    await runSyncBatch()

    expect(await caso.leer()).toMatchObject({ ...caso.valorLocal, sincronizado: false })
  })

  it('(g) con rol personal, el pull pisa un cambio local de un administrador degradado', async () => {
    useAuthStore.setState({ usuario: usuario('personal'), isReady: true })
    await caso.escribir(caso.local(false))
    estado.remoto[caso.tablaRemota] = new Map([['global', { ...caso.remota }]])

    await runSyncBatch()

    expect(await caso.leer()).toMatchObject({ ...caso.valorRemoto, sincronizado: true })
  })

  it('(h) un rechazo por permisos descarta el cambio local sin marcar error', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await caso.escribir(caso.local(false))
    estado.remoto[caso.tablaRemota] = new Map([['global', { ...caso.remota }]])
    estado.errorUpsert[caso.tablaRemota] = rechazoRls

    const resultado = await runSyncBatch()

    expect(resultado.estado).toBe('ok')
    expect(await caso.leer()).toMatchObject({ ...caso.valorRemoto, sincronizado: true })
  })
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('horas_aviso_pendientes (R6)', () => {
  it('(f) no se envía la clave si el valor local es indefinido', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await db.configuracionAlertas.put({
      tenantId: TENANT_1,
      id: 'global',
      nivelesAvisoDias: [30, 7, 1],
      sincronizado: false,
    })

    await runSyncBatch()

    const [subida] = upsertsDe('configuracion_alertas')
    expect(subida.filas[0]).not.toHaveProperty('horas_aviso_pendientes')
  })

  it('se envía y se baja cuando está definido', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await db.configuracionAlertas.put({
      tenantId: TENANT_1,
      id: 'global',
      nivelesAvisoDias: [30, 7, 1],
      horasAvisoPendientes: 12,
      sincronizado: false,
    })

    await runSyncBatch()

    expect(upsertsDe('configuracion_alertas')[0].filas[0]).toMatchObject({
      horas_aviso_pendientes: 12,
    })
    expect(await db.configuracionAlertas.get('global')).toMatchObject({
      horasAvisoPendientes: 12,
      sincronizado: true,
    })
  })
})
