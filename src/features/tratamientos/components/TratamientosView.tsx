import { useState } from 'react'
import { ElegirLugarSheet } from '../../../app/ElegirLugarSheet'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Plus } from '../../../components/icons'
import { useAuthStore } from '../../../stores/authStore'
import { lugaresActivos, useLugarStore } from '../../../stores/lugarStore'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { formatearCLP } from '../../insumos/lib/precio'
import { ETIQUETA_GANANCIA_PROFESIONAL, ETIQUETA_NETO, TEXTO_MOTIVO } from '../lib/montos'
import type { TratamientoProyectado } from '../lib/proyeccion'
import { textoComision, textoCosto, textoGanancia } from '../lib/textos'
import { useMontosTratamiento } from '../lib/useMontosTratamiento'
import {
  nombreCategoriaTratamiento,
  opcionesFiltroCategoria,
  pasaFiltroCategoria,
} from '../lib/categorias'
import { HistorialTratamientos } from './HistorialTratamientos'
import { RegistrarTratamientoSheet } from './RegistrarTratamientoSheet'
import { TratamientoDetalle } from './TratamientoDetalle'
import { TratamientoForm } from './TratamientoForm'

type Overlay =
  | { tipo: 'nuevo' }
  | { tipo: 'editar'; id: string }
  | { tipo: 'elegirLugar'; id: string }
  | { tipo: 'registrar'; id: string; lugarId: string }
  | null

/**
 * Spec 016 (contracts/ui-contracts.md §2): sección Tratamientos con pestañas
 * Tratamientos | Historial. Cada tratamiento muestra el precio del lugar
 * activo, la ganancia del profesional, el costo de materiales y el neto (o por lugar en
 * "Todos"), y "Registrar". Crear y editar: solo administración (FR-004).
 */
export function TratamientosView() {
  const tratamientos = useTratamientosStore((s) => s.tratamientos)
  const categorias = useTratamientosStore((s) => s.categorias)
  const usuario = useAuthStore((s) => s.usuario)
  const esAdministrador = usuario?.rol === 'administrador'
  const lugares = lugaresActivos(useLugarStore((s) => s.lugares))
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  const montosDe = useMontosTratamiento()

  const [pestana, setPestana] = useState<'tratamientos' | 'historial'>('tratamientos')
  const [mostrarDesactivados, setMostrarDesactivados] = useState(false)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  // Spec 026 (FR-007): '' = todas.
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const esTodos = !lugarActivoId || lugarActivoId === 'todos'
  const lugaresVista = esTodos ? lugares : lugares.filter((l) => l.id === lugarActivoId)
  const noOcultos = tratamientos.filter((t) => t.activo || mostrarDesactivados)
  const opcionesCategoria = opcionesFiltroCategoria(
    categorias,
    noOcultos.map((t) => t.categoriaId),
  )
  const visibles = noOcultos.filter((t) =>
    pasaFiltroCategoria(categorias, t.categoriaId, filtroCategoria),
  )
  const porId = (id: string) => tratamientos.find((t) => t.id === id)

  function registrar(tratamiento: TratamientoProyectado) {
    if (esTodos) setOverlay({ tipo: 'elegirLugar', id: tratamiento.id })
    else setOverlay({ tipo: 'registrar', id: tratamiento.id, lugarId: lugarActivoId })
  }

  const detalle = detalleId ? porId(detalleId) : undefined
  const overlayTratamiento = overlay && 'id' in overlay ? porId(overlay.id) : undefined

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-h2 text-text">Tratamientos</h1>
        {esAdministrador && pestana === 'tratamientos' && (
          <TouchButton type="button" onClick={() => setOverlay({ tipo: 'nuevo' })}>
            <Plus size={18} />
            Tratamiento
          </TouchButton>
        )}
      </div>

      <div role="tablist" aria-label="Tratamientos" className="grid grid-cols-2 gap-2">
        {(['tratamientos', 'historial'] as const).map((opcion) => (
          <TouchButton
            key={opcion}
            type="button"
            role="tab"
            aria-selected={pestana === opcion}
            variant={pestana === opcion ? 'primary' : 'ghost'}
            onClick={() => setPestana(opcion)}
          >
            {opcion === 'tratamientos' ? 'Tratamientos' : 'Historial'}
          </TouchButton>
        ))}
      </div>

      {pestana === 'historial' ? (
        <HistorialTratamientos />
      ) : (
        <>
          {detalle && lugaresVista[0] && (
            <TratamientoDetalle
              tratamiento={detalle}
              montos={montosDe(detalle, lugaresVista[0].id)}
              onRegistrar={() => registrar(detalle)}
              onEditar={() => setOverlay({ tipo: 'editar', id: detalle.id })}
              onClose={() => setDetalleId(null)}
            />
          )}

          {opcionesCategoria.length > 1 && (
            <div
              role="group"
              aria-label="Filtrar por categoría"
              className="flex gap-2 overflow-x-auto pb-1"
            >
              {[{ valor: '', nombre: 'Todas' }, ...opcionesCategoria].map((opcion) => (
                <TouchButton
                  key={opcion.valor}
                  type="button"
                  variant={filtroCategoria === opcion.valor ? 'primary' : 'ghost'}
                  aria-pressed={filtroCategoria === opcion.valor}
                  onClick={() => setFiltroCategoria(opcion.valor)}
                  className="shrink-0 rounded-pill px-4 text-sm whitespace-nowrap"
                >
                  {opcion.nombre}
                </TouchButton>
              ))}
            </div>
          )}

          {visibles.length === 0 ? (
            <Card className="px-3.5 py-3">
              <p className="text-sm text-text-muted">
                {esAdministrador
                  ? 'Aún no hay tratamientos. Crea el primero con "+ Tratamiento".'
                  : 'Aún no hay tratamientos definidos.'}
              </p>
            </Card>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibles.map((tratamiento) => {
                const conBaja =
                  esAdministrador &&
                  lugaresVista[0] &&
                  montosDe(tratamiento, lugaresVista[0].id).costo.lineas.some((l) => l.dadoDeBaja)
                return (
                  <li key={tratamiento.id}>
                    <Card className="flex items-center gap-2 py-1.5 pr-1.5 pl-0">
                      <button
                        type="button"
                        onClick={() => setDetalleId(tratamiento.id)}
                        className="touch-target flex flex-1 flex-col gap-1 rounded-lg py-1 pl-3.5 text-left"
                      >
                        <span className="text-xs text-text-muted">
                          {nombreCategoriaTratamiento(categorias, tratamiento.categoriaId)}
                        </span>
                        <span className="text-[15px] font-bold text-text">
                          {tratamiento.nombre}
                          {!tratamiento.activo && (
                            <span className="ml-2 text-xs font-normal text-text-muted">
                              Desactivado
                            </span>
                          )}
                        </span>
                        {conBaja && (
                          <span className="text-xs font-bold text-warning-30-text">
                            Tiene materiales dados de baja
                          </span>
                        )}
                        {lugaresVista.map((lugar) => {
                          const montos = montosDe(tratamiento, lugar.id)
                          return (
                            <span key={lugar.id} className="text-xs text-text-muted">
                              {esTodos && `${lugar.nombre}: `}
                              {montos.precio === null
                                ? TEXTO_MOTIVO['sin-precio']
                                : formatearCLP(montos.precio)}
                              {montos.precio !== null && (
                                <>
                                  {' '}
                                  · {ETIQUETA_GANANCIA_PROFESIONAL}{' '}
                                  <span className="font-bold whitespace-nowrap text-text">
                                    {textoComision(montos)}
                                  </span>
                                </>
                              )}{' '}
                              · Materiales {textoCosto(montos)}
                              {montos.ganancia.ganancia !== null && (
                                <>
                                  {' '}
                                  · {ETIQUETA_NETO}{' '}
                                  <span
                                    className={`whitespace-nowrap ${
                                      montos.ganancia.ganancia < 0 ? 'text-danger' : ''
                                    }`}
                                  >
                                    {textoGanancia(montos)}
                                  </span>
                                </>
                              )}
                            </span>
                          )
                        })}
                      </button>
                      {tratamiento.activo && (
                        <TouchButton
                          type="button"
                          variant="secondary"
                          onClick={() => registrar(tratamiento)}
                          aria-label={`Registrar ${tratamiento.nombre}`}
                          className="shrink-0 px-3"
                        >
                          Registrar
                        </TouchButton>
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}

          {esAdministrador && tratamientos.some((t) => !t.activo) && (
            <TouchButton
              type="button"
              variant="ghost"
              onClick={() => setMostrarDesactivados(!mostrarDesactivados)}
            >
              {mostrarDesactivados ? 'Ocultar desactivados' : 'Mostrar desactivados'}
            </TouchButton>
          )}
        </>
      )}

      {overlay?.tipo === 'nuevo' && (
        <TratamientoForm onGuardado={() => setOverlay(null)} onCancelar={() => setOverlay(null)} />
      )}
      {overlay?.tipo === 'editar' && overlayTratamiento && (
        <TratamientoForm
          tratamiento={overlayTratamiento}
          onGuardado={() => setOverlay(null)}
          onCancelar={() => setOverlay(null)}
        />
      )}
      {overlay?.tipo === 'elegirLugar' && (
        <ElegirLugarSheet
          onElegir={(lugarId) =>
            lugarId !== 'todos' &&
            setOverlay({ tipo: 'registrar', id: overlay.id, lugarId })
          }
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.tipo === 'registrar' && overlayTratamiento && (
        <RegistrarTratamientoSheet
          tratamiento={overlayTratamiento}
          lugarId={overlay.lugarId}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
