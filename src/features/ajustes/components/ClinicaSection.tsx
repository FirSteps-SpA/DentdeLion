import { useState } from 'react'
import { useClinicaStore } from '../../../stores/clinicaStore'
import { guardarNombreClinica } from '../lib/clinica'
import { Building } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'

/**
 * Sección "Clínica" (spec 010 FR-020/021): nombre configurable que
 * reemplaza la etiqueta fija "Gabinete" del encabezado. Solo administrador.
 */
export function ClinicaSection() {
  const nombreClinica = useClinicaStore((s) => s.nombreClinica)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(valor: string) {
    setError(null)
    const resultado = await guardarNombreClinica(valor)
    if (resultado && 'error' in resultado) {
      setError(resultado.error)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-h3 text-text">
        <Building size={18} className="text-primary" />
        Clínica
      </h2>
      {error && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}
      <IconField label="Nombre de la clínica o gabinete" htmlFor="nombre-clinica">
        <input
          id="nombre-clinica"
          type="text"
          defaultValue={nombreClinica ?? ''}
          placeholder="Gabinete"
          onBlur={(event) => void handleChange(event.target.value)}
          aria-label="Nombre de la clínica o gabinete"
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>
    </section>
  )
}
