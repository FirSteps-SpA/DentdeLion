import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { CantidadDobleField } from '../../src/features/insumos/components/CantidadDobleField'
import {
  aConsumo,
  equivalente,
  type CantidadTecleada,
  type PresentacionDoble,
} from '../../src/features/insumos/lib/cantidadDoble'

const JERINGA: PresentacionDoble = { unidadMedida: 'mL', unidadCompra: 'jeringa', contenido: 3 }

describe('cantidadDoble (spec 032 R1)', () => {
  it('convierte en ambos sentidos y marca lo aproximado sin redondear a entero', () => {
    expect(aConsumo({ cantidad: 3, unidad: 'jeringa' }, JERINGA)).toBe(9)
    expect(equivalente({ cantidad: 3, unidad: 'jeringa' }, JERINGA, 'mL')).toEqual({
      valor: 9,
      exacto: true,
    })
    expect(aConsumo({ cantidad: 0.5, unidad: 'mL' }, JERINGA)).toBe(0.5)
    expect(equivalente({ cantidad: 0.5, unidad: 'mL' }, JERINGA, 'jeringa')).toEqual({
      valor: 0.17,
      exacto: false,
    })
  })

  it('sin contenido válido no convierte lo escrito en la unidad de compra', () => {
    const sinContenido = { ...JERINGA, contenido: null }
    expect(aConsumo({ cantidad: 3, unidad: 'jeringa' }, sinContenido)).toBeNull()
    expect(equivalente({ cantidad: 3, unidad: 'jeringa' }, sinContenido, 'mL')).toBeNull()
  })

  it('una unidad que ya no es de la presentación se toma como la de consumo', () => {
    expect(aConsumo({ cantidad: 4, unidad: 'caja' }, JERINGA)).toBe(4)
    expect(aConsumo({ cantidad: null, unidad: 'mL' }, JERINGA)).toBeNull()
  })
})

function Campo({
  presentacion,
  inicial,
  opcional = false,
}: {
  presentacion: PresentacionDoble
  inicial: CantidadTecleada
  opcional?: boolean
}) {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <CantidadDobleField
        id="campo"
        label="Stock inicial"
        ayuda="Te avisamos cuando el stock baje de este número"
        presentacion={presentacion}
        valor={valor}
        onChange={setValor}
        opcional={opcional}
      />
      <output data-testid="consumo">{String(aConsumo(valor, presentacion))}</output>
    </>
  )
}

function ConContenido() {
  const [contenido, setContenido] = useState(3)
  return (
    <>
      <button type="button" onClick={() => setContenido(5)}>
        Cambiar contenido
      </button>
      <Campo
        presentacion={{ ...JERINGA, contenido }}
        inicial={{ cantidad: 3, unidad: 'jeringa' }}
      />
    </>
  )
}

const enJeringas = () => screen.getByLabelText<HTMLInputElement>('Stock inicial en jeringas')
const enML = () => screen.getByLabelText<HTMLInputElement>('Stock inicial en mL')

describe('CantidadDobleField (spec 032 US1)', () => {
  it('muestra los dos campos lado a lado y convierte en vivo hacia ambos lados', () => {
    render(<Campo presentacion={JERINGA} inicial={{ cantidad: 0, unidad: 'jeringa' }} />)

    // Constitución III: cada campo ocupa al menos 48 × 48 px.
    expect(enJeringas().parentElement).toHaveClass('touch-target')
    expect(enML().parentElement).toHaveClass('touch-target')

    fireEvent.change(enJeringas(), { target: { value: '3' } })
    expect(enML()).toHaveValue(9)
    expect(screen.getByTestId('consumo')).toHaveTextContent('9')
    expect(screen.getByText('3 jeringas = 9 mL')).toBeInTheDocument()

    fireEvent.change(enML(), { target: { value: '0.5' } })
    expect(enJeringas()).toHaveValue(0.17)
    expect(screen.getByText('≈')).toBeInTheDocument()
    expect(screen.getByTestId('consumo')).toHaveTextContent('0.5')
  })

  it('rechaza decimales al escribir en una unidad que no los admite', () => {
    render(<Campo presentacion={JERINGA} inicial={{ cantidad: 2, unidad: 'jeringa' }} />)

    fireEvent.change(enJeringas(), { target: { value: '1.5' } })
    expect(enJeringas()).toHaveValue(2)
  })

  it('al cambiar el contenido conserva lo escrito y recalcula el otro campo', () => {
    render(<ConContenido />)
    expect(enML()).toHaveValue(9)

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contenido' }))
    expect(enJeringas()).toHaveValue(3)
    expect(enML()).toHaveValue(15)
    expect(screen.getByTestId('consumo')).toHaveTextContent('15')
  })

  it('opcional: vaciar un campo vacía ambos', () => {
    render(
      <Campo presentacion={JERINGA} inicial={{ cantidad: 0.5, unidad: 'mL' }} opcional />,
    )

    fireEvent.change(enJeringas(), { target: { value: '' } })
    expect(enJeringas()).toHaveValue(null)
    expect(enML()).toHaveValue(null)
    expect(screen.getByTestId('consumo')).toHaveTextContent('null')
  })

  it('sin contenido válido deshabilita el campo de compra y lo explica', () => {
    render(
      <Campo
        presentacion={{ ...JERINGA, contenido: null }}
        inicial={{ cantidad: 2, unidad: 'mL' }}
      />,
    )

    expect(enJeringas()).toBeDisabled()
    expect(enML()).toHaveValue(2)
    expect(screen.getByText(/Completa cuánto trae cada jeringa/)).toBeInTheDocument()
  })

  it('con unidades iguales es un solo campo con − y +', () => {
    render(
      <Campo
        presentacion={{ unidadMedida: 'caja', unidadCompra: 'caja', contenido: 1 }}
        inicial={{ cantidad: 1, unidad: 'caja' }}
      />,
    )

    expect(screen.getByLabelText('Stock inicial')).toHaveValue(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sumar uno' }))
    expect(screen.getByLabelText('Stock inicial')).toHaveValue(2)
    expect(screen.queryByLabelText(/en cajas/)).not.toBeInTheDocument()
  })
})
