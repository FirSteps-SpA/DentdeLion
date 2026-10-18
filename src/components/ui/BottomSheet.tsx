import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from '../icons'
import { TouchButton } from './TouchButton'

export interface BottomSheetProps {
  titulo: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Panel inferior modal (feature 007, contracts/ui-contracts.md) — en móvil
 * sube desde abajo; desde tablet se muestra centrado como el modal del DS §36
 * (spec 013 FR-016: máx. 560 px, padding 24, radio 20). El único
 * primitivo de overlay para el menú de opciones, los formularios y la
 * confirmación de baja. Replica la semántica de `<dialog>` con ARIA (el
 * soporte de `showModal` en jsdom es incompleto, research.md R7): cierra
 * con fondo/Escape/"Cerrar", enfoca el primer control al abrir y devuelve el
 * foco al control que lo abrió al cerrar.
 */
export function BottomSheet({ titulo, onClose, children }: BottomSheetProps) {
  const tituloId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    const contenido = panelRef.current?.querySelector<HTMLElement>(
      `[data-sheet-body] :is(${FOCUSABLE})`,
    )
    const cerrar = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(contenido ?? cerrar)?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previo?.focus?.()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div
        data-testid="bottom-sheet-backdrop"
        className="absolute inset-0 bg-text/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-xl bg-surface p-4 text-left shadow-modal motion-safe:animate-[entrada-sheet_160ms_ease-out] md:max-w-[560px] md:rounded-xl md:p-6"
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            id={tituloId}
            className="text-h3 text-text md:text-[20px] md:leading-7"
          >
            {titulo}
          </h2>
          <TouchButton
            type="button"
            variant="ghost"
            onClick={onClose}
            aria-label="Cerrar"
            className="px-0"
          >
            <X size={18} />
          </TouchButton>
        </div>
        <div data-sheet-body className="flex flex-col gap-2">
          {children}
        </div>
      </div>
    </div>
  )
}
