/** Monto exacto del elemento resaltado, anunciado a lectores de pantalla. */
export function Detalle({ texto }: { texto: string | null }) {
  return (
    <p aria-live="polite" className="min-h-5 text-body font-semibold text-text">
      {texto ?? ''}
    </p>
  )
}
