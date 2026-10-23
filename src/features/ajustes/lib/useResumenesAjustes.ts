import { useAuthStore } from '../../../stores/authStore'
import { useAlertasStore } from '../../../stores/alertasStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { lugaresActivos, useLugarStore } from '../../../stores/lugarStore'
import { catalogoCategorias } from '../../insumos/lib/categorias'
import { SECCIONES_AJUSTES, resumenSeccion, type IdSeccion } from './secciones'

/**
 * Spec 019 (research.md R3): resumen de cada tarjeta del índice desde los
 * stores locales ya suscritos; se actualiza solo cuando cambia un dato (FR-008).
 */
export function useResumenesAjustes(): Record<IdSeccion, string | null> {
  const usuario = useAuthStore((s) => s.usuario)
  const lugares = useLugarStore((s) => s.lugares)
  const lugaresListos = useLugarStore((s) => s.isReady)
  const insumos = useInventoryStore((s) => s.insumos)
  const categorias = useInventoryStore((s) => s.categorias)
  const insumosDadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const inventarioListo = useInventoryStore((s) => s.isReady)
  const alertasListas = useAlertasStore((s) => s.isReady)
  const preferenciaStockBajo = useAlertasStore((s) => s.preferenciaStockBajo)
  const preferenciaCaducidad = useAlertasStore((s) => s.preferenciaCaducidad)
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)

  const datos = {
    usuario,
    lugaresActivos: lugaresListos ? lugaresActivos(lugares).length : null,
    // "Sin categoría" siempre está al final del catálogo: no es una categoría.
    categoriasActivas: inventarioListo
      ? catalogoCategorias(categorias, insumos).filter((c) => c.origen !== 'sin-categoria')
          .length
      : null,
    insumosDadosDeBaja: inventarioListo ? insumosDadosDeBaja.length : null,
    notificaciones: alertasListas
      ? { stockBajo: preferenciaStockBajo, caducidad: preferenciaCaducidad }
      : null,
    nivelesAvisoDias: alertasListas ? nivelesAvisoDias : null,
  }
  return Object.fromEntries(
    SECCIONES_AJUSTES.map((s) => [s.id, resumenSeccion(s.id, datos)]),
  ) as Record<IdSeccion, string | null>
}
