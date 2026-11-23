/** Spec 027 (UI §1) — tonos de los cuadrados de ícono. */
export type TonoIcono = 'primario' | 'peligro' | 'aviso' | 'info'

/** Cuadrado de ícono con tinte por tono (UI §1); ícono ≥ 3:1 sobre su tinte. */
export const CUADRADO_TONO: Record<TonoIcono, string> = {
  primario: 'bg-tinte-primario text-brand-icon',
  peligro: 'bg-tinte-peligro text-danger',
  aviso: 'bg-tinte-aviso text-warning-icon',
  info: 'bg-tinte-info text-info-icon',
}
