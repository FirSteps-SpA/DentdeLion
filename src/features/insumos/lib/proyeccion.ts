import { db, type CambioInsumo, type Insumo } from '../../../lib/db'
import { permiteDecimales } from './quantity'
import { normalizarUnidad } from '../../../lib/unidades'

/** Orden total y determinista del ledger: `(creadoEn, id)` (research.md R9). */
export function compararCambios(
  a: { creadoEn: string; id: string },
  b: { creadoEn: string; id: string },
): number {
  if (a.creadoEn !== b.creadoEn) return a.creadoEn < b.creadoEn ? -1 : 1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

type FilaEditable = Record<string, unknown>

/**
 * Spec 015 (research.md R1): `pieza` → `unidad`, por si un cambio o una fila
 * anterior a la migración la trae. Sin `unidadCompra` (fila sin la columna),
 * vale la unidad de consumo con contenido 1.
 */
function normalizarUnidades(fila: Insumo): void {
  fila.unidadMedida = normalizarUnidad(fila.unidadMedida)
  fila.unidadCompra = normalizarUnidad(fila.unidadCompra ?? fila.unidadMedida)
  fila.contenido ??= 1
}

/**
 * Deshace sobre `fila` los `cambios` dados, campo por campo, devolviendo cada
 * campo al `valorAnterior` del cambio más antiguo de ese campo — el valor que
 * tenía la fila antes de que se aplicaran. Una `'baja'` deshecha deja el
 * insumo activo.
 */
function deshacerCambios(fila: Insumo, cambios: CambioInsumo[]): void {
  const vistos = new Set<string>()
  for (const cambio of [...cambios].sort(compararCambios)) {
    if (vistos.has(cambio.campo)) continue
    vistos.add(cambio.campo)
    if (cambio.campo === 'baja') {
      fila.dadoDeBajaEn = null
      fila.dadoDeBajaPor = null
    } else {
      ;(fila as unknown as FilaEditable)[cambio.campo] = cambio.valorAnterior
    }
  }
}

/**
 * Proyecta la fila `Insumo` desde su ledger de cambios (spec 007 FR-021a,
 * generalizado en spec 010 research.md R2): por cada campo, incluido
 * `'baja'`, gana el cambio con mayor `(creadoEn, id)` — igual que cualquier
 * otro campo, sin caso especial. Un `'baja'` con `valorNuevo: true` deja el
 * insumo dado de baja (con el `creadoEn`/`usuarioId` de esa entrada); uno
 * con `valorNuevo: null` (restaurar, spec 010 FR-023) lo deja activo. Esto
 * reemplaza la regla anterior ("la primera baja vigente siempre gana"), que
 * solo tenía sentido cuando `'baja'` no era reversible. Un cambio rechazado
 * por el servidor (FR-021b) no participa y además se deshace sobre la fila,
 * que pudo haberlo recibido al guardarse localmente. Pura: el mismo
 * conjunto de cambios produce la misma fila en cualquier dispositivo, sin
 * importar el orden en que llegaron.
 */
export function proyectarInsumo(
  insumo: Insumo,
  cambios: CambioInsumo[],
): Insumo {
  const delInsumo = cambios.filter((cambio) => cambio.insumoId === insumo.id)
  const vigentes = delInsumo
    .filter((cambio) => cambio.rechazadoEn === null)
    .sort(compararCambios)

  const proyectado: Insumo = { ...insumo }
  deshacerCambios(
    proyectado,
    delInsumo.filter((cambio) => cambio.rechazadoEn !== null),
  )

  for (const cambio of vigentes) {
    if (cambio.campo === 'baja') continue
    // Ascending order: each later cambio overwrites the previous winner.
    ;(proyectado as unknown as FilaEditable)[cambio.campo] = cambio.valorNuevo
  }

  const ultimaBaja = [...vigentes]
    .reverse()
    .find((cambio) => cambio.campo === 'baja')
  if (ultimaBaja && ultimaBaja.valorNuevo === true) {
    proyectado.dadoDeBajaEn = ultimaBaja.creadoEn
    proyectado.dadoDeBajaPor = ultimaBaja.usuarioId
  } else if (ultimaBaja) {
    proyectado.dadoDeBajaEn = null
    proyectado.dadoDeBajaPor = null
  }
  normalizarUnidades(proyectado)
  proyectado.permiteDecimales = permiteDecimales(proyectado.unidadMedida)
  return proyectado
}

/**
 * Fila a subir a Supabase (contracts/supabase-schema.md, paso 1): la fila
 * local con los cambios aún no sincronizados deshechos. Así la fila remota
 * nunca adelanta un cambio que el servidor todavía no aceptó en
 * `cambios_insumo` (o que rechazó) — cada dispositivo lo aplica desde el
 * ledger al reproyectar, y un cambio rechazado nunca llega a los demás a
 * través de `insumos`, que no tiene RLS.
 */
export function filaParaSubir(insumo: Insumo, cambios: CambioInsumo[]): Insumo {
  const pendientes = cambios.filter(
    (cambio) => cambio.insumoId === insumo.id && !cambio.sincronizado,
  )
  if (pendientes.length === 0) return insumo
  const fila: Insumo = { ...insumo }
  deshacerCambios(fila, pendientes)
  // The most recent *synced* baja/restaurar still stands even if a later
  // pending one is undone (research.md R2 — same "last wins" rule as the
  // rest of the projection, not just the first-ever baja).
  const bajaSincronizada = cambios
    .filter(
      (cambio) =>
        cambio.insumoId === insumo.id &&
        cambio.sincronizado &&
        cambio.rechazadoEn === null &&
        cambio.campo === 'baja',
    )
    .sort(compararCambios)
    .at(-1)
  if (bajaSincronizada) {
    if (bajaSincronizada.valorNuevo === true) {
      fila.dadoDeBajaEn = bajaSincronizada.creadoEn
      fila.dadoDeBajaPor = bajaSincronizada.usuarioId
    } else {
      fila.dadoDeBajaEn = null
      fila.dadoDeBajaPor = null
    }
  }
  normalizarUnidades(fila)
  fila.permiteDecimales = permiteDecimales(fila.unidadMedida)
  return fila
}

function mismaFila(a: Insumo, b: Insumo): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Reproyecta filas ya dentro de una transacción `rw` sobre insumos +
 * cambiosInsumo — para quien ya tiene una abierta (catalogo.ts).
 */
export async function reproyectarEnTransaccion(
  insumoIds?: string[],
): Promise<void> {
  const cambios = await db.cambiosInsumo.toArray()
  const ids = insumoIds ?? [
    ...new Set(cambios.map((cambio) => cambio.insumoId)),
  ]

  for (const id of ids) {
    const insumo = await db.insumos.get(id)
    if (!insumo) continue
    const proyectado = proyectarInsumo(
      insumo,
      cambios.filter((cambio) => cambio.insumoId === id),
    )
    if (!mismaFila(insumo, proyectado)) await db.insumos.put(proyectado)
  }
}

/**
 * Aplica la proyección a Dexie para los insumos indicados (o todos los que
 * tengan cambios) — usado por la sincronización tras bajar cambios/filas.
 */
export async function reproyectarInsumos(insumoIds?: string[]): Promise<void> {
  await db.transaction('rw', db.insumos, db.cambiosInsumo, () =>
    reproyectarEnTransaccion(insumoIds),
  )
}
