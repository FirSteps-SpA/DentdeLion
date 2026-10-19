import { db, type Categoria } from '../../../lib/db'
import { tenantActualOFallar } from '../../../stores/authStore'
import { exigirAdministrador, nuevoCambio } from '../../insumos/lib/catalogo'
import { reproyectarEnTransaccion } from '../../insumos/lib/proyeccion'
import {
  SIN_CATEGORIA,
  catalogoCategoriasCompleto,
  claveCategoria,
} from '../../insumos/lib/categorias'

const CLAVE_SIN_CATEGORIA = claveCategoria(SIN_CATEGORIA)

function validarNombreCategoria(nombre: string): string {
  const limpio = nombre.trim()
  if (!limpio || limpio.length > 40) {
    throw new Error('Elige un nombre de categoría de hasta 40 caracteres.')
  }
  if (claveCategoria(limpio) === CLAVE_SIN_CATEGORIA) {
    throw new Error('Ese nombre está reservado.')
  }
  return limpio
}

/**
 * Crea una categoría desde "Ajustes" (spec 010 FR-014), fuera del flujo de
 * alta de material — misma validación y deduplicación que la spec 008
 * (R2). Rechaza duplicados por clave normalizada, sin crear una fila.
 */
export async function crearCategoriaDesdeAjustes(nombre: string): Promise<void> {
  const usuarioId = exigirAdministrador('crear categorías')
  const limpio = validarNombreCategoria(nombre)

  await db.transaction('rw', db.categorias, db.insumos, async () => {
    const categorias = await db.categorias.toArray()
    const activos = (await db.insumos.toArray()).filter((i) => !i.dadoDeBajaEn)
    const catalogo = catalogoCategoriasCompleto(categorias, activos)
    if (catalogo.some((entrada) => entrada.clave === claveCategoria(limpio))) {
      throw new Error('Ya existe una categoría con ese nombre.')
    }

    const nueva: Categoria = {
      id: crypto.randomUUID(),
      tenantId: tenantActualOFallar(),
      nombre: limpio,
      creadoPor: usuarioId,
      creadoEn: new Date().toISOString(),
      sincronizado: false,
      rechazadoEn: null,
      desactivadoEn: null,
    }
    await db.categorias.add(nueva)
  })
}

export type ResultadoRenombrado =
  | { tipo: 'renombrada' }
  | { tipo: 'fusionada'; con: string }

/**
 * Renombra o fusiona una categoría creada (spec 010 FR-015/016, research.md
 * R3). Si el nuevo nombre normalizado no coincide con ninguna otra entrada
 * activa y "real" (precargada u otra creada — no un texto libre suelto) del
 * catálogo, renombra en el lugar. Si coincide, fusiona: la fila se
 * desactiva y sus materiales pasan a usar el nombre existente. En ambos
 * casos, cada `Insumo` (activo o dado de baja) cuya categoría coincidía por
 * clave con el nombre anterior se actualiza en la misma transacción.
 * Rechaza precargadas y "Sin categoría" (FR-019) — nunca tienen fila, así
 * que un `categoriaId` inexistente ya las cubre.
 */
export async function renombrarCategoria(
  categoriaId: string,
  nuevoNombre: string,
): Promise<ResultadoRenombrado> {
  const usuarioId = exigirAdministrador('renombrar categorías')
  const limpio = validarNombreCategoria(nuevoNombre)

  return db.transaction(
    'rw',
    db.categorias,
    db.insumos,
    db.cambiosInsumo,
    async () => {
      const categoria = await db.categorias.get(categoriaId)
      if (!categoria) throw new Error('La categoría no existe.')

      const claveAnterior = claveCategoria(categoria.nombre)
      const claveNueva = claveCategoria(limpio)

      const todasLasCategorias = await db.categorias.toArray()
      const todosLosInsumos = await db.insumos.toArray()
      const activos = todosLosInsumos.filter((i) => !i.dadoDeBajaEn)
      const catalogo = catalogoCategoriasCompleto(todasLasCategorias, activos)

      const colision = catalogo.find(
        (entrada) =>
          entrada.clave === claveNueva &&
          entrada.clave !== claveAnterior &&
          (entrada.origen === 'precargada' || entrada.origen === 'creada'),
      )

      let resultado: ResultadoRenombrado
      let nombreResultante: string
      if (colision) {
        await db.categorias.update(categoriaId, {
          nombre: limpio,
          desactivadoEn: new Date().toISOString(),
          sincronizado: false,
        })
        nombreResultante = colision.nombre
        resultado = { tipo: 'fusionada', con: colision.nombre }
      } else {
        await db.categorias.update(categoriaId, {
          nombre: limpio,
          sincronizado: false,
        })
        nombreResultante = limpio
        resultado = { tipo: 'renombrada' }
      }

      const afectados = todosLosInsumos.filter(
        (insumo) => claveCategoria(insumo.categoria) === claveAnterior,
      )
      if (afectados.length > 0) {
        await db.cambiosInsumo.bulkAdd(
          afectados.map((insumo) =>
            nuevoCambio(
              insumo.id,
              'categoria',
              insumo.categoria,
              nombreResultante,
              usuarioId,
            ),
          ),
        )
        await reproyectarEnTransaccion(afectados.map((i) => i.id))
      }

      return resultado
    },
  )
}

async function alternarDesactivacion(
  categoriaId: string,
  accion: string,
  desactivadoEn: string | null,
): Promise<void> {
  exigirAdministrador(accion)
  await db.transaction('rw', db.categorias, async () => {
    const categoria = await db.categorias.get(categoriaId)
    if (!categoria) throw new Error('La categoría no existe.')
    await db.categorias.update(categoriaId, {
      desactivadoEn,
      sincronizado: false,
    })
  })
}

/** FR-017: solo alterna `desactivadoEn`; nunca toca insumos. */
export async function desactivarCategoria(categoriaId: string): Promise<void> {
  await alternarDesactivacion(
    categoriaId,
    'desactivar categorías',
    new Date().toISOString(),
  )
}

/** FR-018: devuelve la categoría al selector de materiales. */
export async function reactivarCategoria(categoriaId: string): Promise<void> {
  await alternarDesactivacion(categoriaId, 'reactivar categorías', null)
}
