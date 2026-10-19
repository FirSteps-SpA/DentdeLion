import { db, type Insumo, type Lugar, type Movimiento } from '../../../lib/db'
import { tenantActualOFallar } from '../../../stores/authStore'
import { lugaresActivos } from '../../../stores/lugarStore'
import { crearMovimiento, unidadDeConsumoDelLote } from './movements'
import { validateQuantity } from './quantity'
import { movimientosNormalizadosDeLote, stockLoteEnLugar } from './stock'

/**
 * Traslados entre lugares (spec 014 US6, FR-022–FR-024, research.md R4): un
 * par de movimientos del mismo lote — `traslado_salida` en el origen y
 * `traslado_entrada` en el destino — con el mismo `trasladoId`, escritos en
 * una sola transacción Dexie. El servidor rechaza un par incompleto al
 * confirmar (`verificar_traslado`) y el sync nunca separa las mitades.
 */
export interface TrasladoInput {
  loteId: string
  origenId: string
  destinoId: string
  cantidad: number
}

/** Validación de un traslado contra el stock del lote en el origen (sin sobreconsumo). */
export function validarTraslado(
  input: TrasladoInput,
  {
    insumo,
    lugares,
    movimientos,
  }: { insumo: Insumo; lugares: Lugar[]; movimientos: Movimiento[] },
): string | null {
  if (input.origenId === input.destinoId) return 'Elige un lugar de destino distinto al de origen.'
  const activos = lugaresActivos(lugares).map((lugar) => lugar.id)
  if (!activos.includes(input.origenId)) return 'El lugar de origen no está activo.'
  if (!activos.includes(input.destinoId)) return 'Elige un lugar de destino activo.'
  const cantidad = validateQuantity(input.cantidad, insumo.unidadMedida)
  if (!cantidad.valid) return cantidad.error ?? 'Cantidad inválida.'
  const disponible = stockLoteEnLugar(movimientos, input.loteId, input.origenId)
  if (input.cantidad > disponible) {
    return `Stock insuficiente en el lote: disponible ${disponible} ${insumo.unidadMedida}.`
  }
  return null
}

async function lugaresDelTenant(): Promise<Lugar[]> {
  return db.lugares.where('tenantId').equals(tenantActualOFallar()).toArray()
}

async function escribirPar(
  input: TrasladoInput & { unidad?: string },
  movimientoOrigenId?: string,
): Promise<[Movimiento, Movimiento]> {
  const trasladoId = crypto.randomUUID()
  // Spec 015: ambas mitades en la misma unidad (el servidor lo exige).
  const unidad = input.unidad ?? (await unidadDeConsumoDelLote(input.loteId))
  const salida = await crearMovimiento({
    tipo: 'traslado_salida',
    loteId: input.loteId,
    cantidad: input.cantidad,
    lugarId: input.origenId,
    trasladoId,
    movimientoOrigenId,
    unidad,
  })
  const entrada = await crearMovimiento({
    tipo: 'traslado_entrada',
    loteId: input.loteId,
    cantidad: input.cantidad,
    lugarId: input.destinoId,
    trasladoId,
    movimientoOrigenId,
    unidad,
  })
  return [salida, entrada]
}

/**
 * Registra el traslado. Relee el stock dentro de la transacción (como
 * "Consumir 1") para que dos toques seguidos no sobregiren el lote.
 */
export async function trasladar(
  insumo: Insumo,
  input: TrasladoInput,
): Promise<[Movimiento, Movimiento]> {
  return db.transaction(
    'rw',
    [db.movimientos, db.lugares, db.lotes, db.insumos, db.cambiosInsumo],
    async () => {
    const movimientos = await movimientosNormalizadosDeLote(input.loteId)
    const error = validarTraslado(input, {
      insumo,
      lugares: await lugaresDelTenant(),
      movimientos,
    })
    if (error) throw new Error(error)
    return escribirPar({ ...input, unidad: insumo.unidadMedida })
    },
  )
}

/**
 * "Deshacer" (US6-6): el traslado inverso, vinculado a la salida original por
 * `movimientoOrigenId`, como el deshacer de un consumo (spec 007). Idempotente:
 * si ya se deshizo, devuelve `null`. Falla si en el destino ya no está el stock.
 */
export async function deshacerTraslado(
  salidaId: string,
): Promise<[Movimiento, Movimiento] | null> {
  return db.transaction(
    'rw',
    [db.movimientos, db.lotes, db.insumos, db.cambiosInsumo],
    async () => {
    const salida = await db.movimientos.get(salidaId)
    if (!salida || salida.tipo !== 'traslado_salida' || !salida.trasladoId) return null
    const delLote = await movimientosNormalizadosDeLote(salida.loteId)
    if (delLote.some((m) => m.movimientoOrigenId === salida.id)) return null
    const entrada = delLote.find(
      (m) => m.trasladoId === salida.trasladoId && m.tipo === 'traslado_entrada',
    )
    if (!entrada) return null
    // Spec 015: el stock va en la unidad actual; la salida, en la suya.
    const cantidadActual = delLote.find((m) => m.id === salida.id)?.cantidad ?? salida.cantidad
    if (stockLoteEnLugar(delLote, salida.loteId, entrada.lugarId) < cantidadActual) {
      throw new Error('No se puede deshacer: ya se usó parte del stock en el destino.')
    }
    return escribirPar(
      {
        loteId: salida.loteId,
        origenId: entrada.lugarId,
        destinoId: salida.lugarId,
        cantidad: salida.cantidad,
        unidad: salida.unidad,
      },
      salida.id,
    )
    },
  )
}
