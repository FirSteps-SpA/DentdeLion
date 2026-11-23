import { useState } from 'react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Stepper } from '../../../components/ui/Stepper'
import { IconField } from '../../../components/ui/IconField'
import { User } from '../../../components/icons'
import { MAX_PACIENTE } from '../lib/pacientes'
import { TouchButton } from '../../../components/ui/TouchButton'
import { etiquetaUnidad, formatearCantidad, unidadAdmiteDecimales } from '../../../lib/unidades'
import { useAvisosStore } from '../../../stores/avisosStore'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { nombreLugar, useLugarStore } from '../../../stores/lugarStore'
import { formatearCLP } from '../../insumos/lib/precio'
import { computeStockLote } from '../../insumos/lib/stock'
import { useCostosUnitarios } from '../../insumos/lib/useCostosUnitarios'
import {
  calcularGanancia,
  cantidadEfectiva,
  ETIQUETA_GANANCIA_PROFESIONAL,
  ETIQUETA_NETO,
} from '../lib/montos'
import type { TratamientoProyectado } from '../lib/proyeccion'
import { esLoteVigente, registrarTratamiento, StockInsuficienteError } from '../lib/registro'
import { formatearConSigno, textoPorcentaje } from '../lib/textos'
import { useInsumosPorId, usePorcentajeAplicable } from '../lib/useMontosTratamiento'

export interface RegistrarTratamientoSheetProps {
  tratamiento: TratamientoProyectado
  /** Lugar donde se registra (en "Todos" lo elige antes `ElegirLugarSheet`). */
  lugarId: string
  onClose: () => void
}

/**
 * Spec 016 US3 (contracts/ui-contracts.md §5): cantidades estándar editables
 * (incluso 0), lo disponible en el lugar por material (sin caducados) y los
 * montos en vivo. Con un faltante, "Registrar" queda deshabilitado hasta
 * ajustar (FR-015). Al registrar: aviso con "Deshacer". Controles ≥ 48 px.
 */
export function RegistrarTratamientoSheet({
  tratamiento,
  lugarId,
  onClose,
}: RegistrarTratamientoSheetProps) {
  const lotes = useInventoryStore((s) => s.lotes)
  const movimientos = useInventoryStore((s) => s.movimientos)
  const cambiosInsumo = useInventoryStore((s) => s.cambiosInsumo)
  const insumos = useInsumosPorId()
  const costos = useCostosUnitarios()
  // Spec 026 (FR-010/FR-012): el % de la categoría en el lugar o el general.
  const origenPorcentaje = usePorcentajeAplicable()(tratamiento, lugarId)
  const porcentaje = origenPorcentaje.valor
  const lugares = useLugarStore((s) => s.lugares)
  const agregarAviso = useAvisosStore((s) => s.agregar)

  const [cantidades, setCantidades] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      tratamiento.materiales.map((m) => [
        m.insumoId,
        cantidadEfectiva(m, insumos.get(m.insumoId), cambiosInsumo),
      ]),
    ),
  )
  const [error, setError] = useState<string | null>(null)
  // Spec 028 (FR-001): opcional.
  const [paciente, setPaciente] = useState('')
  const [isPending, setIsPending] = useState(false)

  const hoy = new Date()
  const filas = tratamiento.materiales.map((material) => {
    const insumo = insumos.get(material.insumoId)
    const unidad = insumo?.unidadMedida ?? material.unidad
    let disponible = 0
    let caducado = 0
    for (const lote of lotes) {
      if (lote.insumoId !== material.insumoId) continue
      const stock = computeStockLote(
        movimientos.filter((m) => m.loteId === lote.id && m.lugarId === lugarId),
      )
      if (stock <= 0) continue
      if (esLoteVigente(lote, hoy)) disponible += stock
      else caducado += stock
    }
    const dadoDeBaja = !insumo || Boolean(insumo.dadoDeBajaEn)
    const cantidad = dadoDeBaja ? 0 : (cantidades[material.insumoId] ?? 0)
    return {
      material,
      insumo,
      unidad,
      disponible,
      caducado,
      dadoDeBaja,
      cantidad,
      falta: !dadoDeBaja && cantidad > disponible,
    }
  })
  const hayFaltante = filas.some((fila) => fila.falta)
  const costoMateriales = filas.reduce(
    (total, fila) => total + fila.cantidad * (costos.get(fila.material.insumoId)?.costo ?? 0),
    0,
  )
  const completo = filas.every(
    (fila) => fila.dadoDeBaja || fila.cantidad === 0 || costos.has(fila.material.insumoId),
  )
  const { comision, ganancia } = calcularGanancia(
    tratamiento.precios.get(lugarId) ?? null,
    porcentaje,
    costoMateriales,
  )

  async function registrar() {
    setIsPending(true)
    setError(null)
    try {
      const registro = await registrarTratamiento(tratamiento, { lugarId, cantidades, paciente })
      agregarAviso({
        tipo: 'tratamiento',
        movimientoId: registro.id,
        loteId: null,
        insumoNombre: tratamiento.nombre,
        unidadMedida: null,
      })
      onClose()
    } catch (e) {
      setError(
        e instanceof StockInsuficienteError || e instanceof Error
          ? e.message
          : 'No se pudo registrar.',
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <BottomSheet titulo={`Registrar ${tratamiento.nombre}`} onClose={onClose}>
      <p className="text-sm text-text-muted">Lugar: {nombreLugar(lugares, lugarId)}</p>
      <ul className="flex flex-col gap-3">
        {filas.map((fila) => (
          <li key={fila.material.insumoId} className="flex flex-col gap-1">
            {fila.dadoDeBaja ? (
              <p className="text-sm text-text-muted">
                {fila.insumo?.nombre ?? 'Material'} · Dado de baja: no se descuenta
              </p>
            ) : (
              <>
                <Stepper
                  id={`registrar-${fila.material.insumoId}`}
                  label={`${fila.insumo?.nombre} (${etiquetaUnidad(fila.unidad, 2)})`}
                  value={fila.cantidad}
                  onChange={(valor) =>
                    setCantidades({ ...cantidades, [fila.material.insumoId]: valor ?? 0 })
                  }
                  min={0}
                  permiteDecimales={unidadAdmiteDecimales(fila.unidad)}
                  aria-invalid={fila.falta}
                />
                <p className={`text-xs ${fila.falta ? 'font-bold text-danger' : 'text-text-muted'}`}>
                  Disponible: {formatearCantidad(fila.disponible, fila.unidad)}
                  {fila.falta &&
                    (fila.disponible === 0 && fila.caducado > 0
                      ? ' · Solo hay stock caducado'
                      : ` · Falta ${formatearCantidad(
                          Math.round((fila.cantidad - fila.disponible) * 1e9) / 1e9,
                          fila.unidad,
                        )}`)}
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-text" aria-live="polite">
        {comision !== null && (
          <>
            {ETIQUETA_GANANCIA_PROFESIONAL} ({textoPorcentaje(origenPorcentaje)}):{' '}
            <span className="font-bold whitespace-nowrap">{formatearCLP(comision)}</span>
            {' · '}
          </>
        )}
        Costo de materiales:{' '}
        <span className="whitespace-nowrap">
          {completo ? '' : 'desde '}
          {formatearCLP(costoMateriales)}
        </span>
        {ganancia !== null && (
          <>
            {' '}
            · {ETIQUETA_NETO}:{' '}
            <span className={`whitespace-nowrap ${ganancia < 0 ? 'text-danger' : ''}`}>
              {formatearConSigno(ganancia)}
            </span>
          </>
        )}
      </p>
      {/* Spec 028 (FR-001): dato de salud, opcional; sin autocompletar del navegador. */}
      <IconField
        label="Paciente (nombre o N° de ficha)"
        htmlFor="registro-paciente"
        icon={<User size={18} />}
        hint="Opcional. Solo lo ven tú y la administración."
      >
        <input
          id="registro-paciente"
          type="text"
          maxLength={MAX_PACIENTE}
          autoComplete="off"
          data-sentry-mask
          value={paciente}
          onChange={(event) => setPaciente(event.target.value)}
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <TouchButton type="button" variant="ghost" onClick={onClose} className="flex-1">
          Cancelar
        </TouchButton>
        <TouchButton
          type="button"
          onClick={() => void registrar()}
          disabled={isPending || hayFaltante}
          className="flex-1"
        >
          {isPending ? 'Registrando…' : 'Registrar'}
        </TouchButton>
      </div>
    </BottomSheet>
  )
}
