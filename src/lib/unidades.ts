/**
 * Spec 015 (research.md R1) — catálogo fijo de unidades del DS §25, común a
 * todos los tenants. Las claves son las que se guardan en las filas; `pieza`
 * (anterior a esta spec) se normaliza a `unidad`.
 */
export const UNIDADES = [
  { clave: 'caja', singular: 'Caja', plural: 'cajas', decimales: false },
  { clave: 'frasco', singular: 'Frasco', plural: 'frascos', decimales: false },
  { clave: 'botella', singular: 'Botella', plural: 'botellas', decimales: false },
  { clave: 'jeringa', singular: 'Jeringa', plural: 'jeringas', decimales: false },
  { clave: 'cartucho', singular: 'Cartucho', plural: 'cartuchos', decimales: false },
  { clave: 'paquete', singular: 'Paquete', plural: 'paquetes', decimales: false },
  { clave: 'kit', singular: 'Kit', plural: 'kits', decimales: false },
  { clave: 'unidad', singular: 'Unidad', plural: 'unidades', decimales: false },
  { clave: 'rollo', singular: 'Rollo', plural: 'rollos', decimales: false },
  { clave: 'mL', singular: 'mL', plural: 'mL', decimales: true },
  { clave: 'L', singular: 'L', plural: 'L', decimales: true },
  { clave: 'g', singular: 'g', plural: 'g', decimales: true },
  { clave: 'mg', singular: 'mg', plural: 'mg', decimales: true },
  { clave: 'm', singular: 'm', plural: 'm', decimales: true },
  { clave: 'cm', singular: 'cm', plural: 'cm', decimales: true },
] as const

export type Unidad = (typeof UNIDADES)[number]['clave']

export const CLAVES_UNIDAD: readonly Unidad[] = UNIDADES.map((u) => u.clave)

const POR_CLAVE = new Map<string, (typeof UNIDADES)[number]>(
  UNIDADES.map((u) => [u.clave, u]),
)

export function esUnidad(valor: string): valor is Unidad {
  return POR_CLAVE.has(valor)
}

/** `pieza` (anterior a la spec 015) → `unidad`; el resto queda igual. */
export function normalizarUnidad(valor: string): string {
  return valor === 'pieza' ? 'unidad' : valor
}

/** FR-002 — solo las unidades de magnitud continua admiten decimales. */
export function unidadAdmiteDecimales(valor: string): boolean {
  return POR_CLAVE.get(normalizarUnidad(valor))?.decimales ?? false
}

/**
 * Sin cantidad: el nombre de la unidad ("Caja"). Con cantidad: singular si es
 * 1 y plural en minúscula si no ("cartuchos"). Una clave desconocida se
 * devuelve tal cual.
 */
export function etiquetaUnidad(valor: string, cantidad?: number): string {
  const unidad = POR_CLAVE.get(normalizarUnidad(valor))
  if (!unidad) return valor
  if (cantidad === undefined) return unidad.singular
  if (cantidad === 1) {
    return unidad.decimales ? unidad.singular : unidad.singular.toLocaleLowerCase('es')
  }
  return unidad.plural
}

const NUMERO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 })

export function formatearNumero(n: number): string {
  return NUMERO.format(n)
}

/** "1.250 mL", "2 cajas", "1 cartucho". */
export function formatearCantidad(n: number, unidad: string): string {
  return `${formatearNumero(n)} ${etiquetaUnidad(unidad, n)}`
}

/**
 * Spec 015 (research.md R9, FR-021) — equivalente del stock (en unidad de
 * consumo) en unidades de compra: "≈ 2 cajas + 20", "≈ 2 cajas", "≈ 2,5
 * frascos". `null` cuando ambas unidades son iguales, el contenido es 1 o
 * no alcanza a una presentación completa (no aporta nada).
 */
export function formatearEquivalente(
  stock: number,
  insumo: { unidadMedida: string; unidadCompra: string; contenido: number },
): string | null {
  if (
    insumo.unidadCompra === insumo.unidadMedida ||
    !(insumo.contenido > 0) ||
    insumo.contenido === 1
  ) {
    return null
  }
  if (unidadAdmiteDecimales(insumo.unidadMedida)) {
    const presentaciones = Math.round((stock / insumo.contenido) * 100) / 100
    return `≈ ${formatearCantidad(presentaciones, insumo.unidadCompra)}`
  }
  const completas = Math.floor(stock / insumo.contenido)
  // Menos de una presentación completa: el equivalente no aporta nada.
  if (completas <= 0) return null
  const resto = Math.round((stock - completas * insumo.contenido) * 1000) / 1000
  const base = `≈ ${formatearCantidad(completas, insumo.unidadCompra)}`
  return resto > 0 ? `${base} + ${formatearNumero(resto)}` : base
}
