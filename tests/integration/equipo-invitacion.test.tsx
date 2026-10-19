import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb(
      Object.fromEntries(
        [...tablasMemoria, 'preferenciasNotificaciones', 'borradores'].map((nombre) => [
          nombre,
          new MemoryTable(),
        ]),
      ),
    ),
  }
})

/**
 * Cliente Supabase falso (spec 014 T057): RPC de equipo e invitaciones,
 * lectura de invitaciones pendientes y la Edge Function `aceptar-invitacion`.
 */
const estado = {
  rpc: [] as { nombre: string; args: unknown }[],
  pendientes: [] as { id: string; correo: string; rol: string; vence_en: string }[],
  respuestaFuncion: { status: 200, cuerpo: { correo: 'nueva@x.cl' } as unknown },
  invitacionVigente: true,
}

const client = {
  auth: { signInWithPassword: vi.fn(async () => ({ data: { user: null }, error: { message: 'x' } })) },
  async rpc(nombre: string, args: unknown) {
    estado.rpc.push({ nombre, args })
    if (nombre === 'equipo_tenant') {
      return {
        data: [
          { id: 'u1', nombre: 'Ana', correo: 'ana@x.cl', rol: 'administrador', desactivado_en: null },
        ],
        error: null,
      }
    }
    if (nombre === 'crear_invitacion') {
      return {
        data: [{ id: 'inv-1', token: 'TOKEN-123', vence_en: '2026-10-25T00:00:00Z' }],
        error: null,
      }
    }
    if (nombre === 'revocar_invitacion') {
      estado.pendientes = estado.pendientes.filter((p) => p.id !== (args as { p_id: string }).p_id)
      return { data: null, error: null }
    }
    if (nombre === 'ver_invitacion') {
      return {
        data: estado.invitacionVigente ? [{ correo: 'nueva@x.cl', tenant: 'Clínica Sonrisas' }] : [],
        error: null,
      }
    }
    return { data: null, error: null }
  },
  from(tabla: string) {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      order: async () => ({ data: tabla === 'invitaciones' ? estado.pendientes : [], error: null }),
      maybeSingle: async () => ({ data: { nombre: 'Clínica Sonrisas' }, error: null }),
    }
    return consulta
  },
  functions: {
    async invoke() {
      const { status, cuerpo } = estado.respuestaFuncion
      if (status === 200) return { data: cuerpo, error: null }
      return {
        data: null,
        error: { context: new Response(JSON.stringify(cuerpo), { status }) },
      }
    },
  },
}

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { EquipoSection } from '../../src/features/ajustes/components/EquipoSection'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { AceptarInvitacion } from '../../src/features/auth/AceptarInvitacion'
import { AccesoDesactivado } from '../../src/features/auth/AccesoDesactivado'
import { useAuthStore } from '../../src/stores/authStore'
import { usePendientesStore } from '../../src/stores/pendientesStore'
import { usarLugar1 } from '../helpers/lugarFalso'
import { TENANT_1 } from '../helpers/tenancy'

const admin = {
  id: 'u1',
  tenantId: TENANT_1,
  desactivadoEn: null,
  email: 'ana@x.cl',
  nombre: 'Ana',
  rol: 'administrador' as const,
  autenticadoEn: 'x',
}

beforeEach(() => {
  usarLugar1()
  estado.rpc = []
  estado.pendientes = [
    { id: 'inv-0', correo: 'pedro@x.cl', rol: 'personal', vence_en: '2099-01-01T00:00:00Z' },
  ]
  estado.respuestaFuncion = { status: 200, cuerpo: { correo: 'nueva@x.cl' } }
  estado.invitacionVigente = true
  useAuthStore.setState({ usuario: admin, isReady: true })
})

afterEach(() => {
  useAuthStore.setState({ usuario: null, isReady: true })
})

describe('Equipo (spec 014 US5)', () => {
  it('lista el equipo y las invitaciones pendientes', async () => {
    render(<EquipoSection />)

    expect(await screen.findByText('ana@x.cl')).toBeInTheDocument()
    expect(screen.getByText('pedro@x.cl')).toBeInTheDocument()
  })

  it('invitar crea el enlace y ofrece correo, WhatsApp y copiar', async () => {
    render(<EquipoSection />)
    await screen.findByText('ana@x.cl')

    fireEvent.click(screen.getByRole('button', { name: /Invitar/ }))
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'Nueva@X.cl' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }))

    const dialogo = await screen.findByRole('dialog', { name: 'Envía la invitación' })
    expect(estado.rpc).toContainEqual({
      nombre: 'crear_invitacion',
      args: { p_correo: 'nueva@x.cl', p_rol: 'personal' },
    })
    const enlace = `${window.location.origin}/?invitacion=TOKEN-123`
    expect(dialogo).toHaveTextContent(enlace)
    expect(dialogo).toHaveTextContent('vence en 7 días')
    const correo = within(dialogo).getByRole('link', { name: /Enviar por correo/ })
    expect(correo.getAttribute('href')).toMatch(/^mailto:\?subject=/)
    expect(decodeURIComponent(correo.getAttribute('href')!)).toContain(enlace)
    const whatsapp = within(dialogo).getByRole('link', { name: /WhatsApp/ })
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(within(dialogo).getByRole('button', { name: /Copiar enlace/ })).toBeInTheDocument()
  })

  it('revocar quita la invitación de pendientes', async () => {
    render(<EquipoSection />)
    await screen.findByText('pedro@x.cl')

    fireEvent.click(screen.getByRole('button', { name: 'Revocar' }))

    await waitFor(() => expect(screen.queryByText('pedro@x.cl')).not.toBeInTheDocument())
    expect(estado.rpc).toContainEqual({ nombre: 'revocar_invitacion', args: { p_id: 'inv-0' } })
  })

  it('el personal no ve "Equipo" (US5-7)', () => {
    useAuthStore.setState({ usuario: { ...admin, rol: 'personal' }, isReady: true })
    render(<AjustesView />)

    expect(screen.queryByText('Equipo')).not.toBeInTheDocument()
  })
})

describe('pantalla de invitación (spec 014 US5)', () => {
  const llenar = () => {
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Nueva' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave12345' } })
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), {
      target: { value: 'Clave12345' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))
  }

  beforeEach(() => useAuthStore.setState({ usuario: null, isReady: true }))

  it('muestra el cliente y el correo de una invitación vigente', async () => {
    render(<AceptarInvitacion token="TOKEN-123" onSalir={() => {}} />)

    expect(await screen.findByText('Te invitaron a Clínica Sonrisas')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveValue('nueva@x.cl')
  })

  it('una invitación no vigente dice que ya no es válida', async () => {
    estado.invitacionVigente = false
    render(<AceptarInvitacion token="TOKEN-123" onSalir={() => {}} />)

    expect(await screen.findByText('Esta invitación ya no es válida.')).toBeInTheDocument()
  })

  it.each([
    ['invitacion_vencida', 410, 'Esta invitación venció; pide una nueva.'],
    ['correo_en_otro_tenant', 409, 'Este correo ya pertenece a otro cliente de Dentdelion.'],
    ['invitacion_invalida', 404, 'Esta invitación ya no es válida.'],
  ])('muestra el error %s de la Edge Function', async (codigo, status, mensaje) => {
    estado.respuestaFuncion = { status, cuerpo: { codigo } }
    render(<AceptarInvitacion token="TOKEN-123" onSalir={() => {}} />)
    await screen.findByText('Te invitaron a Clínica Sonrisas')

    llenar()

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
  })

  it('valida la contraseña antes de enviar', async () => {
    render(<AceptarInvitacion token="TOKEN-123" onSalir={() => {}} />)
    await screen.findByText('Te invitaron a Clínica Sonrisas')

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Nueva' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'corta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Unirme' }))

    expect(
      await screen.findByText(/al menos 10 caracteres, con letras y números/, { selector: '[role=alert]' }),
    ).toBeInTheDocument()
  })

  it('si la acepta, inicia sesión con el correo y la contraseña', async () => {
    render(<AceptarInvitacion token="TOKEN-123" onSalir={() => {}} />)
    await screen.findByText('Te invitaron a Clínica Sonrisas')

    llenar()

    await waitFor(() =>
      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'nueva@x.cl',
        password: 'Clave12345',
      }),
    )
  })
})

describe('acceso desactivado (spec 014 FR-021)', () => {
  it('dice que el acceso está desactivado y cuántos registros no subieron', () => {
    useAuthStore.setState({
      usuario: { ...admin, desactivadoEn: '2026-10-18T00:00:00Z' },
      isReady: true,
    })
    usePendientesStore.setState({
      pendientes: [
        { usuarioId: 'u1', movimientos: 2, cambiosInsumo: 0, categorias: 0, creados: [] },
      ],
    })
    render(<AccesoDesactivado />)

    expect(screen.getByText(/Tu acceso a Dentdelion está desactivado/)).toBeInTheDocument()
    expect(screen.getByText('2 registros no se pudieron subir.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })
})
