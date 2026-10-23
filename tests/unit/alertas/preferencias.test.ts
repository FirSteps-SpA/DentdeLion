import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PreferenciaNotificaciones } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAlertasStore } from '../../../src/stores/alertasStore'
import { actualizarPreferenciaNotificacion } from '../../../src/features/alertas/lib/preferencias'

const prefT = db.preferenciasNotificaciones as unknown as MemoryTable<PreferenciaNotificaciones>

beforeEach(() => {
  useAlertasStore.setState({ preferenciaStockBajo: true, preferenciaCaducidad: true })
})

afterEach(() => {
  prefT.rows.clear()
})

describe('actualizarPreferenciaNotificacion (FR-025/027)', () => {
  it('defaults to both enabled without a row', () => {
    expect(useAlertasStore.getState().preferenciaStockBajo).toBe(true)
    expect(useAlertasStore.getState().preferenciaCaducidad).toBe(true)
  })

  it('turning off stockBajo persists it without affecting caducidad', async () => {
    await actualizarPreferenciaNotificacion('stockBajo', false)

    expect(prefT.all()[0]).toMatchObject({ stockBajo: false, caducidad: true })
  })

  it('turning off caducidad persists it without affecting stockBajo', async () => {
    await actualizarPreferenciaNotificacion('caducidad', false)

    expect(prefT.all()[0]).toMatchObject({ stockBajo: true, caducidad: false })
  })

  it('preserves an already-changed preference across a second write', async () => {
    await actualizarPreferenciaNotificacion('stockBajo', false)
    useAlertasStore.setState({ preferenciaStockBajo: false })

    await actualizarPreferenciaNotificacion('caducidad', false)

    expect(prefT.all()[0]).toMatchObject({ stockBajo: false, caducidad: false })
  })
})
