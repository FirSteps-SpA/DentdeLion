import {
  db,
  type CambioInsumo,
  type CambioLote,
  type Categoria,
  type Insumo,
  type ItemCompra,
  type Lote,
  type Lugar,
  type MinimoLugar,
  type Movimiento,
} from '../db'

/** Tablas de Dexie indexadas por `tenantId` (spec 014 Dexie v10). */
interface TablasPorTenant {
  insumos: Insumo
  lotes: Lote
  movimientos: Movimiento
  cambiosInsumo: CambioInsumo
  categorias: Categoria
  itemsCompra: ItemCompra
  lugares: Lugar
  minimosLugar: MinimoLugar
  /** Spec 015 (Dexie v11). */
  cambiosLote: CambioLote
}

/** Lo mínimo de una tabla Dexie indexada por `tenantId` que necesita `delTenant`. */
interface TablaPorTenant<T> {
  where(indice: 'tenantId'): { equals(valor: string): { toArray(): Promise<T[]> } }
}

export { LUGAR_1, TENANT_1 } from './constantes'

/**
 * Filas de una tabla que pertenecen al tenant del usuario con sesión (spec 014
 * FR-004). Lee `usuarioActual` dentro de la misma consulta para que un
 * `liveQuery` que la use se vuelva a ejecutar cuando cambia la sesión. Sin
 * sesión devuelve nada.
 */
export async function delTenant<K extends keyof TablasPorTenant>(
  tabla: K,
): Promise<TablasPorTenant[K][]> {
  const usuario = await db.usuarioActual.toCollection().first()
  if (!usuario) return []
  const indexada = db[tabla] as unknown as TablaPorTenant<TablasPorTenant[K]>
  return indexada.where('tenantId').equals(usuario.tenantId).toArray()
}

/**
 * Aislamiento local al iniciar sesión (spec 014 FR-004, research.md R8): si
 * en este dispositivo quedan datos de otro tenant, se borran los que ya están
 * en el servidor (se pueden volver a bajar) y se conservan los pendientes,
 * ocultos para la app hasta que su dueño vuelva a entrar (spec 012).
 *
 * "Pendiente" según la tabla:
 * - `movimientos`, `cambiosInsumo`, `cambiosLote`, `categorias`, `lugares`,
 *   `minimosLugar`: la bandera `sincronizado`;
 * - `insumos` y `lotes` no tienen bandera: se conservan los que referencia un
 *   pendiente que se conserva (sin ellos, ese pendiente no podría subir);
 * - `itemsCompra` tampoco tiene bandera y no lo referencia nada: se conservan
 *   los `pendiente`, que pueden no haber subido nunca;
 * - la configuración global (fila única) se borra: es por tenant y la vuelve
 *   a bajar el sync.
 */
export async function aislarDatosLocales(tenantId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.insumos,
      db.lotes,
      db.movimientos,
      db.cambiosInsumo,
      db.categorias,
      db.itemsCompra,
      db.lugares,
      db.minimosLugar,
      db.cambiosLote,
      db.configuracionAlertas,
      db.configuracionClinica,
    ],
    async () => {
      const ajeno = (fila: { tenantId?: string }) => fila.tenantId !== tenantId
      const sincronizadoAjeno = (fila: { tenantId?: string; sincronizado?: boolean }) =>
        ajeno(fila) && fila.sincronizado !== false

      const movimientosAjenos = (await db.movimientos.toArray()).filter(ajeno)
      const movimientosConservados = movimientosAjenos.filter(
        (movimiento) => !movimiento.sincronizado,
      )
      const cambiosAjenos = (await db.cambiosInsumo.toArray()).filter(ajeno)
      const cambiosConservados = cambiosAjenos.filter((cambio) => !cambio.sincronizado)

      const cambiosLoteAjenos = (await db.cambiosLote.toArray()).filter(ajeno)

      const lotesConservados = new Set([
        ...movimientosConservados.map((movimiento: Movimiento) => movimiento.loteId),
        ...cambiosLoteAjenos.filter((c) => !c.sincronizado).map((c) => c.loteId),
      ])
      const lotesAjenos = (await db.lotes.toArray()).filter(ajeno)
      const insumosConservados = new Set([
        ...cambiosConservados.map((cambio) => cambio.insumoId),
        ...lotesAjenos
          .filter((lote) => lotesConservados.has(lote.id))
          .map((lote) => lote.insumoId),
      ])

      await db.movimientos.bulkDelete(
        movimientosAjenos.filter((m) => m.sincronizado).map((m) => m.id),
      )
      await db.cambiosInsumo.bulkDelete(
        cambiosAjenos.filter((c) => c.sincronizado).map((c) => c.id),
      )
      await db.cambiosLote.bulkDelete(
        cambiosLoteAjenos.filter((c) => c.sincronizado).map((c) => c.id),
      )
      await db.lotes.bulkDelete(
        lotesAjenos.filter((lote) => !lotesConservados.has(lote.id)).map((l) => l.id),
      )
      await db.insumos.bulkDelete(
        (await db.insumos.toArray())
          .filter((insumo) => ajeno(insumo) && !insumosConservados.has(insumo.id))
          .map((insumo) => insumo.id),
      )
      await db.categorias.bulkDelete(
        (await db.categorias.toArray()).filter(sincronizadoAjeno).map((c) => c.id),
      )
      await db.itemsCompra.bulkDelete(
        (await db.itemsCompra.toArray())
          .filter((item) => ajeno(item) && item.estado !== 'pendiente')
          .map((item) => item.id),
      )
      await db.lugares.bulkDelete(
        (await db.lugares.toArray()).filter(sincronizadoAjeno).map((l) => l.id),
      )
      await db.minimosLugar.bulkDelete(
        (await db.minimosLugar.toArray())
          .filter(sincronizadoAjeno)
          .map((m): [string, string] => [m.insumoId, m.lugarId]),
      )
      for (const tabla of [db.configuracionAlertas, db.configuracionClinica]) {
        const config = (await tabla.get('global')) as { tenantId?: string } | undefined
        if (config && ajeno(config)) await tabla.delete('global')
      }
      // `lugarActivo` no se toca: si el guardado es de otro tenant, `lugarStore`
      // ya no lo encuentra entre los lugares del tenant y usa el principal.
    },
  )
}

/**
 * Al iniciar sesión (spec 014): baja los lugares del tenant antes de entrar,
 * para no mostrar "sin lugares" hasta el primer ciclo de sync. Si falla (sin
 * red, error), no bloquea el login: el ciclo los trae después.
 */
export async function descargarLugares(client: {
  from: (tabla: 'lugares') => {
    select: (columnas: string) => PromiseLike<{ data: unknown; error: unknown }>
  }
}): Promise<void> {
  try {
    const { data, error } = await client.from('lugares').select('*')
    if (error || !Array.isArray(data)) return
    await db.lugares.bulkPut(
      (
        data as {
          id: string
          tenant_id: string
          nombre: string
          desactivado_en: string | null
          creado_en: string
        }[]
      ).map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        nombre: row.nombre,
        desactivadoEn: row.desactivado_en ?? null,
        creadoEn: row.creado_en,
        sincronizado: true,
      })),
    )
  } catch {
    // Sin red o cliente incompleto: lo trae el sync.
  }
}
