import { describe, expect, it } from 'vitest'
import { filtrarBreadcrumb } from '../../src/lib/sentry'

/** Spec 028 T013 (FR-008, SC-005; research.md R6). */
describe('Sentry no recibe lo que se escribe', () => {
  it('descarta los breadcrumbs ui.input (pueden llevar el paciente)', () => {
    expect(filtrarBreadcrumb({ category: 'ui.input', message: 'input#registro-paciente' })).toBeNull()
  })
  it('conserva los demás', () => {
    const clic = { category: 'ui.click', message: 'button' }
    expect(filtrarBreadcrumb(clic)).toBe(clic)
  })
})
