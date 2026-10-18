import { useState, type FormEvent } from 'react'
import { useLogin } from './useLogin'
import { APP_NAME } from '../../lib/branding'
import { Mail, Lock, Tooth } from '../../components/icons'
import { IconField } from '../../components/ui/IconField'
import { TouchButton } from '../../components/ui/TouchButton'

/** Email/password login form. Every control meets the ≥48x48px touch-target
 * convention (Constitution III, spec FR-007) via `IconField`/`TouchButton`. */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, error, isPending } = useLogin()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn(email, password)
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface p-6 shadow-card md:p-8">
      <div className="flex flex-col items-center gap-2">
        <Tooth size={48} className="text-brand" />
        <h1 className="text-h1 text-teal-dark">{APP_NAME}</h1>
        {/* Frase de marca del DS §43. */}
        <p className="text-body text-text-muted">Tu inventario. Tu tiempo. Tu ganancia.</p>
      </div>
      <h2 className="self-start text-h3 text-text">Inicia sesión</h2>
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 text-left">
      <IconField label="Correo" icon={<Mail size={18} />} htmlFor="login-email">
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>
      <IconField
        label="Contraseña"
        icon={<Lock size={18} />}
        htmlFor="login-password"
      >
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>
      {error && (
        <div className="rounded-md bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </div>
      )}
      <TouchButton type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Ingresando…' : 'Ingresar'}
      </TouchButton>
      </form>
    </div>
  )
}
