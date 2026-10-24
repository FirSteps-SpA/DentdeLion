import { useState } from 'react'
import type { Insumo, Lote, Movimiento } from '../../../lib/db'
import { computeStockLote, factoresDeUnidad, type MovimientoNormalizado } from '../lib/stock'
import { compararCambios } from '../lib/proyeccion'
import { textoFactor } from '../lib/conversion'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { usePendientesStore } from '../../../stores/pendientesStore'
import { useAuthStore } from '../../../stores/authStore'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { formatearPresentacion } from '../lib/presentacion'
import { etiquetaUnidad, formatearCantidad, formatearEquivalente } from '../../../lib/unidades'
import { formatearCLP, precioVigenteLote } from '../lib/precio'
import { useCostosUnitarios } from '../lib/useCostosUnitarios'
import { EditarPrecioDialog } from './EditarPrecioDialog'
import { useTratamientosStore } from '../../../stores/tratamientosStore'
import { mapaPorId, nombreDelLote } from '../../proveedores/lib/proveedores'

export interface InsumoDetalleProps {
  insumo: Insumo
  lotes: Lote[]
  /** Spec 015: normalizados a la unidad actual (los de `inventoryStore`). */
  movimientos: (Movimiento | MovimientoNormalizado)[]
  onClose: () => void
}

/**
 * Vista de detalle de solo lectura (spec 006 FR-010): todos los lotes del
 * insumo, su fecha de vencimiento (o "No caduca") y su stock individual, más
 * el stock total agregado. Sin acciones de consumo/edición/eliminación —
 * llegan en la spec 007 (Assumptions).
 */
export function InsumoDetalle({
  insumo,
  lotes,
  movimientos,
  onClose,
}: InsumoDetalleProps) {
  // Spec 014 US6-3: los traslados del lote, con el lugar del otro lado del par.
  const todosLosMovimientos = useInventoryStore((s) => s.movimientos)
  const lugares = useLugarStore((s) => s.lugares)
  // Autor: los nombres que el dispositivo conoce (spec 012 R7; `perfiles` no
  // deja leer los de otros).
  const usuario = useAuthStore((s) => s.usuario)
  const conocidos = usePendientesStore((s) => s.usuariosConocidos)
  const autor = (id: string) =>
    id === usuario?.id ? usuario.nombre : conocidos.find((c) => c.id === id)?.nombre
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })
  // Spec 015 (FR-012/FR-017, UI §4): costo del insumo y precio de cada lote.
  const costo = useCostosUnitarios().get(insumo.id)
  const [loteEditandoPrecio, setLoteEditandoPrecio] = useState<Lote | null>(null)
  // Spec 016 FR-018: consumos de un tratamiento realizado en el historial del lote.
  const realizados = useTratamientosStore((s) => s.realizados)
  function consumosDeTratamiento(loteId: string) {
    return movimientos
      .filter((m) => m.loteId === loteId && m.tratamientoRealizadoId && m.tipo === 'consumo')
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .map((m) => {
        const registro = realizados.find((r) => r.id === m.tratamientoRealizadoId)
        return {
          id: m.id,
          texto: `${registro?.nombre ?? 'Tratamiento'} · ${cantidadConOriginal(m)}`,
          anulado: Boolean(registro?.anuladoEn),
          creadoEn: m.creadoEn,
        }
      })
  }
  // Spec 015 (FR-007a, UI §4): conversiones de unidad en el historial.
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  const delInsumo = cambiosInsumo.filter((c) => c.insumoId === insumo.id)
  const factores = factoresDeUnidad(insumo, delInsumo)
  const conversiones = delInsumo
    .filter((c) => c.campo === 'unidadMedida' && c.factor !== null && c.rechazadoEn === null)
    .sort(compararCambios)
    .reverse()
  const cambiosLote = useInventoryStore((s) => s.cambiosLote)
  // Spec 021 (FR-014, R11): nombre actual del proveedor de cada lote.
  const proveedores = useInventoryStore((s) => s.proveedores)
  const proveedoresPorId = mapaPorId(proveedores)
  function textoPrecio(lote: Lote): string {
    const precio = precioVigenteLote(lote, cambiosLote)
    if (precio === null) return 'Sin precio'
    const unidadCompra =
      lote.unidadIngresada && lote.unidadIngresada !== lote.unidadConsumo
        ? lote.unidadIngresada
        : lote.contenido === 1
          ? lote.unidadConsumo
          : null
    return unidadCompra
      ? `${formatearCLP(precio)} por ${etiquetaUnidad(unidadCompra, 1)}`
      : `${formatearCLP(precio)} por presentación`
  }
  function trasladosDe(loteId: string) {
    return movimientos
      .filter(
        (m) =>
          m.loteId === loteId &&
          (m.tipo === 'traslado_salida' || m.tipo === 'traslado_entrada'),
      )
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .map((m) => {
        const pareja = todosLosMovimientos.find(
          (otro) => otro.trasladoId === m.trasladoId && otro.id !== m.id,
        )
        const otroLugar = pareja ? nombreLugar(lugares, pareja.lugarId) : 'otro lugar'
        return {
          id: m.id,
          texto:
            m.tipo === 'traslado_salida' ? `Traslado → ${otroLugar}` : `Traslado ← ${otroLugar}`,
          cantidad: cantidadConOriginal(m),
          creadoEn: m.creadoEn,
          autor: autor(m.usuarioId),
        }
      })
  }

  // Spec 015 FR-010: "Ingreso: 2 cajas (100 cartuchos)", desde el snapshot del
  // lote (cada lote tiene un solo ingreso). Lotes anteriores a la spec: nada.
  function textoIngreso(lote: Lote): string | null {
    if (lote.cantidadIngresada === null || lote.unidadIngresada === null) return null
    const ingresado = formatearCantidad(lote.cantidadIngresada, lote.unidadIngresada)
    const enConsumo =
      lote.unidadIngresada === lote.unidadConsumo
        ? lote.cantidadIngresada
        : lote.cantidadIngresada * lote.contenido
    const partes = [`Ingreso: ${ingresado}`]
    if (lote.unidadIngresada !== lote.unidadConsumo) {
      partes.push(`(${formatearCantidad(enConsumo, lote.unidadConsumo)})`)
    }
    // Spec 015 FR-007a: si después cambió la unidad de consumo, el equivalente actual.
    if (lote.unidadConsumo !== insumo.unidadMedida) {
      const factor = factores.get(lote.unidadConsumo) ?? 1
      partes.push(`= ${formatearCantidad(enConsumo * factor, insumo.unidadMedida)}`)
    }
    return partes.join(' ')
  }

  /** "4 cartuchos", o "3 cajas = 300 unidades" si se registró en otra unidad. */
  function cantidadConOriginal(m: Movimiento | MovimientoNormalizado): string {
    const actual = formatearCantidad(m.cantidad, insumo.unidadMedida)
    if (m.unidad === insumo.unidadMedida) return actual
    const original = 'cantidadOriginal' in m ? (m.cantidadOriginal ?? m.cantidad) : m.cantidad
    return `${formatearCantidad(original, m.unidad)} = ${actual}`
  }

  const lotesConStock = lotes.map((lote) => ({
    lote,
    stock: computeStockLote(
      movimientos.filter((movimiento) => movimiento.loteId === lote.id),
    ),
  }))
  const stockTotal = lotesConStock.reduce((total, { stock }) => total + stock, 0)

  return (
    <Card className="flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">{insumo.categoria}</span>
          <h3 className="text-h3 text-text">{insumo.nombre}</h3>
          <span className="text-xs text-text-muted">
            Presentación: {formatearPresentacion(insumo)}
          </span>
        </div>
      </div>

      <p className="text-sm font-bold text-text">
        Stock total: {stockTotal} {insumo.unidadMedida}
        {formatearEquivalente(stockTotal, insumo) && (
          <span className="font-normal text-text-muted">
            {' '}
            {formatearEquivalente(stockTotal, insumo)}
          </span>
        )}
      </p>
      <p className="text-sm text-text">
        Costo unitario:{' '}
        {costo ? (
          <>
            <span className="font-bold">
              {formatearCLP(costo.costo)} por {etiquetaUnidad(insumo.unidadMedida, 1)}
            </span>
            <span className="block text-xs text-text-muted">
              Según la última compra con precio ({fecha.format(new Date(costo.fecha))})
            </span>
          </>
        ) : (
          <span className="text-text-muted">Sin precio</span>
        )}
      </p>

      {conversiones.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-text-muted">
          {conversiones.map((c) => (
            <li key={c.id}>
              Unidad cambiada de {etiquetaUnidad(String(c.valorAnterior))} a{' '}
              {etiquetaUnidad(String(c.valorNuevo))} (
              {textoFactor(String(c.valorAnterior), String(c.valorNuevo), c.factor ?? 1)}) ·{' '}
              {fecha.format(new Date(c.creadoEn))}
              {autor(c.usuarioId) && ` · ${autor(c.usuarioId)}`}
            </li>
          ))}
        </ul>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {lotesConStock.map(({ lote, stock }) => (
          <li key={lote.id} className="flex flex-col gap-1 py-2 text-sm">
            <span className="flex items-center justify-between gap-2">
              <span className="text-text">
                Lote {lote.numeroLote}
                {nombreDelLote(lote, proveedoresPorId) &&
                  ` · ${nombreDelLote(lote, proveedoresPorId)}`}{' '}
                —{' '}
                {lote.fechaCaducidad
                  ? `vence ${lote.fechaCaducidad}`
                  : 'No caduca'}
              </span>
              <span className="font-bold text-text-muted">
                {stock} {insumo.unidadMedida}
              </span>
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs text-text-muted">
                {[textoIngreso(lote), textoPrecio(lote)].filter(Boolean).join(' · ')}
              </span>
              {/* Spec 015 US5 (FR-015): cualquier persona del equipo. */}
              <TouchButton
                type="button"
                variant="ghost"
                onClick={() => setLoteEditandoPrecio(lote)}
                aria-label={`Editar precio del lote ${lote.numeroLote}`}
                className="shrink-0 px-3 text-xs"
              >
                Editar precio
              </TouchButton>
            </span>
            {consumosDeTratamiento(lote.id).map((consumo) => (
              <span
                key={consumo.id}
                className={`text-xs text-text-muted ${consumo.anulado ? 'line-through' : ''}`}
              >
                {consumo.texto} · {fecha.format(new Date(consumo.creadoEn))}
              </span>
            ))}
            {trasladosDe(lote.id).map((traslado) => (
              <span key={traslado.id} className="text-xs text-text-muted">
                {traslado.texto}: {traslado.cantidad} ·{' '}
                {fecha.format(new Date(traslado.creadoEn))}
                {traslado.autor && ` · ${traslado.autor}`}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <TouchButton type="button" variant="ghost" onClick={onClose}>
        Volver
      </TouchButton>

      {loteEditandoPrecio && (
        <EditarPrecioDialog
          insumo={insumo}
          lote={loteEditandoPrecio}
          onClose={() => setLoteEditandoPrecio(null)}
        />
      )}
    </Card>
  )
}
