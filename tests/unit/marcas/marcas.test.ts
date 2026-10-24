import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Insumo, Marca } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return { db: createMemoryDb({ marcas: new MemoryTable() }) }
})

import { db } from '../../../src/lib/db'
import {
  claveMarca,
  mapaMarcas,
  marcaParaInsumo,
  nombreDeMarca,
  usosPorMarca,
} from '../../../src/features/marcas/lib/marcas'
import { TENANT_1 } from '../../helpers/tenancy'

/** Spec 023 T023 (contracts/ui-contracts.md "marcas.ts"). */
function marca(id: string, nombre: string, extra: Partial<Marca> = {}): Marca {
  return {
    id,
    tenantId: TENANT_1,
    nombre,
    creadoPor: 'ana',
    creadoEn: '2026-10-24T10:00:00.000Z',
    desactivadoEn: null,
    eliminadoEn: null,
    sincronizado: true,
    ...extra,
  }
}

const insumo = (id: string, marcaId: string | null, dadoDeBajaEn: string | null = null) =>
  ({ id, marcaId, dadoDeBajaEn }) as Insumo

const marcasT = db.marcas as unknown as MemoryTable<Marca>

beforeEach(() => {
  marcasT.seed([
    marca('tres', '3M'),
    marca('gc', 'GC', { desactivadoEn: '2026-10-24T11:00:00.000Z' }),
    marca('vieja', 'Vieja', { eliminadoEn: '2026-10-24T11:00:00.000Z' }),
  ])
})

describe('marcas (spec 023)', () => {
  it('la clave ignora mayúsculas, tildes y espacios', () => {
    expect(claveMarca(' 3m ')).toBe(claveMarca('3M'))
    expect(claveMarca('Ívoclar  Vivadent')).toBe('ivoclar vivadent')
  })

  it('nombreDeMarca: el nombre actual; null sin marca, ausente o eliminada', () => {
    const porId = mapaMarcas(marcasT.all())
    expect(nombreDeMarca(insumo('a', 'tres'), porId)).toBe('3M')
    expect(nombreDeMarca(insumo('b', 'gc'), porId)).toBe('GC')
    expect(nombreDeMarca(insumo('c', null), porId)).toBeNull()
    expect(nombreDeMarca(insumo('d', 'no-existe'), porId)).toBeNull()
    expect(nombreDeMarca(insumo('e', 'vieja'), porId)).toBeNull()
  })

  it('usosPorMarca cuenta los insumos de cada marca, incluidos los dados de baja', () => {
    const usos = usosPorMarca([
      insumo('a', 'tres'),
      insumo('b', 'tres', '2026-10-01T00:00:00.000Z'),
      insumo('c', 'gc'),
      insumo('d', null),
    ])
    expect(usos.get('tres')).toBe(2)
    expect(usos.get('gc')).toBe(1)
    expect(usos.has('vieja')).toBe(false)
  })

  it('marcaParaInsumo acepta una activa o desactivada; descarta eliminada o inexistente', async () => {
    expect(await marcaParaInsumo('tres')).toBe('tres')
    expect(await marcaParaInsumo('gc')).toBe('gc')
    expect(await marcaParaInsumo('vieja')).toBeNull()
    expect(await marcaParaInsumo('no-existe')).toBeNull()
    expect(await marcaParaInsumo(null)).toBeNull()
  })
})
