import * as Sentry from '@sentry/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseStatus } from '../supabase'
import {
  db,
  type CambioInsumo,
  type Categoria,
  type ConfiguracionAlertas,
  type ConfiguracionClinica,
  type Insumo,
  type ItemCompra,
  type Lote,
  type Movimiento,
} from '../db'
import { fetchPerfilPropio } from '../supabase/perfiles'
import {
  filaParaSubir,
  reproyectarInsumos,
} from '../../features/insumos/lib/proyeccion'
import {
  SIN_CATEGORIA,
  catalogoCategorias,
  claveCategoria,
  resolverCategoria,
} from '../../features/insumos/lib/categorias'
import { useAuthStore } from '../../stores/authStore'
import { useAvisosStore } from '../../stores/avisosStore'
import { reconcileOverdraft } from './reconcileOverdraft'
import { reportarErrorSync } from './reportar'

interface InsumoRow {
  id: string
  nombre: string
  categoria: string
  unidad_medida: string
  permite_decimales: boolean
  caduca: boolean
  codigo_fabricante: string | null
  creado_en: string
  stock_minimo: number | null
  dado_de_baja_en?: string | null
  dado_de_baja_por?: string | null
  creado_por?: string | null
}

interface ConfiguracionAlertasRow {
  id: 'global'
  niveles_aviso_dias: number[]
}

interface LoteRow {
  id: string
  insumo_id: string
  numero_lote: string
  proveedor: string
  fecha_caducidad: string | null
  codigo_fabricante: string | null
  estado: 'activo' | 'revision'
  creado_en: string
}

interface CambioInsumoRow {
  id: string
  insumo_id: string
  campo: CambioInsumo['campo']
  valor_anterior: CambioInsumo['valorAnterior']
  valor_nuevo: CambioInsumo['valorNuevo']
  usuario_id: string
  creado_en: string
}

interface CategoriaRow {
  id: string
  nombre: string
  creado_por: string
  creado_en: string
  /** Feature 010 — `null` = activa. */
  desactivado_en?: string | null
}

function toCategoriaRow(categoria: Categoria): CategoriaRow {
  return {
    id: categoria.id,
    nombre: categoria.nombre,
    creado_por: categoria.creadoPor,
    creado_en: categoria.creadoEn,
    desactivado_en: categoria.desactivadoEn,
  }
}

function fromCategoriaRow(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    nombre: row.nombre,
    creadoPor: row.creado_por,
    creadoEn: row.creado_en,
    sincronizado: true,
    rechazadoEn: null,
    desactivadoEn: row.desactivado_en ?? null,
  }
}

interface ItemCompraRow {
  id: string
  nombre: string
  cantidad: number | null
  nota: string | null
  insumo_id: string | null
  estado: ItemCompra['estado']
  creado_por: string
  creado_en: string
  comprado_por: string | null
  comprado_en: string | null
}

function toItemCompraRow(item: ItemCompra): ItemCompraRow {
  return {
    id: item.id,
    nombre: item.nombre,
    cantidad: item.cantidad,
    nota: item.nota,
    insumo_id: item.insumoId,
    estado: item.estado,
    creado_por: item.creadoPor,
    creado_en: item.creadoEn,
    comprado_por: item.compradoPor,
    comprado_en: item.compradoEn,
  }
}

function fromItemCompraRow(row: ItemCompraRow): ItemCompra {
  return {
    id: row.id,
    nombre: row.nombre,
    cantidad: row.cantidad ?? null,
    nota: row.nota ?? null,
    insumoId: row.insumo_id ?? null,
    estado: row.estado,
    creadoPor: row.creado_por,
    creadoEn: row.creado_en,
    compradoPor: row.comprado_por ?? null,
    compradoEn: row.comprado_en ?? null,
  }
}

interface MovimientoRow {
  id: string
  tipo: Movimiento['tipo']
  lote_id: string
  cantidad: number
  usuario_id: string
  movimiento_origen_id: string | null
  creado_en: string
}

function toInsumoRow(insumo: Insumo): InsumoRow {
  return {
    id: insumo.id,
    nombre: insumo.nombre,
    categoria: insumo.categoria,
    unidad_medida: insumo.unidadMedida,
    permite_decimales: insumo.permiteDecimales,
    caduca: insumo.caduca,
    codigo_fabricante: insumo.codigoFabricante,
    creado_en: insumo.creadoEn,
    stock_minimo: insumo.stockMinimo,
    dado_de_baja_en: insumo.dadoDeBajaEn,
    dado_de_baja_por: insumo.dadoDeBajaPor,
    creado_por: insumo.creadoPor,
  }
}

function fromInsumoRow(row: InsumoRow): Insumo {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadMedida: row.unidad_medida,
    permiteDecimales: row.permite_decimales,
    caduca: row.caduca,
    codigoFabricante: row.codigo_fabricante,
    creadoEn: row.creado_en,
    stockMinimo: row.stock_minimo,
    dadoDeBajaEn: row.dado_de_baja_en ?? null,
    dadoDeBajaPor: row.dado_de_baja_por ?? null,
    creadoPor: row.creado_por ?? null,
  }
}

function toConfiguracionAlertasRow(
  config: ConfiguracionAlertas,
): ConfiguracionAlertasRow {
  return {
    id: config.id,
    niveles_aviso_dias: config.nivelesAvisoDias,
  }
}

function fromConfiguracionAlertasRow(
  row: ConfiguracionAlertasRow,
): ConfiguracionAlertas {
  return {
    id: row.id,
    nivelesAvisoDias: row.niveles_aviso_dias,
  }
}

interface ConfiguracionClinicaRow {
  id: 'global'
  nombre: string | null
}

function toConfiguracionClinicaRow(
  config: ConfiguracionClinica,
): ConfiguracionClinicaRow {
  return {
    id: config.id,
    nombre: config.nombre,
  }
}

function fromConfiguracionClinicaRow(
  row: ConfiguracionClinicaRow,
): ConfiguracionClinica {
  return {
    id: row.id,
    nombre: row.nombre ?? null,
  }
}

function toLoteRow(lote: Lote): LoteRow {
  return {
    id: lote.id,
    insumo_id: lote.insumoId,
    numero_lote: lote.numeroLote,
    proveedor: lote.proveedor,
    fecha_caducidad: lote.fechaCaducidad,
    codigo_fabricante: lote.codigoFabricante,
    estado: lote.estado,
    creado_en: lote.creadoEn,
  }
}

function fromLoteRow(row: LoteRow): Lote {
  return {
    id: row.id,
    insumoId: row.insumo_id,
    numeroLote: row.numero_lote,
    proveedor: row.proveedor,
    fechaCaducidad: row.fecha_caducidad,
    codigoFabricante: row.codigo_fabricante,
    estado: row.estado,
    creadoEn: row.creado_en,
  }
}

function toCambioInsumoRow(cambio: CambioInsumo): CambioInsumoRow {
  return {
    id: cambio.id,
    insumo_id: cambio.insumoId,
    campo: cambio.campo,
    valor_anterior: cambio.valorAnterior,
    valor_nuevo: cambio.valorNuevo,
    usuario_id: cambio.usuarioId,
    creado_en: cambio.creadoEn,
  }
}

function fromCambioInsumoRow(row: CambioInsumoRow): CambioInsumo {
  return {
    id: row.id,
    insumoId: row.insumo_id,
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNuevo: row.valor_nuevo,
    usuarioId: row.usuario_id,
    creadoEn: row.creado_en,
    sincronizado: true,
    rechazadoEn: null,
  }
}

function toMovimientoRow(movimiento: Movimiento): MovimientoRow {
  return {
    id: movimiento.id,
    tipo: movimiento.tipo,
    lote_id: movimiento.loteId,
    cantidad: movimiento.cantidad,
    usuario_id: movimiento.usuarioId,
    movimiento_origen_id: movimiento.movimientoOrigenId,
    creado_en: movimiento.creadoEn,
  }
}

function fromMovimientoRow(row: MovimientoRow): Movimiento {
  return {
    id: row.id,
    tipo: row.tipo,
    loteId: row.lote_id,
    cantidad: row.cantidad,
    usuarioId: row.usuario_id,
    movimientoOrigenId: row.movimiento_origen_id,
    creadoEn: row.creado_en,
    sincronizado: true,
  }
}

/**
 * Pushes every local insumo row with its not-yet-synced cambios undone
 * (`filaParaSubir`, feature 007): the remote row never runs ahead of
 * `cambios_insumo`, so a cambio the server later rejects (FR-021b) can't
 * leak to other devices through the RLS-less `insumos` table.
 */
async function pushInsumos(client: SupabaseClient): Promise<void> {
  const insumos = await db.insumos.toArray()
  if (insumos.length === 0) return
  const cambios = await db.cambiosInsumo.toArray()
  await client
    .from('insumos')
    .upsert(
      insumos.map((insumo) => toInsumoRow(filaParaSubir(insumo, cambios))),
    )
}

function esRechazoDePermisos(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false
  return (
    error.code === '42501' || /row-level security/i.test(error.message ?? '')
  )
}

/**
 * Pushes pending `cambiosInsumo` (feature 007, contracts/supabase-schema.md
 * step 2), marking rows synced only when the upsert succeeds. A batch failing
 * on RLS is retried row by row so a rejected cambio can't block valid ones;
 * each row rejected for lack of permissions is marked `rechazadoEn` (kept for
 * audit, never re-pushed). Any other error leaves everything pending for the
 * next cycle. Returns the cambios newly rejected in this cycle.
 */
async function pushCambiosInsumo(
  client: SupabaseClient,
): Promise<CambioInsumo[]> {
  const pendientes = (await db.cambiosInsumo.toArray()).filter(
    (cambio) => !cambio.sincronizado && cambio.rechazadoEn === null,
  )
  if (pendientes.length === 0) return []

  const { error } = await client
    .from('cambios_insumo')
    .upsert(pendientes.map(toCambioInsumoRow))
  if (!error) {
    await db.cambiosInsumo.bulkUpdate(
      pendientes.map((cambio) => ({
        key: cambio.id,
        changes: { sincronizado: true },
      })),
    )
    return []
  }
  if (!esRechazoDePermisos(error)) {
    reportarErrorSync('push cambios_insumo', error)
    return []
  }

  const rechazados: CambioInsumo[] = []
  for (const cambio of pendientes) {
    const { error: errorFila } = await client
      .from('cambios_insumo')
      .upsert(toCambioInsumoRow(cambio))
    if (!errorFila) {
      await db.cambiosInsumo.update(cambio.id, { sincronizado: true })
    } else if (esRechazoDePermisos(errorFila)) {
      await db.cambiosInsumo.update(cambio.id, {
        rechazadoEn: new Date().toISOString(),
      })
      rechazados.push(cambio)
    }
  }
  return rechazados
}

async function pullCambiosInsumo(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.from('cambios_insumo').select('*')
  reportarErrorSync('pull cambios_insumo', error)
  if (error || !data) return
  await db.cambiosInsumo.bulkPut(
    (data as CambioInsumoRow[]).map(fromCambioInsumoRow),
  )
}

/**
 * After a permissions rejection (FR-021b): tell the user once per affected
 * insumo and refresh their cached role, so "Editar"/"Eliminar" disappear.
 */
async function notificarRechazos(
  client: SupabaseClient,
  rechazados: CambioInsumo[],
): Promise<void> {
  const insumoIds = [...new Set(rechazados.map((cambio) => cambio.insumoId))]
  for (const insumoId of insumoIds) {
    const insumo = await db.insumos.get(insumoId)
    useAvisosStore.getState().agregar({
      tipo: 'cambio-rechazado',
      movimientoId: null,
      loteId: null,
      insumoNombre: insumo?.nombre ?? 'un insumo',
      unidadMedida: null,
    })
  }

  const usuario = useAuthStore.getState().usuario
  if (!usuario) return
  const perfil = await fetchPerfilPropio(client, usuario.id)
  if (perfil) await useAuthStore.getState().actualizarRol(perfil.rol)
}

/**
 * Pushes unsynced, non-rejected `categorias` (spec 008 contracts/supabase-schema.md
 * step 0): marks synced only without error. A batch rejected on RLS is
 * retried row by row so one admin-demoted category can't block a sibling's
 * sync; each row rejected for lack of permissions is marked `rechazadoEn`
 * (kept for audit, never re-pushed). Returns the rows newly rejected.
 */
async function pushCategorias(client: SupabaseClient): Promise<Categoria[]> {
  const pendientes = (await db.categorias.toArray()).filter(
    (categoria) => !categoria.sincronizado && categoria.rechazadoEn === null,
  )
  if (pendientes.length === 0) return []

  const { error } = await client
    .from('categorias')
    .upsert(pendientes.map(toCategoriaRow))
  if (!error) {
    await db.categorias.bulkUpdate(
      pendientes.map((categoria) => ({
        key: categoria.id,
        changes: { sincronizado: true },
      })),
    )
    return []
  }
  if (!esRechazoDePermisos(error)) {
    reportarErrorSync('push categorias', error)
    return []
  }

  const rechazadas: Categoria[] = []
  for (const categoria of pendientes) {
    const { error: errorFila } = await client
      .from('categorias')
      .upsert(toCategoriaRow(categoria))
    if (!errorFila) {
      await db.categorias.update(categoria.id, { sincronizado: true })
    } else if (esRechazoDePermisos(errorFila)) {
      await db.categorias.update(categoria.id, {
        rechazadoEn: new Date().toISOString(),
      })
      rechazadas.push(categoria)
    }
  }
  return rechazadas
}

/**
 * After a category push rejection (research.md R4): every local insumo
 * whose `claveCategoria` matches a rejected row moves to "Sin categoría",
 * unless a *formal* surviving source (a precargada or a sibling
 * non-rejected `Categoria` row) still backs that clave. Free text on
 * insumos is deliberately excluded from that check: every insumo being
 * evaluated already holds the rejected name as plain text, so including
 * texto-libre here would make the clave "resolve" via the very rows being
 * moved and never actually move anything. Runs in one transaction, before
 * `pushInsumos`, so the remote row converges instead of leaking the
 * rejected name to other devices.
 */
async function moverASinCategoria(rechazadas: Categoria[]): Promise<void> {
  if (rechazadas.length === 0) return
  await db.transaction('rw', db.insumos, db.categorias, async () => {
    const clavesRechazadas = new Set(
      rechazadas.map((categoria) => claveCategoria(categoria.nombre)),
    )
    const idsRechazadas = new Set(rechazadas.map((categoria) => categoria.id))
    const todosInsumos = await db.insumos.toArray()
    const todasCategorias = await db.categorias.toArray()
    const catalogoSinRechazadas = catalogoCategorias(
      todasCategorias.filter((categoria) => !idsRechazadas.has(categoria.id)),
      [],
    )

    for (const insumo of todosInsumos) {
      if (!clavesRechazadas.has(claveCategoria(insumo.categoria))) continue
      if (resolverCategoria(insumo.categoria, catalogoSinRechazadas) !== null)
        continue
      await db.insumos.update(insumo.id, { categoria: SIN_CATEGORIA })
    }
  })
}

/** One `categoria-rechazada` aviso per category, and a role refresh (mirrors `notificarRechazos`). */
async function notificarRechazoCategorias(
  client: SupabaseClient,
  rechazadas: Categoria[],
): Promise<void> {
  for (const categoria of rechazadas) {
    useAvisosStore.getState().agregar({
      tipo: 'categoria-rechazada',
      movimientoId: null,
      loteId: null,
      insumoNombre: categoria.nombre,
      unidadMedida: null,
    })
  }

  const usuario = useAuthStore.getState().usuario
  if (!usuario) return
  const perfil = await fetchPerfilPropio(client, usuario.id)
  if (perfil) await useAuthStore.getState().actualizarRol(perfil.rol)
}

/**
 * Pulls remote `categorias`, skipping ids the client already marked
 * `rechazadoEn` locally — a resurrected pull must never un-reject a row
 * `moverASinCategoria` already acted on.
 */
async function pullCategorias(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.from('categorias').select('*')
  reportarErrorSync('pull categorias', error)
  if (error || !data) return
  const rechazadasLocalmente = new Set(
    (await db.categorias.toArray())
      .filter((categoria) => categoria.rechazadoEn !== null)
      .map((categoria) => categoria.id),
  )
  const filas = (data as CategoriaRow[])
    .filter((row) => !rechazadasLocalmente.has(row.id))
    .map(fromCategoriaRow)
  await db.categorias.bulkPut(filas)
}

async function pushLotes(client: SupabaseClient): Promise<void> {
  const lotes = await db.lotes.toArray()
  if (lotes.length === 0) return
  await client.from('lotes').upsert(lotes.map(toLoteRow))
}

/**
 * Sube todas las filas locales de `itemsCompra` cada ciclo (research.md R2):
 * a diferencia de `categorias`/`cambios_insumo`, ninguna escritura puede ser
 * rechazada por rol (spec Clarifications: abierto a todo autenticado), así
 * que no hace falta una bandera `sincronizado` ni reintento por fila — mismo
 * patrón simple que `pushLotes`.
 */
async function pushItemsCompra(client: SupabaseClient): Promise<void> {
  const items = await db.itemsCompra.toArray()
  if (items.length === 0) return
  await client.from('items_compra').upsert(items.map(toItemCompraRow))
}

/**
 * Pushes the current user's unsynced movimientos and returns the loteIds of
 * any `consumo` rows actually pushed. Only rows the server accepted are marked
 * `sincronizado`: supabase-js returns `{ error }` instead of throwing (offline,
 * 5xx, RLS), and marking a failed batch as synced lost those movimientos for
 * good. `ignoreDuplicates` (ON CONFLICT DO NOTHING) because `movimientos` is
 * insert-only (no UPDATE policy): re-sending a row that already reached the
 * server must not fail the whole batch. Rows of other users on a shared device
 * stay pending until their owner signs in (RLS: `usuario_id = auth.uid()`).
 */
async function pushMovimientos(client: SupabaseClient): Promise<string[]> {
  const usuarioId = useAuthStore.getState().usuario?.id
  if (!usuarioId) return []
  const pendientes = (await db.movimientos.toArray()).filter(
    (movimiento) => !movimiento.sincronizado && movimiento.usuarioId === usuarioId,
  )
  if (pendientes.length === 0) return []

  const subir = (filas: Movimiento[]) =>
    client
      .from('movimientos')
      .upsert(filas.map(toMovimientoRow), { onConflict: 'id', ignoreDuplicates: true })

  let subidos = pendientes
  const { error } = await subir(pendientes)
  if (error) {
    reportarErrorSync('push movimientos', error)
    if (!esRechazoDePermisos(error)) return []
    // Un rechazo de permisos no debe bloquear las filas válidas: fila por fila.
    subidos = []
    for (const movimiento of pendientes) {
      const { error: errorFila } = await subir([movimiento])
      if (errorFila) reportarErrorSync('push movimiento (fila)', errorFila)
      else subidos.push(movimiento)
    }
  }

  await db.movimientos.bulkUpdate(
    subidos.map((movimiento) => ({
      key: movimiento.id,
      changes: { sincronizado: true },
    })),
  )
  return subidos
    .filter((movimiento) => movimiento.tipo === 'consumo')
    .map((movimiento) => movimiento.loteId)
}

/** Pushes the local global config row, if one has ever been saved (feature 004, FR-005). */
async function pushConfiguracionAlertas(client: SupabaseClient): Promise<void> {
  const config = await db.configuracionAlertas.get('global')
  if (!config) return
  await client
    .from('configuracion_alertas')
    .upsert(toConfiguracionAlertasRow(config))
}

/** Pushes the local clinic-name row, if an administrador has ever saved one (spec 010 FR-020). */
async function pushConfiguracionClinica(client: SupabaseClient): Promise<void> {
  const config = await db.configuracionClinica.get('global')
  if (!config) return
  await client
    .from('configuracion_clinica')
    .upsert(toConfiguracionClinicaRow(config))
}

async function pullInsumos(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.from('insumos').select('*')
  reportarErrorSync('pull insumos', error)
  if (error || !data) return
  await db.insumos.bulkPut((data as InsumoRow[]).map(fromInsumoRow))
}

async function pullLotes(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.from('lotes').select('*')
  reportarErrorSync('pull lotes', error)
  if (error || !data) return
  await db.lotes.bulkPut((data as LoteRow[]).map(fromLoteRow))
}

async function pullItemsCompra(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.from('items_compra').select('*')
  reportarErrorSync('pull items_compra', error)
  if (error || !data) return
  await db.itemsCompra.bulkPut((data as ItemCompraRow[]).map(fromItemCompraRow))
}

/** Pulls the remote global config row, if one has ever been saved (feature 004, FR-005). */
async function pullConfiguracionAlertas(client: SupabaseClient): Promise<void> {
  const { data, error } = await client
    .from('configuracion_alertas')
    .select('*')
    .eq('id', 'global')
    .maybeSingle()
  reportarErrorSync('pull configuracion_alertas', error)
  if (error || !data) return
  await db.configuracionAlertas.put(
    fromConfiguracionAlertasRow(data as ConfiguracionAlertasRow),
  )
}

/** Pulls the remote clinic-name row, if one has ever been saved (spec 010 FR-020). */
async function pullConfiguracionClinica(client: SupabaseClient): Promise<void> {
  const { data, error } = await client
    .from('configuracion_clinica')
    .select('*')
    .eq('id', 'global')
    .maybeSingle()
  reportarErrorSync('pull configuracion_clinica', error)
  if (error || !data) return
  await db.configuracionClinica.put(
    fromConfiguracionClinicaRow(data as ConfiguracionClinicaRow),
  )
}

/** Pulls remote movimientos and returns the loteIds of any `consumo` rows pulled. */
async function pullMovimientos(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('movimientos').select('*')
  reportarErrorSync('pull movimientos', error)
  if (error || !data) return []
  const rows = data as MovimientoRow[]
  await db.movimientos.bulkPut(rows.map(fromMovimientoRow))
  return rows.filter((row) => row.tipo === 'consumo').map((row) => row.lote_id)
}

/**
 * One push+pull sync cycle (contracts/supabase-schema.md's sync contract):
 * push unsynced local movimientos and the current insumos/lotes (idempotent
 * upserts), pull remote changes by id, then reconcile every lot touched by a
 * `consumo` movement in this batch (FR-012, FR-014). Never throws — a
 * missing/unreachable backend simply skips the cycle (Constitution I).
 *
 * Order for the catalog (spec 008 contracts/supabase-schema.md, extending
 * spec 007's): categorias first — a rejection there moves local insumos to
 * "Sin categoría" *before* they're pushed, so the remote row converges in
 * the same cycle — then insumos (so `cambios_insumo.insumo_id`'s FK is
 * satisfied) → cambios → pull cambios → pull insumos → pull categorias →
 * one reprojection from the ledger, which resolves concurrent edits per
 * field on every device identically.
 */
export async function runSyncBatch(): Promise<void> {
  const { client, error } = getSupabaseStatus()
  if (error) return

  const loteIdsTocados = new Set<string>()

  const rechazadasCategorias = await pushCategorias(client)
  await moverASinCategoria(rechazadasCategorias)

  await pushInsumos(client)
  const rechazados = await pushCambiosInsumo(client)
  await pullCambiosInsumo(client)
  await pullInsumos(client)
  await pullCategorias(client)
  await reproyectarInsumos()
  if (rechazados.length > 0) await notificarRechazos(client, rechazados)
  if (rechazadasCategorias.length > 0) {
    await notificarRechazoCategorias(client, rechazadasCategorias)
  }

  await pushLotes(client)
  await pushItemsCompra(client)
  await pushConfiguracionAlertas(client)
  await pushConfiguracionClinica(client)
  for (const loteId of await pushMovimientos(client)) {
    loteIdsTocados.add(loteId)
  }

  await pullLotes(client)
  await pullItemsCompra(client)
  await pullConfiguracionAlertas(client)
  await pullConfiguracionClinica(client)
  for (const loteId of await pullMovimientos(client)) {
    loteIdsTocados.add(loteId)
  }

  for (const loteId of loteIdsTocados) {
    await reconcileOverdraft(loteId)
  }
}

/**
 * Starts the background sync loop (Constitution I: incremental, resilient,
 * never blocking the UI). Returns a stop function to clear the interval.
 */
export function startBackgroundSync(intervalMs = 30_000): () => void {
  const tick = () => {
    void runSyncBatch().catch((err: unknown) => {
      console.error('[inDENTory] Error de sincronización:', err)
      Sentry.captureException(err, { tags: { etapa: 'ciclo de sync' } })
    })
  }
  tick()
  const id = setInterval(tick, intervalMs)
  return () => clearInterval(id)
}
