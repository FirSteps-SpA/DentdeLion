import { useState } from 'react'
import {
  useInventoryStore,
  searchInsumosPorTexto,
  searchInsumosPorCategoria,
  searchInsumosPorEstado,
} from '../../../stores/inventoryStore'
import { useAlertasStore } from '../../../stores/alertasStore'
import { useAuthStore } from '../../../stores/authStore'
import { useAvisosStore } from '../../../stores/avisosStore'
import { computeInsumosStockBajo } from '../../alertas/lib/stockBajo'
import { computeAlertasCaducidad } from '../../alertas/lib/caducidad'
import { computeEstadoInsumo, type Estado } from '../lib/estado'
import {
  consumirUno,
  lotesConStockDeInsumo,
  selectLoteConsumoRapido,
} from '../lib/consumoRapido'
import { darDeBajaInsumo } from '../lib/catalogo'
import { categoriasEnUso } from '../lib/categorias'
import { useDisposicion } from '../../../app/useDisposicion'
import { InventarioTabla } from './InventarioTabla'
import { posiblesDuplicados } from '../lib/alta'
import { ResumenAlertasBanner } from './ResumenAlertasBanner'
import { InsumoFiltros } from './InsumoFiltros'
import { InsumoCard } from './InsumoCard'
import { InsumoDetalle } from './InsumoDetalle'
import { InsumoAccionesMenu } from './InsumoAccionesMenu'
import { AltaMaterialView } from './AltaMaterialView'
import { ConsumoForm } from './ConsumoForm'
import { EditarInsumoForm } from './EditarInsumoForm'
import { ConfirmarBajaDialog } from './ConfirmarBajaDialog'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { Plus } from '../../../components/icons'
import {
  porLugar,
  resumenPorLugar,
  useInventarioDeLugar,
  useVistasDeLugar,
} from '../lib/vistaLugar'
import { ElegirLugarSheet } from '../../../app/ElegirLugarSheet'
import { hayVariosLugares, nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { TrasladoForm } from './TrasladoForm'

// Spec 014 FR-014: en "Todos", las acciones que modifican stock pasan antes por
// "¿En qué lugar?" (`elegirLugar`) y siguen con el lugar elegido.
type AccionConLugar = 'consumirUno' | 'consumir' | 'alta' | 'trasladar'
type Overlay =
  | { tipo: 'menu' | 'editar' | 'baja'; insumoId: string }
  | { tipo: 'consumir'; insumoId: string; lugarId?: string }
  | { tipo: 'trasladar'; insumoId: string; origenId: string }
  | { tipo: 'elegirLugar'; accion: AccionConLugar; insumoId: string | null }
  | null

function mensajeDeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * Pantalla principal por defecto (spec 006 FR-002): resumen de alertas +
 * búsqueda/filtros/listado de insumos + detalle de solo lectura. Dueña del
 * estado de filtros/selección (research.md) — el detalle (User Story 3) se
 * renderiza condicionalmente sin desmontar este árbol, para que
 * texto/categoria/estado sobrevivan a abrir y cerrar el detalle (FR-011).
 *
 * Spec 007: cada tarjeta ofrece "Consumir 1" y un menú de opciones; los
 * paneles (menú, consumir otra cantidad, editar, baja) viven en `overlay`,
 * que nunca toca los filtros (FR-017). Si el insumo de un panel o del
 * detalle deja de estar activo (baja local o sincronizada), se cierra.
 */
export function InventarioView() {
  // Spec 014: datos del lugar activo; en "Todos", los totales del tenant más
  // el estado del peor lugar y el stock de cada uno.
  const { insumos, lotes, movimientos } = useInventarioDeLugar()
  const { vistas, esTodos } = useVistasDeLugar()
  const lugares = useLugarStore((s) => s.lugares)
  const categoriasRows = useInventoryStore((s) => s.categorias)
  const nivelesAvisoDias = useAlertasStore((s) => s.nivelesAvisoDias)
  const rol = useAuthStore((s) => s.usuario?.rol)

  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState<Estado[]>([])
  const [insumoSeleccionadoId, setInsumoSeleccionadoId] = useState<
    string | null
  >(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [bajaPendiente, setBajaPendiente] = useState(false)
  const [altaAbierta, setAltaAbierta] = useState<{ lugarId?: string } | null>(null)

  const totalCaducidad = porLugar(vistas, (d) =>
    computeAlertasCaducidad(d.insumos, d.lotes, d.movimientos, nivelesAvisoDias),
  ).length
  const totalStockBajo = porLugar(vistas, (d) =>
    computeInsumosStockBajo(d.insumos, d.lotes, d.movimientos),
  ).length

  const resumenTodos = esTodos ? resumenPorLugar(vistas, nivelesAvisoDias) : null
  const estadosInsumo = computeEstadoInsumo(
    insumos,
    lotes,
    movimientos,
    nivelesAvisoDias,
  ).map((estadoInsumo) => {
    const peor = resumenTodos?.get(estadoInsumo.insumo.id)?.estado
    return peor ? { ...estadoInsumo, estado: peor } : estadoInsumo
  })
  const idsTexto = new Set(
    searchInsumosPorTexto(insumos, texto).map((insumo) => insumo.id),
  )
  const idsCategoria = new Set(
    searchInsumosPorCategoria(insumos, categoria).map((insumo) => insumo.id),
  )
  const resultados = searchInsumosPorEstado(estadosInsumo, estado).filter(
    (e) => idsTexto.has(e.insumo.id) && idsCategoria.has(e.insumo.id),
  )

  const hayFiltrosActivos =
    texto.trim() !== '' || categoria !== '' || estado.length > 0

  // Derived, not an effect: a detail/panel whose insumo is no longer active
  // (dado de baja here or via sync) simply stops rendering (spec Edge Cases).
  const insumoActivo = (id: string | null) =>
    id ? (insumos.find((insumo) => insumo.id === id) ?? null) : null
  const insumoDetalle = insumoActivo(insumoSeleccionadoId)
  const insumoOverlay =
    overlay && overlay.tipo !== 'elegirLugar' ? insumoActivo(overlay.insumoId) : null
  const duplicados =
    rol === 'administrador' ? posiblesDuplicados(insumos) : new Set<string>()

  const disposicion = useDisposicion()
  const filas = resultados.map((estadoInsumo) => ({
    estadoInsumo,
    disponibilidad: selectLoteConsumoRapido(
      lotesConStockDeInsumo(estadoInsumo.insumo.id, lotes, movimientos),
    ),
    posibleDuplicado: duplicados.has(estadoInsumo.insumo.id),
    desglose: resumenTodos?.get(estadoInsumo.insumo.id)?.desglose,
  }))

  function limpiarFiltros() {
    setTexto('')
    setCategoria('')
    setEstado([])
  }

  function cerrarOverlay() {
    setOverlay(null)
    setErrorAccion(null)
  }

  async function handleConsumirUno(insumoId: string, lugarId?: string) {
    const insumo = insumoActivo(insumoId)
    if (!insumo) return
    if (esTodos && !lugarId) {
      setOverlay({ tipo: 'elegirLugar', accion: 'consumirUno', insumoId })
      return
    }
    setErrorAccion(null)
    try {
      const movimiento = await consumirUno(insumo, { lugarId })
      if (!movimiento && lugarId) {
        setErrorAccion(
          `No hay stock vigente de ${insumo.nombre} en ${nombreLugar(lugares, lugarId)}.`,
        )
      }
    } catch (error) {
      setErrorAccion(mensajeDeError(error, 'No se pudo registrar el consumo.'))
    }
  }

  function abrirAlta() {
    if (esTodos) setOverlay({ tipo: 'elegirLugar', accion: 'alta', insumoId: null })
    else setAltaAbierta({})
  }

  function continuarConLugar(accion: AccionConLugar, insumoId: string | null, lugarId: string) {
    setOverlay(null)
    if (accion === 'alta') setAltaAbierta({ lugarId })
    else if (accion === 'consumirUno' && insumoId) void handleConsumirUno(insumoId, lugarId)
    else if (accion === 'consumir' && insumoId) setOverlay({ tipo: 'consumir', insumoId, lugarId })
    else if (accion === 'trasladar' && insumoId) {
      setOverlay({ tipo: 'trasladar', insumoId, origenId: lugarId })
    }
  }

  // Spec 014 US6-5: "Trasladar" solo con 2 o más lugares activos.
  const lugarActivoId = useLugarStore((s) => s.lugarActivoId)
  function abrirTraslado(insumoId: string) {
    if (esTodos || !lugarActivoId || lugarActivoId === 'todos') {
      setOverlay({ tipo: 'elegirLugar', accion: 'trasladar', insumoId })
    } else {
      setOverlay({ tipo: 'trasladar', insumoId, origenId: lugarActivoId })
    }
  }

  async function handleConfirmarBaja(insumoId: string) {
    setBajaPendiente(true)
    setErrorAccion(null)
    try {
      await darDeBajaInsumo(insumoId)
      if (insumoSeleccionadoId === insumoId) setInsumoSeleccionadoId(null)
      setOverlay(null)
    } catch (error) {
      setErrorAccion(mensajeDeError(error, 'No se pudo eliminar el insumo.'))
    } finally {
      setBajaPendiente(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 text-left">
      <ResumenAlertasBanner
        totalCaducidad={totalCaducidad}
        totalStockBajo={totalStockBajo}
        onFiltrarCaducidad={() => setEstado(['caducado', 'proximo-a-caducar'])}
        onFiltrarStockBajo={() => setEstado(['bajo-stock'])}
      />

      <TouchButton type="button" onClick={abrirAlta}>
        <Plus size={18} />
        Material
      </TouchButton>

      <InsumoFiltros
        texto={texto}
        onTextoChange={setTexto}
        categorias={categoriasEnUso(categoriasRows, insumos).map((c) => c.nombre)}
        categoria={categoria}
        onCategoriaChange={setCategoria}
        estado={estado}
        onEstadoChange={setEstado}
      />

      {errorAccion && !overlay && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {errorAccion}
          </p>
        </Card>
      )}

      {/* Spec 013 US5: misma información y acciones; tabla en desktop, tarjetas en el resto. */}
      {disposicion === 'desktop' ? (
        resultados.length > 0 && (
          <InventarioTabla
            filas={filas}
            onOpen={setInsumoSeleccionadoId}
            onConsumirUno={(id) => void handleConsumirUno(id)}
            onAbrirMenu={(id) => setOverlay({ tipo: 'menu', insumoId: id })}
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map(({ estadoInsumo, disponibilidad, posibleDuplicado, desglose }) => (
            <li key={estadoInsumo.insumo.id}>
              <InsumoCard
                estadoInsumo={estadoInsumo}
                disponibilidad={disponibilidad}
                posibleDuplicado={posibleDuplicado}
                desglose={desglose}
                onOpen={setInsumoSeleccionadoId}
                onConsumirUno={(id) => void handleConsumirUno(id)}
                onAbrirMenu={(id) => setOverlay({ tipo: 'menu', insumoId: id })}
              />
            </li>
          ))}
        </ul>
      )}

      {resultados.length === 0 && insumos.length === 0 && (
        <Card className="flex flex-col gap-2 px-3.5 py-3">
          <p className="text-sm text-text-muted">
            Aún no hay insumos en el inventario.
          </p>
        </Card>
      )}

      {resultados.length === 0 && insumos.length > 0 && (
        <Card className="flex flex-col gap-2 px-3.5 py-3">
          <p className="text-sm text-text-muted">
            Ningún insumo coincide con la búsqueda o los filtros.
          </p>
          {hayFiltrosActivos && (
            <TouchButton
              type="button"
              variant="secondary"
              onClick={limpiarFiltros}
            >
              Limpiar filtros
            </TouchButton>
          )}
        </Card>
      )}

      {insumoDetalle && (
        <InsumoDetalle
          insumo={insumoDetalle}
          lotes={lotes.filter((lote) => lote.insumoId === insumoDetalle.id)}
          movimientos={movimientos}
          onClose={() => setInsumoSeleccionadoId(null)}
        />
      )}

      {overlay?.tipo === 'menu' && insumoOverlay && (
        <InsumoAccionesMenu
          insumo={insumoOverlay}
          rol={rol}
          onVerDetalle={() => {
            setInsumoSeleccionadoId(insumoOverlay.id)
            cerrarOverlay()
          }}
          onConsumirOtraCantidad={() =>
            setOverlay(
              esTodos
                ? { tipo: 'elegirLugar', accion: 'consumir', insumoId: insumoOverlay.id }
                : { tipo: 'consumir', insumoId: insumoOverlay.id },
            )
          }
          onTrasladar={
            hayVariosLugares(lugares) ? () => abrirTraslado(insumoOverlay.id) : undefined
          }
          onEditar={() =>
            setOverlay({ tipo: 'editar', insumoId: insumoOverlay.id })
          }
          onEliminar={() =>
            setOverlay({ tipo: 'baja', insumoId: insumoOverlay.id })
          }
          onClose={cerrarOverlay}
        />
      )}

      {overlay?.tipo === 'consumir' && insumoOverlay && (
        <BottomSheet
          titulo={`Consumir ${insumoOverlay.nombre}`}
          onClose={cerrarOverlay}
        >
          <ConsumoForm
            insumoInicial={insumoOverlay}
            lugarId={overlay.lugarId}
            onDone={cerrarOverlay}
          />
        </BottomSheet>
      )}

      {overlay?.tipo === 'trasladar' && insumoOverlay && (
        <TrasladoForm
          insumo={insumoOverlay}
          origenId={overlay.origenId}
          onClose={cerrarOverlay}
        />
      )}

      {overlay?.tipo === 'editar' && insumoOverlay && (
        <BottomSheet titulo="Editar insumo" onClose={cerrarOverlay}>
          <EditarInsumoForm
            insumo={insumoOverlay}
            onGuardado={cerrarOverlay}
            onCancelar={cerrarOverlay}
          />
        </BottomSheet>
      )}

      {overlay?.tipo === 'baja' && insumoOverlay && (
        <ConfirmarBajaDialog
          insumo={insumoOverlay}
          stockTotal={
            estadosInsumo.find((e) => e.insumo.id === insumoOverlay.id)
              ?.stockTotal ?? 0
          }
          isPending={bajaPendiente}
          error={errorAccion}
          onConfirmar={() => void handleConfirmarBaja(insumoOverlay.id)}
          onCancelar={cerrarOverlay}
        />
      )}

      {overlay?.tipo === 'elegirLugar' && (
        <ElegirLugarSheet
          onElegir={(lugarId) => {
            if (lugarId !== 'todos') continuarConLugar(overlay.accion, overlay.insumoId, lugarId)
          }}
          onClose={cerrarOverlay}
        />
      )}

      {altaAbierta && (
        <AltaMaterialView
          lugarId={altaAbierta.lugarId}
          onCreated={({ insumo }) => {
            setAltaAbierta(null)
            useAvisosStore.getState().agregar({
              tipo: 'material-creado',
              movimientoId: null,
              loteId: null,
              insumoNombre: insumo.nombre,
              unidadMedida: null,
            })
          }}
          onCancel={() => setAltaAbierta(null)}
          onAbrirExistente={(insumo) => {
            setAltaAbierta(null)
            setInsumoSeleccionadoId(insumo.id)
          }}
        />
      )}
    </div>
  )
}
