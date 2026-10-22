import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { useAuthStore } from '../../../stores/authStore'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { formatearCLP } from '../../insumos/lib/precio'
import {
  ETIQUETA_PERIODO,
  registrosDelPeriodo,
  totalesHistorial,
  type Periodo,
} from '../lib/historial'
import { ETIQUETA_GANANCIA, NOTA_GANANCIA } from '../lib/montos'
import { anularTratamiento } from '../lib/registro'
import { formatearConSigno } from '../lib/textos'

/**
 * Spec 016 US5 (contracts/ui-contracts.md §6, FR-019): tratamientos
 * realizados del lugar activo (o de todos, con su lugar) del más reciente al
 * más antiguo, con totales del período sin anulados y "Deshacer".
 */
export function HistorialTratamientos() {
  const realizados = useTratamientosStore((s) => s.realizados)
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [error, setError] = useState<string | null>(null)

  const esTodos = !lugarActivoId || lugarActivoId === 'todos'
  const registros = registrosDelPeriodo(realizados, periodo, esTodos ? null : lugarActivoId)
  const totales = totalesHistorial(registros)
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
  const autor = (id: string | null) =>
    !id ? '' : id === usuario?.id ? usuario.nombre : (conocidos.find((c) => c.id === id)?.nombre ?? 'otra persona')

  async function deshacer(id: string) {
    setError(null)
    try {
      await anularTratamiento(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo deshacer.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Período" className="flex gap-2">
        {(Object.keys(ETIQUETA_PERIODO) as Periodo[]).map((opcion) => (
          <TouchButton
            key={opcion}
            type="button"
            variant={periodo === opcion ? 'primary' : 'ghost'}
            aria-pressed={periodo === opcion}
            onClick={() => setPeriodo(opcion)}
            className="flex-1"
          >
            {ETIQUETA_PERIODO[opcion]}
          </TouchButton>
        ))}
      </div>

      <Card className="grid grid-cols-2 gap-2 p-3.5 text-sm text-text md:grid-cols-4">
        <p>
          <span className="block text-xs text-text-muted">Tratamientos</span>
          <span className="font-bold">{totales.cantidad}</span>
        </p>
        <p>
          <span className="block text-xs text-text-muted">Producción</span>
          <span className="font-bold">{formatearCLP(totales.precios)}</span>
        </p>
        <p>
          <span className="block text-xs text-text-muted">Costo de materiales</span>
          <span className="font-bold">{formatearCLP(totales.costoMateriales)}</span>
        </p>
        <p>
          <span className="block text-xs text-text-muted">{ETIQUETA_GANANCIA}</span>
          <span className={`font-bold ${totales.gananciaEstimada < 0 ? 'text-danger' : ''}`}>
            {formatearConSigno(totales.gananciaEstimada)}
          </span>
        </p>
        <p className="col-span-2 text-xs text-text-muted md:col-span-4">
          {NOTA_GANANCIA}
          {totales.sinMonto > 0 &&
            ` · ${totales.sinMonto} sin precio o sin % no suman a producción ni a ganancia.`}
        </p>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {registros.length === 0 ? (
        <p className="text-sm text-text-muted">No hay tratamientos registrados en este período.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {registros.map((registro) => {
            const anulado = Boolean(registro.anuladoEn)
            return (
              <li key={registro.id}>
                <Card className="flex items-center gap-2 p-3">
                  <div className={`flex flex-1 flex-col gap-0.5 text-sm ${anulado ? 'opacity-60' : ''}`}>
                    <span className={`font-bold text-text ${anulado ? 'line-through' : ''}`}>
                      {registro.nombre}
                    </span>
                    <span className="text-xs text-text-muted">
                      {fecha.format(new Date(registro.creadoEn))} · {autor(registro.usuarioId)}
                      {esTodos && ` · ${nombreLugar(lugares, registro.lugarId)}`}
                    </span>
                    <span className="text-xs text-text-muted">
                      Costo {formatearCLP(registro.costoMateriales)}
                      {!registro.costoCompleto && ' (incompleto)'} ·{' '}
                      {registro.gananciaEstimada === null
                        ? 'Sin precio'
                        : `${ETIQUETA_GANANCIA} ${formatearConSigno(registro.gananciaEstimada)}`}
                    </span>
                    {anulado && (
                      <span className="text-xs font-bold text-text-muted">
                        Anulado por {autor(registro.anuladoPor)}
                      </span>
                    )}
                  </div>
                  {!anulado && (
                    <TouchButton
                      type="button"
                      variant="ghost"
                      aria-label={`Deshacer ${registro.nombre}`}
                      onClick={() => void deshacer(registro.id)}
                      className="shrink-0 px-3"
                    >
                      Deshacer
                    </TouchButton>
                  )}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
