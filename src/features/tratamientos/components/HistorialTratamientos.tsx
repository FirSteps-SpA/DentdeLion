import { useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { EstadoVacio } from '../../../components/ui/EstadoVacio'
import { Calendar, Pencil, Search } from '../../../components/icons'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { IconField } from '../../../components/ui/IconField'
import {
  filtrarPorPaciente,
  guardarPaciente,
  MAX_PACIENTE,
  puedeEditarPaciente,
} from '../lib/pacientes'
import { usePacientesVisibles } from '../lib/usePacientes'
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
 *
 * Spec 028 (US2, US3): "Paciente: …" solo para el autor del registro y la
 * administración, edición desde el lápiz y buscador por paciente.
 *
 * Los registros anulados con "Deshacer" ya no se listan (pedido 2026-11-23):
 * siguen en la base, con quién y cuándo los anuló, pero no en esta lista.
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
  // Al deshacer, el registro sale de la lista: el aviso confirma qué pasó.
  const [aviso, setAviso] = useState<string | null>(null)
  // Spec 026 (FR-014): '' = todas.
  const [filtroCategoria, setFiltroCategoria] = useState('')
  // Spec 028 (FR-012).
  const [busquedaPaciente, setBusquedaPaciente] = useState('')
  const [editando, setEditando] = useState<{ id: string; nombre: string; texto: string } | null>(
    null,
  )
  const [errorPaciente, setErrorPaciente] = useState<string | null>(null)
  const pacientes = usePacientesVisibles()

  const esTodos = !lugarActivoId || lugarActivoId === 'todos'
  const delPeriodo = registrosDelPeriodo(realizados, periodo, esTodos ? null : lugarActivoId).filter(
    (r) => !r.anuladoEn,
  )
  const opcionesCategoria = opcionesCategoriaHistorial(delPeriodo, categorias)
  // Si la categoría elegida no tiene registros en el nuevo período, vuelve a "Todas".
  const filtroEfectivo = opcionesCategoria.some((o) => o.valor === filtroCategoria)
    ? filtroCategoria
    : ''
  const hayPacientes = delPeriodo.some((r) => pacientes.has(r.id))
  const registros = filtrarPorPaciente(
    filtrarPorCategoria(delPeriodo, filtroEfectivo),
    pacientes,
    hayPacientes ? busquedaPaciente : '',
  )
  const totales = totalesHistorial(registros)
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
  const autor = (id: string | null) =>
    !id ? '' : id === usuario?.id ? usuario.nombre : (conocidos.find((c) => c.id === id)?.nombre ?? 'otra persona')

  async function guardarEdicion(texto: string) {
    if (!editando) return
    setErrorPaciente(null)
    try {
      await guardarPaciente(editando.id, texto)
      setEditando(null)
    } catch (e) {
      // Mensajes fijos: nunca incluyen el texto del paciente (R6).
      setErrorPaciente(e instanceof Error ? e.message : 'No se pudo guardar el paciente.')
    }
  }

  async function deshacer(id: string, nombre: string) {
    setError(null)
    setAviso(null)
    try {
      await anularTratamiento(id)
      setAviso(`Se deshizo "${nombre}": sus materiales volvieron al stock.`)
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

      {hayPacientes && (
        <IconField label="Buscar paciente" htmlFor="historial-buscar-paciente" icon={<Search size={18} />}>
          <input
            id="historial-buscar-paciente"
            type="search"
            autoComplete="off"
            data-sentry-mask
            value={busquedaPaciente}
            onChange={(event) => setBusquedaPaciente(event.target.value)}
            className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
          />
        </IconField>
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
      {aviso && (
        <p role="status" className="text-sm text-text">
          {aviso}
        </p>
      )}

      {registros.length === 0 ? (
        <Card>
          <EstadoVacio Icono={Calendar} texto="No hay tratamientos registrados en este período." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {registros.map((registro) => {
            return (
              <li key={registro.id}>
                <Card className="flex items-center gap-2 p-3">
                  <div className="flex flex-1 flex-col gap-0.5 text-sm">
                    <span className="font-bold text-text">
                      {registro.nombre}
                    </span>
                    {pacientes.has(registro.id) && (
                      <span className="text-xs font-semibold text-text">
                        Paciente: {pacientes.get(registro.id)}
                      </span>
                    )}
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
                  </div>
                  {puedeEditarPaciente(registro, usuario) && (
                    <TouchButton
                      type="button"
                      variant="ghost"
                      aria-label={`Paciente de ${registro.nombre}`}
                      onClick={() => {
                        setErrorPaciente(null)
                        setEditando({
                          id: registro.id,
                          nombre: registro.nombre,
                          texto: pacientes.get(registro.id) ?? '',
                        })
                      }}
                      className="shrink-0 px-3"
                    >
                      <Pencil size={16} />
                    </TouchButton>
                  )}
                  <TouchButton
                    type="button"
                    variant="ghost"
                    aria-label={`Deshacer ${registro.nombre}`}
                    onClick={() => void deshacer(registro.id, registro.nombre)}
                    className="shrink-0 px-3"
                  >
                    Deshacer
                  </TouchButton>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {editando && (
        <BottomSheet titulo={`Paciente de ${editando.nombre}`} onClose={() => setEditando(null)}>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void guardarEdicion(editando.texto)
            }}
          >
            <IconField
              label="Paciente (nombre o N° de ficha)"
              htmlFor="editar-paciente"
              hint="Solo lo ven quien registró y la administración."
            >
              <input
                id="editar-paciente"
                type="text"
                maxLength={MAX_PACIENTE}
                autoComplete="off"
                data-sentry-mask
                value={editando.texto}
                onChange={(event) => setEditando({ ...editando, texto: event.target.value })}
                className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
              />
            </IconField>
            {errorPaciente && (
              <p role="alert" className="text-sm text-danger">
                {errorPaciente}
              </p>
            )}
            <TouchButton type="submit">Guardar</TouchButton>
            {pacientes.has(editando.id) && (
              <TouchButton
                type="button"
                variant="ghost"
                onClick={() => void guardarEdicion('')}
              >
                Quitar paciente
              </TouchButton>
            )}
          </form>
        </BottomSheet>
      )}
    </div>
  )
}
