import {
  db,
  type Lote,
  type MaterialUsado,
  type Movimiento,
  type TratamientoRealizado,
} from '../../../lib/db'
import { diasEntre } from '../../../lib/dateMath'
import { getUsuarioActualId, tenantActualOFallar } from '../../../stores/authStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'
import { repartirFefo, type LoteConStock } from '../../insumos/lib/fefo'
import { crearMovimiento } from '../../insumos/lib/movements'
import { costosUnitariosPorInsumo } from '../../insumos/lib/precio'
import {
  computeStockLote,
  movimientosDeTratamiento,
  movimientosNormalizadosDeLote,
} from '../../insumos/lib/stock'
import { calcularGanancia, cantidadEfectiva } from './montos'
import { porcentajesPorLugar, type TratamientoProyectado } from './proyeccion'

/** Mismo criterio que "Consumir 1" y las alertas: vence hoy = todavía vigente. */
export function esLoteVigente(lote: Lote, hoy: Date = new Date()): boolean {
  return lote.fechaCaducidad === null || diasEntre(lote.fechaCaducidad, hoy) >= 0
}

/** Un material que no alcanza en el lugar (FR-015). */
export interface Faltante {
  insumoId: string
  nombre: string
  pedido: number
  disponible: number
  unidad: string
  /** Hay stock, pero solo en lotes caducados. */
  soloCaducado: boolean
}

export class StockInsuficienteError extends Error {
  readonly faltantes: Faltante[]

  constructor(faltantes: Faltante[]) {
    super(
      `Falta stock en el lugar: ${faltantes
        .map((f) => `${f.nombre} (disponible ${f.disponible} ${f.unidad})`)
        .join(', ')}.`,
    )
    this.name = 'StockInsuficienteError'
    this.faltantes = faltantes
  }
}

export interface RegistroInput {
  /** Lugar elegido en "Todos" (spec 014 FR-014); sin él, el activo. */
  lugarId?: string
  /**
   * Cantidad usada por insumo, en su unidad de consumo actual. Sin entrada,
   * la cantidad estándar del tratamiento (FR-013).
   */
  cantidades?: Record<string, number>
}

async function lotesConStockEnLugar(insumoId: string, lugarId: string): Promise<LoteConStock[]> {
  const lotes = await db.lotes.where('insumoId').equals(insumoId).toArray()
  return Promise.all(
    lotes.map(async (lote) => ({
      lote,
      stockDisponible: computeStockLote(
        (await movimientosNormalizadosDeLote(lote.id)).filter((m) => m.lugarId === lugarId),
      ),
    })),
  )
}

/**
 * Spec 016 US3 (FR-013–FR-016, research.md R4): registra el tratamiento y
 * descuenta sus materiales del lugar por FEFO (sin caducados), en **una**
 * transacción Dexie: o queda el registro con todos sus consumos, o nada. El
 * stock se relee dentro de la transacción. Si algún material no alcanza,
 * lanza `StockInsuficienteError` con el detalle y no escribe. El registro
 * guarda el snapshot de precio, % y costos de este momento (SC-003).
 */
export async function registrarTratamiento(
  tratamiento: TratamientoProyectado,
  input: RegistroInput = {},
): Promise<TratamientoRealizado> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error('No hay un usuario autenticado local — no se puede registrar el tratamiento.')
  }
  const tenantId = tenantActualOFallar()
  const lugarId = lugarParaEscribirOFallar(input.lugarId)
  const hoy = new Date()

  return db.transaction(
    'rw',
    [
      db.lotes,
      db.movimientos,
      db.insumos,
      db.cambiosInsumo,
      db.cambiosLote,
      db.cambiosTratamiento,
      db.tratamientosRealizados,
    ],
    async () => {
      const cambiosInsumo = await db.cambiosInsumo.toArray()
      const faltantes: Faltante[] = []
      const consumos: { lote: Lote; cantidad: number; unidad: string }[] = []
      const usados: MaterialUsado[] = []
      const insumos = []

      for (const material of tratamiento.materiales) {
        const insumo = await db.insumos.get(material.insumoId)
        const nombre = insumo?.nombre ?? 'Material'
        const unidad = insumo?.unidadMedida ?? material.unidad
        if (!insumo || insumo.dadoDeBajaEn) {
          usados.push({
            insumoId: material.insumoId,
            nombre,
            cantidad: 0,
            unidad,
            costoUnitario: null,
            dadoDeBaja: true,
          })
          continue
        }
        insumos.push(insumo)
        const cantidad =
          input.cantidades?.[material.insumoId] ??
          cantidadEfectiva(material, insumo, cambiosInsumo)
        usados.push({ insumoId: insumo.id, nombre, cantidad, unidad, costoUnitario: null })
        if (cantidad <= 0) continue

        const reparto = repartirFefo(
          await lotesConStockEnLugar(insumo.id, lugarId),
          cantidad,
          (lote) => esLoteVigente(lote, hoy),
        )
        if (reparto.faltante > 0) {
          const disponible = Math.round((cantidad - reparto.faltante) * 1e9) / 1e9
          faltantes.push({
            insumoId: insumo.id,
            nombre,
            pedido: cantidad,
            disponible,
            unidad,
            soloCaducado: disponible === 0 && reparto.stockCaducado > 0,
          })
          continue
        }
        for (const parte of reparto.partes) consumos.push({ ...parte, unidad })
      }
      if (faltantes.length > 0) throw new StockInsuficienteError(faltantes)

      // Snapshot de costos (spec 015: último ingreso con precio, todo el tenant).
      const costos = costosUnitariosPorInsumo(
        insumos,
        await db.lotes.toArray(),
        await db.cambiosLote.toArray(),
        cambiosInsumo,
      )
      for (const usado of usados) {
        if (!usado.dadoDeBaja) usado.costoUnitario = costos.get(usado.insumoId)?.costo ?? null
      }
      const conCantidad = usados.filter((u) => !u.dadoDeBaja && u.cantidad > 0)
      const costoMateriales = conCantidad.reduce(
        (total, u) => total + u.cantidad * (u.costoUnitario ?? 0),
        0,
      )
      const precio = tratamiento.precios.get(lugarId) ?? null
      const porcentaje =
        porcentajesPorLugar(await db.cambiosTratamiento.toArray()).get(lugarId) ?? null

      const registro: TratamientoRealizado = {
        id: crypto.randomUUID(),
        tenantId,
        lugarId,
        tratamientoId: tratamiento.id,
        nombre: tratamiento.nombre,
        precio,
        porcentajeProfesional: porcentaje,
        materiales: usados,
        costoMateriales,
        costoCompleto: conCantidad.every((u) => u.costoUnitario !== null),
        gananciaEstimada: calcularGanancia(precio, porcentaje, costoMateriales).ganancia,
        usuarioId,
        creadoEn: new Date().toISOString(),
        anuladoEn: null,
        anuladoPor: null,
        sincronizado: false,
        anulacionSincronizada: true,
      }
      await db.tratamientosRealizados.add(registro)
      for (const consumo of consumos) {
        await crearMovimiento({
          tipo: 'consumo',
          loteId: consumo.lote.id,
          cantidad: consumo.cantidad,
          unidad: consumo.unidad,
          lugarId,
          tratamientoRealizadoId: registro.id,
        })
      }
      return registro
    },
  )
}

/**
 * Spec 016 US3-6 (FR-017, research.md R5): "Deshacer". Revierte cada consumo
 * con un ajuste vinculado (en su unidad y su lugar) y marca el registro
 * anulado, sin borrar nada. Idempotente: si ya está anulado devuelve `null`.
 * Lo puede hacer cualquier persona del equipo.
 */
export async function anularTratamiento(id: string): Promise<Movimiento[] | null> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error('No hay un usuario autenticado local — no se puede deshacer.')
  }
  return db.transaction(
    'rw',
    [db.tratamientosRealizados, db.movimientos, db.lotes, db.insumos],
    async () => {
      const registro = await db.tratamientosRealizados.get(id)
      if (!registro || registro.anuladoEn) return null
      const vinculados = await movimientosDeTratamiento(id)
      const revertidos = new Set(
        vinculados.filter((m) => m.tipo === 'ajuste').map((m) => m.movimientoOrigenId),
      )
      const ajustes: Movimiento[] = []
      for (const consumo of vinculados.filter((m) => m.tipo === 'consumo')) {
        if (revertidos.has(consumo.id)) continue
        ajustes.push(
          await crearMovimiento({
            tipo: 'ajuste',
            loteId: consumo.loteId,
            cantidad: consumo.cantidad,
            unidad: consumo.unidad,
            movimientoOrigenId: consumo.id,
            lugarId: consumo.lugarId,
            tratamientoRealizadoId: id,
          }),
        )
      }
      await db.tratamientosRealizados.update(id, {
        anuladoEn: new Date().toISOString(),
        anuladoPor: usuarioId,
        anulacionSincronizada: false,
      })
      return ajustes
    },
  )
}
