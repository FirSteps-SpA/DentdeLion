import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VerMas } from '../../src/components/ui/VerMas'

describe('VerMas (spec 020 contracts/ui-contracts.md)', () => {
  it('no se muestra si no queda nada', () => {
    const { container } = render(
      <VerMas quedan={0} mostrados={25} total={25} onVerMas={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('dice cuántos quedan y llama onVerMas', () => {
    const onVerMas = vi.fn()
    render(<VerMas quedan={35} mostrados={25} total={60} onVerMas={onVerMas} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 35)' }))
    expect(onVerMas).toHaveBeenCalledOnce()
  })

  it('singular con uno', () => {
    render(<VerMas quedan={1} mostrados={25} total={26} onVerMas={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Ver más (queda 1)' }),
    ).toBeInTheDocument()
  })

  it('anuncia lo visible a los lectores de pantalla', () => {
    render(<VerMas quedan={35} mostrados={25} total={60} onVerMas={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('Se muestran 25 de 60')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
