import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import {
  cambiarRol,
  desactivarUsuario,
  listarEquipo,
  reactivarUsuario,
  type MiembroEquipo,
} from '../lib/equipo'
import {
  crearInvitacion,
  enlacesCompartir,
  listarInvitacionesPendientes,
  reenviarInvitacion,
  revocarInvitacion,
  type InvitacionCreada,
  type InvitacionPendiente,
  type RolInvitacion,
} from '../lib/invitaciones'
import { leerNombreTenant } from '../lib/lugares'
import { copiarAlPortapapeles } from '../../compras/lib/compartir'
import { Copy, Mail, MessageCircle, Plus, Users } from '../../../components/icons'
import { Badge } from '../../../components/ui/Badge'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'

const ROL: Record<RolInvitacion, string> = {
  administrador: 'Administradora',
  personal: 'Personal',
}

const fecha = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' })

interface DatosEquipo {
  miembros: MiembroEquipo[]
  invitaciones: InvitacionPendiente[]
  tenant: string | null
}

/** Equipo, invitaciones pendientes y nombre del tenant; `null` sin conexión. */
async function obtenerDatos(): Promise<DatosEquipo | null> {
  try {
    const [miembros, invitaciones, tenant] = await Promise.all([
      listarEquipo(),
      listarInvitacionesPendientes(),
      leerNombreTenant(),
    ])
    return { miembros, invitaciones, tenant }
  } catch {
    return null
  }
}

/**
 * Sección "Equipo" (spec 014 US5, contracts/ui-contracts.md): personas del
 * tenant (rol y estado) e invitaciones por enlace. Solo administradores.
 * Necesita conexión: es gestión, no flujo clínico (Constitución I).
 */
export function EquipoSection() {
  const yo = useAuthStore((s) => s.usuario)
  const [equipo, setEquipo] = useState<MiembroEquipo[] | null>(null)
  const [pendientes, setPendientes] = useState<InvitacionPendiente[]>([])
  const [tenant, setTenant] = useState<string | null>(null)
  const [sinConexion, setSinConexion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitando, setInvitando] = useState(false)
  const [enlaceCreado, setEnlaceCreado] = useState<
    (InvitacionCreada & { correo: string }) | null
  >(null)

  const aplicar = useCallback((datos: DatosEquipo | null) => {
    if (!datos) {
      setSinConexion(true)
      return
    }
    setEquipo(datos.miembros)
    setPendientes(datos.invitaciones)
    setTenant(datos.tenant)
    setSinConexion(false)
  }, [])

  const cargar = useCallback(() => obtenerDatos().then(aplicar), [aplicar])

  useEffect(() => {
    // Carga inicial desde el servidor (gestión del equipo, necesita red).
    let cancelado = false
    void obtenerDatos().then((datos) => {
      if (!cancelado) aplicar(datos)
    })
    return () => {
      cancelado = true
    }
  }, [aplicar])

  async function ejecutar(accion: () => Promise<unknown>) {
    setError(null)
    try {
      await accion()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.')
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="ajustes-equipo">
      <h2 id="ajustes-equipo" className="flex items-center gap-2 text-h3 text-text">
        <Users size={18} className="text-primary" />
        Equipo
      </h2>

      {sinConexion && (
        <Card className="px-3.5 py-2.5">
          <p className="text-sm text-text-muted">
            La gestión del equipo necesita conexión. Vuelve a intentarlo cuando tengas red.
          </p>
        </Card>
      )}
      {error && (
        <Card className="bg-danger-bg px-3.5 py-2.5">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        </Card>
      )}

      {equipo && (
        <ul className="flex flex-col gap-2" aria-label="Personas del equipo">
          {equipo.map((miembro) => {
            const desactivado = !!miembro.desactivadoEn
            const otroRol = miembro.rol === 'administrador' ? 'personal' : 'administrador'
            return (
              <li key={miembro.id}>
                <Card className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-text">
                      {miembro.nombre}
                      {miembro.id === yo?.id && ' (tú)'}
                    </span>
                    <span className="truncate text-xs text-text-muted">{miembro.correo}</span>
                  </span>
                  {miembro.rol === 'administrador' ? (
                    <Badge variant="success">{ROL.administrador}</Badge>
                  ) : (
                    <span className="text-xs font-bold text-text-muted">{ROL.personal}</span>
                  )}
                  {desactivado && <Badge variant="danger">Desactivado</Badge>}
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => void ejecutar(() => cambiarRol(miembro.id, otroRol))}
                    className="px-3 text-xs"
                  >
                    Cambiar a {ROL[otroRol].toLowerCase()}
                  </TouchButton>
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      void ejecutar(() =>
                        desactivado ? reactivarUsuario(miembro.id) : desactivarUsuario(miembro.id),
                      )
                    }
                    className="px-3 text-xs"
                  >
                    {desactivado ? 'Reactivar' : 'Desactivar'}
                  </TouchButton>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <TouchButton
        type="button"
        variant="secondary"
        disabled={sinConexion}
        onClick={() => {
          setEnlaceCreado(null)
          setInvitando(true)
        }}
      >
        <Plus size={16} />
        Invitar
      </TouchButton>

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold tracking-wide text-text-muted uppercase">
            Invitaciones pendientes
          </h3>
          <ul className="flex flex-col gap-2" aria-label="Invitaciones pendientes">
            {pendientes.map((invitacion) => (
              <li key={invitacion.id}>
                <Card className="flex flex-wrap items-center gap-2 px-3.5 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-text">{invitacion.correo}</span>
                    <span className="text-xs text-text-muted">
                      {ROL[invitacion.rol]} ·{' '}
                      {invitacion.vencida
                        ? 'Vencida'
                        : `vence el ${fecha.format(new Date(invitacion.venceEn))}`}
                    </span>
                  </span>
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      void ejecutar(async () => {
                        const creada = await reenviarInvitacion(invitacion)
                        setEnlaceCreado({ ...creada, correo: invitacion.correo })
                        setInvitando(true)
                      })
                    }
                    className="px-3 text-xs"
                  >
                    Reenviar
                  </TouchButton>
                  <TouchButton
                    type="button"
                    variant="ghost"
                    onClick={() => void ejecutar(() => revocarInvitacion(invitacion.id))}
                    className="px-3 text-xs"
                  >
                    Revocar
                  </TouchButton>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}

      {invitando && (
        <BottomSheet
          titulo={enlaceCreado ? 'Envía la invitación' : 'Invitar al equipo'}
          onClose={() => setInvitando(false)}
        >
          {enlaceCreado ? (
            <EnlaceInvitacion invitacion={enlaceCreado} tenant={tenant} />
          ) : (
            <FormularioInvitacion
              onCreada={(creada) => {
                setEnlaceCreado(creada)
                void cargar()
              }}
            />
          )}
        </BottomSheet>
      )}
    </section>
  )
}

function FormularioInvitacion({
  onCreada,
}: {
  onCreada: (invitacion: InvitacionCreada & { correo: string }) => void
}) {
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState<RolInvitacion>('personal')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  return (
    <form
      data-sheet-body
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        setError(null)
        setOcupado(true)
        crearInvitacion(correo, rol)
          .then((creada) => onCreada({ ...creada, correo: correo.trim().toLowerCase() }))
          .catch((err: unknown) =>
            setError(err instanceof Error ? err.message : 'No se pudo crear la invitación.'),
          )
          .finally(() => setOcupado(false))
      }}
    >
      <IconField label="Correo" htmlFor="invitar-correo" error={error ?? undefined}>
        <input
          id="invitar-correo"
          type="email"
          autoComplete="off"
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          className="h-full w-full border-none bg-transparent text-sm text-text outline-none"
        />
      </IconField>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
        Rol
        <select
          value={rol}
          onChange={(event) => setRol(event.target.value as RolInvitacion)}
          className="touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text"
        >
          <option value="personal">Personal</option>
          <option value="administrador">Administradora</option>
        </select>
      </label>
      <TouchButton type="submit" disabled={ocupado}>
        Crear invitación
      </TouchButton>
    </form>
  )
}

function EnlaceInvitacion({
  invitacion,
  tenant,
}: {
  invitacion: InvitacionCreada & { correo: string }
  tenant: string | null
}) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const { mailto, whatsapp } = enlacesCompartir(invitacion.enlace, tenant)
  const boton =
    'touch-target flex items-center justify-center gap-2 rounded-md bg-secondary-bg px-[18px] text-sm font-bold text-primary-text hover:bg-primary-soft'

  return (
    <div data-sheet-body className="flex flex-col gap-3">
      <p className="text-sm text-text">
        Envía este enlace a <span className="font-bold">{invitacion.correo}</span>. El enlace vence
        en 7 días.
      </p>
      <p className="rounded-md border border-border bg-bg px-3 py-2 text-xs break-all text-text-muted">
        {invitacion.enlace}
      </p>
      <a className={boton} href={mailto}>
        <Mail size={16} />
        Enviar por correo
      </a>
      <a className={boton} href={whatsapp} target="_blank" rel="noreferrer">
        <MessageCircle size={16} />
        WhatsApp
      </a>
      <TouchButton
        type="button"
        variant="secondary"
        onClick={() =>
          void copiarAlPortapapeles(invitacion.enlace).then((ok) =>
            setCopiado(ok ? 'Enlace copiado.' : 'No se pudo copiar el enlace.'),
          )
        }
      >
        <Copy size={16} />
        Copiar enlace
      </TouchButton>
      {copiado && (
        <p role="status" className="text-sm text-text">
          {copiado}
        </p>
      )}
    </div>
  )
}
