import { useState } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { restaurarInsumo } from '../../insumos/lib/catalogo'
import { Undo } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { TouchButton } from '../../../components/ui/TouchButton'

/**
 * Sección "Insumos dados de baja" (spec 010 FR-022/023/024): listar y
 * restaurar. Solo administradores.
 */
export function InsumosBajaSection() {
  const insumosDadosDeBaja = useInventoryStore((s) => s.insumosDadosDeBaja)
  const [error, setError] = useState<string | null>(null)

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
      <h2 className="text-h3 text-text">Insumos dados de baja</h2>
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
          {insumosDadosDeBaja.map((insumo) => (
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
    </section>
  )
}
