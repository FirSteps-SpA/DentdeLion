import Dexie, { type EntityTable, type Table } from 'dexie'
import type { AltaMaterialInput } from '../../features/insumos/lib/alta'
import { LUGAR_1, TENANT_1 } from '../tenancy/constantes'

export { LUGAR_1, TENANT_1 }

/**
 * The locally-cached authenticated identity that gates offline app access
 * (spec 003 FR-002/FR-006; data-model.md). `id` is the Supabase Auth user id
 * (`auth.users.id`) — the same id feature 002's `Movimiento.usuarioId`
 * references. At most one row exists at a time (single active local user per
 * device): the store clears the table before writing a new row on login.
 */
export interface UsuarioActual {
  id: string
  email: string
  nombre: string
  rol: 'administrador' | 'personal'
  autenticadoEn: string
  /** Spec 014 FR-001 — tenant del usuario; filtra todo lo que se lee de Dexie. */
  tenantId: string
  /**
   * Spec 014 FR-021 — fecha en que una administradora lo desactivó, o `null`.
   * Con fecha, la app muestra "acceso desactivado" en vez del inventario.
   */
  desactivadoEn: string | null
}

/** Feature 002 data-model.md — Insumo. */
export interface Insumo {
  id: string
  /** Spec 014 — catálogo compartido por los lugares del tenant. */
  tenantId: string
  nombre: string
  categoria: string
  unidadMedida: string
  permiteDecimales: boolean
  /** Whether this type of supply expires at all (FR-002b) — false for e.g. reusable instruments. */
  caduca: boolean
  codigoFabricante: string | null
  creadoEn: string
  /** Feature 004 (FR-001) — optional; `null`/unset never generates a stock-bajo alert (FR-004). */
  stockMinimo: number | null
  /**
   * Feature 007 (FR-018) — baja lógica. `null` = activo. Projected from the
   * earliest `CambioInsumo` with `campo: 'baja'` (data-model.md), never
   * written directly.
   */
  dadoDeBajaEn: string | null
  dadoDeBajaPor: string | null
  /** Feature 008 (R10) — autor del alta; `null` en insumos anteriores a esta spec. */
  creadoPor: string | null
}

/** Campos de `Insumo` que un administrador puede editar (feature 007 FR-013). */
export type CampoEditableInsumo =
  | 'nombre'
  | 'categoria'
  | 'unidadMedida'
  | 'stockMinimo'
  | 'codigoFabricante'
  | 'caduca'

/**
 * Feature 007 data-model.md — CambioInsumo. Append-only per-field ledger:
 * one row per field changed by an edit (or one `'baja'` row), so concurrent
 * edits resolve per field (FR-021a) and every overwritten value stays
 * auditable. The `Insumo` row is a projection of this ledger
 * (`proyectarInsumo`). Only the local `sincronizado`/`rechazadoEn` flags are
 * ever updated after creation.
 */
export interface CambioInsumo {
  id: string
  tenantId: string
  insumoId: string
  campo: CampoEditableInsumo | 'baja'
  valorAnterior: string | number | boolean | null
  valorNuevo: string | number | boolean | null
  usuarioId: string
  creadoEn: string
  sincronizado: boolean
  /** Local-only: set when the server rejected it for lack of permissions (FR-021b). */
  rechazadoEn: string | null
}

/** Feature 002 data-model.md — Lote. */
export interface Lote {
  id: string
  tenantId: string
  /**
   * Spec 014 (research.md R3) — lugar de alta. El stock por lugar sale de los
   * movimientos (`Movimiento.lugarId`), así el lote conserva su identidad al
   * trasladarse.
   */
  lugarId: string
  insumoId: string
  numeroLote: string
  proveedor: string
  /** `null` only when the parent Insumo has `caduca: false` (FR-002b) — never a sentinel date. */
  fechaCaducidad: string | null
  codigoFabricante: string | null
  estado: 'activo' | 'revision'
  creadoEn: string
}

/** Feature 002 data-model.md — Movimiento (append-only ledger entry). */
export interface Movimiento {
  id: string
  tenantId: string
  /** Spec 014 FR-010 — lugar activo al registrarlo, aunque se suba después. */
  lugarId: string
  tipo:
    | 'ingreso'
    | 'consumo'
    | 'ajuste'
    | 'traslado_salida'
    | 'traslado_entrada'
  /** Spec 014 (research.md R4) — une la salida y la entrada de un traslado. */
  trasladoId: string | null
  loteId: string
  cantidad: number
  usuarioId: string
  movimientoOrigenId: string | null
  creadoEn: string
  sincronizado: boolean
}

/**
 * Feature 004 data-model.md — ConfiguracionAlertas. Single global row (fixed
 * id `'global'`) holding the caducidad warning day-levels (FR-005) — never
 * per-insumo (spec Clarifications). Absence of a row means the in-code
 * default `[30, 7, 1]` applies (data-model.md's Bootstrapping).
 */
export interface ConfiguracionAlertas {
  id: 'global'
  /** Spec 014 (R7) — una fila por tenant en el servidor; localmente sigue siendo `'global'`. */
  tenantId: string
  nivelesAvisoDias: number[]
  /**
   * Spec 012 FR-011 — horas tras las que un cambio sin subir se avisa como
   * antiguo. Ausente = `HORAS_AVISO_PENDIENTES_POR_DEFECTO` (24); nunca se
   * rellena al subir, para no pisar el valor del servidor (research.md R6).
   */
  horasAvisoPendientes?: number
  /** Spec 012 (research.md R5) — local: `false` = cambio de un administrador aún sin subir. */
  sincronizado: boolean
}

/**
 * Feature 008 data-model.md — Categoria. Solo las categorías creadas por
 * administradores; las precargadas y "Sin categoría" son constantes de
 * código (`categorias.ts`), no filas.
 */
export interface Categoria {
  id: string
  tenantId: string
  nombre: string
  creadoPor: string
  creadoEn: string
  sincronizado: boolean
  /** Local-only: set when the server rejected it for lack of permissions (R4). */
  rechazadoEn: string | null
  /** Feature 010 (FR-017/018) — `null` = activa; con fecha = oculta del selector, reversible. */
  desactivadoEn: string | null
}

/**
 * Feature 008 data-model.md — Borrador. Fila única (`id` fija) del
 * formulario "Nuevo Material" en curso, nunca sincronizada (R6).
 */
export interface Borrador {
  id: 'alta-material'
  datos: Partial<AltaMaterialInput>
  actualizadoEn: string
}

/**
 * Feature 009 data-model.md — ItemCompra. Un pedido puntual agregado a mano
 * a la lista de compras. Nunca se borra físicamente (research.md R1): pasa
 * por `estado: 'pendiente' -> 'comprado' | 'eliminado'`. Se sincroniza sin
 * bandera `sincronizado` (research.md R2) — mismo patrón que `Lote`.
 */
export interface ItemCompra {
  id: string
  tenantId: string
  /** Spec 014 FR-006 — la lista de compras es por lugar. */
  lugarId: string
  nombre: string
  cantidad: number | null
  nota: string | null
  /** Vínculo opcional a `Insumo.id` (FR-016); no se limpia por escritura si
   *  ese insumo se da de baja (research.md R8) — se resuelve en memoria. */
  insumoId: string | null
  estado: 'pendiente' | 'comprado' | 'eliminado'
  creadoPor: string
  creadoEn: string
  compradoPor: string | null
  compradoEn: string | null
}

/**
 * Feature 010 data-model.md — ConfiguracionClinica. Single global row (fixed
 * id `'global'`) holding the configurable clinic/gabinete name. `null`
 * (never configured, or the last save was rejected) means the header falls
 * back to the default label "Gabinete" — never a sentinel string.
 */
export interface ConfiguracionClinica {
  id: 'global'
  nombre: string | null
  /** Spec 012 (research.md R5) — local: `false` = cambio de un administrador aún sin subir. */
  sincronizado: boolean
}

/**
 * Feature 010 data-model.md — PreferenciaNotificaciones. Single row, local
 * to this device only (FR-027): never synced to Supabase, no `sincronizado`
 * flag needed. Absence of a row means both types default to `true`
 * (data-model.md's Bootstrapping).
 */
export interface PreferenciaNotificaciones {
  id: 'local'
  stockBajo: boolean
  caducidad: boolean
}

/**
 * Spec 012 data-model.md — UsuarioConocido. Quién inició sesión alguna vez en
 * este dispositivo, solo para nombrar a los dueños de pendientes ajenos
 * (FR-012): `perfiles` no deja leer nombres de otros (research.md R7). Local,
 * nunca sincronizada; `logout` no la borra.
 */
export interface UsuarioConocido {
  id: string
  nombre: string
  vistoEn: string
}

/**
 * Spec 012 data-model.md — EstadoSync. Fila única, local al dispositivo: hora
 * del último ciclo de sincronización sin errores (FR-006). Ausente o `null` =
 * "Nunca sincronizado".
 */
export interface EstadoSync {
  id: 'local'
  ultimaExitosaEn: string | null
}

/**
 * Spec 014 data-model.md — Lugar de trabajo de un tenant. Sincronizado; lo
 * crean y editan solo administradores (`sincronizado: false` = cambio local
 * aún sin subir).
 */
export interface Lugar {
  id: string
  tenantId: string
  nombre: string
  desactivadoEn: string | null
  creadoEn: string
  sincronizado: boolean
}

/**
 * Spec 014 FR-007 — mínimo de un insumo en un lugar. `stockMinimo: null` =
 * usar el del catálogo (`Insumo.stockMinimo`).
 */
export interface MinimoLugar {
  insumoId: string
  lugarId: string
  tenantId: string
  stockMinimo: number | null
  sincronizado: boolean
}

/** Spec 014 (research.md R10) — lugar elegido en este dispositivo. Local. */
export interface LugarActivo {
  id: 'local'
  lugarId: string | 'todos'
}

/**
 * IndexedDB client (Constitution I: local-first primary write, Principle IV:
 * batch/expiry/stock queries). Future inventory features add their own
 * domain tables here via `db.version(n).stores({...})`.
 */
export const db = new Dexie('inDENToryDB') as Dexie & {
  usuarioActual: EntityTable<UsuarioActual, 'id'>
  insumos: EntityTable<Insumo, 'id'>
  lotes: EntityTable<Lote, 'id'>
  movimientos: EntityTable<Movimiento, 'id'>
  configuracionAlertas: EntityTable<ConfiguracionAlertas, 'id'>
  cambiosInsumo: EntityTable<CambioInsumo, 'id'>
  categorias: EntityTable<Categoria, 'id'>
  borradores: EntityTable<Borrador, 'id'>
  itemsCompra: EntityTable<ItemCompra, 'id'>
  configuracionClinica: EntityTable<ConfiguracionClinica, 'id'>
  preferenciasNotificaciones: EntityTable<PreferenciaNotificaciones, 'id'>
  usuariosConocidos: EntityTable<UsuarioConocido, 'id'>
  estadoSync: EntityTable<EstadoSync, 'id'>
  lugares: EntityTable<Lugar, 'id'>
  minimosLugar: Table<MinimoLugar, [string, string]>
  lugarActivo: EntityTable<LugarActivo, 'id'>
}

db.version(1).stores({
  usuarioActual: 'id',
})

// version(2): feature 002 (data-model.md) — version(1) is already claimed by
// 003-login-personal-clinico's usuarioActual table, carried forward unchanged.
db.version(2).stores({
  insumos: 'id, nombre, categoria, codigoFabricante',
  lotes: 'id, insumoId, fechaCaducidad, codigoFabricante, estado',
  movimientos: 'id, loteId, tipo, usuarioId, creadoEn, sincronizado',
})

// version(3): feature 004 (data-model.md) — insumos/lotes/movimientos carried
// forward unchanged; `Insumo.stockMinimo` needs no new index (nothing queries
// by it, data-model.md).
db.version(3).stores({
  configuracionAlertas: 'id',
})

// version(4): feature 007 (data-model.md) — new append-only `cambiosInsumo`
// ledger; existing insumos get the baja fields as `null` (activo). No new
// index on insumos: the activos filter runs in memory (≤300 rows).
db.version(4)
  .stores({
    cambiosInsumo: 'id, insumoId, campo, creadoEn, sincronizado',
  })
  .upgrade((tx) =>
    tx
      .table('insumos')
      .toCollection()
      .modify((insumo: Partial<Insumo>) => {
        insumo.dadoDeBajaEn ??= null
        insumo.dadoDeBajaPor ??= null
      }),
  )

// version(5): feature 008 (data-model.md) — new `categorias` (synced) and
// `borradores` (local-only) tables; existing insumos get `creadoPor: null`
// (author unknown for pre-008 rows).
db.version(5)
  .stores({
    categorias: 'id, creadoEn, sincronizado',
    borradores: 'id',
  })
  .upgrade((tx) =>
    tx
      .table('insumos')
      .toCollection()
      .modify((insumo: Partial<Insumo>) => {
        insumo.creadoPor ??= null
      }),
  )

// version(6): feature 009 (data-model.md) — new `itemsCompra` table, never
// synced via a `sincronizado` flag (research.md R2, same pattern as
// `lotes`). No existing table changes shape, so no `.upgrade()`.
db.version(6).stores({
  itemsCompra: 'id, insumoId, estado, creadoEn',
})

// version(7): feature 010 (data-model.md) — new `configuracionClinica`
// (synced, single global row) and `preferenciasNotificaciones` (local-only,
// never synced) tables; existing `categorias` rows get `desactivadoEn: null`
// (activas). `categorias` keeps its index string unchanged — `desactivadoEn`
// is filtered in memory, same criterion as the rest of the catalog.
db.version(7)
  .stores({
    configuracionClinica: 'id',
    preferenciasNotificaciones: 'id',
  })
  .upgrade((tx) =>
    tx
      .table('categorias')
      .toCollection()
      .modify((categoria: Partial<Categoria>) => {
        categoria.desactivadoEn ??= null
      }),
  )

// Version 8 (fix sync de movimientos): hasta esta versión `pushMovimientos`
// marcaba un lote como `sincronizado` aunque el upsert fallara (sin red, 5xx,
// RLS), y esos movimientos no se reintentaban nunca. Reabre todos para un único
// reenvío: el push usa ON CONFLICT DO NOTHING, así que los que ya están en el
// servidor se ignoran y solo se recuperan los perdidos. Sin cambios de forma.
db.version(8)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('movimientos')
      .toCollection()
      .modify((movimiento: Partial<Movimiento>) => {
        movimiento.sincronizado = false
      }),
  )

// Version 9 (spec 012, data-model.md): tablas locales `usuariosConocidos` y
// `estadoSync`, nunca sincronizadas. Las filas de configuración global ganan la
// bandera local `sincronizado` (research.md R5): las existentes ya vinieron del
// servidor o ya se subieron, así que arrancan en `true`.
db.version(9)
  .stores({
    usuariosConocidos: 'id',
    estadoSync: 'id',
  })
  .upgrade(async (tx) => {
    await tx
      .table('configuracionAlertas')
      .toCollection()
      .modify((config: Partial<ConfiguracionAlertas>) => {
        config.sincronizado ??= true
      })
    await tx
      .table('configuracionClinica')
      .toCollection()
      .modify((config: Partial<ConfiguracionClinica>) => {
        config.sincronizado ??= true
      })
  })

// Version 10 (spec 014, data-model.md / research.md R8): datos por tenant y
// por lugar. Todas las filas existentes son de la clínica original, así que
// reciben `TENANT_1` y, donde corresponde, `LUGAR_1` — los mismos UUID que
// siembra la migración del servidor, para que los pendientes de la 2.2.0
// suban al lugar 1 (FR-018). `sincronizado` no se toca. El lugar 1 se crea
// localmente con el nombre de la clínica para que el selector no arranque
// vacío sin red.
db.version(10)
  .stores({
    insumos: 'id, nombre, categoria, codigoFabricante, tenantId',
    lotes: 'id, insumoId, fechaCaducidad, codigoFabricante, estado, tenantId, lugarId',
    movimientos:
      'id, loteId, tipo, usuarioId, creadoEn, sincronizado, tenantId, lugarId, trasladoId',
    cambiosInsumo: 'id, insumoId, campo, creadoEn, sincronizado, tenantId',
    categorias: 'id, creadoEn, sincronizado, tenantId',
    itemsCompra: 'id, insumoId, estado, creadoEn, tenantId, lugarId',
    lugares: 'id, tenantId',
    minimosLugar: '[insumoId+lugarId], tenantId, lugarId',
    lugarActivo: 'id',
  })
  .upgrade(async (tx) => {
    const delTenant1 = (fila: { tenantId?: string }) => {
      fila.tenantId ??= TENANT_1
    }
    const delLugar1 = (fila: { tenantId?: string; lugarId?: string }) => {
      fila.tenantId ??= TENANT_1
      fila.lugarId ??= LUGAR_1
    }
    for (const tabla of [
      'insumos',
      'cambiosInsumo',
      'categorias',
      'configuracionAlertas',
      'configuracionClinica',
      'usuarioActual',
    ]) {
      await tx.table(tabla).toCollection().modify(delTenant1)
    }
    for (const tabla of ['lotes', 'itemsCompra']) {
      await tx.table(tabla).toCollection().modify(delLugar1)
    }
    await tx
      .table('movimientos')
      .toCollection()
      .modify((movimiento: Partial<Movimiento>) => {
        delLugar1(movimiento)
        movimiento.trasladoId ??= null
      })
    await tx
      .table('usuarioActual')
      .toCollection()
      .modify((usuario: Partial<UsuarioActual>) => {
        usuario.desactivadoEn ??= null
      })
    const clinica = (await tx.table('configuracionClinica').get('global')) as
      | ConfiguracionClinica
      | undefined
    await tx.table('lugares').put({
      id: LUGAR_1,
      tenantId: TENANT_1,
      nombre: clinica?.nombre?.trim() || 'Clínica',
      desactivadoEn: null,
      creadoEn: '2026-01-01T00:00:00.000Z',
      sincronizado: true,
    } satisfies Lugar)
  })

export type { EntityTable }
