import { useState } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { restaurarInsumo } from '../../insumos/lib/catalogo'
import { Undo } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'
import { VerMas } from '../../../components/ui/VerMas'
import { useListaPaginada } from '../../../lib/paginacion'

/**
 * Sección "Insumos dados de baja" (spec 010 FR-022/023/024): listar y
 * restaurar. Solo administradores.
 */
export function InsumosBajaSection({ sinTitulo = false }: { sinTitulo?: boolean } = {}) {
  const insumosDadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const [error, setError] = useState<string | null>(null)
  // Spec 020 FR-003a, FR-014: por nombre y de a 25 con "Ver más".
  const ordenados = [...insumosDadosDeBaja].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  )
  const lista = useListaPaginada(ordenados, { clave: '', modo: 'ver-mas' })

  async function handleRestaurar(insumoId: string) {
    setError(null)
    try {
      await restaurarInsumo(insumoId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restaurar.')
    }
  }

  return (
    <section className="flex flex-col gap-2">
      {/* Spec 019: dentro de su subpantalla, el título lo pone la pantalla. */}
      {!sinTitulo && <h2 className="text-h3 text-text">Insumos dados de baja</h2>}
      {error && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}
      {insumosDadosDeBaja.length === 0 ? (
        <Card className="px-3.5 py-2.5">
          <p className="text-sm text-text-muted">
            Ningún insumo está dado de baja.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.visibles.map((insumo) => (
            <li key={insumo.id}>
              <Card className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="text-sm text-text">
                  <span className="font-bold">{insumo.nombre}</span> —{' '}
                  {insumo.categoria}
                  <br />
                  <span className="text-xs text-text-muted">
                    Dado de baja el {insumo.dadoDeBajaEn}
                  </span>
                </span>
                <TouchButton
                  type="button"
                  variant="ghost"
                  onClick={() => void handleRestaurar(insumo.id)}
                  className="text-sm"
                >
                  <Undo size={16} />
                  Restaurar
                </TouchButton>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <VerMas
        quedan={lista.quedan}
        mostrados={lista.visibles.length}
        total={lista.total}
        onVerMas={lista.verMas}
      />
    </section>
  )
}
