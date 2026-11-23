import type { ComponentType, ReactNode, Ref } from 'react'
import type { IconProps } from '../icons'
import { DienteLinea, IconoFondo } from '../decoracion'
import { BotonAyuda } from '../../features/ayuda/components/BotonAyuda'
import type { IdAyuda } from '../../features/ayuda/contenido'

export interface EncabezadoVistaProps {
  titulo: ReactNode
  subtitulo?: ReactNode
  /** Botón o controles a la derecha (p. ej. "+ Tratamiento", selector de período). */
  accion?: ReactNode
  /** Ícono de la sección, como ilustración decorativa desvaída. */
  Icono?: ComponentType<IconProps>
  /** Inicio: diente con destellos en vez del ícono. */
  ilustracion?: 'diente'
  /** Para enfocar el título al abrir una sección (Ajustes). */
  tituloRef?: Ref<HTMLHeadingElement>
  /** Clases del título (p. ej. `outline-none` cuando recibe foco). */
  tituloClassName?: string
  /** Spec 030: agrega el "?" con la ayuda de esta pantalla. */
  ayuda?: IdAyuda
}

/**
 * Spec 027 (FR-011, research.md R5, UI §2) — encabezado común de cada vista:
 * `h1`, subtítulo y acción opcionales, y a la derecha la ilustración
 * decorativa (el diente en Inicio, el ícono de la sección en las demás).
 * Spec 030 (FR-001): con `ayuda`, el "?" va al final de las acciones.
 */
export function EncabezadoVista({
  titulo,
  subtitulo,
  accion,
  Icono,
  ilustracion,
  tituloRef,
  tituloClassName = '',
  ayuda,
}: EncabezadoVistaProps) {
  return (
    // `div`, no `header`: la barra superior es el único landmark "banner".
    <div className="relative flex min-h-16 flex-wrap items-center justify-between gap-3">
      <div className="relative z-10 flex min-w-0 flex-col gap-1">
        <h1
          ref={tituloRef}
          tabIndex={tituloRef ? -1 : undefined}
          className={`text-h2 break-words text-text desk:text-h1 ${tituloClassName}`}
        >
          {titulo}
        </h1>
        {subtitulo && <div className="text-body text-text-muted">{subtitulo}</div>}
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-2">
        {accion}
        {ayuda && <BotonAyuda id={ayuda} />}
      </div>
      {ilustracion === 'diente' ? (
        <DienteLinea
          destellos
          size={88}
          className={`absolute -top-3 hidden opacity-90 md:block ${ayuda ? 'right-14' : 'right-0'}`}
        />
      ) : (
        Icono && (
          <IconoFondo
            Icono={Icono}
            size={72}
            className={`absolute top-1/2 -translate-y-1/2 hidden md:block ${
              accion ? (ayuda ? 'right-64' : 'right-48') : ayuda ? 'right-16' : 'right-2'
            }`}
          />
        )
      )}
    </div>
  )
}
