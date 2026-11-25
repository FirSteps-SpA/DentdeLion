import { db, type Insumo, type Lote, type Lugar, type MinimoLugar, type Movimiento } from '../../../lib/db'
import { tenantActualOFallar, useAuthStore } from '../../../stores/authStore'
import { lugaresActivos, lugaresDeBodega, rotuloBodega } from '../../../stores/lugarStore'
import { minimoEfectivoBodega } from './minimos'
import {
  lotesConMovimientosEnLugar,
  movimientosNormalizadosDeLote,
  stockLoteEnBodega,
  stockLoteEnLugar,
} from './stock'
import { escribirPar } from './traslado'

/**
 * Spec 033 — configuración de bodegas compartidas (research.md R5/R6,
 * data-model.md). Solo administración; escribe en Dexie y sube con el push de
 * lugares y mínimos de siempre (el servidor lo exige por RLS, FR-005).
 */

function exigirAdministrador(): void {
  if (useAuthStore.getState().usuario?.rol !== 'administrador') {
    throw new Error('Solo un administrador puede cambiar con quién comparte bodega un lugar.')
  }
}

/** Un insumo cuyo mínimo difiere entre las dos bodegas que se juntan (FR-006). */
export interface MinimoAUnificar {
  insumo: Insumo
  /** El mínimo de cada lado, en el orden (lugar, con quién se junta). */
  opciones: { rotulo: string; minimo: number | null }[]
  /** Por defecto, el mayor (aclaración de la spec). */
  porDefecto: number | null
}

export interface ResumenJuntar {
  rotuloLugar: string
  rotuloCon: string
  /** Insumos con stock en los dos lados, que pasan a un solo total (FR-004). */
  insumosConStockEnAmbos: number
  minimosDistintos: MinimoAUnificar[]
}

export interface DatosJuntar {
  insumos: Insumo[]
  lotes: Lote[]
  movimientos: Movimiento[]
  minimosLugar: MinimoLugar[]
  lugares: Lugar[]
}

function stockDeInsumo(
  insumoId: string,
  lotes: Lote[],
  movimientos: Movimiento[],
  lugarIds: ReadonlySet<string>,
): number {
  return lotes
    .filter((lote) => lote.insumoId === insumoId)
    .reduce((total, lote) => total + stockLoteEnBodega(movimientos, lote.id, lugarIds), 0)
}

function mayor(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}

/**
 * Spec 033 (FR-004, research.md R5): lo que va a pasar al juntar la bodega de
 * `lugarId` con la de `conLugarId`, calculado en memoria antes de confirmar.
 */
export function resumenDeJuntar(
  lugarId: string,
  conLugarId: string,
  { insumos, lotes, movimientos, minimosLugar, lugares }: DatosJuntar,
): ResumenJuntar {
  const grupoLugar = lugaresDeBodega(lugarId, lugares)
  const grupoCon = lugaresDeBodega(conLugarId, lugares)
  const rotuloLugar = rotuloBodega(grupoLugar, lugares)
  const rotuloCon = rotuloBodega(grupoCon, lugares)
  let insumosConStockEnAmbos = 0
  const minimosDistintos: MinimoAUnificar[] = []
  for (const insumo of insumos) {
    if (insumo.dadoDeBajaEn) continue
    if (
      stockDeInsumo(insumo.id, lotes, movimientos, grupoLugar) > 1e-9 &&
      stockDeInsumo(insumo.id, lotes, movimientos, grupoCon) > 1e-9
    ) {
      insumosConStockEnAmbos++
    }
    const minimoLugar = minimoEfectivoBodega(insumo, grupoLugar, minimosLugar)
    const minimoCon = minimoEfectivoBodega(insumo, grupoCon, minimosLugar)
    if (minimoLugar !== minimoCon) {
      minimosDistintos.push({
        insumo,
        opciones: [
          { rotulo: rotuloLugar, minimo: minimoLugar },
          { rotulo: rotuloCon, minimo: minimoCon },
        ],
        porDefecto: mayor(minimoLugar, minimoCon),
      })
    }
  }
  minimosDistintos.sort((a, b) => a.insumo.nombre.localeCompare(b.insumo.nombre, 'es'))
  return { rotuloLugar, rotuloCon, insumosConStockEnAmbos, minimosDistintos }
}

/**
 * Spec 033 (FR-002/FR-003/FR-006, research.md R5): junta la bodega de
 * `lugarId` con la de `conLugarId` en una transacción Dexie. Todos los lugares
 * de las dos quedan con el mismo `bodegaId` (el que ya tenga una de ellas, o un
 * uuid nuevo) y con el mínimo elegido de cada insumo en `minimosElegidos`. No
 * crea movimientos: el stock común es la suma de los de todos.
 */
export async function compartirBodega(
  lugarId: string,
  conLugarId: string,
  minimosElegidos: ReadonlyMap<string, number | null>,
): Promise<string> {
  exigirAdministrador()
  const tenantId = tenantActualOFallar()
  return db.transaction('rw', [db.lugares, db.minimosLugar], async () => {
    const lugares = await db.lugares.where('tenantId').equals(tenantId).toArray()
    const lugar = lugares.find((l) => l.id === lugarId)
    const con = lugares.find((l) => l.id === conLugarId)
    if (!lugar || lugar.desactivadoEn || !con || con.desactivadoEn) {
      throw new Error('Los dos lugares deben estar activos.')
    }
    const grupoLugar = lugaresDeBodega(lugarId, lugares)
    if (grupoLugar.has(conLugarId)) throw new Error('Esos lugares ya comparten bodega.')
    const grupoCon = lugaresDeBodega(conLugarId, lugares)

    const bodegaId = con.bodegaId ?? lugar.bodegaId ?? crypto.randomUUID()
    const todos = [...grupoLugar, ...grupoCon]
    for (const id of todos) {
      const actual = lugares.find((l) => l.id === id)
      if (actual && actual.bodegaId !== bodegaId) {
        await db.lugares.update(id, { bodegaId, sincronizado: false })
      }
    }
    const filas: MinimoLugar[] = []
    for (const [insumoId, stockMinimo] of minimosElegidos) {
      for (const id of todos) {
        filas.push({ insumoId, lugarId: id, tenantId, stockMinimo, sincronizado: false })
      }
    }
    if (filas.length > 0) await db.minimosLugar.bulkPut(filas)
    return bodegaId
  })
}

/** Tablas que toca `separarDeBodega`; quien la anide en su transacción debe incluirlas. */
export function tablasSeparar() {
  return [db.lugares, db.movimientos, db.lotes, db.insumos, db.cambiosInsumo]
}

/**
 * Spec 033 (US3, FR-007..FR-009, research.md R6, data-model § Movimientos al
 * separar): separa `lugarId` de su bodega compartida en una transacción Dexie.
 * Por cada lote con saldo propio ≠ 0 en el lugar (lo que suman **sus**
 * movimientos) escribe un traslado que lo lleva a 0, contra otro lugar activo
 * de la bodega: así el lugar separado empieza en 0 y la bodega conserva todo
 * el stock común, sin tocar movimientos anteriores. Luego deja `bodegaId =
 * null` en el lugar, y también en el último que quede solo. Conserva sus
 * mínimos, que ya son los de la bodega. Devuelve cuántos traslados escribió.
 */
export async function separarDeBodega(lugarId: string): Promise<number> {
  exigirAdministrador()
  const tenantId = tenantActualOFallar()
  return db.transaction('rw', tablasSeparar(), async () => {
    const lugares = await db.lugares.where('tenantId').equals(tenantId).toArray()
    const bodega = lugaresDeBodega(lugarId, lugares)
    if (bodega.size < 2) throw new Error('Ese lugar no comparte bodega.')
    const destino = lugaresActivos(lugares).find((l) => l.id !== lugarId && bodega.has(l.id))
    if (!destino) throw new Error('Ese lugar no comparte bodega.')

    const loteIds = await lotesConMovimientosEnLugar(lugarId)
    let traslados = 0
    for (const loteId of loteIds) {
      const saldo = stockLoteEnLugar(await movimientosNormalizadosDeLote(loteId), loteId, lugarId)
      if (Math.abs(saldo) <= 1e-9) continue
      await escribirPar(
        saldo > 0
          ? { loteId, origenId: lugarId, destinoId: destino.id, cantidad: saldo }
          : { loteId, origenId: destino.id, destinoId: lugarId, cantidad: -saldo },
      )
      traslados++
    }

    await db.lugares.update(lugarId, { bodegaId: null, sincronizado: false })
    const restantes = [...bodega].filter((id) => id !== lugarId)
    if (restantes.length === 1) {
      await db.lugares.update(restantes[0], { bodegaId: null, sincronizado: false })
    }
    return traslados
  })
}
