import { useState, type FormEvent } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { useLogout } from '../../auth/useLogout'
import { guardarNombrePropio } from '../../../lib/supabase/perfiles'
import { Pencil, User } from '../../../components/icons'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'

/**
 * Sección "Perfil" (spec 010 FR-004/005): nombre/correo/rol del usuario
 * autenticado y "Cerrar sesión" (también en el menú del avatar, spec 032
 * FR-007/008). Spec 032 (FR-009, ui-contracts §5): cada persona edita su
 * propio nombre; requiere conexión. Visible para todo usuario autenticado.
 */
export function PerfilSection() {
  const usuario = useAuthStore((s) => s.usuario)
  const actualizarNombre = useAuthStore((s) => s.actualizarNombre)
  const { signOut } = useLogout()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  if (!usuario) return null

  function empezar() {
    setTexto(usuario?.nombre ?? '')
    setError(null)
    setEditando(true)
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const nombre = await guardarNombrePropio(texto)
      await actualizarNombre(nombre)
      setEditando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el nombre.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-h3 text-text">
        <User size={18} className="text-primary" />
        Perfil
      </h2>
      <Card className="flex flex-col gap-2.5 px-3.5 py-3">
        {editando ? (
          <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-2">
            <IconField label="Tu nombre" htmlFor="perfil-nombre">
              <input
                id="perfil-nombre"
                type="text"
                autoFocus
                maxLength={80}
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
                {...(error ? { 'aria-invalid': true, 'aria-describedby': 'error-perfil-nombre' } : {})}
              />
            </IconField>
            {error && (
              <p id="error-perfil-nombre" role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <TouchButton type="submit" disabled={guardando} className="flex-1">
                {guardando ? 'Guardando…' : 'Guardar'}
              </TouchButton>
              <TouchButton
                type="button"
                variant="ghost"
                onClick={() => setEditando(false)}
                className="flex-1"
              >
                Cancelar
              </TouchButton>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-bold text-text">{usuario.nombre}</span>
              <span className="text-sm text-text-muted">{usuario.email}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {usuario.rol}
              </span>
            </div>
            <TouchButton
              type="button"
              variant="ghost"
              onClick={empezar}
              className="shrink-0 gap-1.5 px-3 text-sm"
            >
              <Pencil size={16} />
              Editar nombre
            </TouchButton>
          </div>
        )}
        <TouchButton
          type="button"
          variant="ghost"
          onClick={() => void signOut()}
          className="w-fit text-sm"
        >
          Cerrar sesión
        </TouchButton>
      </Card>
    </section>
  )
}
