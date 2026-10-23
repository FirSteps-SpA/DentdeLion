import { useState } from 'react'
import { useInventoryStore } from '../../../stores/inventoryStore'
import { useLugarStore } from '../../../stores/lugarStore'
import { actualizarStockMinimo } from '../../alertas/lib/configuracion'
import { validarStockMinimo } from '../../insumos/lib/catalogo'
import { guardarMinimoLugar } from '../../insumos/lib/minimos'
import { filasMinimos, modoEditorMinimos, TAMANO_PAGINA_MINIMOS, type FilaMinimo } from '../lib/minimosEditor'
import { Search } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { NumeroInput } from '../../../components/ui/NumeroInput'
import { TouchButton } from '../../../components/ui/TouchButton'

function textoMinimo(minimo: number | null): string {
  return minimo === null ? 'sin mínimo' : String(minimo)
}

/**
 * Stock mínimo por insumo (spec 010 FR-006; spec 019 FR-014–021, UI §5):
 * buscador, de a 25 filas, y la misma regla que la edición del insumo — con
 * varios lugares edita el mínimo del lugar activo (vacío = usar el general
 * del catálogo), en "Todos" solo muestra el de cada lugar, y con un solo
 * lugar edita el del catálogo. Cada cambio se guarda en el dispositivo al
 * salir del campo y lo sube el sync. Solo administradores.
 */
export function MinimosPorInsumoSection() {
  const insumos = useInventoryStore((s) => s.insumos)
  const minimosLugar = useInventoryStore((s) => s.minimosLugar)
  const lugares = useLugarStore((s) => s.lugares)
  const seleccion = useLugarStore((s) => s.lugarActivoId)

  const [busqueda, setBusqueda] = useState('')
  const [visibles, setVisibles] = useState(TAMANO_PAGINA_MINIMOS)
  const [errores, setErrores] = useState<Record<string, string>>({})

  // Al cambiar la búsqueda o el lugar se vuelve a la primera tanda (FR-015).
  const [claveTanda, setClaveTanda] = useState(`${busqueda}|${seleccion}`)
  if (claveTanda !== `${busqueda}|${seleccion}`) {
    setClaveTanda(`${busqueda}|${seleccion}`)
    setVisibles(TAMANO_PAGINA_MINIMOS)
    setErrores({})
  }

  const modo = modoEditorMinimos(lugares, seleccion)
  const lugarActivo = lugares.find((l) => l.id === seleccion)
  const filas = filasMinimos(insumos, minimosLugar, seleccion, lugares, busqueda)
  const mostradas = filas.slice(0, visibles)
  const quedan = filas.length - mostradas.length
  const buscando = busqueda.trim() !== ''

  async function guardar(fila: FilaMinimo, texto: string) {
    if (fila.modo === 'todos') return
    const valor = texto.trim() === '' ? null : Number(texto)
    // Lo guardado hoy: en modo lugar, `null` si el lugar no tiene uno propio.
    const guardado = fila.modo === 'lugar' && fila.origen === 'catalogo' ? null : fila.minimo
    const error = validarStockMinimo(valor, fila.insumo.unidadMedida)
    setErrores((actual) => {
      const resto = { ...actual }
      delete resto[fila.insumo.id]
      return error ? { ...resto, [fila.insumo.id]: error } : resto
    })
    if (error || valor === guardado) return
    try {
      if (fila.modo === 'lugar') {
        await guardarMinimoLugar(fila.insumo, seleccion as string, valor)
      } else {
        await actualizarStockMinimo(fila.insumo.id, valor)
      }
    } catch (err) {
      setErrores((actual) => ({
        ...actual,
        [fila.insumo.id]: err instanceof Error ? err.message : 'No se pudo guardar.',
      }))
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h3 text-text">Stock mínimo por insumo</h2>
      {modo === 'lugar' && lugarActivo && (
        <p className="text-sm text-text-muted">
          Mínimos de <span className="font-bold text-text">{lugarActivo.nombre}</span>. Si un
          insumo no tiene uno propio, usa el general.
        </p>
      )}
      {modo === 'todos' && (
        <Card className="bg-info-bg px-3.5 py-2.5">
          <p role="status" className="text-sm text-text">
            Elige un lugar en el encabezado para editar los mínimos.
          </p>
        </Card>
      )}

      <IconField label="Buscar insumo" htmlFor="buscar-minimos" icon={<Search size={18} />}>
        <input
          id="buscar-minimos"
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>
      {buscando && filas.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-muted">Ningún insumo coincide con “{busqueda.trim()}”</p>
          <TouchButton type="button" variant="ghost" onClick={() => setBusqueda('')}>
            Limpiar búsqueda
          </TouchButton>
        </div>
      ) : (
        <p className="text-sm text-text-muted" aria-live="polite">
          {filas.length === 1 ? '1 insumo' : `${filas.length} insumos`}
        </p>
      )}

      {mostradas.length > 0 && (
        <Card as="ul" className="flex flex-col divide-y divide-border px-3.5">
          {mostradas.map((fila) => (
            <li key={fila.insumo.id} className="flex flex-col gap-1 py-2.5 text-sm text-text">
              {fila.modo === 'todos' ? (
                <>
                  <span className="font-bold">{fila.insumo.nombre}</span>
                  <ul className="flex flex-col gap-0.5 text-text-muted">
                    {fila.porLugar.map(({ lugar, minimo, origen }) => (
                      <li key={lugar.id}>
                        {lugar.nombre}: {textoMinimo(minimo)} (
                        {origen === 'lugar' ? 'propio' : 'general'})
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span>{fila.insumo.nombre}</span>
                    {fila.modo === 'lugar' && (
                      <Badge variant={fila.origen === 'lugar' ? 'success' : 'neutral'}>
                        {fila.origen === 'lugar' ? 'Propio' : 'General'}
                      </Badge>
                    )}
                  </span>
                  <NumeroInput
                    key={`${fila.insumo.id}|${seleccion}|${fila.modo === 'lugar' ? fila.origen : ''}`}
                    step="any"
                    min={0}
                    placeholder={
                      fila.modo === 'lugar'
                        ? `General (${textoMinimo(fila.insumo.stockMinimo)})`
                        : 'Sin mínimo'
                    }
                    defaultValue={
                      fila.modo === 'lugar' && fila.origen === 'catalogo' ? '' : (fila.minimo ?? '')
                    }
                    onBlur={(event) => void guardar(fila, event.target.value)}
                    aria-label={`Stock mínimo de ${fila.insumo.nombre}`}
                    aria-invalid={errores[fila.insumo.id] ? true : undefined}
                    aria-describedby={
                      errores[fila.insumo.id] ? `error-minimo-${fila.insumo.id}` : undefined
                    }
                    className="touch-target w-32 shrink-0 rounded-lg border border-border bg-surface px-3 text-right"
                  />
                </div>
              )}
              {errores[fila.insumo.id] && (
                <p
                  id={`error-minimo-${fila.insumo.id}`}
                  role="alert"
                  className="text-sm text-danger"
                >
                  {errores[fila.insumo.id]}
                </p>
              )}
            </li>
          ))}
        </Card>
      )}

      {quedan > 0 && (
        <TouchButton
          type="button"
          variant="secondary"
          onClick={() => setVisibles((n) => n + TAMANO_PAGINA_MINIMOS)}
        >
          Ver más (quedan {quedan})
        </TouchButton>
      )}
    </section>
  )
}
