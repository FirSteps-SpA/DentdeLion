import { db, type Categoria, type Insumo, type Lote } from '../../../lib/db'
import {
  getUsuarioActualId,
  tenantActualOFallar,
  useAuthStore,
} from '../../../stores/authStore'
import { lugarParaEscribirOFallar } from '../../../stores/lugarStore'
import { claveNombre, validarStockMinimo } from './catalogo'
import { esUnidad, type Unidad } from '../../../lib/unidades'
import {
  SIN_CATEGORIA,
  catalogoCategorias,
  claveCategoria,
  plegar,
  resolverCategoria,
  type CategoriaCatalogo,
} from './categorias'
import { crearMovimiento } from './movements'
import { convertirIngreso, snapshotIngreso, type CantidadIngreso } from './ingreso'
import { precioPorUnidadCompra, validarPrecio, type PrecioIngreso } from './precio'
import { normalizarPresentacion, validarPresentacion, type Presentacion } from './presentacion'
import { permiteDecimales } from './quantity'

/**
 * Spec 015 — presentación elegida en el alta, con "igual que la de consumo"
 * (`unidadCompra: null`) resuelto a la misma unidad y contenido 1.
 */
/** Spec 015 — el stock inicial con su unidad (por defecto, la de compra). */
export function stockInicialDe(input: AltaMaterialInput): CantidadIngreso {
  const presentacion = presentacionValida(input)
  const elegida = input.unidadStockInicial
  // Una unidad que ya no es de la presentación (se cambió después) vuelve a la de compra.
  const valida =
    elegida === presentacion.unidadCompra || elegida === presentacion.unidadMedida
  return {
    cantidad: input.stockInicial,
    unidad: valida && elegida ? elegida : presentacion.unidadCompra,
  }
}

/** La presentación del alta con contenido 1 si aún no es válido (solo para convertir). */
function presentacionValida(input: AltaMaterialInput) {
  const p = presentacionDeAlta(input)
  return { ...p, contenido: p.contenido !== null && p.contenido > 0 ? p.contenido : 1 }
}

export function presentacionDeAlta(input: AltaMaterialInput): Presentacion {
  return normalizarPresentacion({
    unidadMedida: input.unidadMedida,
    unidadCompra: input.unidadCompra ?? input.unidadMedida,
    contenido: input.contenido ?? null,
  })
}

/** Formulario "Nuevo Material" (spec 008 contracts/ui-contracts.md). */
export interface AltaMaterialInput {
  nombre: string
  categoria: string
  /** `true` solo si se usó "+ Crear nueva categoría" (US3). */
  categoriaNueva: boolean
  /** Unidad de consumo (spec 015 R2). */
  unidadMedida: Unidad
  /**
   * Spec 015 (FR-003/FR-006) — unidad de compra; `null` = "igual que la de
   * consumo" (contenido 1, sin pedirlo, FR-004). Cualquier rol la define en el
   * alta. Opcional para borradores anteriores a la spec.
   */
  unidadCompra?: Unidad | null
  /** Unidades de consumo por unidad de compra; ignorado si `unidadCompra` es `null`. */
  contenido?: number | null
  codigoFabricante: string
  stockMinimo: number | null
  caduca: boolean
  /** 0 por defecto — sin stock inicial. */
  stockInicial: number
  /**
   * Spec 015 (FR-009) — unidad de `stockInicial`; `null`/ausente = la unidad
   * de compra de la presentación elegida.
   */
  unidadStockInicial?: string | null
  /** Spec 015 (FR-013) — precio opcional del lote inicial. */
  precio?: PrecioIngreso
  /** Ignorado si `stockInicial === 0`. */
  lote: { numeroLote: string; proveedor: string; fechaCaducidad: string }
  confirmarCaducado: boolean
}

export type CampoAlta =
  | 'nombre'
  | 'categoria'
  | 'unidadMedida'
  | 'unidadCompra'
  | 'contenido'
  | 'stockMinimo'
  | 'stockInicial'
  | 'precio'
  | 'numeroLote'
  | 'proveedor'
  | 'fechaCaducidad'

export type ValidacionAlta =
  | { valido: true; advertencias: { loteCaducado: boolean } }
  | {
      valido: false
      errores: Partial<Record<CampoAlta, string>>
      advertencias: { loteCaducado: boolean }
    }

/**
 * Valida el formulario "Nuevo Material" (spec 008 FR-005..FR-018).
 * `hoy` es la fecha local `YYYY-MM-DD` de quien guarda, para comparar contra
 * `lote.fechaCaducidad` sin ambigüedad de huso horario.
 */
export function validarAltaMaterial(
  input: AltaMaterialInput,
  insumosActivos: Insumo[],
  catalogo: CategoriaCatalogo[],
  hoy: string,
): ValidacionAlta {
  const errores: Partial<Record<CampoAlta, string>> = {}
  const nombre = input.nombre.trim()

  if (!nombre) {
    errores.nombre = 'Ingresa el nombre del material.'
  } else if (
    insumosActivos.some(
      (otro) => claveNombre(otro.nombre) === claveNombre(nombre),
    )
  ) {
    errores.nombre = 'Ya existe un material activo con ese nombre.'
  }

  if (input.categoriaNueva) {
    const nombreCategoria = input.categoria.trim()
    if (!nombreCategoria || nombreCategoria.length > 40) {
      errores.categoria = 'Elige una categoría.'
    } else if (claveCategoria(nombreCategoria) === claveCategoria(SIN_CATEGORIA)) {
      errores.categoria = 'Ese nombre está reservado.'
    }
  } else if (!input.categoria.trim()) {
    errores.categoria = 'Elige una categoría.'
  } else if (resolverCategoria(input.categoria, catalogo) === null) {
    errores.categoria = 'Elige una categoría.'
  }

  if (!esUnidad(input.unidadMedida)) {
    errores.unidadMedida = 'Elige una unidad de medida válida.'
  } else {
    const erroresPresentacion = validarPresentacion(presentacionDeAlta(input))
    if (erroresPresentacion.unidadCompra) errores.unidadCompra = erroresPresentacion.unidadCompra
    if (erroresPresentacion.contenido) errores.contenido = erroresPresentacion.contenido
  }

  const errorStockMinimo = validarStockMinimo(input.stockMinimo, input.unidadMedida)
  if (errorStockMinimo) errores.stockMinimo = errorStockMinimo

  let loteCaducado = false
  if (input.stockInicial < 0) {
    errores.stockInicial = 'Ingresa una cantidad mayor o igual a cero.'
  } else if (input.stockInicial > 0) {
    const conversion = convertirIngreso(
      presentacionValida(input),
      stockInicialDe(input),
    )
    if (conversion.error) {
      errores.stockInicial = conversion.error
    }
    const errorPrecio = validarPrecio(input.precio ?? null)
    if (errorPrecio) errores.precio = errorPrecio
    if (!input.lote.numeroLote.trim()) {
      errores.numeroLote = 'Ingresa el número de lote.'
    }
    if (!input.lote.proveedor.trim()) {
      errores.proveedor = 'Ingresa el proveedor.'
    }
    if (input.caduca) {
      if (!input.lote.fechaCaducidad) {
        errores.fechaCaducidad = 'Ingresa la fecha de vencimiento.'
      } else {
        loteCaducado = input.lote.fechaCaducidad < hoy
      }
    }
  }

  const advertencias = { loteCaducado }
  return Object.keys(errores).length === 0
    ? { valido: true, advertencias }
    : { valido: false, errores, advertencias }
}

/**
 * Da de alta un material (spec 008 R3): valida, y en **una** transacción
 * Dexie escribe la categoría nueva (si corresponde), el insumo, el primer
 * lote + su ingreso (si `stockInicial > 0`) y borra el borrador. Cualquier
 * excepción aborta todo (FR-016, SC-003). Relee el estado dentro de la
 * transacción para que un doble toque con el mismo nombre falle por
 * duplicado en vez de crear dos materiales.
 */
export async function darDeAltaMaterial(
  input: AltaMaterialInput,
  opciones: { lugarId?: string } = {},
): Promise<{ insumo: Insumo; conLoteInicial: boolean }> {
  const usuarioId = getUsuarioActualId()
  if (!usuarioId) {
    throw new Error(
      'No hay un usuario autenticado local — no se puede dar de alta el material.',
    )
  }
  if (
    input.categoriaNueva &&
    useAuthStore.getState().usuario?.rol !== 'administrador'
  ) {
    throw new Error('Solo un administrador puede crear categorías.')
  }

  const tenantId = tenantActualOFallar()
  // Spec 014 FR-010: el lote inicial queda en el lugar activo (o el elegido
  // desde "Todos"). Sin stock inicial no hay lote, así que no hace falta lugar.
  const lugarId =
    input.stockInicial > 0 ? lugarParaEscribirOFallar(opciones.lugarId) : null
  const nombre = input.nombre.trim()
  const codigoFabricante = input.codigoFabricante.trim() || null
  const hoy = new Date().toISOString().slice(0, 10)

  return db.transaction(
    'rw',
    db.insumos,
    db.categorias,
    db.lotes,
    db.movimientos,
    db.borradores,
    async () => {
      const insumosActivos = (await db.insumos.toArray()).filter(
        (i) => !i.dadoDeBajaEn,
      )
      const catalogo = catalogoCategorias(
        await db.categorias.toArray(),
        insumosActivos,
      )

      const validacion = validarAltaMaterial(input, insumosActivos, catalogo, hoy)
      if (!validacion.valido) {
        throw new Error(Object.values(validacion.errores).join(' '))
      }
      if (validacion.advertencias.loteCaducado && !input.confirmarCaducado) {
        throw new Error('Confirma el ingreso de un lote ya caducado.')
      }

      let categoriaNombre: string
      if (input.categoriaNueva) {
        const resuelta = resolverCategoria(input.categoria, catalogo)
        if (resuelta !== null) {
          categoriaNombre = resuelta
        } else {
          const nuevaCategoria: Categoria = {
            id: crypto.randomUUID(),
            tenantId,
            nombre: input.categoria.trim(),
            creadoPor: usuarioId,
            creadoEn: new Date().toISOString(),
            sincronizado: false,
            rechazadoEn: null,
            desactivadoEn: null,
          }
          await db.categorias.add(nuevaCategoria)
          categoriaNombre = nuevaCategoria.nombre
        }
      } else {
        // Ya validado arriba: resuelve siempre.
        categoriaNombre = resolverCategoria(input.categoria, catalogo)!
      }

      const presentacion = presentacionDeAlta(input)
      const insumo: Insumo = {
        id: crypto.randomUUID(),
        tenantId,
        nombre,
        categoria: categoriaNombre,
        unidadMedida: presentacion.unidadMedida,
        unidadCompra: presentacion.unidadCompra,
        contenido: presentacion.contenido ?? 1,
        permiteDecimales: permiteDecimales(input.unidadMedida),
        caduca: input.caduca,
        codigoFabricante,
        creadoEn: new Date().toISOString(),
        stockMinimo: input.stockMinimo,
        dadoDeBajaEn: null,
        dadoDeBajaPor: null,
        creadoPor: usuarioId,
      }
      await db.insumos.add(insumo)

      let conLoteInicial = false
      if (input.stockInicial > 0 && lugarId) {
        const lote: Lote = {
          id: crypto.randomUUID(),
          tenantId,
          lugarId,
          insumoId: insumo.id,
          numeroLote: input.lote.numeroLote.trim(),
          proveedor: input.lote.proveedor.trim(),
          fechaCaducidad: input.caduca ? input.lote.fechaCaducidad : null,
          codigoFabricante: insumo.codigoFabricante,
          estado: 'activo',
          creadoEn: new Date().toISOString(),
          ...snapshotIngreso(insumo, stockInicialDe(input)),
          precioCompra: precioPorUnidadCompra(
            input.precio ?? null,
            convertirIngreso(insumo, stockInicialDe(input)).presentaciones,
          ),
        }
        await db.lotes.add(lote)
        await crearMovimiento({
          tipo: 'ingreso',
          loteId: lote.id,
          cantidad: convertirIngreso(insumo, stockInicialDe(input)).cantidadConsumo,
          lugarId,
          unidad: insumo.unidadMedida,
        })
        conLoteInicial = true
      }

      await db.borradores.delete('alta-material')

      return { insumo, conLoteInicial }
    },
  )
}

/**
 * Sugerencias de materiales existentes mientras se escribe el nombre
 * (spec 008 R8): desde 2 caracteres, comparando sin acentos/mayúsculas.
 */
export function sugerirMateriales(
  insumosActivos: Insumo[],
  texto: string,
  limite = 5,
): Insumo[] {
  const q = plegar(texto.trim())
  if (q.length < 2) return []
  return insumosActivos
    .filter((insumo) => plegar(insumo.nombre).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, limite)
}

function compararPorAntiguedad(a: Insumo, b: Insumo): number {
  if (a.creadoEn !== b.creadoEn) return a.creadoEn < b.creadoEn ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

/**
 * "Posible duplicado" (spec 008 R9): ids de insumos activos cuyo nombre
 * coincide con el de otro activo más antiguo `(creadoEn, id)`. Derivado, no
 * persistido: converge igual en todos los dispositivos.
 */
export function posiblesDuplicados(insumosActivos: Insumo[]): Set<string> {
  const grupos = new Map<string, Insumo[]>()
  for (const insumo of insumosActivos) {
    const clave = claveNombre(insumo.nombre)
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(insumo)
    else grupos.set(clave, [insumo])
  }

  const duplicados = new Set<string>()
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue
    const ordenado = [...grupo].sort(compararPorAntiguedad)
    for (const insumo of ordenado.slice(1)) duplicados.add(insumo.id)
  }
  return duplicados
}
