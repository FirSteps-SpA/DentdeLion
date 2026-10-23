import { useState } from 'react'
import { useAlertasStore } from '../../../stores/alertasStore'
import {
  actualizarNivelesAviso,
  actualizarHorasAvisoPendientes,
} from '../../alertas/lib/configuracion'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { NumeroInput } from '../../../components/ui/NumeroInput'

/**
 * Niveles de aviso de caducidad y aviso de cambios sin subir (spec 010
 * FR-007/008, spec 012). Spec 019: antes "ConfiguracionAlertasSection"; el
 * stock mínimo por insumo pasó a `MinimosPorInsumoSection` y las dos viven en
 * "Notificaciones y avisos". Solo administradores.
 */
export function AvisosSection() {
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const horasAvisoPendientes = useAlertasStore((s) => s.horasAvisoPendientes)

  const [errorNiveles, setErrorNiveles] = useState<string | null>(null)
  const [errorHoras, setErrorHoras] = useState<string | null>(null)

  async function handleNivelesAvisoChange(valor: string) {
    setErrorNiveles(null)
    const dias = valor
      .split(',')
      .map((parte) => Number(parte.trim()))
      .filter((n) => !Number.isNaN(n))
    try {
      await actualizarNivelesAviso(dias)
    } catch (err) {
      setErrorNiveles(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  async function handleHorasAvisoChange(valor: string) {
    setErrorHoras(null)
    try {
      await actualizarHorasAvisoPendientes(Number(valor))
    } catch (err) {
      setErrorHoras(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-h3 text-text">
          Configurar niveles de aviso de caducidad
        </h2>
        {errorNiveles && (
          <Card className="bg-danger-bg px-3.5 py-2.5">
            <p role="alert" className="text-sm text-danger">
              {errorNiveles}
            </p>
          </Card>
        )}
        <IconField
          label="Días antes de caducar (separados por coma)"
          htmlFor="niveles-aviso"
        >
          <input
            id="niveles-aviso"
            type="text"
            defaultValue={nivelesAvisoDias.join(', ')}
            onBlur={(event) => void handleNivelesAvisoChange(event.target.value)}
            aria-label="Niveles de aviso de caducidad, en días"
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
          />
        </IconField>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-h3 text-text">
          Aviso de cambios sin subir
        </h2>
        {errorHoras && (
          <Card className="bg-danger-bg px-3.5 py-2.5">
            <p role="alert" className="text-sm text-danger">
              {errorHoras}
            </p>
          </Card>
        )}
        <IconField
          label="Avisar si un cambio lleva más de (horas)"
          htmlFor="horas-aviso-pendientes"
        >
          <NumeroInput
            id="horas-aviso-pendientes"
            min={1}
            max={168}
            step={1}
            defaultValue={horasAvisoPendientes}
            onBlur={(event) => void handleHorasAvisoChange(event.target.value)}
            aria-label="Horas sin subir antes de avisar"
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
          />
        </IconField>
      </section>
    </>
  )
}
