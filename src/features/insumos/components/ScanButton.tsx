import { useEffect, useRef, useState } from 'react'
import { useBarcodeScanner } from '../../../lib/scanner/useBarcodeScanner'
import type { Insumo, Lote } from '../../../lib/db'
import {
  findInsumoPorCodigo,
  findLotePorCodigo,
  useInventoryStore,
} from '../../../stores/inventoryStore'
import { Scan } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'

interface ScanButtonProps {
  /** Selecciona igual que la búsqueda manual — `lote` solo si el código escaneado era de lote. */
  onSelect?: (insumo: Insumo, lote?: Lote) => void
  /**
   * Spec 008 R8: cuando está presente, un resultado `'match'` entrega el
   * código crudo y omite la búsqueda de insumo/lote — usado por el alta de
   * material, que no selecciona nada, solo completa el campo de código.
   */
  onCodigo?: (codigo: string) => void
}

/**
 * Canal alternativo de selección, siempre bajo acción explícita del usuario
 * (FR-008/FR-009, Constitution V) — la cámara nunca se activa al montar este
 * componente, solo dentro de `iniciarEscaneo`. Un código no reconocido o una
 * cámara no disponible muestra un mensaje explícito y deja continuar por
 * búsqueda manual sin reiniciar el formulario (FR-011).
 */
export function ScanButton({ onSelect, onCodigo }: ScanButtonProps) {
  const insumos = useInventoryStore((s) => s.insumos)
  const lotes = useInventoryStore((s) => s.lotes)
  const { scan, stop } = useBarcodeScanner()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activo, setActivo] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  // El `<video>` solo existe una vez que `activo` monta la Card de abajo —
  // leer `videoRef.current` en el mismo tick que `setActivo(true)` siempre
  // daría `null` (el commit de React todavía no ocurrió), como ya evita
  // `EditarInsumoForm`'s `EscanearCodigo` con el mismo patrón.
  useEffect(() => {
    if (!activo || !videoRef.current) return
    let cancelado = false
    void scan(videoRef.current).then((resultado) => {
      if (cancelado) return
      setActivo(false)

      if (resultado.status === 'unavailable') {
        setMensaje(resultado.message)
        return
      }
      if (resultado.status === 'no-match') {
        setMensaje('Código no reconocido. Puedes continuar por búsqueda manual.')
        return
      }

      if (onCodigo) {
        onCodigo(resultado.codigo)
        return
      }

      const insumoPorCodigo = findInsumoPorCodigo(insumos, resultado.codigo)
      if (insumoPorCodigo) {
        onSelect?.(insumoPorCodigo)
        return
      }

      const lotePorCodigo = findLotePorCodigo(lotes, resultado.codigo)
      const insumoDelLote = lotePorCodigo
        ? insumos.find((insumo) => insumo.id === lotePorCodigo.insumoId)
        : undefined
      if (lotePorCodigo && insumoDelLote) {
        onSelect?.(insumoDelLote, lotePorCodigo)
        return
      }

      setMensaje('Código no reconocido. Puedes continuar por búsqueda manual.')
    })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo])

  function iniciarEscaneo() {
    setMensaje(null)
    setActivo(true)
  }

  function cancelar() {
    stop()
    setActivo(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <TouchButton
        type="button"
        variant="secondary"
        onClick={iniciarEscaneo}
        disabled={activo}
      >
        <Scan size={18} />
        {activo ? 'Escaneando…' : 'Escanear'}
      </TouchButton>

      {activo && (
        <Card className="flex flex-col gap-2 p-3">
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full rounded-md"
          />
          <TouchButton type="button" variant="ghost" onClick={cancelar}>
            Cancelar
          </TouchButton>
        </Card>
      )}

      {mensaje && (
        <Card className="px-3.5 py-2.5">
          <p role="status" className="text-sm text-text-muted">
            {mensaje}
          </p>
        </Card>
      )}
    </div>
  )
}
