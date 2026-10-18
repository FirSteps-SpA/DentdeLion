import { describe, expect, it } from 'vitest'
import type { Insumo } from '../../../src/lib/db'
import { computeInsumosStockBajo } from '../../../src/features/alertas/lib/stockBajo'
import {
  estadoVisual,
  type EstadoInsumo,
} from '../../../src/features/insumos/lib/estado'

const insumo: Insumo = {
  id: 'i1',
  nombre: 'Guantes',
  categoria: 'Protección',
  unidadMedida: 'caja',
  permiteDecimales: false,
  caduca: false,
  codigoFabricante: null,
  creadoEn: 'x',
  stockMinimo: null,
  dadoDeBajaEn: null,
  dadoDeBajaPor: null,
  creadoPor: null,
}

const de = (
  estado: EstadoInsumo['estado'],
  stockTotal: number,
): EstadoInsumo => ({
  insumo,
  estado,
  stockTotal,
  loteMasProximoAVencer: null,
})

describe('estadoVisual (spec 013 FR-007, data-model.md)', () => {
  it.each([
    ['caducado', 0, 'Caducado', 'danger'],
    ['proximo-a-caducar', 0, 'Próximo a caducar', 'urgent-7'],
    ['bajo-stock', 0, 'Stock crítico', 'danger'],
    ['ok', 0, 'Stock crítico', 'danger'],
    ['bajo-stock', 3, 'Bajo Stock', 'warning-30'],
    ['ok', 12, 'Ok', 'success'],
  ] as const)('%s con stock %i → %s', (estado, stock, etiqueta, tono) => {
    expect(estadoVisual(de(estado, stock))).toMatchObject({ etiqueta, tono })
  })

  it('"crítico" es solo visual: un insumo agotado sin mínimo no genera alerta de stock bajo', () => {
    expect(computeInsumosStockBajo([insumo], [], [])).toEqual([])
    expect(estadoVisual(de('ok', 0)).etiqueta).toBe('Stock crítico')
  })
})
