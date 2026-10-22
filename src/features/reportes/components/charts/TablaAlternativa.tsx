import { useId, useState } from 'react'

export interface TablaAlternativaProps {
  titulo: string
  columnas: string[]
  filas: string[][]
}

/**
 * Spec 017 (FR-014, UI §3) — los datos del gráfico como tabla: siempre en el
 * DOM para lectores de pantalla (`sr-only`) y visible con "Ver como tabla"
 * (botón ≥ 48 px, Constitución III).
 */
export function TablaAlternativa({ titulo, columnas, filas }: TablaAlternativaProps) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={visible}
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
        className="touch-target self-start rounded-md px-3 text-body font-semibold text-primary-text hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-brand"
      >
        {visible ? 'Ocultar tabla' : 'Ver como tabla'}
      </button>
      <table id={id} className={visible ? 'w-full text-left text-body' : 'sr-only'}>
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr className="border-b border-border text-text-muted">
            {columnas.map((columna) => (
              <th key={columna} scope="col" className="py-2 pr-3 font-semibold">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {fila.map((celda, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="py-2 pr-3 font-normal text-text">
                    {celda}
                  </th>
                ) : (
                  <td key={j} className="py-2 pr-3 text-text tabular-nums">
                    {celda}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
