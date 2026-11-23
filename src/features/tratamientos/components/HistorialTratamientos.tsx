import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { EstadoVacio } from '../../../components/ui/EstadoVacio'
import { Calendar } from '../../../components/icons'
import { useAuthStore } from '../../../stores/authStore'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { formatearCLP } from '../../insumos/lib/precio'
import {
  categoriaDeRegistro,
  ETIQUETA_PERIODO,
  filtrarPorCategoria,
  opcionesCategoriaHistorial,
  registrosDelPeriodo,
  totalesHistorial,
  type Periodo,
} from '../lib/historial'
import {
  comisionRegistro,
  ETIQUETA_GANANCIA_PROFESIONAL,
  ETIQUETA_NETO,
  NOTA_GANANCIA,
} from '../lib/montos'
import { anularTratamiento } from '../lib/registro'
import { formatearConSigno } from '../lib/textos'

/**
 * Spec 016 US5 (contracts/ui-contracts.md §6, FR-019): tratamientos
 * realizados del lugar activo (o de todos, con su lugar) del más reciente al
 * más antiguo, con totales del período sin anulados y "Deshacer".
 */
export function HistorialTratamientos() {
  const realizados = useTratamientosStore((s) => s.realizados)
  const categorias = useTratamientosStore((s) => s.categorias)
  const lugares = useLugarStore((s) => s.lugares)
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [error, setError] = useState<string | null>(null)
  // Spec 026 (FR-014): '' = todas.
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const esTodos = !lugarActivoId || lugarActivoId === 'todos'
  const delPeriodo = registrosDelPeriodo(realizados, periodo, esTodos ? null : lugarActivoId)
  const opcionesCategoria = opcionesCategoriaHistorial(delPeriodo, categorias)
  // Si la categoría elegida no tiene registros en el nuevo período, vuelve a "Todas".
  const filtroEfectivo = opcionesCategoria.some((o) => o.valor === filtroCategoria)
    ? filtroCategoria
    : ''
  const registros = filtrarPorCategoria(delPeriodo, filtroEfectivo)
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

      {opcionesCategoria.length > 0 && (
        <label className="flex flex-col gap-1 text-sm font-bold text-text">
          Categoría
          <select
            value={filtroEfectivo}
            onChange={(event) => setFiltroCategoria(event.target.value)}
            className="touch-target rounded-md border border-border-input bg-surface px-3 text-sm font-normal text-text"
          >
            <option value="">Todas</option>
            {opcionesCategoria.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      <Card className="grid grid-cols-2 gap-2 p-3.5 text-sm text-text md:grid-cols-5">
        <p className="col-span-2 md:col-span-1">
          <span className="block text-xs text-text-muted">{ETIQUETA_GANANCIA_PROFESIONAL}</span>
          <span className="text-h3 font-bold">{formatearCLP(totales.gananciaProfesional)}</span>
        </p>
        <p>
          <span className="block text-xs text-text-muted">Tratamientos</span>
          <span className="font-bold">{totales.cantidad}</span>
        </p>
        <p>
          <span className="block text-xs text-text-muted">Producción</span>
          <span className="font-bold">{formatearCLP(totales.precios)}</span>
        </p>
        <p className="text-text-muted">
          <span className="block text-xs">Costo de materiales</span>
          <span>{formatearCLP(totales.costoMateriales)}</span>
        </p>
        <p className="text-text-muted">
          <span className="block text-xs">{ETIQUETA_NETO}</span>
          <span className={totales.gananciaEstimada < 0 ? 'text-danger' : ''}>
            {formatearConSigno(totales.gananciaEstimada)}
          </span>
        </p>
        <p className="col-span-2 text-xs text-text-muted md:col-span-5">
          {NOTA_GANANCIA}
          {totales.sinMonto > 0 &&
            ` · ${totales.sinMonto} sin precio o sin % no suman a producción ni a ganancias.`}
        </p>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {registros.length === 0 ? (
        <Card>
          <EstadoVacio Icono={Calendar} texto="No hay tratamientos registrados en este período." />
        </Card>
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
                      {categoriaDeRegistro(registro)} ·{' '}
                      {fecha.format(new Date(registro.creadoEn))} · {autor(registro.usuarioId)}
                      {esTodos && ` · ${nombreLugar(lugares, registro.lugarId)}`}
                    </span>
                    <span className="text-xs text-text-muted">
                      {comisionRegistro(registro) === null ? (
                        'Sin precio'
                      ) : (
                        <>
                          {ETIQUETA_GANANCIA_PROFESIONAL}{' '}
                          <span className="font-bold text-text">
                            {formatearCLP(comisionRegistro(registro) ?? 0)}
                          </span>
                        </>
                      )}{' '}
                      · Costo {formatearCLP(registro.costoMateriales)}
                      {!registro.costoCompleto && ' (incompleto)'}
                      {registro.gananciaEstimada !== null &&
                        ` · ${ETIQUETA_NETO} ${formatearConSigno(registro.gananciaEstimada)}`}
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
