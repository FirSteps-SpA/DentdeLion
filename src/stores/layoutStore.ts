import { create } from 'zustand'

const CLAVE = 'dentdelion.sidebar'

function leerPreferencia(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

/**
 * Preferencia de interfaz local del dispositivo (spec 013 FR-013, research.md
 * R6): sidebar expandida o contraída en tablet, contraída por defecto. No es un
 * dato de inventario: va en `localStorage` (con try/catch, puede no estar
 * disponible) y nunca se sincroniza.
 */
interface LayoutState {
  sidebarExpandida: boolean
  alternarSidebar: () => void
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarExpandida: leerPreferencia(),
  alternarSidebar: () => {
    const valor = !get().sidebarExpandida
    set({ sidebarExpandida: valor })
    try {
      localStorage.setItem(CLAVE, valor ? '1' : '0')
    } catch {
      // Sin almacenamiento: la preferencia dura solo esta sesión.
    }
  },
}))
