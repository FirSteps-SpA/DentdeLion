import type { ReactNode } from 'react'

export interface IconProps {
  size?: number
  className?: string
}

/**
 * Shared stroke-based icon set (feature 005, contracts/design-system.md) —
 * hand-authored rather than an icon-library dependency (research.md), so
 * every icon matches the approved mockup's exact style: 1.75px stroke,
 * round caps/joins, `currentColor` so callers set color via Tailwind's
 * `text-*` utilities.
 */
function makeIcon(paths: () => ReactNode) {
  return function Icon({ size = 20, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths()}
      </svg>
    )
  }
}

export const Tooth = ({ size = 20, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3c-1.66 0-3 .67-4 1.5C7 3.67 5.66 3 4 3 2.34 3 1 4.34 1 6c0 1.2.3 2.3.8 3.3.6 1.2 1 2.5 1.2 3.9l.6 4.6c.15 1.1 1.05 1.9 2.15 1.9.95 0 1.8-.6 2.1-1.5l1-3c.2-.6.7-1 1.15-1s.95.4 1.15 1l1 3c.3.9 1.15 1.5 2.1 1.5 1.1 0 2-.8 2.15-1.9l.6-4.6c.2-1.4.6-2.7 1.2-3.9.5-1 .8-2.1.8-3.3 0-1.66-1.34-3-3-3-1.66 0-3 .67-4 1.5C15 3.67 13.66 3 12 3z" />
  </svg>
)

export const Search = makeIcon(() => (
  <>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>
))

export const Scan = makeIcon(() => (
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </>
))

export const Calendar = makeIcon(() => (
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>
))

export const Hash = makeIcon(() => (
  <>
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </>
))

export const Truck = makeIcon(() => (
  <>
    <path d="M1 3h15v13H1z" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </>
))

export const Bell = makeIcon(() => (
  <>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>
))

export const Package = makeIcon(() => (
  <>
    <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
    <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    <line x1="12" y1="12" x2="12" y2="17" />
    <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" />
  </>
))

export const PackageMinus = makeIcon(() => (
  <>
    <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
    <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
    <line x1="9" y1="13" x2="15" y2="13" />
  </>
))

export const Check = makeIcon(() => <polyline points="20 6 9 17 4 12" />)

export const AlertTriangle = makeIcon(() => (
  <>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
))

export const ChevronDown = makeIcon(() => <polyline points="6 9 12 15 18 9" />)

export const ChevronRight = makeIcon(() => <polyline points="9 6 15 12 9 18" />)

export const Plus = makeIcon(() => (
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>
))

export const Minus = makeIcon(() => <line x1="5" y1="12" x2="19" y2="12" />)

export const Mail = makeIcon(() => (
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </>
))

export const X = makeIcon(() => (
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>
))

export const Lock = makeIcon(() => (
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
))

export const ShoppingCart = makeIcon(() => (
  <>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </>
))

export const Settings = makeIcon(() => (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
))

export const MoreVertical = makeIcon(() => (
  <>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </>
))

export const Undo = makeIcon(() => (
  <>
    <polyline points="9 14 4 9 9 4" />
    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
  </>
))

export const Pencil = makeIcon(() => (
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>
))

export const Share = makeIcon(() => (
  <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </>
))

export const Copy = makeIcon(() => (
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>
))

export const Trash = makeIcon(() => (
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </>
))

export const User = makeIcon(() => (
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.58-7 8-7s8 3 8 7" />
  </>
))

export const Building = makeIcon(() => (
  <>
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <line x1="9" y1="7" x2="9" y2="7.01" />
    <line x1="15" y1="7" x2="15" y2="7.01" />
    <line x1="9" y1="12" x2="9" y2="12.01" />
    <line x1="15" y1="12" x2="15" y2="12.01" />
    <line x1="9" y1="17" x2="9" y2="17.01" />
    <line x1="15" y1="17" x2="15" y2="17.01" />
  </>
))

export const Tag = makeIcon(() => (
  <>
    <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z" />
    <circle cx="7.5" cy="7.5" r="1.25" />
  </>
))

/** Spec 012 — estado "N pendientes" del indicador de sincronización. */
export const ArrowsSync = makeIcon(() => (
  <>
    <path d="M21 12a9 9 0 0 0-15.5-6.2L3 8" />
    <polyline points="3 3 3 8 8 8" />
    <path d="M3 12a9 9 0 0 0 15.5 6.2L21 16" />
    <polyline points="21 21 21 16 16 16" />
  </>
))

/** Spec 012 — estado "Sin conexión". */
export const CloudOff = makeIcon(() => (
  <>
    <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </>
))

/** Spec 012 — alerta de pendientes antiguos. */
export const Clock = makeIcon(() => (
  <>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </>
))
