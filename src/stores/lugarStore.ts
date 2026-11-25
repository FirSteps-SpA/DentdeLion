import { create } from 'zustand'
import { liveQuery } from 'dexie'
import { db, type Lugar } from '../lib/db'

/**
 * Lugar de trabajo activo en este dispositivo (spec 014 FR-008/FR-009,
 * research.md R10). Los lugares del tenant del usuario con sesión vienen de
 * Dexie vía `liveQuery` (los trae el sync), y el elegido se recuerda en
 * `lugarActivo`. `'todos'` es la vista consolidada de solo lectura (US3).
 */
export type SeleccionLugar = string | 'todos'

interface LugarState {
  /** Todos los lugares del tenant, también los desactivados (Ajustes los muestra). */
  lugares: Lugar[]
  /** Lugar activo ya resuelto: siempre un lugar activo existente o `'todos'`; `null` sin lugares. */
  lugarActivoId: SeleccionLugar | null
  isReady: boolean
  subscribe: () => () => void
  setLugarActivo: (id: SeleccionLugar) => Promise<void>
}

/** Lugares activos, el más antiguo primero (el "lugar principal" del servidor). */
export function lugaresActivos(lugares: Lugar[]): Lugar[] {
  return lugares
    .filter((lugar) => !lugar.desactivadoEn)
    .sort(
      (a, b) =>
        a.creadoEn.localeCompare(b.creadoEn) || a.id.localeCompare(b.id),
    )
}

/**
 * El lugar guardado si sigue activo; si no, el principal (R10). `'todos'` solo
 * tiene sentido con 2 o más lugares activos.
 */
export function resolverLugarActivo(
  lugares: Lugar[],
  guardado: SeleccionLugar | undefined,
): SeleccionLugar | null {
  const activos = lugaresActivos(lugares)
  if (activos.length === 0) return null
  if (guardado === 'todos') return activos.length > 1 ? 'todos' : activos[0].id
  if (guardado && activos.some((lugar) => lugar.id === guardado)) return guardado
  return activos[0].id
}

export const useLugarStore = create<LugarState>((set) => ({
  lugares: [],
  lugarActivoId: null,
  isReady: false,
  subscribe: () => {
    const sub = liveQuery(async () => {
      const usuario = await db.usuarioActual.toCollection().first()
      if (!usuario) return { lugares: [] as Lugar[], guardado: undefined }
      const [lugares, guardado] = await Promise.all([
        db.lugares.where('tenantId').equals(usuario.tenantId).toArray(),
        db.lugarActivo.get('local'),
      ])
      return { lugares, guardado: guardado?.lugarId }
    }).subscribe({
      next: ({ lugares, guardado }) =>
        set({
          lugares,
          lugarActivoId: resolverLugarActivo(lugares, guardado),
          isReady: true,
        }),
    })
    return () => sub.unsubscribe()
  },
  setLugarActivo: async (id) => {
    set({ lugarActivoId: id })
    await db.lugarActivo.put({ id: 'local', lugarId: id })
  },
}))

export function hayVariosLugares(lugares: Lugar[]): boolean {
  return lugaresActivos(lugares).length > 1
}

/**
 * Lugar donde se registra una operación que modifica stock (FR-010): el
 * explícito si se pasa (p. ej. el elegido en "¿En qué lugar?" desde "Todos",
 * FR-014), si no el activo. `null` en "Todos" sin lugar elegido: la interfaz
 * tiene que pedir uno antes de escribir.
 */
export function getLugarParaEscribir(explicito?: string): string | null {
  if (explicito) return explicito
  const { lugarActivoId } = useLugarStore.getState()
  if (!lugarActivoId || lugarActivoId === 'todos') return null
  return lugarActivoId
}

/** Igual que `getLugarParaEscribir`, pero falla con un mensaje claro si no hay lugar. */
export function lugarParaEscribirOFallar(explicito?: string): string {
  const lugarId = getLugarParaEscribir(explicito)
  if (!lugarId) {
    throw new Error('Elige un lugar de trabajo antes de registrar el movimiento.')
  }
  return lugarId
}

/** Nombre de un lugar por id, para chips e historial. */
export function nombreLugar(lugares: Lugar[], id: string): string {
  return lugares.find((lugar) => lugar.id === id)?.nombre ?? 'Lugar'
}

/**
 * Spec 033 (data-model.md § Bodega): la bodega de un lugar es su `bodegaId`
 * o, si no comparte, su propio id.
 */
export function bodegaDe(lugar: Lugar): string {
  return lugar.bodegaId ?? lugar.id
}

const cacheBodegas = new WeakMap<Lugar[], Map<string, Set<string>>>()

/**
 * Spec 033: ids de los lugares **activos** que comparten bodega con `lugarId`
 * (incluido él). Un lugar sin bodega compartida, o que no está en `lugares`,
 * da solo su propio id: así toda la lógica por bodega es idéntica a la de un
 * lugar cuando nadie comparte (FR-019). Memoizado por arreglo de lugares.
 */
export function lugaresDeBodega(lugarId: string, lugares: Lugar[]): Set<string> {
  let porLugar = cacheBodegas.get(lugares)
  if (!porLugar) {
    porLugar = new Map()
    cacheBodegas.set(lugares, porLugar)
  }
  const enCache = porLugar.get(lugarId)
  if (enCache) return enCache
  const lugar = lugares.find((l) => l.id === lugarId)
  const conjunto = new Set<string>([lugarId])
  if (lugar && !lugar.desactivadoEn) {
    const bodega = bodegaDe(lugar)
    for (const otro of lugaresActivos(lugares)) {
      if (bodegaDe(otro) === bodega) conjunto.add(otro.id)
    }
  }
  porLugar.set(lugarId, conjunto)
  return conjunto
}

/** Spec 033: si el lugar comparte su stock con otro lugar activo. */
export function comparteBodega(lugarId: string, lugares: Lugar[]): boolean {
  return lugaresDeBodega(lugarId, lugares).size > 1
}

/**
 * Spec 033: las bodegas de los lugares activos, cada una con sus lugares en el
 * orden de `lugaresActivos`; las bodegas, en el orden de su primer lugar.
 */
export function bodegasActivas(lugares: Lugar[]): Lugar[][] {
  const grupos = new Map<string, Lugar[]>()
  for (const lugar of lugaresActivos(lugares)) {
    const bodega = bodegaDe(lugar)
    grupos.set(bodega, [...(grupos.get(bodega) ?? []), lugar])
  }
  return [...grupos.values()]
}

/** Spec 033: "Box 1 + Box 2", en el orden de `lugaresActivos`. */
export function rotuloBodega(lugarIds: Iterable<string>, lugares: Lugar[]): string {
  const ids = new Set(lugarIds)
  return lugaresActivos(lugares)
    .filter((lugar) => ids.has(lugar.id))
    .map((lugar) => lugar.nombre)
    .join(' + ')
}

/**
 * Spec 033: `lugaresDeBodega` con los lugares que tiene cargados la store, para
 * la lógica que no recibe la lista: validar contra el stock común una
 * operación registrada en `lugarId` (research.md R3) o escribir el mínimo en
 * toda la bodega (R4). Sin bodegas compartidas es `{lugarId}`.
 */
export function bodegaSegunStore(lugarId: string): Set<string> {
  return lugaresDeBodega(lugarId, useLugarStore.getState().lugares)
}

/**
 * Spec 033: el lugar que representa a la bodega de `lugarId`, el primero de
 * sus lugares en el orden de `lugaresActivos` (el mismo que encabeza su vista
 * en "Todos"). Sirve de clave estable para lo que es de la bodega, como un
 * sugerido de Compras. Sin bodega compartida es el propio lugar.
 */
export function representanteDeBodega(lugarId: string, lugares: Lugar[]): string {
  const bodega = lugaresDeBodega(lugarId, lugares)
  if (bodega.size === 1) return lugarId
  return lugaresActivos(lugares).find((lugar) => bodega.has(lugar.id))?.id ?? lugarId
}

/**
 * Spec 033: el nombre con que "Todos" muestra el lugar: el rótulo de su bodega
 * ("Box 1 + Box 2") si la comparte, o su nombre.
 */
export function nombreEnTodos(lugarId: string, lugares: Lugar[]): string {
  const bodega = lugaresDeBodega(lugarId, lugares)
  return bodega.size > 1 ? rotuloBodega(bodega, lugares) : nombreLugar(lugares, lugarId)
}

/**
 * Spec 033 (ui-contracts §2): cómo se lista un lugar en el selector, "Box 2 ·
 * bodega con Box 1" si comparte bodega. La pastilla del encabezado usa solo
 * el nombre.
 */
export function etiquetaEnSelector(lugar: Lugar, lugares: Lugar[]): string {
  const otros = [...lugaresDeBodega(lugar.id, lugares)].filter((id) => id !== lugar.id)
  return otros.length === 0
    ? lugar.nombre
    : `${lugar.nombre} · bodega con ${rotuloBodega(otros, lugares)}`
}
