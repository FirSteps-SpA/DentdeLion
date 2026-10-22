import type {
  CambioInsumo,
  CambioLote,
  CambioTratamiento,
  Categoria,
  Movimiento,
  TratamientoRealizado,
  UsuarioConocido,
} from '../db'
import type { ResultadoCiclo } from '../../stores/syncStore'

/** Spec 012 FR-011 — umbral cuando ningún administrador configuró otro. */
export const HORAS_AVISO_PENDIENTES_POR_DEFECTO = 24

/** Pendientes de un autor en este dispositivo (spec 012 data-model.md). */
export interface PendientesPorAutor {
  usuarioId: string
  movimientos: number
  cambiosInsumo: number
  categorias: number
  /** Spec 015 (R6) — correcciones de precio de lotes sin subir. */
  preciosLote?: number
  /** Spec 016 — cambios de tratamientos, registros y anulaciones sin subir. */
  tratamientos?: number
  /** `creadoEn` de cada pendiente, para calcular antigüedades con el reloj actual. */
  creados: string[]
}

export type EstadoIndicador =
  | 'sincronizado'
  | 'pendientes'
  | 'sin-conexion'
  | 'error'

export interface PendientesAjenos {
  usuarioId: string
  nombre: string
  total: number
  antiguo: boolean
}

export interface Indicador {
  estado: EstadoIndicador
  /** Pendientes del usuario con sesión (FR-003). */
  propios: number
  /** `propios` para mostrar: "99+" desde 100. */
  etiqueta: string
  motivoError: 'servidor' | 'sesion' | null
  desglosePropio: {
    movimientos: number
    cambiosInsumo: number
    categorias: number
    preciosLote: number
    tratamientos: number
  }
  ajenos: PendientesAjenos[]
  /** Pendientes (propios y ajenos) que superan el umbral (FR-010). */
  antiguos: number
  masAntiguoEn: string | null
  alerta: boolean
}

/**
 * Agrupa por autor lo que aún no llegó al servidor (spec 012 FR-003,
 * data-model.md): movimientos sin subir y cambios de insumo / categorías sin
 * subir que no fueron rechazados (esos ya se revirtieron y nunca se subirán).
 */
export function agruparPendientes(
  movimientos: Movimiento[],
  cambios: CambioInsumo[],
  categorias: Categoria[],
  /** Spec 015 — sin rechazos por rol: solo cuenta la bandera `sincronizado`. */
  cambiosLote: CambioLote[] = [],
  /** Spec 016. */
  tratamientos: { cambios: CambioTratamiento[]; realizados: TratamientoRealizado[] } = {
    cambios: [],
    realizados: [],
  },
): PendientesPorAutor[] {
  const porAutor = new Map<string, PendientesPorAutor>()
  const de = (usuarioId: string) => {
    let grupo = porAutor.get(usuarioId)
    if (!grupo) {
      grupo = { usuarioId, movimientos: 0, cambiosInsumo: 0, categorias: 0, creados: [] }
      porAutor.set(usuarioId, grupo)
    }
    return grupo
  }
  for (const movimiento of movimientos) {
    if (movimiento.sincronizado) continue
    const grupo = de(movimiento.usuarioId)
    grupo.movimientos++
    grupo.creados.push(movimiento.creadoEn)
  }
  for (const cambio of cambios) {
    if (cambio.sincronizado || cambio.rechazadoEn !== null) continue
    const grupo = de(cambio.usuarioId)
    grupo.cambiosInsumo++
    grupo.creados.push(cambio.creadoEn)
  }
  for (const categoria of categorias) {
    if (categoria.sincronizado || categoria.rechazadoEn !== null) continue
    const grupo = de(categoria.creadoPor)
    grupo.categorias++
    grupo.creados.push(categoria.creadoEn)
  }
  for (const cambio of cambiosLote) {
    if (cambio.sincronizado) continue
    const grupo = de(cambio.usuarioId)
    grupo.preciosLote = (grupo.preciosLote ?? 0) + 1
    grupo.creados.push(cambio.creadoEn)
  }
  const sumarTratamiento = (usuarioId: string, creadoEn: string) => {
    const grupo = de(usuarioId)
    grupo.tratamientos = (grupo.tratamientos ?? 0) + 1
    grupo.creados.push(creadoEn)
  }
  for (const cambio of tratamientos.cambios) {
    if (cambio.sincronizado || cambio.rechazadoEn !== null) continue
    sumarTratamiento(cambio.usuarioId, cambio.creadoEn)
  }
  for (const registro of tratamientos.realizados) {
    if (!registro.sincronizado) sumarTratamiento(registro.usuarioId, registro.creadoEn)
    else if (!registro.anulacionSincronizada && registro.anuladoPor && registro.anuladoEn) {
      sumarTratamiento(registro.anuladoPor, registro.anuladoEn)
    }
  }
  return [...porAutor.values()]
}

const totalDe = (grupo: PendientesPorAutor) =>
  grupo.movimientos +
  grupo.cambiosInsumo +
  grupo.categorias +
  (grupo.preciosLote ?? 0) +
  (grupo.tratamientos ?? 0)

export interface EntradaIndicador {
  usuarioId: string
  pendientes: PendientesPorAutor[]
  ultimoResultado: ResultadoCiclo['estado'] | null
  enLinea: boolean
  horasAviso: number
  ahora: number
  usuariosConocidos: UsuarioConocido[]
}

/**
 * Deriva lo que muestra el indicador (spec 012 data-model.md, FR-002/010/012).
 * Pura: sin Dexie ni React. Prioridad Error > Sin conexión > Pendientes >
 * Sincronizado; los pendientes ajenos nunca cambian el estado, pero sí pueden
 * activar la alerta de antigüedad (aclaración 2). Un reloj atrasado no da
 * antigüedades negativas.
 */
export function calcularIndicador(entrada: EntradaIndicador): Indicador {
  const limiteMs = entrada.horasAviso * 60 * 60 * 1000
  const esAntiguo = (creadoEn: string) =>
    Math.max(0, entrada.ahora - Date.parse(creadoEn)) > limiteMs

  const propio = entrada.pendientes.find((g) => g.usuarioId === entrada.usuarioId)
  const propios = propio ? totalDe(propio) : 0

  const nombres = new Map(entrada.usuariosConocidos.map((u) => [u.id, u.nombre]))
  const ajenos = entrada.pendientes
    .filter((g) => g.usuarioId !== entrada.usuarioId && totalDe(g) > 0)
    .map((g) => ({
      usuarioId: g.usuarioId,
      nombre: nombres.get(g.usuarioId) ?? 'otro usuario',
      total: totalDe(g),
      antiguo: g.creados.some(esAntiguo),
    }))

  const creadosAntiguos = entrada.pendientes
    .flatMap((g) => g.creados)
    .filter(esAntiguo)
    .sort()

  const estado: EstadoIndicador =
    entrada.ultimoResultado === 'error' || entrada.ultimoResultado === 'sesion'
      ? 'error'
      : !entrada.enLinea || entrada.ultimoResultado === 'sin-red'
        ? 'sin-conexion'
        : propios > 0
          ? 'pendientes'
          : 'sincronizado'

  return {
    estado,
    propios,
    etiqueta: propios > 99 ? '99+' : String(propios),
    motivoError:
      estado !== 'error'
        ? null
        : entrada.ultimoResultado === 'sesion'
          ? 'sesion'
          : 'servidor',
    desglosePropio: {
      movimientos: propio?.movimientos ?? 0,
      cambiosInsumo: propio?.cambiosInsumo ?? 0,
      categorias: propio?.categorias ?? 0,
      preciosLote: propio?.preciosLote ?? 0,
      tratamientos: propio?.tratamientos ?? 0,
    },
    ajenos,
    antiguos: creadosAntiguos.length,
    masAntiguoEn: creadosAntiguos[0] ?? null,
    alerta: creadosAntiguos.length > 0,
  }
}
