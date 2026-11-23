import { useId, type ComponentType, type ReactNode } from 'react'
import { ChartColumn, type IconProps } from '../../../../components/icons'
import { EstadoVacio } from '../../../../components/ui/EstadoVacio'
import { TablaAlternativa, type TablaAlternativaProps } from './TablaAlternativa'

export interface TarjetaGraficoProps {
  titulo: string
  /** Sin datos: "Sin datos en este período" en vez de ejes vacíos (FR-017). */
  vacio: boolean
  tabla: Omit<TablaAlternativaProps, 'titulo'>
  nota?: ReactNode
  /** Spec 027 (FR-012): ícono del encabezado, en cuadrado con tinte. */
  Icono?: ComponentType<IconProps>
  children: ReactNode
}

/**
 * Spec 017 (UI §2–3) — contenedor de cada gráfico: `<figure>` con su título,
 * el gráfico (o el estado vacío), una nota opcional y la tabla alternativa.
 * Spec 027: encabezado con ícono y estado vacío con ícono desvaído.
 */
export function TarjetaGrafico({
  titulo,
  vacio,
  tabla,
  nota,
  Icono = ChartColumn,
  children,
}: TarjetaGraficoProps) {
  const id = useId()
  return (
    <figure
      aria-labelledby={id}
      className="m-0 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-tarjeta"
    >
      <figcaption className="flex items-center gap-3 text-h3 text-text">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-tinte-primario text-brand-icon"
        >
          <Icono size={18} />
        </span>
        <span id={id}>{titulo}</span>
      </figcaption>
      {vacio ? (
        <EstadoVacio Icono={Icono} texto="Sin datos en este período" compacto />
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
