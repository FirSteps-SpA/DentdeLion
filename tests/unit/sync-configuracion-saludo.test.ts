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
  return {
    tenantId: TENANT_1,
    desactivadoEn: null,
    id: 'u1',
    email: 'u@x.cl',
    nombre: 'U',
    rol,
    autenticadoEn: 'x',
  }
}

const subidas = () =>
  estado.upserts
    .filter((u) => u.tabla === 'configuracion_alertas')
    .map((u) => u.filas[0])

const remota = (extra: Record<string, unknown>) =>
  new Map([
    [
      'global',
      { id: 'global', tenant_id: TENANT_1, niveles_aviso_dias: [30], ...extra },
    ],
  ])

beforeEach(async () => {
  reiniciar(estado)
  await db.configuracionAlertas.clear()
  usarLugar1()
  useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
})

describe('saludo_pedido (spec 022 R1)', () => {
  it('sin tocar aquí (undefined) no viaja', async () => {
    await db.configuracionAlertas.put({
      id: 'global',
      tenantId: TENANT_1,
      nivelesAvisoDias: [10],
      sincronizado: false,
    })

    await runSyncBatch()

    expect(subidas()[0]).not.toHaveProperty('saludo_pedido')
  })

  it('un saludo propio y un null (restablecer) sí viajan', async () => {
    await db.configuracionAlertas.put({
      id: 'global',
      tenantId: TENANT_1,
      nivelesAvisoDias: [10],
      saludoPedido: 'Hola Paula',
      sincronizado: false,
    })
    await runSyncBatch()
    expect(subidas()[0]).toMatchObject({ saludo_pedido: 'Hola Paula' })

    reiniciar(estado)
    await db.configuracionAlertas.put({
      id: 'global',
      tenantId: TENANT_1,
      nivelesAvisoDias: [10],
      saludoPedido: null,
      sincronizado: false,
    })
    await runSyncBatch()
    expect(subidas()[0]).toMatchObject({ saludo_pedido: null })
  })

  it('el pull guarda el saludo del servidor, también null', async () => {
    estado.remoto.configuracion_alertas = remota({
      saludo_pedido: 'Hola desde otro',
    })
    await runSyncBatch()
    expect(await db.configuracionAlertas.get('global')).toMatchObject({
      saludoPedido: 'Hola desde otro',
    })

    estado.remoto.configuracion_alertas = remota({ saludo_pedido: null })
    await runSyncBatch()
    expect(
      (await db.configuracionAlertas.get('global'))?.saludoPedido,
    ).toBeNull()
  })

  it('sin la columna en el servidor (sin migrar) no define el campo', async () => {
    estado.remoto.configuracion_alertas = remota({})
    await runSyncBatch()
    expect(await db.configuracionAlertas.get('global')).not.toHaveProperty(
      'saludoPedido',
    )
  })

  it('personal con un saludo local no lo sube', async () => {
    useAuthStore.setState({ usuario: usuario('personal'), isReady: true })
    await db.configuracionAlertas.put({
      id: 'global',
      tenantId: TENANT_1,
      nivelesAvisoDias: [10],
      saludoPedido: 'No debería subir',
      sincronizado: false,
    })

    await runSyncBatch()

    expect(subidas()).toEqual([])
  })
})
