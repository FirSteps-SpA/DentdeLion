import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useLogout } from '../features/auth/useLogout'
import { User } from '../components/icons'
import { iniciales } from './iniciales'

export interface MenuPerfilProps {
  /** "Ver perfil": abre Ajustes → Perfil. Sin ella, el menú no ofrece la opción. */
  onVerPerfil?: () => void
  /** Tamaño del círculo: 34 px en el encabezado móvil, 40 px en la barra superior. */
  tamano?: 'movil' | 'escritorio'
}

const ITEM_CLASS =
  'touch-target flex w-full items-center gap-2 rounded-md px-3 text-left text-sm font-semibold text-text hover:bg-bg focus-visible:bg-bg focus-visible:outline-none'

/**
 * Spec 032 US2 (FR-007/008/014, contracts/ui-contracts.md §4): el avatar con
 * las iniciales abre un menú pequeño anclado a él con el nombre y el correo,
 * "Ver perfil" y "Cerrar sesión" (el mismo de Ajustes → Perfil). Se cierra
 * con Escape (vuelve el foco al avatar) o tocando fuera; ↑/↓ recorren las
 * opciones. Área táctil ≥ 48 px (Constitución III).
 */
export function MenuPerfil({ onVerPerfil, tamano = 'escritorio' }: MenuPerfilProps) {
  const usuario = useAuthStore((s) => s.usuario)
  const { signOut } = useLogout()
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!abierto) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    function fuera(event: PointerEvent) {
      if (!contenedorRef.current?.contains(event.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  if (!usuario) return null

  function cerrar({ devolverFoco = true } = {}) {
    setAbierto(false)
    if (devolverFoco) botonRef.current?.focus()
  }

  function teclado(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cerrar()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    const actual = items.indexOf(document.activeElement as HTMLElement)
    const paso = event.key === 'ArrowDown' ? 1 : -1
    items[(actual + paso + items.length) % items.length]?.focus()
  }

  const circulo =
    tamano === 'movil' ? 'h-[34px] w-[34px] text-xs' : 'h-10 w-10 text-sm'

  return (
    <div ref={contenedorRef} className="relative shrink-0">
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? menuId : undefined}
        aria-label={`Menú de ${usuario.nombre}`}
        title={usuario.nombre}
        onClick={() => setAbierto((a) => !a)}
        className="touch-target flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span
          className={`flex items-center justify-center rounded-full bg-primary-soft font-bold text-primary-text ${circulo}`}
        >
          {iniciales(usuario.nombre)}
        </span>
      </button>
      {abierto && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={`Menú de ${usuario.nombre}`}
          onKeyDown={teclado}
          className="absolute top-full right-0 z-30 mt-2 flex w-64 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-card"
        >
          <div className="flex flex-col gap-0.5 px-3 py-2">
            <span className="truncate text-sm font-bold text-text">{usuario.nombre}</span>
            <span className="truncate text-xs text-text-muted">{usuario.email}</span>
          </div>
          <div className="h-px bg-border" aria-hidden="true" />
          {onVerPerfil && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                cerrar({ devolverFoco: false })
                onVerPerfil()
              }}
              className={ITEM_CLASS}
            >
              <User size={16} className="text-primary" />
              Ver perfil
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              cerrar({ devolverFoco: false })
              void signOut()
            }}
            className={ITEM_CLASS}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
