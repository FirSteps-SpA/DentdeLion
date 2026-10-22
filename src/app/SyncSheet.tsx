import { useState } from 'react'
import { BottomSheet } from '../components/ui/BottomSheet'
import { Card } from '../components/ui/Card'
import { TouchButton } from '../components/ui/TouchButton'
import { sincronizarAhora } from '../lib/sync'
import type { Indicador } from '../lib/sync/indicador'
import { useSyncStore, type ResultadoCiclo } from '../stores/syncStore'
import { fechaRelativa, textoIndicador } from './textosSync'

const MOTIVO: Record<'servidor' | 'sesion', string> = {
  servidor: 'El servidor rechazó la última subida. Se reintentará automáticamente.',
  sesion: 'Tu sesión expiró. Cierra sesión y vuelve a entrar para subir tus cambios.',
}

const MENSAJE_RESULTADO: Record<ResultadoCiclo['estado'], string> = {
  ok: 'Listo',
  'sin-red': 'Sin conexión: se subirán al volver la red',
  error: MOTIVO.servidor,
  sesion: MOTIVO.sesion,
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

export interface SyncSheetProps {
  indicador: Indicador & { umbralHoras: number }
  onClose: () => void
}

/**
 * Panel de sincronización (spec 012 FR-007/008/009/010/012/015,
 * contracts/ui-contracts.md): estado y motivo de error, última sincronización
 * exitosa, desglose de los pendientes propios, pendientes antiguos con el
 * umbral vigente (la única vista del umbral para quien no es administrador),
 * pendientes de otras personas y "Sincronizar ahora".
 */
export function SyncSheet({ indicador, onClose }: SyncSheetProps) {
  const ultimaExitosaEn = useSyncStore((s) => s.ultimaExitosaEn)
  const sincronizando = useSyncStore((s) => s.fase === 'sincronizando')
  const [resultado, setResultado] = useState<ResultadoCiclo['estado'] | null>(null)

  async function handleSincronizar() {
    setResultado(null)
    const { estado } = await sincronizarAhora()
    setResultado(estado)
  }

  const { desglosePropio: desglose, umbralHoras } = indicador
  const lineasDesglose = [
    ['Consumos e ingresos', desglose.movimientos],
    ['Cambios de insumo', desglose.cambiosInsumo],
    ['Categorías nuevas', desglose.categorias],
    ['Precios de lotes', desglose.preciosLote],
    ['Tratamientos', desglose.tratamientos],
  ] as const

  return (
    <BottomSheet titulo="Sincronización" onClose={onClose}>
      <p className="text-sm font-bold text-text">{textoIndicador(indicador)}</p>
      {indicador.motivoError && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p className="text-sm text-danger">{MOTIVO[indicador.motivoError]}</p>
        </Card>
      )}

      <p className="text-sm text-text-muted">
        {ultimaExitosaEn
          ? `Última sincronización: ${fechaRelativa(ultimaExitosaEn)}`
          : 'Nunca sincronizado'}
      </p>

      {indicador.propios > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-text">Tus pendientes</h3>
          <ul className="text-sm text-text">
            {lineasDesglose
              .filter(([, cantidad]) => cantidad > 0)
              .map(([etiqueta, cantidad]) => (
                <li key={etiqueta}>
                  {etiqueta}: {cantidad}
                </li>
              ))}
          </ul>
        </section>
      )}

      {indicador.alerta && indicador.masAntiguoEn && (
        <Card className="bg-warning-30-bg px-3.5 py-2.5">
          <p className="text-sm text-warning-30-text">
            {indicador.antiguos}{' '}
            {plural(indicador.antiguos, 'cambio lleva', 'cambios llevan')} más de{' '}
            {umbralHoras} h sin subir (el más antiguo, del{' '}
            {fechaRelativa(indicador.masAntiguoEn)}).
          </p>
        </Card>
      )}
      <p className="text-xs text-text-muted">Aviso tras {umbralHoras} h sin subir</p>

      {indicador.ajenos.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-text">De otras personas</h3>
          {indicador.ajenos.map((ajeno) => (
            <p key={ajeno.usuarioId} className="text-sm text-text">
              Hay {ajeno.total} {plural(ajeno.total, 'cambio', 'cambios')} de{' '}
              {ajeno.nombre} que{' '}
              {plural(ajeno.total, 'se subirá', 'se subirán')} cuando esa persona
              inicie sesión en este dispositivo.
              {ajeno.antiguo && ' Pídele que inicie sesión pronto.'}
            </p>
          ))}
        </section>
      )}

      <TouchButton
        type="button"
        onClick={() => void handleSincronizar()}
        disabled={sincronizando}
        className="w-full"
      >
        {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
      </TouchButton>
      {resultado && !sincronizando && (
        <p role="status" className="text-sm text-text-muted">
          {MENSAJE_RESULTADO[resultado]}
        </p>
      )}
    </BottomSheet>
  )
}
