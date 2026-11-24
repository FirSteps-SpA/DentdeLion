import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { Card } from '../../../components/ui/Card'
import { EstadoVacio } from '../../../components/ui/EstadoVacio'
import { IconField } from '../../../components/ui/IconField'
import { TouchButton } from '../../../components/ui/TouchButton'
import {
  ArrowLeft,
  Building,
  Download,
  Mail,
  Plus,
  Trash,
} from '../../../components/icons'
import { EnlaceInvitacion } from '../../ajustes/components/EquipoSection'
import {
  ErrorPlataforma,
  borrarCuentas,
  crearCliente,
  descargarRespaldo,
  detalleCliente,
  eliminarCliente,
  eliminarUsuario,
  invitarACliente,
  listarClientes,
  type ClientePlataforma,
  type DetalleCliente,
  type UsuarioPlataforma,
} from '../lib/plataforma'

/**
 * Spec 031 (US1–US4, contracts/api.md) — Ajustes → "Plataforma", solo para
 * operadores de First Steps: clientes con su actividad, su detalle (usuarios
 * e invitaciones), crear cliente, invitar, eliminar usuario y eliminar
 * cliente (respaldo primero y luego el nombre exacto). Siempre con conexión;
 * nada se guarda en el dispositivo (FR-002).
 */
export function PlataformaSection() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  return tenantId ? (
    <ClienteDetalle tenantId={tenantId} onVolver={() => setTenantId(null)} />
  ) : (
    <ListaClientes onAbrir={setTenantId} />
  )
}

const INPUT =
  'h-full w-full border-none bg-transparent text-[15px] text-text outline-none'
const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })
const mensaje = (e: unknown) =>
  e instanceof ErrorPlataforma
    ? e.message
    : 'No se pudo completar; intenta de nuevo.'

function useCarga<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let vigente = true
    cargar().then(
      (d) => {
        if (!vigente) return
        setDatos(d)
        setError(null)
      },
      (e: unknown) => {
        if (vigente) setError(mensaje(e))
      },
    )
    return () => {
      vigente = false
    }
  }, [cargar, version])
  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  return { datos, error, recargar }
}

function ListaClientes({ onAbrir }: { onAbrir: (id: string) => void }) {
  const { datos: clientes, error, recargar } = useCarga(listarClientes)
  const [nuevo, setNuevo] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <TouchButton
        type="button"
        onClick={() => setNuevo(true)}
        className="self-start"
      >
        <Plus size={18} />
        Nuevo cliente
      </TouchButton>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {clientes === null && !error && (
        <p className="text-sm text-text-muted">Cargando clientes…</p>
      )}
      {clientes?.length === 0 && (
        <Card>
          <EstadoVacio
            Icono={Building}
            texto="Todavía no hay clientes."
            compacto
          />
        </Card>
      )}
      {clientes && clientes.length > 0 && (
        <ul aria-label="Clientes" className="flex flex-col gap-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <FilaCliente cliente={c} onAbrir={() => onAbrir(c.id)} />
            </li>
          ))}
        </ul>
      )}
      {nuevo && (
        <NuevoClienteSheet
          onClose={() => {
            setNuevo(false)
            recargar()
          }}
        />
      )}
    </div>
  )
}

function FilaCliente({
  cliente,
  onAbrir,
}: {
  cliente: ClientePlataforma
  onAbrir: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="touch-target flex w-full flex-col gap-0.5 rounded-lg border border-border bg-surface p-3 text-left shadow-tarjeta hover:border-brand"
    >
      <span className="font-bold text-text">{cliente.nombre}</span>
      <span className="text-xs text-text-muted">
        Alta {fecha.format(new Date(cliente.creadoEn))} · {cliente.lugares}{' '}
        {cliente.lugares === 1 ? 'lugar' : 'lugares'} ·{' '}
        {cliente.usuariosActivos}{' '}
        {cliente.usuariosActivos === 1 ? 'usuario activo' : 'usuarios activos'}{' '}
        ·{' '}
        {cliente.ultimaActividad
          ? `último registro ${fecha.format(new Date(cliente.ultimaActividad))}`
          : 'sin registros'}
      </span>
    </button>
  )
}

function NuevoClienteSheet({ onClose }: { onClose: () => void }) {
  const [nombre, setNombre] = useState('')
  const [lugar, setLugar] = useState('')
  const [correo, setCorreo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creado, setCreado] = useState<{
    enlace: string
    venceEn: string
  } | null>(null)

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      const r = await crearCliente({ nombre, lugar, correo })
      setCreado({ enlace: r.enlace, venceEn: r.venceEn })
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <BottomSheet titulo="Nuevo cliente" onClose={onClose}>
      {creado ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold text-text">
            Cliente "{nombre.trim()}" creado.
          </p>
          <EnlaceInvitacion
            invitacion={{
              id: '',
              enlace: creado.enlace,
              venceEn: creado.venceEn,
              correo: correo.trim(),
            }}
            tenant={nombre.trim()}
          />
          <TouchButton type="button" variant="ghost" onClick={onClose}>
            Listo
          </TouchButton>
        </div>
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
          <IconField label="Nombre del cliente" htmlFor="plataforma-nombre">
            <input
              id="plataforma-nombre"
              maxLength={80}
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={INPUT}
            />
          </IconField>
          <IconField label="Primer lugar de trabajo" htmlFor="plataforma-lugar">
            <input
              id="plataforma-lugar"
              maxLength={80}
              required
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              className={INPUT}
            />
          </IconField>
          <IconField
            label="Correo de la administradora"
            htmlFor="plataforma-correo"
            icon={<Mail size={18} />}
          >
            <input
              id="plataforma-correo"
              type="email"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={INPUT}
            />
          </IconField>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <TouchButton type="submit" disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Crear cliente e invitación'}
          </TouchButton>
        </form>
      )}
    </BottomSheet>
  )
}

type Hoja =
  | { tipo: 'invitar' }
  | { tipo: 'eliminarUsuario'; usuario: UsuarioPlataforma }
  | { tipo: 'eliminarCliente' }

function ClienteDetalle({
  tenantId,
  onVolver,
}: {
  tenantId: string
  onVolver: () => void
}) {
  const cargar = useCallback(() => detalleCliente(tenantId), [tenantId])
  const { datos, error, recargar } = useCarga<DetalleCliente>(cargar)
  const [hoja, setHoja] = useState<Hoja | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const cerrar = () => {
    setHoja(null)
    recargar()
  }

  return (
    <div className="flex flex-col gap-3">
      <TouchButton
        type="button"
        variant="ghost"
        onClick={onVolver}
        className="self-start"
      >
        <ArrowLeft size={18} />
        Clientes
      </TouchButton>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="text-sm text-text">
          {aviso}
        </p>
      )}
      {datos && (
        <>
          <h2 className="text-h3 text-text">{datos.cliente.nombre}</h2>
          <section aria-label="Usuarios" className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-text">Usuarios</h3>
            {datos.usuarios.length === 0 && (
              <p className="text-sm text-text-muted">Sin usuarios.</p>
            )}
            {datos.usuarios.map((u) => (
              <Card key={u.id} className="flex items-center gap-2 p-3">
                <div className="flex flex-1 flex-col gap-0.5 text-sm">
                  <span className="font-bold text-text">{u.nombre}</span>
                  <span className="text-xs break-all text-text-muted">
                    {u.correo} ·{' '}
                    {u.rol === 'administrador' ? 'Administradora' : 'Personal'}
                    {u.desactivado && ' · Desactivado'}
                  </span>
                </div>
                <TouchButton
                  type="button"
                  variant="ghost"
                  aria-label={`Eliminar a ${u.nombre}`}
                  onClick={() =>
                    setHoja({ tipo: 'eliminarUsuario', usuario: u })
                  }
                  className="shrink-0 px-3"
                >
                  <Trash size={16} />
                </TouchButton>
              </Card>
            ))}
          </section>
          <section
            aria-label="Invitaciones pendientes"
            className="flex flex-col gap-2"
          >
            <h3 className="text-sm font-bold text-text">
              Invitaciones pendientes
            </h3>
            {datos.invitaciones.length === 0 ? (
              <p className="text-sm text-text-muted">Ninguna.</p>
            ) : (
              datos.invitaciones.map((i) => (
                <p key={i.id} className="text-sm text-text">
                  {i.correo} ·{' '}
                  {i.rol === 'administrador' ? 'Administradora' : 'Personal'} ·
                  vence {fecha.format(new Date(i.venceEn))}
                </p>
              ))
            )}
          </section>
          <div className="flex flex-col gap-2 desk:flex-row">
            <TouchButton
              type="button"
              variant="secondary"
              onClick={() => setHoja({ tipo: 'invitar' })}
            >
              <Mail size={16} />
              Invitar
            </TouchButton>
            <TouchButton
              type="button"
              variant="ghost"
              onClick={() => setHoja({ tipo: 'eliminarCliente' })}
              className="text-danger!"
            >
              <Trash size={16} />
              Eliminar cliente
            </TouchButton>
          </div>
          {hoja?.tipo === 'invitar' && (
            <InvitarSheet
              tenantId={tenantId}
              cliente={datos.cliente.nombre}
              onClose={cerrar}
            />
          )}
          {hoja?.tipo === 'eliminarUsuario' && (
            <EliminarUsuarioSheet
              usuario={hoja.usuario}
              onClose={cerrar}
              onEliminado={(texto) => {
                setAviso(texto)
                cerrar()
              }}
            />
          )}
          {hoja?.tipo === 'eliminarCliente' && (
            <EliminarClienteSheet
              tenantId={tenantId}
              cliente={datos.cliente.nombre}
              onClose={() => setHoja(null)}
              onEliminado={onVolver}
            />
          )}
        </>
      )}
    </div>
  )
}

function InvitarSheet({
  tenantId,
  cliente,
  onClose,
}: {
  tenantId: string
  cliente: string
  onClose: () => void
}) {
  const [correo, setCorreo] = useState('')
  const [rol, setRol] = useState<'administrador' | 'personal'>('personal')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creada, setCreada] = useState<{
    enlace: string
    venceEn: string
  } | null>(null)

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOcupado(true)
    setError(null)
    try {
      setCreada(await invitarACliente({ tenantId, correo, rol }))
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <BottomSheet titulo={`Invitar a ${cliente}`} onClose={onClose}>
      {creada ? (
        <EnlaceInvitacion
          invitacion={{ id: '', ...creada, correo: correo.trim() }}
          tenant={cliente}
        />
      ) : (
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3">
          <IconField
            label="Correo"
            htmlFor="plataforma-invitar-correo"
            icon={<Mail size={18} />}
          >
            <input
              id="plataforma-invitar-correo"
              type="email"
              required
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className={INPUT}
            />
          </IconField>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-text">
            Rol
            <select
              value={rol}
              onChange={(e) =>
                setRol(e.target.value as 'administrador' | 'personal')
              }
              className="touch-target rounded-md border border-border bg-surface px-3.5 text-[15px] font-normal text-text"
            >
              <option value="personal">Personal</option>
              <option value="administrador">Administradora</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <TouchButton type="submit" disabled={ocupado}>
            {ocupado ? 'Creando…' : 'Crear invitación'}
          </TouchButton>
        </form>
      )}
    </BottomSheet>
  )
}

function EliminarUsuarioSheet({
  usuario,
  onClose,
  onEliminado,
}: {
  usuario: UsuarioPlataforma
  onClose: () => void
  onEliminado: (aviso: string) => void
}) {
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const coincide =
    confirmacion.trim().toLowerCase() === usuario.correo.toLowerCase()

  async function eliminar() {
    setOcupado(true)
    setError(null)
    try {
      const r = await eliminarUsuario(usuario.id, confirmacion)
      onEliminado(
        r.cuentaPendiente
          ? `Se eliminó a ${usuario.nombre}, pero su cuenta de acceso no se pudo borrar: ya no ve datos; reintenta más tarde.`
          : `Se eliminó a ${usuario.nombre}. Sus registros quedan como "Usuario eliminado".`,
      )
    } catch (e) {
      setError(mensaje(e))
      setOcupado(false)
    }
  }

  return (
    <BottomSheet titulo={`Eliminar a ${usuario.nombre}`} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm text-text">
        <p>
          Se borran su cuenta, su correo y su nombre. Sus registros (consumos,
          compras, tratamientos) se conservan en el cliente como "Usuario
          eliminado". No se puede deshacer.
        </p>
        <IconField
          label={`Escribe ${usuario.correo} para confirmar`}
          htmlFor="plataforma-confirmar-usuario"
        >
          <input
            id="plataforma-confirmar-usuario"
            autoComplete="off"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            className={INPUT}
          />
        </IconField>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <TouchButton
          type="button"
          disabled={!coincide || ocupado}
          onClick={() => void eliminar()}
          className="bg-danger! hover:bg-danger! disabled:bg-disabled-bg!"
        >
          {ocupado ? 'Eliminando…' : 'Eliminar usuario'}
        </TouchButton>
      </div>
    </BottomSheet>
  )
}

function EliminarClienteSheet({
  tenantId,
  cliente,
  onClose,
  onEliminado,
}: {
  tenantId: string
  cliente: string
  onClose: () => void
  onEliminado: () => void
}) {
  const [respaldado, setRespaldado] = useState(false)
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<string[] | null>(null)
  const normalizar = (s: string) =>
    s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
  const coincide = normalizar(confirmacion) === normalizar(cliente)

  async function respaldar() {
    setOcupado(true)
    setError(null)
    try {
      await descargarRespaldo(tenantId, cliente)
      setRespaldado(true)
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  async function eliminar() {
    setOcupado(true)
    setError(null)
    try {
      const r = await eliminarCliente(tenantId, confirmacion)
      if (r.cuentasPendientes.length === 0) onEliminado()
      else setPendientes(r.cuentasPendientes)
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  async function reintentar() {
    if (!pendientes) return
    setOcupado(true)
    setError(null)
    try {
      const r = await borrarCuentas(pendientes)
      if (r.cuentasPendientes.length === 0) onEliminado()
      else setPendientes(r.cuentasPendientes)
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <BottomSheet
      titulo={`Eliminar ${cliente}`}
      onClose={pendientes ? onEliminado : onClose}
    >
      <div className="flex flex-col gap-3 text-sm text-text">
        {pendientes ? (
          <>
            <p role="status">
              El cliente y sus datos se borraron, pero {pendientes.length}{' '}
              {pendientes.length === 1
                ? 'cuenta de acceso no se pudo'
                : 'cuentas de acceso no se pudieron'}{' '}
              borrar (ya no ven datos).
            </p>
            <TouchButton
              type="button"
              disabled={ocupado}
              onClick={() => void reintentar()}
            >
              Reintentar
            </TouchButton>
          </>
        ) : (
          <>
            <p>
              Se borran <span className="font-bold">todos</span> sus datos
              (inventario, compras, tratamientos, pacientes, reportes) y las
              cuentas de sus usuarios. No se puede deshacer.
            </p>
            <TouchButton
              type="button"
              variant="secondary"
              disabled={ocupado}
              onClick={() => void respaldar()}
            >
              <Download size={16} />
              {respaldado ? 'Respaldo descargado' : '1. Descargar respaldo'}
            </TouchButton>
            <IconField
              label={`2. Escribe "${cliente}" para confirmar`}
              htmlFor="plataforma-confirmar-cliente"
            >
              <input
                id="plataforma-confirmar-cliente"
                autoComplete="off"
                disabled={!respaldado}
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                className={INPUT}
              />
            </IconField>
            <TouchButton
              type="button"
              disabled={!respaldado || !coincide || ocupado}
              onClick={() => void eliminar()}
              className="bg-danger! hover:bg-danger! disabled:bg-disabled-bg!"
            >
              {ocupado ? 'Eliminando…' : 'Eliminar cliente y sus datos'}
            </TouchButton>
          </>
        )}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
