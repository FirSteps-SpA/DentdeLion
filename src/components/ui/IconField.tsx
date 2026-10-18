import type { ReactNode } from 'react'

export interface IconFieldProps {
  label: string
  /** Omit for fields with no natural icon match — the label still renders. */
  icon?: ReactNode
  htmlFor: string
  hint?: string
  error?: string
  /** The `<input>`/`<select>` itself — style it as a plain, borderless,
   * transparent-background control; this wrapper provides the border,
   * padding, and >=48px touch target (FR-003). */
  children: ReactNode
}

/**
 * Shared label + icon + input wrapper (feature 005; DS §16 en la spec 013).
 * One place enforces the >=48px minimum height (Constitution III, FR-003) so
 * no restyled field can accidentally ship under it.
 */
export function IconField({
  label,
  icon,
  htmlFor,
  hint,
  error,
  children,
}: IconFieldProps) {
  return (
    <div className="group flex flex-col gap-1.5 text-[13px] font-semibold text-text">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {icon && <span className="text-text-muted">{icon}</span>}
        {label}
      </label>
      {/* DS §16: 44 px → 48 (Constitution III); foco con borde de 2 px y anillo. */}
      <div className="touch-target flex items-center gap-2.5 rounded-md border border-border-input bg-surface px-3.5 text-sm font-normal outline outline-0 outline-brand focus-within:outline-2 focus-within:shadow-[0_0_0_4px_rgb(18_184_174_/_0.1)] [&_input::placeholder]:text-text-muted [&_textarea::placeholder]:text-text-muted">
        {children}
      </div>
      {hint && <p className="text-caption text-text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
