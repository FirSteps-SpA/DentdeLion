import type { Lugar } from '../../src/lib/db'
import { useLugarStore } from '../../src/stores/lugarStore'
import { LUGAR_1, LUGAR_2, TENANT_1 } from './tenancy'

/**
 * Spec 014 — las escrituras de stock van al lugar activo de `lugarStore`, que
 * en la app llena un `liveQuery`. Las pruebas que no montan ese ciclo fijan
 * aquí el lugar 1 de la clínica original, como un tenant de un solo lugar.
 */
export const lugar1: Lugar = {
  id: LUGAR_1,
  tenantId: TENANT_1,
  nombre: 'Clínica',
  desactivadoEn: null,
  creadoEn: '2026-01-01T00:00:00.000Z',
  sincronizado: true,
  proveedorPredeterminadoId: null,
}

export const lugar2: Lugar = {
  id: LUGAR_2,
  tenantId: TENANT_1,
  nombre: 'Box Las Condes',
  desactivadoEn: null,
  creadoEn: '2026-02-01T00:00:00.000Z',
  sincronizado: true,
  proveedorPredeterminadoId: null,
}

export function usarLugar1(): void {
  useLugarStore.setState({ lugares: [lugar1], lugarActivoId: LUGAR_1, isReady: true })
}

/** Dos lugares, con `activo` elegido (por defecto el 1). */
export function usarDosLugares(activo: string | 'todos' = LUGAR_1): void {
  useLugarStore.setState({
    lugares: [lugar1, lugar2],
    lugarActivoId: activo,
    isReady: true,
  })
}
