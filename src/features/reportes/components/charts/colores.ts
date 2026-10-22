import { OTRAS, type CategoriaGasto } from '../../lib/kpis'

/**
 * Spec 017 (research.md R7, DS §35) — colores de los gráficos como variables
 * CSS del `@theme`. El donut usa la paleta validada en orden fijo (3
 * turquesas + gris para "Otras"): los 4 turquesas del DS juntos no se
 * distinguen bien entre sí. Ningún texto usa estos colores: los valores van
 * en tinta de texto y el color solo identifica la marca.
 */
export const COLOR_SERIE = 'var(--color-chart-1)'
export const COLOR_NEGATIVO = 'var(--color-chart-negativo)'
export const COLOR_OTRAS = 'var(--color-chart-otras)'
export const PALETA_CATEGORIAS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
] as const
/** Hueco entre sectores y barras: el color de la superficie (DS §35, dataviz). */
export const COLOR_HUECO = 'var(--color-surface)'

/** Color de un sector del donut: "Otras" siempre en gris (orden fijo, nunca cíclico). */
export const colorCategoria = (categoria: CategoriaGasto, i: number) =>
  categoria.nombre === OTRAS ? COLOR_OTRAS : PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length]
