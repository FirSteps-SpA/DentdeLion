import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfiguracionAlertas } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      configuracionAlertas: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  MENSAJE_SALUDO_LARGO,
  guardarSaludoPedido,
  restablecerSaludoPedido,
} from '../../../src/features/ajustes/lib/saludoAdmin'
import { TENANT_1 } from '../../helpers/tenancy'

const configT =
  db.configuracionAlertas as unknown as MemoryTable<ConfiguracionAlertas>

beforeEach(() => {
  configT.seed([])
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'admin-1',
      email: 'a@x.cl',
      nombre: 'Admin',
      rol: 'administrador',
      autenticadoEn: '2026-01-01T00:00:00.000Z',
    },
    isReady: true,
  })
})

describe('saludoAdmin (spec 022 FR-022)', () => {
  it('sin fila, la crea con los niveles por defecto y el saludo recortado, para subir', async () => {
    await guardarSaludoPedido('  Hola Paula  ')
    expect(configT.all()[0]).toEqual({
      id: 'global',
      tenantId: TENANT_1,
      nivelesAvisoDias: [30, 7, 1],
      saludoPedido: 'Hola Paula',
      sincronizado: false,
    })
  })

  it('conserva el resto de la configuración', async () => {
    configT.seed([
      {
        id: 'global',
        tenantId: TENANT_1,
        nivelesAvisoDias: [15],
        horasAvisoPendientes: 6,
        sincronizado: true,
      },
    ])
    await guardarSaludoPedido('Hola')
    expect(configT.all()[0]).toMatchObject({
      nivelesAvisoDias: [15],
      horasAvisoPendientes: 6,
      saludoPedido: 'Hola',
      sincronizado: false,
    })
  })

  it('vacío o solo espacios vuelve al de la clienta (null)', async () => {
    await guardarSaludoPedido('   ')
    expect(configT.all()[0].saludoPedido).toBeNull()
  })

  it('más de 500 caracteres no se guarda', async () => {
    await expect(guardarSaludoPedido('x'.repeat(501))).rejects.toThrow(
      MENSAJE_SALUDO_LARGO,
    )
    expect(configT.all()).toEqual([])
  })

  it('restablecer deja null y marca la fila para subir', async () => {
    await guardarSaludoPedido('Hola')
    await restablecerSaludoPedido()
    expect(configT.all()[0]).toMatchObject({
      saludoPedido: null,
      sincronizado: false,
    })
  })
})
