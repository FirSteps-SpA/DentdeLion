import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { TouchButton } from '../../../components/ui/TouchButton'
import { CircleHelp } from '../../../components/icons'
import { useAuthStore } from '../../../stores/authStore'
import { AYUDAS, ayudaParaRol, tituloAyuda, type IdAyuda } from '../contenido'
import {
  ayudaVista,
  configuracionAyuda,
  marcarAyudaVista,
  soltarHojaAyuda,
  tomarHojaAyuda,
} from '../ayudasVistas'
import { AyudaContenido } from './AyudaContenido'

/**
 * Spec 030 (FR-001, FR-002, FR-005; contracts/ui.md) — el "?" del
 * encabezado de cada pantalla. Abre la ayuda en una hoja; la primera vez que
 * cada persona entra a la pantalla en este dispositivo, se abre sola.
 */
export function BotonAyuda({ id }: { id: IdAyuda }) {
  const usuario = useAuthStore((s) => s.usuario)
  const rol = usuario?.rol ?? 'personal'
  const ayuda = ayudaParaRol(AYUDAS[id], rol)
  const titulo = tituloAyuda(id, rol)
  // Primera visita (FR-005): se decide al montar la pantalla. Tomar la hoja es
  // idempotente para el mismo id, así que el doble render de StrictMode no la
  // pierde; marcarla como vista va en el efecto.
  const [abierta, setAbierta] = useState(
    () =>
      configuracionAyuda.automatica &&
      !!usuario &&
      ayuda !== null &&
      !ayudaVista(usuario.id, id) &&
      tomarHojaAyuda(id),
  )
  function abrir() {
    if (!tomarHojaAyuda(id)) return
    if (usuario) marcarAyudaVista(usuario.id, id)
    setAbierta(true)
  }

  function cerrar() {
    soltarHojaAyuda(id)
    setAbierta(false)
  }

  useEffect(() => {
    if (abierta && usuario) marcarAyudaVista(usuario.id, id)
  }, [abierta, usuario, id])
  // Al salir de la pantalla, la hoja se cierra con ella y deja el lugar libre.
  useEffect(() => () => soltarHojaAyuda(id), [id])

  if (!ayuda) return null

  return (
    <>
      <TouchButton
        type="button"
        variant="ghost"
        onClick={abrir}
        aria-label={`Ayuda de ${titulo}`}
        aria-haspopup="dialog"
        // `px-0!`: el `px-[18px]` de TouchButton dejaría 12 px para el ícono.
        className="w-12 shrink-0 px-0!"
      >
        <CircleHelp size={22} />
      </TouchButton>
      {/* En `body`: el encabezado es un contexto de apilamiento (`z-10`) y,
          dentro de él, la barra inferior (`z-20`) taparía el pie de la hoja. */}
      {abierta &&
        createPortal(
          <BottomSheet titulo={`Ayuda: ${titulo}`} onClose={cerrar}>
            <div className="flex flex-col gap-5">
              <AyudaContenido ayuda={ayuda} />
              <TouchButton type="button" onClick={cerrar}>
                Entendido
              </TouchButton>
            </div>
          </BottomSheet>,
          document.body,
        )}
    </>
  )
}
