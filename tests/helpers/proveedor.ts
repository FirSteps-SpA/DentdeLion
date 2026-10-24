import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { Proveedor } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { lugar1 } from './lugarFalso'
import { TENANT_1 } from './tenancy'

/** Spec 021 — un proveedor del catálogo, activo y ya sincronizado. */
export function proveedorFalso(overrides: Partial<Proveedor> = {}): Proveedor {
  return {
    id: 'proveedor-x',
    tenantId: TENANT_1,
    nombre: 'Proveedor X',
    whatsapp: null,
    contacto: null,
    creadoPor: 'admin-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    desactivadoEn: null,
    eliminadoEn: null,
    sincronizado: true,
    ...overrides,
  }
}

/**
 * Elige un proveedor con el `SelectorProveedor` del formulario abierto: abre la
 * hoja, escribe el nombre y pulsa Enter, que elige el que coincide o agrega uno
 * nuevo con ese nombre. Espera a que la hoja se cierre.
 */
export async function elegirProveedor(
  nombre: string,
  etiqueta = 'Proveedor',
): Promise<void> {
  fireEvent.click(screen.getByLabelText(etiqueta))
  const buscador = await screen.findByLabelText('Buscar proveedor')
  fireEvent.change(buscador, { target: { value: nombre } })
  fireEvent.keyDown(buscador, { key: 'Enter' })
  await waitFor(() =>
    expect(screen.queryByLabelText('Buscar proveedor')).toBeNull(),
  )
}

/**
 * Deja "Proveedor X" como predeterminado del lugar 1 (en `lugarStore`, el
 * catálogo de `inventoryStore` y la tabla de proveedores del `memoryDb`), así
 * el alta y la recepción lo traen elegido (FR-006) y las pruebas no lo tocan.
 */
export function usarProveedorPredeterminado(tabla: {
  seed: (filas: Proveedor[]) => void
}): Proveedor {
  const proveedor = proveedorFalso()
  tabla.seed([proveedor])
  useInventoryStore.setState({ proveedores: [proveedor] })
  useLugarStore.setState({
    lugares: [{ ...lugar1, proveedorPredeterminadoId: proveedor.id }],
    lugarActivoId: lugar1.id,
    isReady: true,
  })
  return proveedor
}
