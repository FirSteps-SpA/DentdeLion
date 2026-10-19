import { useEffect, useState, type FormEvent } from 'react'
import { APP_NAME } from '../../lib/branding'
import { Lock, Mail, Tooth, User } from '../../components/icons'
import { IconField } from '../../components/ui/IconField'
import { TouchButton } from '../../components/ui/TouchButton'
import { useLogin } from './useLogin'
import {
  aceptarInvitacion,
  limpiarTokenDeLaUrl,
  MENSAJES_INVITACION,
  validarPassword,
  verInvitacion,
  type CodigoInvitacion,
} from './invitacion'

/**
 * Pantalla de invitación (`/?invitacion=<token>`, sin sesión; spec 014 US5,
 * contracts/ui-contracts.md): muestra a qué cliente se une y con qué correo,
 * pide nombre y contraseña, y al aceptar inicia sesión y entra a Inicio.
 */
export function AceptarInvitacion({ token, onSalir }: { token: string; onSalir: () => void }) {
  const [invitacion, setInvitacion] = useState<
    { correo: string; tenant: string } | CodigoInvitacion | null
  >(null)
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const { signIn, error: errorLogin } = useLogin()

  useEffect(() => {
    let cancelado = false
    void verInvitacion(token).then((resultado) => {
      if (!cancelado) setInvitacion(resultado)
    })
    return () => {
      cancelado = true
    }
  }, [token])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!invitacion || typeof invitacion === 'string') return
    setError(null)
    if (!nombre.trim()) {
      setError('Ingresa tu nombre.')
      return
    }
    const errorPassword = validarPassword(password, repetida)
    if (errorPassword) {
      setError(errorPassword)
      return
    }
    setEnviando(true)
    try {
      const resultado = await aceptarInvitacion(token, nombre.trim(), password)
      if (typeof resultado === 'string') {
        setError(MENSAJES_INVITACION[resultado])
        return
      }
      limpiarTokenDeLaUrl()
      await signIn(resultado.correo, password)
    } finally {
      setEnviando(false)
    }
  }

  const invalida = typeof invitacion === 'string'

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface p-6 text-left shadow-card md:p-8">
      <div className="flex flex-col items-center gap-2">
        <Tooth size={48} className="text-brand" />
        <h1 className="text-h1 text-teal-dark">{APP_NAME}</h1>
      </div>

      {invitacion === null && <p className="text-body text-text-muted">Revisando la invitación…</p>}

      {invalida && (
        <div className="flex w-full flex-col gap-3">
          <p role="alert" className="rounded-md bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
            {MENSAJES_INVITACION[invitacion]}
          </p>
          <TouchButton
            type="button"
            variant="ghost"
            onClick={() => {
              limpiarTokenDeLaUrl()
              onSalir()
            }}
          >
            Ir a iniciar sesión
          </TouchButton>
        </div>
      )}

      {invitacion && !invalida && (
        <form onSubmit={(event) => void handleSubmit(event)} className="flex w-full flex-col gap-4">
          <h2 className="text-h3 text-text">Te invitaron a {invitacion.tenant}</h2>
          <IconField label="Correo" icon={<Mail size={18} />} htmlFor="invitacion-correo">
            <input
              id="invitacion-correo"
              type="email"
              value={invitacion.correo}
              readOnly
              className="h-full w-full border-none bg-transparent text-sm text-text-muted outline-none"
            />
          </IconField>
          <IconField label="Tu nombre" icon={<User size={18} />} htmlFor="invitacion-nombre">
            <input
              id="invitacion-nombre"
              type="text"
              autoComplete="name"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </IconField>
          <IconField
            label="Contraseña"
            icon={<Lock size={18} />}
            htmlFor="invitacion-password"
            hint="Mínimo 10 caracteres, con letras y números"
          >
            <input
              id="invitacion-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </IconField>
          <IconField label="Repite la contraseña" icon={<Lock size={18} />} htmlFor="invitacion-repetida">
            <input
              id="invitacion-repetida"
              type="password"
              autoComplete="new-password"
              value={repetida}
              onChange={(event) => setRepetida(event.target.value)}
              className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
            />
          </IconField>
          {(error ?? errorLogin) && (
            <p role="alert" className="rounded-md bg-danger-bg px-3.5 py-2.5 text-sm text-danger">
              {error ?? errorLogin}
            </p>
          )}
          <TouchButton type="submit" disabled={enviando}>
            {enviando ? 'Uniéndote…' : 'Unirme'}
          </TouchButton>
        </form>
      )}
    </div>
  )
}
