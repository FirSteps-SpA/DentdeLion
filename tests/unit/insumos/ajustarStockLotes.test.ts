import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CambioInsumo,
  Insumo,
  Lote,
  MinimoLugar,
  Movimiento,
  UsuarioActual,
} from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      categorias: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  ajustarStockLotes,
  guardarEdicionInsumo,
} from '../../../src/features/insumos/lib/ajusteStock'
import { ingresoCompra, insumoCompra, loteCompra } from '../../helpers/compras'
import { usarDosLugares, usarLugar1 } from '../../helpers/lugarFalso'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../../helpers/tenancy'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>
const minimosT = db.minimosLugar as unknown as MemoryTable<MinimoLugar>

const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}

const guantes = insumoCompra({ id: 'i1', nombre: 'Guantes', categoria: 'Protección' })

function ajustes(): Movimiento[] {
  return movimientosT.all().filter((m) => m.tipo === 'ajuste')
}

beforeEach(() => {
  usarLugar1()
  useAuthStore.setState({ usuario: admin, isReady: true })
  insumosT.seed([guantes])
  lotesT.seed([loteCompra({ id: 'l1' }), loteCompra({ id: 'l2', numeroLote: 'L2' })])
  movimientosT.seed([ingresoCompra('l1', 3), ingresoCompra('l2', 5)])
  cambiosT.seed([])
  minimosT.seed([])
})

describe('ajustarStockLotes (spec 024 US2, R4)', () => {
  it('escribe un ajuste por la diferencia, a nombre de quien corrige', async () => {
    await ajustarStockLotes('i1', [
      { loteId: 'l1', lugarId: LUGAR_1, cantidad: 4 },
      { loteId: 'l2', lugarId: LUGAR_1, cantidad: 2 },
    ])

    expect(ajustes()).toEqual([
      expect.objectContaining({ loteId: 'l1', cantidad: 1, usuarioId: 'admin-1', movimientoOrigenId: null }),
      expect.objectContaining({ loteId: 'l2', cantidad: -3, usuarioId: 'admin-1' }),
    ])
  })

  it('una cantidad sin cambios no escribe nada', async () => {
    await ajustarStockLotes('i1', [{ loteId: 'l1', lugarId: LUGAR_1, cantidad: 3 }])
    expect(ajustes()).toEqual([])
  })

  it('corrige en el lugar indicado, con el stock de ese lugar', async () => {
    usarDosLugares('todos')
    movimientosT.seed([ingresoCompra('l1', 3, LUGAR_1), ingresoCompra('l1', 7, LUGAR_2)])

    await ajustarStockLotes('i1', [{ loteId: 'l1', lugarId: LUGAR_2, cantidad: 6 }])

    expect(ajustes()).toEqual([
      expect.objectContaining({ loteId: 'l1', lugarId: LUGAR_2, cantidad: -1 }),
    ])
  })

  it('solo administración', async () => {
    useAuthStore.setState({ usuario: { ...admin, rol: 'personal' }, isReady: true })
    await expect(
      ajustarStockLotes('i1', [{ loteId: 'l1', lugarId: LUGAR_1, cantidad: 0 }]),
    ).rejects.toThrow('Solo un administrador puede ajustar el stock de insumos.')
    expect(ajustes()).toEqual([])
  })

  it('una cantidad inválida no escribe ninguna corrección', async () => {
    await expect(
      ajustarStockLotes('i1', [
        { loteId: 'l1', lugarId: LUGAR_1, cantidad: 0 },
        { loteId: 'l2', lugarId: LUGAR_1, cantidad: 1.5 },
      ]),
    ).rejects.toThrow('Esta unidad no admite decimales.')
    expect(ajustes()).toEqual([])
  })

  it('usa el stock normalizado si el insumo cambió de unidad', async () => {
    insumosT.seed([{ ...guantes, unidadMedida: 'guante', unidadCompra: 'caja', contenido: 100 }])
    cambiosT.seed([
      {
        id: 'c1',
        tenantId: TENANT_1,
        insumoId: 'i1',
        campo: 'unidadMedida',
        valorAnterior: 'caja',
        valorNuevo: 'guante',
        factor: 100,
        usuarioId: 'admin-1',
        creadoEn: '2026-02-01T00:00:00.000Z',
        sincronizado: true,
        rechazadoEn: null,
      },
    ])

    // l1 tiene 3 cajas = 300 guantes.
    await ajustarStockLotes('i1', [{ loteId: 'l1', lugarId: LUGAR_1, cantidad: 250 }])

    expect(ajustes()).toEqual([
      expect.objectContaining({ loteId: 'l1', cantidad: -50, unidad: 'guante' }),
    ])
  })
})

describe('guardarEdicionInsumo (spec 024 FR-008)', () => {
  it('guarda catálogo, correcciones y mínimo del lugar juntos', async () => {
    await guardarEdicionInsumo({
      insumo: guantes,
      cambios: { nombre: 'Guantes M' },
      correcciones: [{ loteId: 'l1', lugarId: LUGAR_1, cantidad: 0 }],
      minimoLugar: { lugarId: LUGAR_1, valor: 2 },
    })

    expect(insumosT.all()[0].nombre).toBe('Guantes M')
    expect(ajustes()).toEqual([expect.objectContaining({ loteId: 'l1', cantidad: -3 })])
    expect(minimosT.all()[0]).toMatchObject({ insumoId: 'i1', lugarId: LUGAR_1, stockMinimo: 2 })
  })

  it('una corrección inválida no deja guardado el cambio de nombre', async () => {
    await expect(
      guardarEdicionInsumo({
        insumo: guantes,
        cambios: { nombre: 'Guantes M' },
        correcciones: [{ loteId: 'l1', lugarId: LUGAR_1, cantidad: -1 }],
        minimoLugar: null,
      }),
    ).rejects.toThrow('Ingresa una cantidad de 0 o más.')

    expect(insumosT.all()[0].nombre).toBe('Guantes')
    expect(cambiosT.all()).toEqual([])
  })

  it('un error al guardar el mínimo revierte catálogo y ajustes', async () => {
    await expect(
      guardarEdicionInsumo({
        insumo: guantes,
        cambios: { nombre: 'Guantes M' },
        correcciones: [{ loteId: 'l1', lugarId: LUGAR_1, cantidad: 0 }],
        minimoLugar: { lugarId: LUGAR_1, valor: -5 },
      }),
    ).rejects.toThrow()

    expect(insumosT.all()[0].nombre).toBe('Guantes')
    expect(ajustes()).toEqual([])
    expect(minimosT.all()).toEqual([])
  })
})
