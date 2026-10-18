import type { ComponentType, ReactNode } from 'react'
import type { IconProps } from '../icons'

export type BadgeVariant =
  | 'success'
  | 'warning-30'
  | 'urgent-7'
  | 'urgent-1'
  | 'danger'
  | 'neutral'

export interface BadgeProps {
  variant: BadgeVariant
  /** Ícono del estado (DS §21): nunca solo color o texto (Constitución IV). */
  icono?: ComponentType<IconProps>
  children: ReactNode
}

/**
 * Shared status pill (feature 005, FR-005, contracts/design-system.md).
 * Every variant pairs a light background with a dark, saturated text color
 * verified >=4.5:1 WCAG AA against that background (research.md's
 * "Verifying alert color contrast" decision) — never a solid fill with
 * white text, which the mockup's own colors fail at as low as 2.04:1.
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-success-text',
  'warning-30': 'bg-warning-30-bg text-warning-30-text',
  'urgent-7': 'bg-urgent-7-bg text-urgent-7-text',
  'urgent-1': 'bg-urgent-1-bg text-urgent-1-text',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-bg-secondary text-text-muted',
}

export function Badge({ variant, icono: Icono, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-bold ${VARIANT_CLASSES[variant]}`}
    >
      {Icono && <Icono size={14} />}
      {children}
    </span>
  )
}
