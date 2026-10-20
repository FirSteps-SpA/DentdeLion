import {
  db,
  type CambioTratamiento,
  type Insumo,
  type MaterialTratamiento,
} from '../../../lib/db'
import { unidadAdmiteDecimales } from '../../../lib/unidades'
import { tenantActualOFallar, useAuthStore } from '../../../stores/authStore'
import { proyectarTratamientos, type TratamientoProyectado } from './proyeccion'

/** FR-004: solo administración define tratamientos y porcentajes. */
function exigirAdministrador(accion: string): string {
  const usuario = useAuthStore.getState().usuario
  if (usuario?.rol !== 'administrador') {
    throw new Error(`Solo un administrador puede ${accion} tratamientos.`)
  }
  return usuario.id
}

/** Formulario de tratamiento (contracts/ui-contracts.md §3). */
export interface TratamientoInput {
  nombre: string
  /** Cantidades en la unidad de consumo **actual** de cada insumo. */
  materiales: { insumoId: string; cantidad: number }[]
  /** Precio por lugar; `null` o ausente = sin precio en ese lugar (Q1). */
  precios: Record<string, number | null>
}

export type CampoTratamientoInput = 'nombre' | 'materiales' | 'precios'

const clave = (nombre: string) => nombre.trim().toLocaleLowerCase('es')

/**
 * Spec 016 FR-001: nombre (1–80, único en el tenant sin distinguir mayúsculas
 * ni espacios), materiales con cantidad > 0 (entera si la unidad no admite
 * decimales) sin insumos repetidos, precios ≥ 0. Mensajes por campo.
 */
export function validarTratamiento(
  input: TratamientoInput,
  existentes: TratamientoProyectado[],
  insumos: Map<string, Insumo>,
  idActual?: string,
): Partial<Record<CampoTratamientoInput, string>> {
  const errores: Partial<Record<CampoTratamientoInput, string>> = {}
  const nombre = input.nombre.trim()
  if (!nombre || nombre.length > 80) {
    errores.nombre = 'Ingresa un nombre de hasta 80 caracteres.'
  } else if (existentes.some((t) => t.id !== idActual && clave(t.nombre) === clave(nombre))) {
    errores.nombre = 'Ya existe un tratamiento con ese nombre.'
  }

  const vistos = new Set<string>()
  for (const material of input.materiales) {
    const insumo = insumos.get(material.insumoId)
    if (!insumo) {
      errores.materiales = 'Elige materiales del inventario.'
      break
    }
    if (vistos.has(material.insumoId)) {
      errores.materiales = `"${insumo.nombre}" está repetido.`
      break
    }
    vistos.add(material.insumoId)
    if (!Number.isFinite(material.cantidad) || material.cantidad <= 0) {
      errores.materiales = `La cantidad de "${insumo.nombre}" debe ser mayor que cero.`
      break
    }
    if (!unidadAdmiteDecimales(insumo.unidadMedida) && !Number.isInteger(material.cantidad)) {
      errores.materiales = `"${insumo.nombre}" se cuenta en ${insumo.unidadMedida}: usa un número entero.`
      break
    }
  }

  if (
    Object.values(input.precios).some(
      (precio) => precio !== null && (!Number.isFinite(precio) || precio < 0),
    )
  ) {
    errores.precios = 'Los precios deben ser montos mayores o iguales a 0.'
  }
  return errores
}

function materialesDe(
  input: TratamientoInput,
  insumos: Map<string, Insumo>,
): MaterialTratamiento[] {
  return input.materiales.map((m) => ({
    insumoId: m.insumoId,
    cantidad: m.cantidad,
    unidad: insumos.get(m.insumoId)?.unidadMedida ?? 'unidad',
  }))
}

function nuevoCambio(
  usuarioId: string,
  campo: CambioTratamiento['campo'],
  valorAnterior: CambioTratamiento['valorAnterior'],
  valorNuevo: CambioTratamiento['valorNuevo'],
  {
    tratamientoId = null,
    lugarId = null,
  }: { tratamientoId?: string | null; lugarId?: string | null },
): CambioTratamiento {
  return {
    id: crypto.randomUUID(),
    tenantId: tenantActualOFallar(),
    tratamientoId,
    lugarId,
    campo,
    valorAnterior,
    valorNuevo,
    usuarioId,
    creadoEn: new Date().toISOString(),
    sincronizado: false,
    rechazadoEn: null,
  }
}

async function contexto() {
  const [filas, cambios, insumos] = await Promise.all([
    db.tratamientos.toArray(),
    db.cambiosTratamiento.toArray(),
    db.insumos.toArray(),
  ])
  return {
    tratamientos: proyectarTratamientos(filas, cambios),
    insumos: new Map(insumos.map((i) => [i.id, i])),
  }
}

function lanzarSiInvalido(errores: Partial<Record<CampoTratamientoInput, string>>) {
  const mensajes = Object.values(errores)
  if (mensajes.length > 0) throw new Error(mensajes.join(' '))
}

const mismosMateriales = (a: MaterialTratamiento[], b: MaterialTratamiento[]) =>
  JSON.stringify(a) === JSON.stringify(b)

/**
 * Spec 016 US1 (FR-001/FR-003): crea la fila de identidad y los cambios de
 * nombre, estado, materiales y cada precio definido, en una transacción Dexie
 * (Constitución I). Solo administración.
 */
export async function crearTratamiento(input: TratamientoInput): Promise<string> {
  const usuarioId = exigirAdministrador('crear')
  return db.transaction(
    'rw',
    [db.tratamientos, db.cambiosTratamiento, db.insumos],
    async () => {
      const { tratamientos, insumos } = await contexto()
      lanzarSiInvalido(validarTratamiento(input, tratamientos, insumos))
      const id = crypto.randomUUID()
      await db.tratamientos.add({
        id,
        tenantId: tenantActualOFallar(),
        creadoPor: usuarioId,
        creadoEn: new Date().toISOString(),
        sincronizado: false,
        rechazadoEn: null,
      })
      const cambios = [
        nuevoCambio(usuarioId, 'nombre', null, input.nombre.trim(), { tratamientoId: id }),
        nuevoCambio(usuarioId, 'activo', null, true, { tratamientoId: id }),
        nuevoCambio(usuarioId, 'materiales', null, materialesDe(input, insumos), {
          tratamientoId: id,
        }),
        ...Object.entries(input.precios)
          .filter(([, precio]) => precio !== null)
          .map(([lugarId, precio]) =>
            nuevoCambio(usuarioId, 'precio', null, precio, { tratamientoId: id, lugarId }),
          ),
      ]
      await db.cambiosTratamiento.bulkAdd(cambios)
      return id
    },
  )
}

/**
 * Edita un tratamiento escribiendo solo los cambios reales (FR-003): no altera
 * los tratamientos ya registrados, que guardan su snapshot (FR-016).
 */
export async function editarTratamiento(id: string, input: TratamientoInput): Promise<void> {
  const usuarioId = exigirAdministrador('editar')
  await db.transaction(
    'rw',
    [db.tratamientos, db.cambiosTratamiento, db.insumos],
    async () => {
      const { tratamientos, insumos } = await contexto()
      const actual = tratamientos.find((t) => t.id === id)
      if (!actual) throw new Error('El tratamiento no existe.')
      lanzarSiInvalido(validarTratamiento(input, tratamientos, insumos, id))

      const cambios: CambioTratamiento[] = []
      const nombre = input.nombre.trim()
      if (nombre !== actual.nombre) {
        cambios.push(nuevoCambio(usuarioId, 'nombre', actual.nombre, nombre, { tratamientoId: id }))
      }
      const materiales = materialesDe(input, insumos)
      if (!mismosMateriales(materiales, actual.materiales)) {
        cambios.push(
          nuevoCambio(usuarioId, 'materiales', actual.materiales, materiales, {
            tratamientoId: id,
          }),
        )
      }
      for (const [lugarId, precio] of Object.entries(input.precios)) {
        const anterior = actual.precios.get(lugarId) ?? null
        if (anterior !== precio) {
          cambios.push(
            nuevoCambio(usuarioId, 'precio', anterior, precio, { tratamientoId: id, lugarId }),
          )
        }
      }
      if (cambios.length > 0) await db.cambiosTratamiento.bulkAdd(cambios)
    },
  )
}

/** Desactivar / reactivar (US1-5): los registros pasados se conservan. */
export async function cambiarActivo(id: string, activo: boolean): Promise<void> {
  const usuarioId = exigirAdministrador(activo ? 'reactivar' : 'desactivar')
  await db.transaction('rw', [db.tratamientos, db.cambiosTratamiento], async () => {
    const actual = proyectarTratamientos(
      await db.tratamientos.toArray(),
      await db.cambiosTratamiento.toArray(),
    ).find((t) => t.id === id)
    if (!actual) throw new Error('El tratamiento no existe.')
    if (actual.activo === activo) return
    await db.cambiosTratamiento.add(
      nuevoCambio(usuarioId, 'activo', actual.activo, activo, { tratamientoId: id }),
    )
  })
}

/**
 * Spec 016 US4 (FR-012, Q2): % profesional de un lugar, 0–100 o `null` para
 * quitarlo. Aplica hacia adelante; los registros guardan su snapshot. No
 * escribe nada si no cambia.
 */
export async function fijarPorcentajeLugar(
  lugarId: string,
  porcentaje: number | null,
  porcentajeActual: number | null,
): Promise<void> {
  const usuarioId = exigirAdministrador('cambiar el porcentaje de')
  if (
    porcentaje !== null &&
    (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)
  ) {
    throw new Error('El porcentaje profesional debe estar entre 0 y 100.')
  }
  if (porcentaje === porcentajeActual) return
  await db.cambiosTratamiento.add(
    nuevoCambio(usuarioId, 'porcentajeProfesional', porcentajeActual, porcentaje, { lugarId }),
  )
}
