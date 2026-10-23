import { describe, expect, it } from 'vitest'
import { etiquetaStockBajo } from '../../../src/features/alertas/lib/etiquetaStock'
import { AlertTriangle, CircleAlert } from '../../../src/components/icons'

describe('etiquetaStockBajo (spec 018 FR-011, contracts/ui-contracts.md §3)', () => {
  it.each([-2, 0])('stock %s → "Sin stock" en peligro', (stock) => {
    expect(etiquetaStockBajo(stock)).toEqual({
      texto: 'Sin stock',
      variante: 'danger',
      icono: CircleAlert,
    })
  })

  it.each([0.5, 2])('stock %s → "Bajo mínimo" en advertencia', (stock) => {
    expect(etiquetaStockBajo(stock)).toEqual({
      texto: 'Bajo mínimo',
      variante: 'warning-30',
      icono: AlertTriangle,
    })
  })
})
