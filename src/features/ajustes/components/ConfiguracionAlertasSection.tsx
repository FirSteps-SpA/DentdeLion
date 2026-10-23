import { useState } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useAlertasStore } from '../../../stores/alertasStore'
import {
  actualizarStockMinimo,
  actualizarNivelesAviso,
  actualizarHorasAvisoPendientes,
} from '../../alertas/lib/configuracion'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { NumeroInput } from '../../../components/ui/NumeroInput'

/**
 * Configuración de alertas relocalizada desde `AlertasView` (spec 010
 * FR-006/007/008): mismo comportamiento exacto, solo cambia la pantalla que
 * la aloja. Visible únicamente para administradores — la sección "Alertas"
 * queda dedicada solo a mostrar alertas.
 */
export function ConfiguracionAlertasSection() {
  const insumos = useInventoryStore((s) => s.insumos)
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const horasAvisoPendientes = useAlertasStore((s) => s.horasAvisoPendientes)

  const [errorConfig, setErrorConfig] = useState<string | null>(null)
  const [errorNiveles, setErrorNiveles] = useState<string | null>(null)
  const [errorHoras, setErrorHoras] = useState<string | null>(null)

  async function handleStockMinimoChange(insumoId: string, valor: string) {
    setErrorConfig(null)
    const numero = valor.trim() === '' ? null : Number(valor)
    try {
      await actualizarStockMinimo(insumoId, numero)
    } catch (err) {
      setErrorConfig(err instanceof Error ? err.message : 'No se pudo guardar.')
    }
  }

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
          Configurar stock mínimo por insumo
        </h2>
        {errorConfig && (
          <Card className="bg-danger-bg px-3.5 py-2.5">
            <p role="alert" className="text-sm text-danger">
              {errorConfig}
            </p>
          </Card>
        )}
        <Card className="flex flex-col divide-y divide-border px-3.5">
          {insumos.map((insumo) => (
            <div
              key={insumo.id}
              className="flex items-center justify-between gap-2 py-2.5 text-sm text-text"
            >
              <span>{insumo.nombre}</span>
              <NumeroInput
                step="any"
                min={0}
                placeholder="Sin mínimo"
                defaultValue={insumo.stockMinimo ?? ''}
                onBlur={(event) =>
                  void handleStockMinimoChange(insumo.id, event.target.value)
                }
                aria-label={`Stock mínimo de ${insumo.nombre}`}
                className="touch-target w-28 rounded-lg border border-border bg-surface px-3 text-right"
              />
            </div>
          ))}
        </Card>
      </section>

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
