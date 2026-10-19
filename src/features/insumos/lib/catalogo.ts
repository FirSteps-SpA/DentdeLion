import {
  db,
  type CambioInsumo,
  type CampoEditableInsumo,
  type Insumo,
} from '../../../lib/db'
import { tenantActualOFallar, useAuthStore } from '../../../stores/authStore'
import {
  catalogoCategorias,
  resolverCategoria,
  type CategoriaCatalogo,
} from './categorias'
import { reproyectarEnTransaccion } from './proyeccion'
import { permiteDecimales } from './quantity'

/** Unidades de medida del alta/edición de insumos (spec 008 research.md R5). */
export const UNIDADES_MEDIDA = [
  'caja',
  'frasco',
  'pieza',
  'cartucho',
  'mL',
  'g',
] as const

export type UnidadMedida = (typeof UNIDADES_MEDIDA)[number]

export const ETIQUETAS_UNIDAD: Record<UnidadMedida, string> = {
  caja: 'Caja',
  frasco: 'Frasco',
  pieza: 'Pieza',
  cartucho: 'Cartucho',
  mL: 'mL',
  g: 'g',
}

export type CambiosInsumoInput = Partial<Pick<Insumo, CampoEditableInsumo>>

export type ValidacionEdicion =
  | { valido: true }
  | { valido: false; errores: Partial<Record<CampoEditableInsumo, string>> }

const CAMPOS_EDITABLES: CampoEditableInsumo[] = [
  'nombre',
  'categoria',
  'unidadMedida',
  'stockMinimo',
  'codigoFabricante',
  'caduca',
]

export function claveNombre(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es')
}

/**
 * Reglas de stock mínimo compartidas por el alta (spec 008) y la edición
 * (spec 007 FR-014): `null` (sin alerta) siempre es válido; si no, un
 * número ≥ 0, entero cuando la unidad no admite decimales.
 */
export function validarStockMinimo(
  minimo: number | null,
  unidadMedida: string,
): string | null {
  if (minimo === null) return null
  if (!Number.isFinite(minimo) || minimo < 0) {
    return 'El stock mínimo debe ser un número mayor o igual a 0.'
  }
  if (!permiteDecimales(unidadMedida) && !Number.isInteger(minimo)) {
    return `La unidad "${unidadMedida}" no admite decimales.`
  }
  return null
}

/** Normaliza lo escrito en el formulario al valor que se persiste. */
function normalizar(cambios: CambiosInsumoInput): CambiosInsumoInput {
  const normalizados: CambiosInsumoInput = { ...cambios }
  if (normalizados.nombre !== undefined)
    normalizados.nombre = normalizados.nombre.trim()
  if (normalizados.codigoFabricante !== undefined) {
    normalizados.codigoFabricante =
      normalizados.codigoFabricante?.trim() || null
  }
  return normalizados
}

/**
 * Validación de la edición de un insumo (spec 007 FR-014, data-model.md).
 * Devuelve un mensaje por campo inválido, para mostrarlo junto al campo.
 */
export function validarEdicionInsumo(
  insumo: Insumo,
  cambios: CambiosInsumoInput,
  insumosActivos: Insumo[],
  catalogo: CategoriaCatalogo[],
): ValidacionEdicion {
  const resultado = { ...insumo, ...normalizar(cambios) }
  const errores: Partial<Record<CampoEditableInsumo, string>> = {}

  if (!resultado.nombre) {
    errores.nombre = 'Ingresa el nombre comercial.'
  } else if (
    insumosActivos.some(
      (otro) =>
        otro.id !== insumo.id &&
        claveNombre(otro.nombre) === claveNombre(resultado.nombre),
    )
  ) {
    errores.nombre = 'Ya existe otro insumo con ese nombre.'
  }

  // Solo se valida contra el catálogo ofrecible cuando la categoría es
  // parte del cambio (spec 010 FR-017): editar otro campo de un insumo cuya
  // categoría ya fue desactivada no debe bloquearse por eso.
  if (
    'categoria' in cambios &&
    resolverCategoria(resultado.categoria, catalogo) === null
  ) {
    errores.categoria = 'Elige una categoría existente.'
  }

  if (
    !(UNIDADES_MEDIDA as readonly string[]).includes(resultado.unidadMedida)
  ) {
    errores.unidadMedida = 'Elige una unidad de medida válida.'
  }

  const errorStockMinimo = validarStockMinimo(
    resultado.stockMinimo,
    resultado.unidadMedida,
  )
  if (errorStockMinimo) errores.stockMinimo = errorStockMinimo

  return Object.keys(errores).length === 0
    ? { valido: true }
    : { valido: false, errores }
}

/** Exported for reuse outside this module (spec 010 — `categoriasAdmin.ts`/`clinica.ts`). */
export function exigirAdministrador(accion: string): string {
  const usuario = useAuthStore.getState().usuario
  if (usuario?.rol !== 'administrador') {
    throw new Error(`Solo un administrador puede ${accion} insumos.`)
  }
  return usuario.id
}

/** Exported for reuse outside this module (spec 010 — `categoriasAdmin.ts`). */
export function nuevoCambio(
  insumoId: string,
  campo: CambioInsumo['campo'],
  valorAnterior: CambioInsumo['valorAnterior'],
  valorNuevo: CambioInsumo['valorNuevo'],
  usuarioId: string,
): CambioInsumo {
  return {
    id: crypto.randomUUID(),
    tenantId: tenantActualOFallar(),
    insumoId,
    campo,
    valorAnterior,
    valorNuevo,
    usuarioId,
    creadoEn: new Date().toISOString(),
    sincronizado: false,
    rechazadoEn: null,
  }
}

/**
 * Edita los datos de producto de un insumo (spec 007 FR-013/FR-015): solo
 * administradores (FR-012), validado (FR-014), y registrado como un
 * `CambioInsumo` por campo realmente modificado en la misma transacción que
 * reproyecta la fila (FR-021a). Nunca toca lotes ni movimientos. Un guardado
 * sin diferencias no escribe nada.
 */
export async function editarInsumo(
  insumoId: string,
  cambios: CambiosInsumoInput,
): Promise<void> {
  const usuarioId = exigirAdministrador('editar')
  const normalizados = normalizar(cambios)

  await db.transaction(
    'rw',
    db.insumos,
    db.cambiosInsumo,
    db.categorias,
    async () => {
      const insumo = await db.insumos.get(insumoId)
      if (!insumo) throw new Error('El insumo no existe.')

      const activos = (await db.insumos.toArray()).filter(
        (i) => !i.dadoDeBajaEn,
      )
      const catalogo = catalogoCategorias(
        await db.categorias.toArray(),
        activos,
      )
      const validacion = validarEdicionInsumo(
        insumo,
        normalizados,
        activos,
        catalogo,
      )
      if (!validacion.valido) {
        throw new Error(Object.values(validacion.errores).join(' '))
      }

      const nuevos = CAMPOS_EDITABLES.filter(
        (campo) =>
          campo in normalizados && normalizados[campo] !== insumo[campo],
      ).map((campo) =>
        nuevoCambio(
          insumoId,
          campo,
          insumo[campo],
          normalizados[campo] ?? null,
          usuarioId,
        ),
      )
      if (nuevos.length === 0) return

      await db.cambiosInsumo.bulkAdd(nuevos)
      await reproyectarEnTransaccion([insumoId])
    },
  )
}

/**
 * Baja lógica (spec 007 FR-018): solo administradores; un `CambioInsumo`
 * `'baja'` + reproyección. No escribe movimientos aunque quede stock
 * (Clarification Q5) — lotes e historial quedan intactos.
 */
export async function darDeBajaInsumo(insumoId: string): Promise<void> {
  const usuarioId = exigirAdministrador('eliminar')

  await db.transaction('rw', db.insumos, db.cambiosInsumo, async () => {
    const insumo = await db.insumos.get(insumoId)
    if (!insumo) throw new Error('El insumo no existe.')
    if (insumo.dadoDeBajaEn) return

    await db.cambiosInsumo.add(
      nuevoCambio(insumoId, 'baja', null, true, usuarioId),
    )
    await reproyectarEnTransaccion([insumoId])
  })
}

/**
 * Restaura un insumo dado de baja (spec 010 FR-023/024): inversa de
 * `darDeBajaInsumo` — un `CambioInsumo` `'baja'` con `valorNuevo: null` +
 * reproyección (research.md R2: la más reciente de estas entradas manda).
 * Solo administradores. No-op si el insumo ya está activo. No reconstruye
 * nada: sus lotes y movimientos nunca se borraron (spec 007), solo estaban
 * ocultos de las vistas operativas.
 */
export async function restaurarInsumo(insumoId: string): Promise<void> {
  const usuarioId = exigirAdministrador('restaurar')

  await db.transaction('rw', db.insumos, db.cambiosInsumo, async () => {
    const insumo = await db.insumos.get(insumoId)
    if (!insumo) throw new Error('El insumo no existe.')
    if (!insumo.dadoDeBajaEn) return

    await db.cambiosInsumo.add(
      nuevoCambio(insumoId, 'baja', true, null, usuarioId),
    )
    await reproyectarEnTransaccion([insumoId])
  })
}
