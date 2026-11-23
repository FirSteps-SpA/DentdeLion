import { ChevronDown } from '../../../components/icons'
import { useAuthStore } from '../../../stores/authStore'
import { AYUDAS, ORDEN_AYUDAS, ayudaParaRol, tituloAyuda } from '../contenido'
import { AyudaContenido } from './AyudaContenido'

/**
 * Spec 030 US3 (FR-006) — Ajustes → "Guía de uso": todas las ayudas visibles
 * para el rol, en el orden del menú, cada una desplegable con el mismo texto
 * de su "?".
 */
export function GuiaUsoSection() {
  const rol = useAuthStore((s) => s.usuario?.rol) ?? 'personal'
  const entradas = ORDEN_AYUDAS.flatMap((id) => {
    const ayuda = ayudaParaRol(AYUDAS[id], rol)
    return ayuda ? [{ id, ayuda, titulo: tituloAyuda(id, rol) }] : []
  })

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">
        La misma ayuda del botón "?" de cada pantalla, reunida para leerla de corrido.
      </p>
      {entradas.map(({ id, ayuda, titulo }) => (
        <details
          key={id}
          className="group rounded-lg border border-border bg-surface shadow-tarjeta"
        >
          <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-2 px-4 font-bold text-text [&::-webkit-details-marker]:hidden">
            {id.startsWith('ajustes:') ? `Ajustes · ${titulo}` : titulo}
            <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4">
            <AyudaContenido ayuda={ayuda} />
          </div>
        </details>
      ))}
    </div>
  )
}
