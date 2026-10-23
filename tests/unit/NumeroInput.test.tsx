import { createRef, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NumeroInput } from '../../src/components/ui/NumeroInput'

function Controlado({ inicial = '200' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial)
  return (
    <NumeroInput
      aria-label="Stock inicial"
      value={valor}
      onChange={(event) => setValor(event.target.value)}
    />
  )
}

describe('NumeroInput (spec 018 R1, contracts/ui-contracts.md §1)', () => {
  it('es un campo numérico', () => {
    render(<Controlado />)
    expect(screen.getByLabelText('Stock inicial')).toHaveAttribute('type', 'number')
  })

  it('con foco, la rueda suelta el foco y no cambia el valor ni bloquea el scroll', () => {
    render(<Controlado />)
    const input = screen.getByLabelText<HTMLInputElement>('Stock inicial')
    input.focus()
    expect(document.activeElement).toBe(input)

    const noCancelado = fireEvent.wheel(input, { deltaY: -100 })

    expect(document.activeElement).not.toBe(input)
    expect(input.value).toBe('200')
    // Sin preventDefault: la página se sigue desplazando (FR-002).
    expect(noCancelado).toBe(true)
  })

  it('sin foco, la rueda no hace nada', () => {
    render(<Controlado />)
    const input = screen.getByLabelText<HTMLInputElement>('Stock inicial')
    expect(() => fireEvent.wheel(input, { deltaY: 100 })).not.toThrow()
    expect(input.value).toBe('200')
  })

  it('la escritura sigue funcionando', () => {
    render(<Controlado />)
    const input = screen.getByLabelText<HTMLInputElement>('Stock inicial')
    fireEvent.change(input, { target: { value: '35' } })
    expect(input.value).toBe('35')
  })

  it('llama al onWheel recibido y reenvía el ref', () => {
    const onWheel = vi.fn()
    const ref = createRef<HTMLInputElement>()
    render(<NumeroInput aria-label="Precio" ref={ref} onWheel={onWheel} defaultValue="10" />)
    fireEvent.wheel(screen.getByLabelText('Precio'))
    expect(onWheel).toHaveBeenCalledTimes(1)
    expect(ref.current).toBe(screen.getByLabelText('Precio'))
  })
})
