import { fireEvent } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * Spec 018 FR-005 (research.md R8): jsdom no simula el cambio de valor por la
 * rueda, así que se verifica el mecanismo de `NumeroInput`: con el campo
 * enfocado y un valor escrito, la rueda le quita el foco, deja el valor
 * intacto y no cancela el evento (la página se desplaza).
 */
export function esperarQueLaRuedaNoCambie(input: HTMLElement, valor = '200') {
  const campo = input as HTMLInputElement
  expect(campo.type).toBe('number')
  fireEvent.change(campo, { target: { value: valor } })
  campo.focus()
  expect(document.activeElement).toBe(campo)

  const noCancelado = fireEvent.wheel(campo, { deltaY: -120 })
  fireEvent.wheel(campo, { deltaY: 120 })

  expect(noCancelado).toBe(true)
  expect(document.activeElement).not.toBe(campo)
  expect(campo.value).toBe(valor)
}
