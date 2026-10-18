import type { ButtonHTMLAttributes } from 'react'

export interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
}

const VARIANT_CLASSES: Record<NonNullable<TouchButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dark active:bg-primary-active disabled:bg-disabled-bg disabled:text-white',
  secondary:
    'bg-secondary-bg text-primary-text hover:bg-primary-soft disabled:text-text-faint',
  // Outline del DS §15.
  ghost:
    'border border-border-input bg-surface font-semibold text-teal-dark hover:border-brand hover:bg-bg disabled:text-text-faint',
}

/**
 * Shared button (feature 005; DS §13–15 en la spec 013, contracts/design-tokens.md)
 * — bakes in the >=48x48px touch target (Constitution III, FR-003: el DS
 * pide 44 px, aquí 48) so no call site has to remember the `touch-target`
 * utility individually.
 */
export function TouchButton({
  variant = 'primary',
  className = '',
  ...props
}: TouchButtonProps) {
  return (
    <button
      {...props}
      className={`touch-target flex items-center justify-center gap-2 rounded-md px-[18px] text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    />
  )
}
