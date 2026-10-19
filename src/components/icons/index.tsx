/* eslint-disable react-refresh/only-export-components -- módulo de íconos sin
 * estado creados con `deLucide`: Fast Refresh no aporta aquí y la regla
 * marcaba cada ícono. */
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft as LucideArrowLeft,
  Bell as LucideBell,
  Boxes as LucideBoxes,
  Building2,
  Calendar as LucideCalendar,
  Check as LucideCheck,
  ChevronDown as LucideChevronDown,
  ChevronRight as LucideChevronRight,
  CircleAlert as LucideCircleAlert,
  CircleCheck as LucideCircleCheck,
  CircleUserRound,
  Clock3,
  CloudOff as LucideCloudOff,
  Copy as LucideCopy,
  Ellipsis,
  Hash as LucideHash,
  House as LucideHouse,
  Lock as LucideLock,
  Mail as LucideMail,
  Menu as LucideMenu,
  Minus as LucideMinus,
  Package as LucidePackage,
  PackageMinus as LucidePackageMinus,
  PanelLeftClose as LucidePanelLeftClose,
  PanelLeftOpen as LucidePanelLeftOpen,
  Pencil as LucidePencil,
  Plus as LucidePlus,
  RefreshCw,
  ScanLine,
  Search as LucideSearch,
  Settings as LucideSettings,
  Share2,
  ShoppingCart as LucideShoppingCart,
  Tag as LucideTag,
  Trash2,
  TriangleAlert,
  Truck as LucideTruck,
  Undo2,
  X as LucideX,
  ArrowRightLeft,
  Link as LucideLink,
  MapPin as LucideMapPin,
  MessageCircle as LucideMessageCircle,
  Users as LucideUsers,
} from 'lucide-react'

export interface IconProps {
  size?: number
  className?: string
}

/**
 * Íconos de la app (spec 013, DS §6–8): Lucide outline con trazo de 2 px y
 * `currentColor`, detrás de los mismos nombres que ya usaban los componentes
 * (research.md R3) — los imports existentes no cambian. Se importa ícono por
 * ícono para que el build quede tree-shaken y todo funcione offline (nunca un
 * CDN, Constitución I). Decorativos: `aria-hidden`; el texto accesible va en
 * el control que los contiene.
 */
function deLucide(Icono: LucideIcon) {
  return function Icon({ size = 20, className }: IconProps) {
    return (
      <Icono
        size={size}
        strokeWidth={2}
        className={className}
        aria-hidden="true"
      />
    )
  }
}

/**
 * Diente de marca propio (DS §7, "Icono DentDelion"): outline geométrico,
 * trazo de 2 px y esquinas redondeadas. Mismo dibujo que `public/icons/icon.svg`.
 */
export const Tooth = ({ size = 20, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M7.5 3.5C5.3 3.5 4 5.2 4 7.6c0 1.6.5 3 1 4.4.5 1.4.7 2.8.9 4.3l.4 3.1c.1.9.8 1.6 1.7 1.6.8 0 1.4-.5 1.6-1.3l.9-3.4c.2-.7.8-1.1 1.5-1.1s1.3.4 1.5 1.1l.9 3.4c.2.8.8 1.3 1.6 1.3.9 0 1.6-.7 1.7-1.6l.4-3.1c.2-1.5.4-2.9.9-4.3.5-1.4 1-2.8 1-4.4 0-2.4-1.3-4.1-3.5-4.1-1.3 0-2.3.5-3.2 1.1-.6.4-1.1.6-1.8.6s-1.2-.2-1.8-.6c-.9-.6-1.9-1.1-3.2-1.1Z" />
  </svg>
)

// Navegación y secciones (DS §7)
export const House = deLucide(LucideHouse)
export const Boxes = deLucide(LucideBoxes)
export const Package = deLucide(LucidePackage)
export const PackageMinus = deLucide(LucidePackageMinus)
export const ShoppingCart = deLucide(LucideShoppingCart)
export const Bell = deLucide(LucideBell)
export const Settings = deLucide(LucideSettings)
export const Menu = deLucide(LucideMenu)
export const PanelLeftClose = deLucide(LucidePanelLeftClose)
export const PanelLeftOpen = deLucide(LucidePanelLeftOpen)
export const ArrowLeft = deLucide(LucideArrowLeft)

// Acciones
export const Search = deLucide(LucideSearch)
export const Scan = deLucide(ScanLine)
export const Plus = deLucide(LucidePlus)
export const Minus = deLucide(LucideMinus)
export const Pencil = deLucide(LucidePencil)
export const Trash = deLucide(Trash2)
export const Share = deLucide(Share2)
export const Copy = deLucide(LucideCopy)
export const Undo = deLucide(Undo2)
export const X = deLucide(LucideX)
export const MoreVertical = deLucide(Ellipsis)
export const ChevronDown = deLucide(LucideChevronDown)
export const ChevronRight = deLucide(LucideChevronRight)

// Estados (DS §21)
export const Check = deLucide(LucideCheck)
export const CircleCheck = deLucide(LucideCircleCheck)
export const CircleAlert = deLucide(LucideCircleAlert)
export const AlertTriangle = deLucide(TriangleAlert)
export const Clock = deLucide(Clock3)
export const ArrowsSync = deLucide(RefreshCw)
export const CloudOff = deLucide(LucideCloudOff)

// Campos y datos
export const Calendar = deLucide(LucideCalendar)
export const Hash = deLucide(LucideHash)
export const Truck = deLucide(LucideTruck)
export const Mail = deLucide(LucideMail)
export const Lock = deLucide(LucideLock)
export const Tag = deLucide(LucideTag)
export const User = deLucide(CircleUserRound)
export const Building = deLucide(Building2)
// Spec 014: lugares de trabajo, traslados, equipo e invitaciones.
export const MapPin = deLucide(LucideMapPin)
export const Traslado = deLucide(ArrowRightLeft)
export const Users = deLucide(LucideUsers)
export const Link = deLucide(LucideLink)
export const MessageCircle = deLucide(LucideMessageCircle)
