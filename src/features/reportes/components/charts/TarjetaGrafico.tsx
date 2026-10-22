import { useId, type ReactNode } from 'react'
import { TablaAlternativa, type TablaAlternativaProps } from './TablaAlternativa'

export interface TarjetaGraficoProps {
  titulo: string
  /** Sin datos: "Sin datos en este período" en vez de ejes vacíos (FR-017). */
  vacio: boolean
  tabla: Omit<TablaAlternativaProps, 'titulo'>
  nota?: ReactNode
  children: ReactNode
}

/**
 * Spec 017 (UI §2–3) — contenedor de cada gráfico: `<figure>` con su título,
 * el gráfico (o el estado vacío), una nota opcional y la tabla alternativa.
 */
export function TarjetaGrafico({ titulo, vacio, tabla, nota, children }: TarjetaGraficoProps) {
  const id = useId()
  return (
    <figure
      aria-labelledby={id}
      className="m-0 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-card"
    >
      <figcaption id={id} className="text-h3 text-text">
        {titulo}
      </figcaption>
      {vacio ? (
        <p className="py-6 text-center text-body text-text-muted">Sin datos en este período</p>
      ) : (
        <>
          {children}
          {nota && <p className="text-caption text-text-muted">{nota}</p>}
          <TablaAlternativa titulo={titulo} {...tabla} />
        </>
      )}
    </figure>
  )
}
