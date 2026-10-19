import { MapPin } from '../components/icons'

/** Chip con el lugar de una fila en la vista "Todos" (spec 014 FR-013). */
export function ChipLugar({ nombre }: { nombre: string }) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center gap-1 truncate rounded-pill bg-bg-secondary px-2 py-px text-[11px] font-bold text-text-muted">
      <MapPin size={11} className="shrink-0" />
      {nombre}
    </span>
  )
}
