import { Wallet } from '../../../components/icons'
import { KpiCard } from '../../../components/ui/Card'
import { formatearMonto, textoVariacion } from '../lib/formato'
import type { ValorEnFecha, ValorInventario } from '../lib/valorInventario'

/**
 * Spec 017 (US4, FR-015) — Valor de inventario (DS §20): Σ stock × costo de
 * los lotes no caducados del lugar activo, con su variación frente al cierre
 * del mes anterior en tono neutro (subir o bajar no es bueno ni malo por sí
 * mismo). Desde 2026-11-23 vive en Reportes (en Inicio quedó la ganancia del
 * mes): es el valor de hoy, no depende del período elegido.
 *
 * Spec 033 (ui-contracts §5): "Stock compartido con Box 1" con un lugar de una
 * bodega compartida, y en "Todos" una fila por bodega ("Box 1 + Box 2: $…").
 */
function textoMonto({ valor, lotesSinPrecio }: ValorEnFecha): string {
  if (lotesSinPrecio > 0 && valor === 0) return 'sin precios'
  return lotesSinPrecio > 0 ? `desde ${formatearMonto(valor)}` : formatearMonto(valor)
}

export function TarjetaValorInventario({ valor }: { valor: ValorInventario }) {
  const sinPrecios = valor.lotesSinPrecio > 0 && valor.valor === 0
  const monto = sinPrecios
    ? 'Sin precios'
    : valor.lotesSinPrecio > 0
      ? `desde ${formatearMonto(valor.valor)}`
      : formatearMonto(valor.valor)
  const notas = [
    'Hoy (no depende del período)',
    sinPrecios
      ? 'Ingresa el precio al recibir compras'
      : valor.lotesSinPrecio > 0
        ? `${valor.lotesSinPrecio} ${valor.lotesSinPrecio === 1 ? 'lote sin precio' : 'lotes sin precio'}`
        : null,
    valor.compartidoCon ? `Stock compartido con ${valor.compartidoCon}` : null,
    ...(valor.desglose ?? []).map(({ nombre, valor: fila }) => `${nombre}: ${textoMonto(fila)}`),
  ].filter((n): n is string => n !== null)
  const variacion = sinPrecios ? null : textoVariacion(valor.variacion, 'vs. mes anterior')
  return (
    <KpiCard
      titulo="Valor de inventario"
      valor={monto}
      Icono={Wallet}
      variacion={variacion ? { texto: variacion, tono: 'muted' } : undefined}
      nota={
        <span className="flex flex-col">
          {notas.map((nota) => (
            <span key={nota}>{nota}</span>
          ))}
        </span>
      }
      ariaLabel={[`Valor de inventario: ${monto}`, variacion, ...notas].filter(Boolean).join('. ')}
    />
  )
}
