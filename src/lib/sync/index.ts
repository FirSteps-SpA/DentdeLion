import * as Sentry from '@sentry/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseStatus } from '../supabase'
import { seleccionarTodo } from './paginar'
import {
  db,
  type CambioInsumo,
  type CambioLote,
  type CambioTratamiento,
  type TratamientoRealizado,
  type Categoria,
  type ConfiguracionAlertas,
  type Insumo,
  type ItemCompra,
  type Lote,
  type Lugar,
  type MinimoLugar,
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
import { getTenantActualId, useAuthStore } from '../../stores/authStore'
import { useAvisosStore } from '../../stores/avisosStore'
import { useSyncStore, type ResultadoCiclo } from '../../stores/syncStore'
import { reconcileOverdraft } from './reconcileOverdraft'
import { esFallaDeRed, reportarErrorSync } from './reportar'
import { normalizarUnidad } from '../unidades'

interface InsumoRow {
  id: string
  tenant_id: string
  nombre: string
  categoria: string
  unidad_medida: string
  /** Spec 015 — opcionales al bajar solo por robustez: la migración los deja `not null`. */
  unidad_compra?: string | null
  contenido?: number | null
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
  tenant_id: string
  niveles_aviso_dias: number[]
  /** Spec 012 FR-011 — se omite si el valor local es `undefined` (research.md R6). */
  horas_aviso_pendientes?: number
}

interface LoteRow {
  id: string
  tenant_id: string
  lugar_id: string
  insumo_id: string
  numero_lote: string
  proveedor: string
  fecha_caducidad: string | null
  codigo_fabricante: string | null
  estado: 'activo' | 'revision'
  creado_en: string
  cantidad_ingresada?: number | null
  unidad_ingresada?: string | null
  contenido?: number | null
  unidad_consumo?: string | null
  precio_compra?: number | null
}

interface CambioInsumoRow {
  id: string
  tenant_id: string
  insumo_id: string
  campo: CambioInsumo['campo']
  valor_anterior: CambioInsumo['valorAnterior']
  valor_nuevo: CambioInsumo['valorNuevo']
  factor?: number | null
  usuario_id: string
  creado_en: string
}

// ---------------------------------------------------------------------------
// Spec 016 (contracts/supabase-schema.md §5): tratamientos
// ---------------------------------------------------------------------------

interface TratamientoRow {
  id: string
  tenant_id: string
  creado_por: string
  creado_en: string
}

interface CambioTratamientoRow {
  id: string
  tenant_id: string
  tratamiento_id: string | null
  lugar_id: string | null
  campo: CambioTratamiento['campo']
  valor_anterior: CambioTratamiento['valorAnterior']
  valor_nuevo: CambioTratamiento['valorNuevo']
  usuario_id: string
  creado_en: string
}

interface TratamientoRealizadoRow {
  id: string
  tenant_id: string
  lugar_id: string
  tratamiento_id: string
  nombre: string
  precio: number | null
  porcentaje_profesional: number | null
  materiales: TratamientoRealizado['materiales']
  costo_materiales: number
  costo_completo: boolean
  ganancia_estimada: number | null
  usuario_id: string
  creado_en: string
  anulado_en: string | null
  anulado_por: string | null
}

const aNumero = (valor: number | string | null | undefined): number | null =>
  valor === null || valor === undefined ? null : Number(valor)

function toTratamientoRealizadoRow(r: TratamientoRealizado): TratamientoRealizadoRow {
  return {
    id: r.id,
    tenant_id: r.tenantId,
    lugar_id: r.lugarId,
    tratamiento_id: r.tratamientoId,
    nombre: r.nombre,
    precio: r.precio,
    porcentaje_profesional: r.porcentajeProfesional,
    materiales: r.materiales,
    costo_materiales: r.costoMateriales,
    costo_completo: r.costoCompleto,
    ganancia_estimada: r.gananciaEstimada,
    usuario_id: r.usuarioId,
    creado_en: r.creadoEn,
    anulado_en: r.anuladoEn,
    anulado_por: r.anuladoPor,
  }
}

function fromTratamientoRealizadoRow(row: TratamientoRealizadoRow): TratamientoRealizado {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    lugarId: row.lugar_id,
    tratamientoId: row.tratamiento_id,
    nombre: row.nombre,
    precio: aNumero(row.precio),
    porcentajeProfesional: aNumero(row.porcentaje_profesional),
    materiales: row.materiales ?? [],
    costoMateriales: Number(row.costo_materiales),
    costoCompleto: row.costo_completo,
    gananciaEstimada: aNumero(row.ganancia_estimada),
    usuarioId: row.usuario_id,
    creadoEn: row.creado_en,
    anuladoEn: row.anulado_en ?? null,
    anuladoPor: row.anulado_por ?? null,
    sincronizado: true,
    anulacionSincronizada: true,
  }
}

/**
 * Sube las altas de tratamientos pendientes del usuario (solo administración
 * pasa el RLS). Un rechazo por permisos la marca `rechazadoEn` (la proyección
 * la oculta) y no es error del ciclo; otro error la deja pendiente.
 */
async function pushTratamientos(client: SupabaseClient, ciclo: CicloSync): Promise<void> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return
  const pendientes = delTenantActual(await db.tratamientos.toArray()).filter(
    (t) => !t.sincronizado && t.rechazadoEn === null && t.creadoPor === usuarioId,
  )
  for (const tratamiento of pendientes) {
    const fila: TratamientoRow = {
      id: tratamiento.id,
      tenant_id: tratamiento.tenantId,
      creado_por: tratamiento.creadoPor,
      creado_en: tratamiento.creadoEn,
    }
    const respuesta = await client
      .from('tratamientos')
      .upsert(fila, { onConflict: 'id', ignoreDuplicates: true })
    if (!respuesta.error) {
      await db.tratamientos.update(tratamiento.id, { sincronizado: true })
    } else if (esRechazoDePermisos(respuesta.error)) {
      await db.tratamientos.update(tratamiento.id, { rechazadoEn: new Date().toISOString() })
    } else {
      ciclo.registrar('push tratamientos', errorDe(respuesta))
    }
  }
}

async function pullTratamientos(client: SupabaseClient, ciclo: CicloSync): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'tratamientos')
  ciclo.registrar('pull tratamientos', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.tratamientos.bulkPut(
    (respuesta.data as TratamientoRow[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      creadoPor: row.creado_por,
      creadoEn: row.creado_en,
      sincronizado: true,
      rechazadoEn: null,
    })),
  )
}

/** Patrón de `pushCambiosInsumo`: lote completo y, ante RLS, fila por fila. */
async function pushCambiosTratamiento(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return
  const pendientes = delTenantActual(await db.cambiosTratamiento.toArray()).filter(
    (c) => !c.sincronizado && c.rechazadoEn === null && c.usuarioId === usuarioId,
  )
  if (pendientes.length === 0) return
  const fila = (c: CambioTratamiento): CambioTratamientoRow => ({
    id: c.id,
    tenant_id: c.tenantId,
    tratamiento_id: c.tratamientoId,
    lugar_id: c.lugarId,
    campo: c.campo,
    valor_anterior: c.valorAnterior,
    valor_nuevo: c.valorNuevo,
    usuario_id: c.usuarioId,
    creado_en: c.creadoEn,
  })
  const subir = (filas: CambioTratamientoRow[]) =>
    client
      .from('cambios_tratamiento')
      .upsert(filas, { onConflict: 'id', ignoreDuplicates: true })

  const respuesta = await subir(pendientes.map(fila))
  if (!respuesta.error) {
    await db.cambiosTratamiento.bulkUpdate(
      pendientes.map((c) => ({ key: c.id, changes: { sincronizado: true } })),
    )
    return
  }
  if (!esRechazoDePermisos(respuesta.error)) {
    ciclo.registrar('push cambios_tratamiento', errorDe(respuesta))
    return
  }
  for (const cambio of pendientes) {
    const respuestaFila = await subir([fila(cambio)])
    if (!respuestaFila.error) {
      await db.cambiosTratamiento.update(cambio.id, { sincronizado: true })
    } else if (esRechazoDePermisos(respuestaFila.error)) {
      await db.cambiosTratamiento.update(cambio.id, { rechazadoEn: new Date().toISOString() })
    } else {
      ciclo.registrar('push cambio_tratamiento (fila)', errorDe(respuestaFila))
    }
  }
}

async function pullCambiosTratamiento(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'cambios_tratamiento')
  ciclo.registrar('pull cambios_tratamiento', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.cambiosTratamiento.bulkPut(
    (respuesta.data as CambioTratamientoRow[]).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      tratamientoId: row.tratamiento_id ?? null,
      lugarId: row.lugar_id ?? null,
      campo: row.campo,
      valorAnterior: row.valor_anterior,
      valorNuevo: row.valor_nuevo,
      usuarioId: row.usuario_id,
      creadoEn: row.creado_en,
      sincronizado: true,
      rechazadoEn: null,
    })),
  )
}

/**
 * Spec 016 (R4/R5): primero las altas de los registros propios (insert-only,
 * `ignoreDuplicates`), luego las anulaciones hechas en este dispositivo
 * (update de `anulado_en`/`anulado_por`; el servidor conserva la primera).
 * Van antes que los movimientos, que los referencian. Un error deja todo
 * pendiente y es error del ciclo.
 */
async function pushTratamientosRealizados(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return
  const propios = delTenantActual(await db.tratamientosRealizados.toArray())
  const altas = propios.filter((r) => !r.sincronizado && r.usuarioId === usuarioId)
  if (altas.length > 0) {
    const respuesta = await client
      .from('tratamientos_realizados')
      .upsert(altas.map(toTratamientoRealizadoRow), { onConflict: 'id', ignoreDuplicates: true })
    ciclo.registrar('push tratamientos_realizados', errorDe(respuesta))
    if (respuesta.error) return
    await db.tratamientosRealizados.bulkUpdate(
      altas.map((r) => ({
        key: r.id,
        // Una anulación hecha antes de subir ya viajó en el insert.
        changes: { sincronizado: true, anulacionSincronizada: true },
      })),
    )
  }
  const anulaciones = propios.filter(
    (r) =>
      r.sincronizado &&
      !r.anulacionSincronizada &&
      r.anuladoPor === usuarioId &&
      r.anuladoEn !== null,
  )
  for (const registro of anulaciones) {
    const respuesta = await client
      .from('tratamientos_realizados')
      .update({ anulado_en: registro.anuladoEn, anulado_por: registro.anuladoPor })
      .eq('id', registro.id)
    ciclo.registrar('push anulación de tratamiento', errorDe(respuesta))
    if (!respuesta.error) {
      await db.tratamientosRealizados.update(registro.id, { anulacionSincronizada: true })
    }
  }
}

/** Baja los registros sin pisar una anulación local aún sin subir. */
async function pullTratamientosRealizados(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'tratamientos_realizados')
  ciclo.registrar('pull tratamientos_realizados', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  const locales = new Map(
    (await db.tratamientosRealizados.toArray()).map((r) => [r.id, r]),
  )
  await db.tratamientosRealizados.bulkPut(
    (respuesta.data as TratamientoRealizadoRow[]).map((row) => {
      const remoto = fromTratamientoRealizadoRow(row)
      const local = locales.get(row.id)
      if (local && !local.anulacionSincronizada && remoto.anuladoEn === null) {
        return { ...remoto, anuladoEn: local.anuladoEn, anuladoPor: local.anuladoPor, anulacionSincronizada: false }
      }
      return remoto
    }),
  )
}

interface CambioLoteRow {
  id: string
  tenant_id: string
  lote_id: string
  campo: CambioLote['campo']
  valor_anterior: number | null
  valor_nuevo: number | null
  usuario_id: string
  creado_en: string
}

function toCambioLoteRow(cambio: CambioLote): CambioLoteRow {
  return {
    id: cambio.id,
    tenant_id: cambio.tenantId,
    lote_id: cambio.loteId,
    campo: cambio.campo,
    valor_anterior: cambio.valorAnterior,
    valor_nuevo: cambio.valorNuevo,
    usuario_id: cambio.usuarioId,
    creado_en: cambio.creadoEn,
  }
}

function fromCambioLoteRow(row: CambioLoteRow): CambioLote {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    loteId: row.lote_id,
    campo: row.campo,
    valorAnterior: row.valor_anterior === null ? null : Number(row.valor_anterior),
    valorNuevo: row.valor_nuevo === null ? null : Number(row.valor_nuevo),
    usuarioId: row.usuario_id,
    creadoEn: row.creado_en,
    sincronizado: true,
  }
}

interface CategoriaRow {
  id: string
  tenant_id: string
  nombre: string
  creado_por: string
  creado_en: string
  /** Feature 010 — `null` = activa. */
  desactivado_en?: string | null
}

function toCategoriaRow(categoria: Categoria): CategoriaRow {
  return {
    id: categoria.id,
    tenant_id: categoria.tenantId,
    nombre: categoria.nombre,
    creado_por: categoria.creadoPor,
    creado_en: categoria.creadoEn,
    desactivado_en: categoria.desactivadoEn,
  }
}

function fromCategoriaRow(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    tenantId: row.tenant_id,
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
  tenant_id: string
  lugar_id: string
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
    tenant_id: item.tenantId,
    lugar_id: item.lugarId,
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
    tenantId: row.tenant_id,
    lugarId: row.lugar_id,
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
  tenant_id: string
  lugar_id: string
  traslado_id: string | null
  tipo: Movimiento['tipo']
  lote_id: string
  cantidad: number
  unidad?: string | null
  tratamiento_realizado_id?: string | null
  usuario_id: string
  movimiento_origen_id: string | null
  creado_en: string
}

function toInsumoRow(insumo: Insumo): InsumoRow {
  return {
    id: insumo.id,
    tenant_id: insumo.tenantId,
    nombre: insumo.nombre,
    categoria: insumo.categoria,
    unidad_medida: insumo.unidadMedida,
    unidad_compra: insumo.unidadCompra,
    contenido: insumo.contenido,
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
    tenantId: row.tenant_id,
    nombre: row.nombre,
    categoria: row.categoria,
    unidadMedida: normalizarUnidad(row.unidad_medida),
    unidadCompra: normalizarUnidad(row.unidad_compra ?? row.unidad_medida),
    contenido: row.contenido ?? 1,
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
  const row: ConfiguracionAlertasRow = {
    id: config.id,
    tenant_id: config.tenantId,
    niveles_aviso_dias: config.nivelesAvisoDias,
  }
  if (config.horasAvisoPendientes !== undefined) {
    row.horas_aviso_pendientes = config.horasAvisoPendientes
  }
  return row
}

function fromConfiguracionAlertasRow(
  row: ConfiguracionAlertasRow,
): ConfiguracionAlertas {
  const config: ConfiguracionAlertas = {
    id: 'global',
    tenantId: row.tenant_id,
    nivelesAvisoDias: row.niveles_aviso_dias,
    sincronizado: true,
  }
  if (row.horas_aviso_pendientes != null) {
    config.horasAvisoPendientes = row.horas_aviso_pendientes
  }
  return config
}

function toLoteRow(lote: Lote): LoteRow {
  return {
    id: lote.id,
    tenant_id: lote.tenantId,
    lugar_id: lote.lugarId,
    insumo_id: lote.insumoId,
    numero_lote: lote.numeroLote,
    proveedor: lote.proveedor,
    fecha_caducidad: lote.fechaCaducidad,
    codigo_fabricante: lote.codigoFabricante,
    estado: lote.estado,
    creado_en: lote.creadoEn,
    cantidad_ingresada: lote.cantidadIngresada,
    unidad_ingresada: lote.unidadIngresada,
    contenido: lote.contenido,
    unidad_consumo: lote.unidadConsumo,
    precio_compra: lote.precioCompra,
  }
}

function fromLoteRow(row: LoteRow): Lote {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    lugarId: row.lugar_id,
    insumoId: row.insumo_id,
    numeroLote: row.numero_lote,
    proveedor: row.proveedor,
    fechaCaducidad: row.fecha_caducidad,
    codigoFabricante: row.codigo_fabricante,
    estado: row.estado,
    creadoEn: row.creado_en,
    cantidadIngresada: row.cantidad_ingresada ?? null,
    unidadIngresada: row.unidad_ingresada ? normalizarUnidad(row.unidad_ingresada) : null,
    contenido: row.contenido ?? 1,
    // Sin la columna (no debería pasar tras la migración): la unidad no se
    // conoce aquí; `unidad` vale como "sin conversión" en los factores.
    unidadConsumo: normalizarUnidad(row.unidad_consumo ?? 'unidad'),
    precioCompra: row.precio_compra ?? null,
  }
}

interface LugarRow {
  id: string
  tenant_id: string
  nombre: string
  desactivado_en: string | null
  creado_en: string
}

function toLugarRow(lugar: Lugar): LugarRow {
  return {
    id: lugar.id,
    tenant_id: lugar.tenantId,
    nombre: lugar.nombre,
    desactivado_en: lugar.desactivadoEn,
    creado_en: lugar.creadoEn,
  }
}

function fromLugarRow(row: LugarRow): Lugar {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nombre: row.nombre,
    desactivadoEn: row.desactivado_en ?? null,
    creadoEn: row.creado_en,
    sincronizado: true,
  }
}

interface MinimoLugarRow {
  tenant_id: string
  insumo_id: string
  lugar_id: string
  stock_minimo: number | null
}

function toMinimoLugarRow(minimo: MinimoLugar): MinimoLugarRow {
  return {
    tenant_id: minimo.tenantId,
    insumo_id: minimo.insumoId,
    lugar_id: minimo.lugarId,
    stock_minimo: minimo.stockMinimo,
  }
}

function fromMinimoLugarRow(row: MinimoLugarRow): MinimoLugar {
  return {
    tenantId: row.tenant_id,
    insumoId: row.insumo_id,
    lugarId: row.lugar_id,
    stockMinimo: row.stock_minimo ?? null,
    sincronizado: true,
  }
}

function toCambioInsumoRow(cambio: CambioInsumo): CambioInsumoRow {
  return {
    id: cambio.id,
    tenant_id: cambio.tenantId,
    insumo_id: cambio.insumoId,
    campo: cambio.campo,
    valor_anterior: cambio.valorAnterior,
    valor_nuevo: cambio.valorNuevo,
    factor: cambio.factor,
    usuario_id: cambio.usuarioId,
    creado_en: cambio.creadoEn,
  }
}

function fromCambioInsumoRow(row: CambioInsumoRow): CambioInsumo {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    insumoId: row.insumo_id,
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNuevo: row.valor_nuevo,
    factor: row.factor ?? null,
    usuarioId: row.usuario_id,
    creadoEn: row.creado_en,
    sincronizado: true,
    rechazadoEn: null,
  }
}

function toMovimientoRow(movimiento: Movimiento): MovimientoRow {
  return {
    id: movimiento.id,
    tenant_id: movimiento.tenantId,
    lugar_id: movimiento.lugarId,
    traslado_id: movimiento.trasladoId,
    tipo: movimiento.tipo,
    lote_id: movimiento.loteId,
    cantidad: movimiento.cantidad,
    unidad: movimiento.unidad,
    tratamiento_realizado_id: movimiento.tratamientoRealizadoId,
    usuario_id: movimiento.usuarioId,
    movimiento_origen_id: movimiento.movimientoOrigenId,
    creado_en: movimiento.creadoEn,
  }
}

function fromMovimientoRow(row: MovimientoRow): Movimiento {
  return {
    tratamientoRealizadoId: row.tratamiento_realizado_id ?? null,
    id: row.id,
    tenantId: row.tenant_id,
    lugarId: row.lugar_id,
    trasladoId: row.traslado_id ?? null,
    tipo: row.tipo,
    loteId: row.lote_id,
    cantidad: row.cantidad,
    unidad: normalizarUnidad(row.unidad ?? 'unidad'),
    usuarioId: row.usuario_id,
    movimientoOrigenId: row.movimiento_origen_id,
    creadoEn: row.creado_en,
    sincronizado: true,
  }
}

type ErrorEtapa = { message?: string; code?: string; status?: number }

/** Respuesta de supabase-js (`{ error, status }`) → el error con su status HTTP, o `null`. */
function errorDe(respuesta: {
  error: { message?: string; code?: string } | null
  status?: number
}): ErrorEtapa | null {
  if (!respuesta.error) return null
  return { ...respuesta.error, status: respuesta.status }
}

/**
 * Sesión vencida o revocada en el servidor (spec 012 research.md R2/R3):
 * PostgREST responde 401 / `PGRST30x` / "JWT …". `getSession` no lo detecta
 * porque no valida el token contra el servidor.
 */
function esErrorDeSesion(error: ErrorEtapa): boolean {
  return (
    error.status === 401 ||
    /^PGRST30\d$/.test(error.code ?? '') ||
    /jwt/i.test(error.message ?? '')
  )
}

/**
 * Corta el ciclo en la etapa que detectó una sesión inválida (research.md R3)
 * o la falta de red: las etapas siguientes fallarían igual, y seguir solo
 * demora el resultado de "Sincronizar ahora" (FR-009).
 */
class CorteDeCiclo extends Error {}

/**
 * Recolector del resultado de un ciclo (spec 012 research.md R1/R2). Cada
 * etapa le entrega su `{ error }`; él lo clasifica en sesión / red / servidor,
 * lo reporta a Sentry (salvo red, que `reportarErrorSync` ya descarta, y
 * sesión, que es esperable) y corta el ciclo ante una sesión inválida — para
 * que ningún push posterior confunda la falta de sesión con un rechazo de
 * permisos y marque filas `rechazadoEn` — o ante la falta de red.
 */
class CicloSync {
  private sesion = false
  private servidor = false
  private red = false
  readonly etapasConError: string[] = []

  registrar(etapa: string, error: ErrorEtapa | null): void {
    if (!error) return
    this.etapasConError.push(etapa)
    if (esErrorDeSesion(error)) {
      this.sesion = true
      throw new CorteDeCiclo(etapa)
    }
    if (esFallaDeRed(error)) {
      this.red = true
      throw new CorteDeCiclo(etapa)
    }
    this.servidor = true
    reportarErrorSync(etapa, error)
  }

  marcarSesionInvalida(etapa: string): void {
    this.etapasConError.push(etapa)
    this.sesion = true
  }

  marcarSinRed(etapa: string): void {
    this.etapasConError.push(etapa)
    this.red = true
  }

  marcarFalla(etapa: string): void {
    this.etapasConError.push(etapa)
    this.servidor = true
  }

  resultado(): ResultadoCiclo {
    const estado = this.sesion
      ? 'sesion'
      : this.servidor
        ? 'error'
        : this.red
          ? 'sin-red'
          : 'ok'
    return {
      estado,
      etapasConError: [...this.etapasConError],
      terminadoEn: new Date().toISOString(),
    }
  }
}

function usuarioActualId(): string | undefined {
  return useAuthStore.getState().usuario?.id
}

function esAdministradorActual(): boolean {
  return useAuthStore.getState().usuario?.rol === 'administrador'
}

/**
 * Spec 014 FR-004/FR-017: solo se suben filas del tenant del usuario con
 * sesión. Las de otro tenant (pendientes de alguien que entró antes en este
 * dispositivo) esperan a que su dueño vuelva a entrar.
 */
function delTenantActual<T extends { tenantId: string }>(filas: T[]): T[] {
  const tenantId = getTenantActualId()
  return tenantId ? filas.filter((fila) => fila.tenantId === tenantId) : []
}

/**
 * Pushes every local insumo row with its not-yet-synced cambios undone
 * (`filaParaSubir`, feature 007): the remote row never runs ahead of
 * `cambios_insumo`, so a cambio the server later rejects (FR-021b) can't
 * leak to other devices through the RLS-less `insumos` table.
 */
async function pushInsumos(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const insumos = delTenantActual(await db.insumos.toArray())
  if (insumos.length === 0) return
  const cambios = await db.cambiosInsumo.toArray()
  const respuesta = await client
    .from('insumos')
    .upsert(
      insumos.map((insumo) => toInsumoRow(filaParaSubir(insumo, cambios))),
    )
  ciclo.registrar('push insumos', errorDe(respuesta))
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
 * Pushes the current user's pending `cambiosInsumo` (feature 007,
 * contracts/supabase-schema.md step 2), marking rows synced only when the
 * upsert succeeds. Only the signed-in user's rows (spec 012 research.md R4):
 * RLS requires `usuario_id = auth.uid()`, so on a shared device another
 * user's cambio would be rejected as "sin permisos" and reverted — it stays
 * pending until its owner signs in. A batch failing on RLS is retried row by
 * row so a rejected cambio can't block valid ones; each row rejected for lack
 * of permissions is marked `rechazadoEn` (kept for audit, never re-pushed) and
 * is not a cycle error. Any other error leaves the rows pending and is
 * recorded. Returns the cambios newly rejected in this cycle.
 */
async function pushCambiosInsumo(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<CambioInsumo[]> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return []
  const pendientes = delTenantActual(await db.cambiosInsumo.toArray()).filter(
    (cambio) =>
      !cambio.sincronizado &&
      cambio.rechazadoEn === null &&
      cambio.usuarioId === usuarioId,
  )
  if (pendientes.length === 0) return []

  const respuesta = await client
    .from('cambios_insumo')
    .upsert(pendientes.map(toCambioInsumoRow))
  if (!respuesta.error) {
    await db.cambiosInsumo.bulkUpdate(
      pendientes.map((cambio) => ({
        key: cambio.id,
        changes: { sincronizado: true },
      })),
    )
    return []
  }
  if (!esRechazoDePermisos(respuesta.error)) {
    ciclo.registrar('push cambios_insumo', errorDe(respuesta))
    return []
  }

  const rechazados: CambioInsumo[] = []
  for (const cambio of pendientes) {
    const respuestaFila = await client
      .from('cambios_insumo')
      .upsert(toCambioInsumoRow(cambio))
    if (!respuestaFila.error) {
      await db.cambiosInsumo.update(cambio.id, { sincronizado: true })
    } else if (esRechazoDePermisos(respuestaFila.error)) {
      await db.cambiosInsumo.update(cambio.id, {
        rechazadoEn: new Date().toISOString(),
      })
      rechazados.push(cambio)
    } else {
      ciclo.registrar('push cambio_insumo (fila)', errorDe(respuestaFila))
    }
  }
  return rechazados
}

async function pullCambiosInsumo(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'cambios_insumo')
  ciclo.registrar('pull cambios_insumo', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.cambiosInsumo.bulkPut(
    (respuesta.data as CambioInsumoRow[]).map(fromCambioInsumoRow),
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
 * Pushes the current user's unsynced, non-rejected `categorias` (spec 008
 * contracts/supabase-schema.md step 0): marks synced only without error. Only
 * the signed-in user's rows (spec 012 research.md R4, same reason as
 * `pushCambiosInsumo`: RLS requires `creado_por = auth.uid()`). A batch
 * rejected on RLS is retried row by row so one admin-demoted category can't
 * block a sibling's sync; each row rejected for lack of permissions is marked
 * `rechazadoEn` (kept for audit, never re-pushed). Returns the rows newly
 * rejected.
 */
async function pushCategorias(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<Categoria[]> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return []
  const pendientes = delTenantActual(await db.categorias.toArray()).filter(
    (categoria) =>
      !categoria.sincronizado &&
      categoria.rechazadoEn === null &&
      categoria.creadoPor === usuarioId,
  )
  if (pendientes.length === 0) return []

  const respuesta = await client
    .from('categorias')
    .upsert(pendientes.map(toCategoriaRow))
  if (!respuesta.error) {
    await db.categorias.bulkUpdate(
      pendientes.map((categoria) => ({
        key: categoria.id,
        changes: { sincronizado: true },
      })),
    )
    return []
  }
  if (!esRechazoDePermisos(respuesta.error)) {
    ciclo.registrar('push categorias', errorDe(respuesta))
    return []
  }

  const rechazadas: Categoria[] = []
  for (const categoria of pendientes) {
    const respuestaFila = await client
      .from('categorias')
      .upsert(toCategoriaRow(categoria))
    if (!respuestaFila.error) {
      await db.categorias.update(categoria.id, { sincronizado: true })
    } else if (esRechazoDePermisos(respuestaFila.error)) {
      await db.categorias.update(categoria.id, {
        rechazadoEn: new Date().toISOString(),
      })
      rechazadas.push(categoria)
    } else {
      ciclo.registrar('push categoria (fila)', errorDe(respuestaFila))
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
async function pullCategorias(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'categorias')
  ciclo.registrar('pull categorias', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  const rechazadasLocalmente = new Set(
    (await db.categorias.toArray())
      .filter((categoria) => categoria.rechazadoEn !== null)
      .map((categoria) => categoria.id),
  )
  const filas = (respuesta.data as CategoriaRow[])
    .filter((row) => !rechazadasLocalmente.has(row.id))
    .map(fromCategoriaRow)
  await db.categorias.bulkPut(filas)
}

async function pushLotes(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const lotes = delTenantActual(await db.lotes.toArray())
  if (lotes.length === 0) return
  const respuesta = await client.from('lotes').upsert(lotes.map(toLoteRow))
  ciclo.registrar('push lotes', errorDe(respuesta))
}

/**
 * Spec 015 (research.md R6, contracts/supabase-schema.md §7): sube las
 * correcciones de precio pendientes del usuario con sesión. `cambios_lote` es
 * insert-only y abierto a todo el tenant (Clarifications Q3), así que no hay
 * rechazos por rol que manejar: un error deja las filas pendientes y es un
 * error del ciclo. `ignoreDuplicates` porque reenviar una fila que ya llegó no
 * debe fallar el lote. Va después de `pushLotes` (FK).
 */
async function pushCambiosLote(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return
  const pendientes = delTenantActual(await db.cambiosLote.toArray()).filter(
    (cambio) => !cambio.sincronizado && cambio.usuarioId === usuarioId,
  )
  if (pendientes.length === 0) return
  const respuesta = await client
    .from('cambios_lote')
    .upsert(pendientes.map(toCambioLoteRow), { onConflict: 'id', ignoreDuplicates: true })
  ciclo.registrar('push cambios_lote', errorDe(respuesta))
  if (respuesta.error) return
  await db.cambiosLote.bulkUpdate(
    pendientes.map((cambio) => ({ key: cambio.id, changes: { sincronizado: true } })),
  )
}

async function pullCambiosLote(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'cambios_lote')
  ciclo.registrar('pull cambios_lote', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.cambiosLote.bulkPut((respuesta.data as CambioLoteRow[]).map(fromCambioLoteRow))
}

/**
 * Sube todas las filas locales de `itemsCompra` cada ciclo (research.md R2):
 * a diferencia de `categorias`/`cambios_insumo`, ninguna escritura puede ser
 * rechazada por rol (spec Clarifications: abierto a todo autenticado), así
 * que no hace falta una bandera `sincronizado` ni reintento por fila — mismo
 * patrón simple que `pushLotes`.
 */
async function pushItemsCompra(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const items = delTenantActual(await db.itemsCompra.toArray())
  if (items.length === 0) return
  const respuesta = await client
    .from('items_compra')
    .upsert(items.map(toItemCompraRow))
  ciclo.registrar('push items_compra', errorDe(respuesta))
}

/**
 * Spec 014 (research.md R4): unidades de subida. Las dos mitades de un
 * traslado viajan siempre juntas, en el mismo upsert (una transacción en el
 * servidor, donde `verificar_traslado` rechaza un par incompleto al
 * confirmar). Una mitad cuya pareja ya está en el servidor sube sola; una sin
 * pareja local no sube y se reporta, porque el servidor la rechazaría igual.
 */
async function unidadesDeSubida(pendientes: Movimiento[]): Promise<Movimiento[][]> {
  const unidades: Movimiento[][] = []
  const porTraslado = new Map<string, Movimiento[]>()
  for (const movimiento of pendientes) {
    if (!movimiento.trasladoId) {
      unidades.push([movimiento])
      continue
    }
    const grupo = porTraslado.get(movimiento.trasladoId) ?? []
    grupo.push(movimiento)
    porTraslado.set(movimiento.trasladoId, grupo)
  }
  for (const [trasladoId, grupo] of porTraslado) {
    if (grupo.length === 2) {
      unidades.push(grupo)
      continue
    }
    const pareja = (
      await db.movimientos.where('trasladoId').equals(trasladoId).toArray()
    ).find((movimiento) => movimiento.id !== grupo[0].id)
    if (pareja?.sincronizado) {
      unidades.push(grupo)
    } else {
      reportarErrorSync('push traslado incompleto', {
        message: `Traslado ${trasladoId} sin su pareja local`,
      })
    }
  }
  return unidades
}

/**
 * Pushes the current user's unsynced movimientos and returns the loteIds of
 * any `consumo` or `traslado_salida` rows actually pushed (the lots whose
 * stock went down, to reconcile). Only rows the server accepted are marked
 * `sincronizado`: supabase-js returns `{ error }` instead of throwing
 * (offline, 5xx, RLS), and marking a failed batch as synced lost those
 * movimientos for good. `ignoreDuplicates` (ON CONFLICT DO NOTHING) because
 * `movimientos` is insert-only (no UPDATE policy): re-sending a row that
 * already reached the server must not fail the whole batch. Rows of other
 * users on a shared device stay pending until their owner signs in (RLS:
 * `usuario_id = auth.uid()`). Unlike cambios/categorías there's no
 * `rechazadoEn`: a rejected row stays pending, so every row error is a cycle
 * error (spec 012 research.md R1). A traslado is one unit: its two halves
 * are never split, not even in the row-by-row retry (spec 014 FR-023).
 */
async function pushMovimientos(
  client: SupabaseClient,
  ciclo: CicloSync,
  filtro: (movimiento: Movimiento) => boolean = () => true,
): Promise<string[]> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return []
  const pendientes = delTenantActual(await db.movimientos.toArray()).filter(
    (movimiento) =>
      !movimiento.sincronizado &&
      movimiento.usuarioId === usuarioId &&
      filtro(movimiento),
  )
  if (pendientes.length === 0) return []
  const unidades = await unidadesDeSubida(pendientes)
  if (unidades.length === 0) return []

  const subir = (filas: Movimiento[]) =>
    client
      .from('movimientos')
      .upsert(filas.map(toMovimientoRow), { onConflict: 'id', ignoreDuplicates: true })

  let subidos = unidades.flat()
  const respuesta = await subir(subidos)
  if (respuesta.error) {
    if (!esRechazoDePermisos(respuesta.error)) {
      ciclo.registrar('push movimientos', errorDe(respuesta))
      return []
    }
    // Un rechazo de permisos no debe bloquear las filas válidas: unidad por unidad.
    subidos = []
    for (const unidad of unidades) {
      const respuestaUnidad = await subir(unidad)
      if (respuestaUnidad.error) {
        ciclo.registrar('push movimiento (fila)', errorDe(respuestaUnidad))
      } else {
        subidos.push(...unidad)
      }
    }
  }

  await db.movimientos.bulkUpdate(
    subidos.map((movimiento) => ({
      key: movimiento.id,
      changes: { sincronizado: true },
    })),
  )
  return subidos
    .filter((movimiento) => restaStock(movimiento.tipo))
    .map((movimiento) => movimiento.loteId)
}

function restaStock(tipo: Movimiento['tipo']): boolean {
  return tipo === 'consumo' || tipo === 'traslado_salida'
}

/**
 * Sube una fila de configuración global (feature 004 FR-005 / spec 010
 * FR-020) solo si un administrador la cambió en este dispositivo y aún no se
 * subió (spec 012 research.md R5): subirla en cada ciclo hacía que `personal`
 * chocara con RLS cada 30 s y que un administrador con la fila vieja pisara
 * el cambio de otro. Un rechazo por permisos (rol quitado) descarta el cambio
 * local para que el pull traiga el valor del servidor; cualquier otro error
 * lo deja pendiente. Solo se marca subida si la fila no cambió mientras tanto.
 */
async function pushConfiguracionAlertas(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const config = await db.configuracionAlertas.get('global')
  if (
    !config ||
    config.sincronizado !== false ||
    !esAdministradorActual() ||
    config.tenantId !== getTenantActualId()
  )
    return
  const respuesta = await client
    .from('configuracion_alertas')
    .upsert(toConfiguracionAlertasRow(config))
  if (respuesta.error && !esRechazoDePermisos(respuesta.error)) {
    ciclo.registrar('push configuracion_alertas', errorDe(respuesta))
    return
  }
  const actual = await db.configuracionAlertas.get('global')
  if (actual && mismaFila(actual, config)) {
    await db.configuracionAlertas.update('global', { sincronizado: true })
  }
}

/**
 * Spec 014 FR-011: lugares creados, renombrados o (des)activados por un
 * administrador en este dispositivo. Un rechazo del servidor (permisos,
 * nombre repetido, último lugar activo) descarta el cambio local para que el
 * pull traiga el valor del servidor, como la configuración global.
 */
async function pushLugares(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  if (!esAdministradorActual()) return
  const pendientes = delTenantActual(await db.lugares.toArray()).filter(
    (lugar) => !lugar.sincronizado,
  )
  for (const lugar of pendientes) {
    const respuesta = await client.from('lugares').upsert(toLugarRow(lugar))
    if (respuesta.error && !esRechazoDeLugar(respuesta.error)) {
      ciclo.registrar('push lugares', errorDe(respuesta))
      continue
    }
    const actual = await db.lugares.get(lugar.id)
    if (actual && mismaFila(actual, lugar)) {
      await db.lugares.update(lugar.id, { sincronizado: true })
    }
  }
}

function esRechazoDeLugar(error: { code?: string; message?: string }): boolean {
  return (
    esRechazoDePermisos(error) ||
    error.code === '23505' ||
    /ultimo_lugar_activo/.test(error.message ?? '')
  )
}

async function pullLugares(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'lugares')
  ciclo.registrar('pull lugares', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  const locales = new Map(
    (await db.lugares.toArray()).map((lugar) => [lugar.id, lugar]),
  )
  await db.lugares.bulkPut(
    (respuesta.data as LugarRow[])
      .filter((row) => !conservarCambioLocal(locales.get(row.id)))
      .map(fromLugarRow),
  )
}

/** Spec 014 FR-007: mínimos por lugar que un administrador cambió aquí. */
async function pushMinimosLugar(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  if (!esAdministradorActual()) return
  const pendientes = delTenantActual(await db.minimosLugar.toArray()).filter(
    (minimo) => !minimo.sincronizado,
  )
  if (pendientes.length === 0) return
  const respuesta = await client
    .from('minimos_lugar')
    .upsert(pendientes.map(toMinimoLugarRow), { onConflict: 'insumo_id,lugar_id' })
  if (respuesta.error && !esRechazoDePermisos(respuesta.error)) {
    ciclo.registrar('push minimos_lugar', errorDe(respuesta))
    return
  }
  for (const minimo of pendientes) {
    const clave: [string, string] = [minimo.insumoId, minimo.lugarId]
    const actual = await db.minimosLugar.get(clave)
    if (actual && mismaFila(actual, minimo)) {
      await db.minimosLugar.update(clave, { sincronizado: true })
    }
  }
}

async function pullMinimosLugar(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  // Spec 019 (research.md R5): clave (insumo, lugar), sin `id`; paginado por
  // cursor compuesto para no truncar en `max_rows`.
  const respuesta = await seleccionarTodo<MinimoLugarRow & Record<string, unknown>>(
    client,
    'minimos_lugar',
    { clave: ['insumo_id', 'lugar_id'] },
  )
  ciclo.registrar('pull minimos_lugar', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  const locales = new Map(
    (await db.minimosLugar.toArray()).map((minimo) => [
      `${minimo.insumoId}|${minimo.lugarId}`,
      minimo,
    ]),
  )
  await db.minimosLugar.bulkPut(
    (respuesta.data as MinimoLugarRow[])
      .filter(
        (row) =>
          !conservarCambioLocal(locales.get(`${row.insumo_id}|${row.lugar_id}`)),
      )
      .map(fromMinimoLugarRow),
  )
}

function mismaFila(a: object, b: object): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Un pull de configuración no pisa un cambio local aún sin subir, salvo que
 * quien tiene la sesión ya no sea administrador: ese cambio nunca se subirá,
 * así que gana el servidor y el dispositivo converge (spec 012 research.md R5).
 */
function conservarCambioLocal(local: { sincronizado?: boolean } | undefined): boolean {
  return local?.sincronizado === false && esAdministradorActual()
}

async function pullInsumos(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'insumos')
  ciclo.registrar('pull insumos', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.insumos.bulkPut((respuesta.data as InsumoRow[]).map(fromInsumoRow))
}

async function pullLotes(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'lotes')
  ciclo.registrar('pull lotes', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.lotes.bulkPut((respuesta.data as LoteRow[]).map(fromLoteRow))
}

async function pullItemsCompra(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  const respuesta = await seleccionarTodo(client, 'items_compra')
  ciclo.registrar('pull items_compra', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  await db.itemsCompra.bulkPut(
    (respuesta.data as ItemCompraRow[]).map(fromItemCompraRow),
  )
}

/** Pulls the remote global config row, if one has ever been saved (feature 004, FR-005). */
async function pullConfiguracionAlertas(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  // Spec 014 (R7): una fila por tenant, todas con id 'global'; RLS devuelve
  // solo la del tenant propio.
  const respuesta = await client
    .from('configuracion_alertas')
    .select('*')
    .eq('id', 'global')
    .maybeSingle()
  ciclo.registrar('pull configuracion_alertas', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return
  if (conservarCambioLocal(await db.configuracionAlertas.get('global'))) return
  await db.configuracionAlertas.put(
    fromConfiguracionAlertasRow(respuesta.data as ConfiguracionAlertasRow),
  )
}

/** Pulls remote movimientos and returns the loteIds of the rows that lowered stock. */
async function pullMovimientos(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<string[]> {
  const respuesta = await seleccionarTodo(client, 'movimientos')
  ciclo.registrar('pull movimientos', errorDe(respuesta))
  if (respuesta.error || !respuesta.data) return []
  const rows = respuesta.data as MovimientoRow[]
  await db.movimientos.bulkPut(rows.map(fromMovimientoRow))
  return rows.filter((row) => restaStock(row.tipo)).map((row) => row.lote_id)
}

/**
 * Valida la sesión antes de subir nada (spec 012 research.md R3): con la
 * sesión vencida, supabase-js envía todo como `anon` y los push de cambios y
 * categorías confundirían el RLS con "sin permisos" y revertirían filas.
 * Devuelve `false` si el ciclo no debe seguir.
 */
/**
 * Spec 014 FR-021: el último envío de un usuario desactivado. Sube sus lotes
 * y movimientos registrados antes de la desactivación (el servidor los acepta
 * con una política propia) con INSERT simple: `ON CONFLICT` exige además la
 * política SELECT, que un desactivado no pasa. Un duplicado (23505) significa
 * que ya estaba arriba. Lo posterior a la desactivación queda pendiente y la
 * pantalla de acceso desactivado lo cuenta.
 */
async function subirPendientesPrevios(
  client: SupabaseClient,
  desactivadoEn: string,
): Promise<void> {
  const usuarioId = usuarioActualId()
  if (!usuarioId) return
  const previos = delTenantActual(await db.movimientos.toArray()).filter(
    (m) => !m.sincronizado && m.usuarioId === usuarioId && m.creadoEn < desactivadoEn,
  )
  // Spec 015: las correcciones de precio previas también (política propia).
  const preciosPrevios = delTenantActual(await db.cambiosLote.toArray()).filter(
    (c) => !c.sincronizado && c.usuarioId === usuarioId && c.creadoEn < desactivadoEn,
  )
  // Spec 016: los tratamientos realizados previos, antes que sus consumos.
  const realizadosPrevios = delTenantActual(await db.tratamientosRealizados.toArray()).filter(
    (r) => !r.sincronizado && r.usuarioId === usuarioId && r.creadoEn < desactivadoEn,
  )
  if (previos.length === 0 && preciosPrevios.length === 0 && realizadosPrevios.length === 0) {
    return
  }
  const yaArriba = (error: { code?: string } | null) => !error || error.code === '23505'

  const loteIds = new Set([
    ...previos.map((m) => m.loteId),
    ...preciosPrevios.map((c) => c.loteId),
  ])
  for (const lote of await db.lotes.bulkGet([...loteIds])) {
    if (!lote || lote.creadoEn >= desactivadoEn) continue
    await client.from('lotes').insert(toLoteRow(lote))
  }
  for (const registro of realizadosPrevios) {
    const { error } = await client
      .from('tratamientos_realizados')
      .insert(toTratamientoRealizadoRow(registro))
    if (yaArriba(error)) {
      await db.tratamientosRealizados.update(registro.id, {
        sincronizado: true,
        anulacionSincronizada: true,
      })
    }
  }
  for (const unidad of await unidadesDeSubida(previos)) {
    const { error } = await client.from('movimientos').insert(unidad.map(toMovimientoRow))
    if (yaArriba(error)) {
      await db.movimientos.bulkUpdate(
        unidad.map((m) => ({ key: m.id, changes: { sincronizado: true } })),
      )
    }
  }
  for (const cambio of preciosPrevios) {
    const { error } = await client.from('cambios_lote').insert(toCambioLoteRow(cambio))
    if (yaArriba(error)) await db.cambiosLote.update(cambio.id, { sincronizado: true })
  }
}

/**
 * Spec 014 FR-021: estado del perfil en el servidor. Si una administradora lo
 * desactivó, se marca localmente (la app muestra "acceso desactivado"), se
 * hace el último envío y el ciclo se detiene sin borrar pendientes. Si lo
 * reactivó, se desmarca. Sin respuesta (sin red, error) no cambia nada.
 */
async function revisarPerfil(client: SupabaseClient): Promise<boolean> {
  const usuario = useAuthStore.getState().usuario
  if (!usuario) return true
  const perfil = await fetchPerfilPropio(client, usuario.id).catch(() => null)
  if (!perfil) return !usuario.desactivadoEn
  await useAuthStore.getState().marcarDesactivado(perfil.desactivado_en ?? null)
  if (perfil.desactivado_en) {
    await subirPendientesPrevios(client, perfil.desactivado_en)
    return false
  }
  if (perfil.rol !== usuario.rol) await useAuthStore.getState().actualizarRol(perfil.rol)
  return true
}

async function validarSesion(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    ciclo.marcarSinRed('sin red')
    return false
  }
  const { data, error } = await client.auth.getSession()
  if (error) {
    if (esFallaDeRed(error)) ciclo.marcarSinRed('sesion')
    else ciclo.marcarSesionInvalida('sesion')
    return false
  }
  const usuarioId = usuarioActualId()
  if (!data.session || !usuarioId || data.session.user.id !== usuarioId) {
    ciclo.marcarSesionInvalida('sesion')
    return false
  }
  if (!(await revisarPerfil(client))) {
    ciclo.marcarSesionInvalida('acceso desactivado')
    return false
  }
  return true
}

async function ejecutarCiclo(
  client: SupabaseClient,
  ciclo: CicloSync,
): Promise<void> {
  if (!(await validarSesion(client, ciclo))) return

  const loteIdsTocados = new Set<string>()

  // Spec 014: los lugares primero — lotes, movimientos e ítems de compra los
  // referencian (FK compuesta en el servidor).
  await pushLugares(client, ciclo)
  await pullLugares(client, ciclo)

  const rechazadasCategorias = await pushCategorias(client, ciclo)
  await moverASinCategoria(rechazadasCategorias)

  await pushInsumos(client, ciclo)
  // Spec 016: el catálogo de tratamientos referencia insumos y lugares.
  await pushTratamientos(client, ciclo)
  await pushCambiosTratamiento(client, ciclo)
  const rechazados = await pushCambiosInsumo(client, ciclo)
  await pullCambiosInsumo(client, ciclo)
  await pullInsumos(client, ciclo)
  await pullCategorias(client, ciclo)
  await pullTratamientos(client, ciclo)
  await pullCambiosTratamiento(client, ciclo)
  await reproyectarInsumos()
  if (rechazados.length > 0) await notificarRechazos(client, rechazados)
  if (rechazadasCategorias.length > 0) {
    await notificarRechazoCategorias(client, rechazadasCategorias)
  }

  await pushLotes(client, ciclo)
  await pushCambiosLote(client, ciclo)
  await pushItemsCompra(client, ciclo)
  await pushMinimosLugar(client, ciclo)
  await pushConfiguracionAlertas(client, ciclo)
  // Spec 016: los registros antes que sus consumos (FK).
  await pushTratamientosRealizados(client, ciclo)
  for (const loteId of await pushMovimientos(client, ciclo)) {
    loteIdsTocados.add(loteId)
  }

  await pullLotes(client, ciclo)
  await pullCambiosLote(client, ciclo)
  await pullItemsCompra(client, ciclo)
  await pullMinimosLugar(client, ciclo)
  await pullConfiguracionAlertas(client, ciclo)
  await pullTratamientosRealizados(client, ciclo)
  for (const loteId of await pullMovimientos(client, ciclo)) {
    loteIdsTocados.add(loteId)
  }

  for (const loteId of loteIdsTocados) {
    await reconcileOverdraft(loteId)
  }
}

/**
 * One push+pull sync cycle (contracts/supabase-schema.md's sync contract):
 * validate the session, push unsynced local rows and the current
 * insumos/lotes (idempotent upserts), pull remote changes by id, then
 * reconcile every lot touched by a `consumo` movement in this batch (FR-012,
 * FR-014). Never throws (Constitution I) — it reports how the cycle went
 * instead (spec 012 contracts/supabase-schema.md): `ok` writes
 * `estadoSync.ultimaExitosaEn`; any other result leaves it untouched.
 *
 * Order for the catalog (spec 008 contracts/supabase-schema.md, extending
 * spec 007's): categorias first — a rejection there moves local insumos to
 * "Sin categoría" *before* they're pushed, so the remote row converges in
 * the same cycle — then insumos (so `cambios_insumo.insumo_id`'s FK is
 * satisfied) → cambios → pull cambios → pull insumos → pull categorias →
 * one reprojection from the ledger, which resolves concurrent edits per
 * field on every device identically.
 */
export async function runSyncBatch(): Promise<ResultadoCiclo> {
  const ciclo = new CicloSync()
  const { client, error } = getSupabaseStatus()
  if (error) {
    ciclo.marcarSinRed('backend no configurado')
    return ciclo.resultado()
  }

  try {
    await ejecutarCiclo(client, ciclo)
  } catch (err) {
    if (!(err instanceof CorteDeCiclo)) {
      console.error('[inDENTory] Error de sincronización:', err)
      Sentry.captureException(err, { tags: { etapa: 'ciclo de sync' } })
      ciclo.marcarFalla('ciclo')
    }
  }

  const resultado = ciclo.resultado()
  if (resultado.estado === 'ok') {
    try {
      await db.estadoSync.put({
        id: 'local',
        ultimaExitosaEn: resultado.terminadoEn,
      })
    } catch (err) {
      console.error('[inDENTory] No se pudo guardar la última sincronización:', err)
    }
  }
  return resultado
}

let cicloEnCurso: Promise<ResultadoCiclo> | null = null

/**
 * Lanza un ciclo ya (botón "Sincronizar ahora", spec 012 FR-008) o devuelve el
 * que está en curso: nunca corren dos a la vez (research.md R9). Refleja la
 * fase y el resultado en `useSyncStore`.
 */
export function sincronizarAhora(): Promise<ResultadoCiclo> {
  if (cicloEnCurso) return cicloEnCurso
  useSyncStore.getState().iniciarCiclo()
  cicloEnCurso = (async () => {
    let resultado: ResultadoCiclo | null = null
    try {
      resultado = await runSyncBatch()
      return resultado
    } finally {
      useSyncStore.getState().terminarCiclo(
        resultado ?? {
          estado: 'error',
          etapasConError: ['ciclo'],
          terminadoEn: new Date().toISOString(),
        },
      )
      cicloEnCurso = null
    }
  })()
  return cicloEnCurso
}

/**
 * Starts the background sync loop (Constitution I: incremental, resilient,
 * never blocking the UI): one cycle now, one every `intervalMs`, one as soon
 * as the browser goes back `online` (spec 012 SC-002), all through the same
 * single-flight guard. Going `offline` shows "Sin conexión" right away.
 * Returns a stop function that clears the interval and the listeners.
 */
export function startBackgroundSync(intervalMs = 30_000): () => void {
  const tick = () => {
    void sincronizarAhora()
  }
  // Al volver la red, un ciclo en curso empezó sin ella: hace falta otro
  // después, no reutilizar ese.
  const alConectar = () => {
    void (cicloEnCurso ?? Promise.resolve()).then(() => sincronizarAhora())
  }
  const alDesconectar = () => useSyncStore.getState().marcarSinRed()
  tick()
  const id = setInterval(tick, intervalMs)
  window.addEventListener('online', alConectar)
  window.addEventListener('offline', alDesconectar)
  return () => {
    clearInterval(id)
    window.removeEventListener('online', alConectar)
    window.removeEventListener('offline', alDesconectar)
  }
}
