import { useEffect, useRef, useState } from 'react'
import { useDisposicion } from '../../../app/useDisposicion'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { ChevronDown } from '../../../components/icons'
import { mesesSeleccionables, rangoPeriodo, type Periodo } from '../lib/periodos'

const FIJOS: { periodo: Periodo; etiqueta: string }[] = [
  { periodo: { tipo: 'esteMes' }, etiqueta: 'Este mes' },
  { periodo: { tipo: 'mesAnterior' }, etiqueta: 'Mes anterior' },
  { periodo: { tipo: 'ultimos3' }, etiqueta: 'Últimos 3 meses' },
  { periodo: { tipo: 'esteAnio' }, etiqueta: 'Este año' },
]

const opcionClase =
  'touch-target flex w-full items-center rounded-md px-4 text-left text-body-lg text-text hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-brand aria-[current=true]:bg-primary-soft aria-[current=true]:font-semibold'

/**
 * Spec 017 (FR-007, UI §2) — selector de período: los 4 fijos y "Elegir mes…"
 * con los 12 meses de la ventana. `BottomSheet` en móvil, menú en tablet y
 * desktop. Opciones de ≥ 48 px (Constitución III).
 */
export function SelectorPeriodo({
  periodo,
  onCambiar,
}: {
  periodo: Periodo
  onCambiar: (periodo: Periodo) => void
}) {
  const disposicion = useDisposicion()
  const [abierto, setAbierto] = useState(false)
  const [eligiendoMes, setEligiendoMes] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const ahora = new Date()
  const etiqueta = rangoPeriodo(periodo, ahora).etiqueta

  const cerrar = () => {
    setAbierto(false)
    setEligiendoMes(false)
  }
  const elegir = (nuevo: Periodo) => {
    onCambiar(nuevo)
    cerrar()
  }
  // El menú de tablet/desktop se cierra al tocar fuera o con Escape (el
  // BottomSheet ya lo hace solo).
  useEffect(() => {
    if (!abierto || disposicion === 'movil') return
    const fuera = (evento: PointerEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) cerrar()
    }
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') cerrar()
    }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto, disposicion])

  const actual = (p: Periodo) =>
    p.tipo === periodo.tipo &&
    (p.tipo !== 'mes' || (periodo.tipo === 'mes' && p.anio === periodo.anio && p.mes === periodo.mes))

  const opciones = (
    <ul className="flex flex-col gap-1">
      {eligiendoMes
        ? mesesSeleccionables(ahora).map(({ anio, mes, etiqueta: nombre }) => {
            const p: Periodo = { tipo: 'mes', anio, mes }
            return (
              <li key={nombre}>
                <button type="button" aria-current={actual(p)} className={opcionClase} onClick={() => elegir(p)}>
                  {nombre}
                </button>
              </li>
            )
          })
        : [
            ...FIJOS.map(({ periodo: p, etiqueta: nombre }) => (
              <li key={nombre}>
                <button type="button" aria-current={actual(p)} className={opcionClase} onClick={() => elegir(p)}>
                  {nombre}
                </button>
              </li>
            )),
            <li key="mes">
              <button
                type="button"
                aria-current={periodo.tipo === 'mes'}
                className={opcionClase}
                onClick={() => setEligiendoMes(true)}
              >
                Elegir mes…
              </button>
            </li>,
          ]}
    </ul>
  )

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={`Período: ${etiqueta}. Cambiar período`}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        className="touch-target flex items-center gap-2 rounded-md border border-border-input bg-surface px-4 text-body font-semibold text-text hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
      >
        {etiqueta}
        <ChevronDown size={18} />
      </button>
      {abierto &&
        (disposicion === 'movil' ? (
          <BottomSheet titulo={eligiendoMes ? 'Elegir mes' : 'Período'} onClose={cerrar}>
            {opciones}
          </BottomSheet>
        ) : (
          <div
            role="group"
            aria-label="Período"
            className="absolute right-0 z-20 mt-2 max-h-[420px] w-64 overflow-y-auto rounded-lg border border-border bg-surface p-2 shadow-dropdown"
          >
            {opciones}
          </div>
        ))}
    </div>
  )
}
