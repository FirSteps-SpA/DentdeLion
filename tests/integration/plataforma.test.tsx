import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { UsuarioActual } from '../../src/lib/db'

/**
 * Spec 031 T008, T009, T012, T013: Ajustes → "Plataforma" solo para
 * operadores; lista, detalle, crear cliente, invitar, eliminar usuario y
 * eliminar cliente (respaldo primero, luego el nombre exacto).
 */
const ID_CLIENTE = '22222222-2222-4222-8222-222222222222'
const estado = {
  operador: true,
  llamadas: [] as Record<string, unknown>[],
  respuestas: {} as Record<string, { status: number; cuerpo: unknown }>,
}

const client = {
  async rpc(fn: string) {
    return fn === 'es_operador_plataforma'
      ? { data: estado.operador, error: null }
      : { data: null, error: {} }
  },
  functions: {
    async invoke(_nombre: string, { body }: { body: Record<string, unknown> }) {
      estado.llamadas.push(body)
      const r = estado.respuestas[String(body.accion)] ?? {
        status: 500,
        cuerpo: { codigo: 'error_interno' },
      }
      if (r.status === 200)
        return { data: structuredClone(r.cuerpo), error: null }
      return {
        data: null,
        error: {
          context: new Response(JSON.stringify(r.cuerpo), { status: r.status }),
        },
      }
    },
  },
}
vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { useAuthStore } from '../../src/stores/authStore'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { PlataformaSection } from '../../src/features/plataforma/components/PlataformaSection'
import { TENANT_1 } from '../helpers/tenancy'

const operador: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'op',
  email: 'op@firststeps.cl',
  nombre: 'Operador',
  rol: 'administrador',
  autenticadoEn: 'x',
}

const detalle = {
  cliente: { id: ID_CLIENTE, nombre: 'Clínica Prueba' },
  usuarios: [
    {
      id: 'u1',
      nombre: 'Paula',
      correo: 'paula@x.cl',
      rol: 'personal',
      desactivado: false,
    },
    {
      id: 'u2',
      nombre: 'Rosa',
      correo: 'rosa@x.cl',
      rol: 'administrador',
      desactivado: false,
    },
  ],
  invitaciones: [
    {
      id: 'i1',
      correo: 'nueva@x.cl',
      rol: 'personal',
      venceEn: '2026-11-30T00:00:00.000Z',
    },
  ],
}

beforeEach(() => {
  estado.operador = true
  estado.llamadas = []
  estado.respuestas = {
    listar: {
      status: 200,
      cuerpo: {
        clientes: [
          {
            id: ID_CLIENTE,
            nombre: 'Clínica Prueba',
            creadoEn: '2026-10-01T00:00:00.000Z',
            lugares: 2,
            usuariosActivos: 2,
            ultimaActividad: '2026-11-20T00:00:00.000Z',
          },
        ],
      },
    },
    detalle: { status: 200, cuerpo: detalle },
  }
  window.location.hash = ''
  useAuthStore.setState({ usuario: operador, isReady: true })
})
afterEach(() => vi.restoreAllMocks())

async function abrirCliente() {
  render(<PlataformaSection />)
  fireEvent.click(await screen.findByRole('button', { name: /Clínica Prueba/ }))
  await screen.findByRole('heading', { name: 'Clínica Prueba' })
}

describe('acceso (US1)', () => {
  it('la tarjeta "Plataforma" aparece solo si el servidor dice que es operador', async () => {
    const { unmount } = render(<AjustesView />)
    expect(
      await screen.findByRole('button', { name: /^Plataforma/ }),
    ).toBeInTheDocument()
    unmount()

    estado.operador = false
    render(<AjustesView />)
    await waitFor(() =>
      expect(
        screen.getByRole('list', { name: 'Secciones de Ajustes' }),
      ).toBeInTheDocument(),
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(
      screen.queryByRole('button', { name: /^Plataforma/ }),
    ).not.toBeInTheDocument()
  })

  it('un error del servidor se muestra (p. ej. sin permiso)', async () => {
    estado.respuestas.listar = {
      status: 403,
      cuerpo: { codigo: 'sin_permiso' },
    }
    render(<PlataformaSection />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu cuenta no administra la plataforma.',
    )
  })
})

describe('ver y crear (US1, US2)', () => {
  it('lista clientes con su actividad y abre el detalle con usuarios e invitaciones', async () => {
    render(<PlataformaSection />)
    const fila = await screen.findByRole('button', { name: /Clínica Prueba/ })
    expect(fila).toHaveTextContent(
      '2 lugares · 2 usuarios activos · último registro',
    )
    fireEvent.click(fila)
    expect(await screen.findByText('paula@x.cl · Personal')).toBeInTheDocument()
    expect(
      screen.getByText(/nueva@x.cl · Personal · vence/),
    ).toBeInTheDocument()
  })

  it('"Nuevo cliente" crea cliente e invitación y muestra el enlace', async () => {
    estado.respuestas.crear_cliente = {
      status: 200,
      cuerpo: {
        tenantId: 't-nuevo',
        token: 'tok123',
        venceEn: '2026-11-30T00:00:00.000Z',
      },
    }
    render(<PlataformaSection />)
    fireEvent.click(
      await screen.findByRole('button', { name: /Nuevo cliente/ }),
    )
    const hoja = screen.getByRole('dialog', { name: 'Nuevo cliente' })
    fireEvent.change(within(hoja).getByLabelText('Nombre del cliente'), {
      target: { value: 'Clínica Sol' },
    })
    fireEvent.change(within(hoja).getByLabelText('Primer lugar de trabajo'), {
      target: { value: 'Centro' },
    })
    fireEvent.change(
      within(hoja).getByLabelText('Correo de la administradora'),
      { target: { value: 'ana@sol.cl' } },
    )
    fireEvent.click(
      within(hoja).getByRole('button', { name: 'Crear cliente e invitación' }),
    )
    expect(
      await within(hoja).findByText(/invitacion=tok123/),
    ).toBeInTheDocument()
    expect(estado.llamadas).toContainEqual({
      accion: 'crear_cliente',
      nombre: 'Clínica Sol',
      lugar: 'Centro',
      correo: 'ana@sol.cl',
    })
  })

  it('"Invitar" muestra el enlace; un correo de otro cliente muestra el error', async () => {
    estado.respuestas.invitar = {
      status: 409,
      cuerpo: { codigo: 'correo_en_otro_tenant' },
    }
    await abrirCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Invitar' }))
    const hoja = screen.getByRole('dialog', {
      name: 'Invitar a Clínica Prueba',
    })
    fireEvent.change(within(hoja).getByLabelText('Correo'), {
      target: { value: 'x@y.cl' },
    })
    fireEvent.click(
      within(hoja).getByRole('button', { name: 'Crear invitación' }),
    )
    expect(await within(hoja).findByRole('alert')).toHaveTextContent(
      'Ese correo ya pertenece a otro cliente.',
    )

    estado.respuestas.invitar = {
      status: 200,
      cuerpo: { token: 'tok9', venceEn: '2026-11-30T00:00:00.000Z' },
    }
    fireEvent.click(
      within(hoja).getByRole('button', { name: 'Crear invitación' }),
    )
    expect(await within(hoja).findByText(/invitacion=tok9/)).toBeInTheDocument()
  })
})

describe('eliminar usuario (US3)', () => {
  it('pide escribir su correo; luego elimina y avisa', async () => {
    estado.respuestas.eliminar_usuario = {
      status: 200,
      cuerpo: { ok: true, cuentaPendiente: false },
    }
    await abrirCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar a Paula' }))
    const hoja = screen.getByRole('dialog', { name: 'Eliminar a Paula' })
    const boton = within(hoja).getByRole('button', { name: 'Eliminar usuario' })
    expect(boton).toBeDisabled()
    fireEvent.change(within(hoja).getByLabelText(/para confirmar/), {
      target: { value: 'PAULA@x.cl ' },
    })
    expect(boton).toBeEnabled()
    fireEvent.click(boton)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se eliminó a Paula. Sus registros quedan como "Usuario eliminado".',
    )
    expect(estado.llamadas).toContainEqual({
      accion: 'eliminar_usuario',
      usuarioId: 'u1',
      confirmacion: 'PAULA@x.cl ',
    })
  })

  it('la única administradora no se elimina: muestra el motivo', async () => {
    estado.respuestas.eliminar_usuario = {
      status: 409,
      cuerpo: { codigo: 'unica_administradora' },
    }
    await abrirCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar a Rosa' }))
    const hoja = screen.getByRole('dialog', { name: 'Eliminar a Rosa' })
    fireEvent.change(within(hoja).getByLabelText(/para confirmar/), {
      target: { value: 'rosa@x.cl' },
    })
    fireEvent.click(
      within(hoja).getByRole('button', { name: 'Eliminar usuario' }),
    )
    expect(await within(hoja).findByRole('alert')).toHaveTextContent(
      'Es la única administradora',
    )
  })
})

describe('eliminar cliente (US4)', () => {
  it('primero descarga el respaldo; luego pide el nombre exacto y elimina', async () => {
    estado.respuestas.exportar_cliente = {
      status: 200,
      cuerpo: { cliente: { id: ID_CLIENTE }, tablas: {} },
    }
    estado.respuestas.eliminar_cliente = {
      status: 200,
      cuerpo: { cuentasBorradas: 2, cuentasPendientes: [] },
    }
    const crearUrl = vi.fn(() => 'blob:respaldo')
    Object.assign(URL, { createObjectURL: crearUrl, revokeObjectURL: vi.fn() })
    const clic = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    await abrirCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cliente' }))
    const hoja = screen.getByRole('dialog', { name: 'Eliminar Clínica Prueba' })
    const confirmar = within(hoja).getByLabelText(/para confirmar/)
    const eliminar = within(hoja).getByRole('button', {
      name: 'Eliminar cliente y sus datos',
    })
    expect(confirmar).toBeDisabled()
    expect(eliminar).toBeDisabled()

    fireEvent.click(
      within(hoja).getByRole('button', { name: /Descargar respaldo/ }),
    )
    expect(
      await within(hoja).findByRole('button', { name: /Respaldo descargado/ }),
    ).toBeInTheDocument()
    expect(clic).toHaveBeenCalled()
    expect(crearUrl).toHaveBeenCalled()

    fireEvent.change(confirmar, { target: { value: 'Clínica' } })
    expect(eliminar).toBeDisabled()
    fireEvent.change(confirmar, { target: { value: 'clínica prueba' } })
    fireEvent.click(eliminar)
    // Vuelve a la lista.
    expect(
      await screen.findByRole('button', { name: /Nuevo cliente/ }),
    ).toBeInTheDocument()
    expect(estado.llamadas).toContainEqual({
      accion: 'eliminar_cliente',
      tenantId: ID_CLIENTE,
      confirmacion: 'clínica prueba',
    })
  })

  it('si quedan cuentas sin borrar, lo dice y permite reintentar', async () => {
    estado.respuestas.exportar_cliente = { status: 200, cuerpo: {} }
    estado.respuestas.eliminar_cliente = {
      status: 200,
      cuerpo: { cuentasBorradas: 1, cuentasPendientes: ['u2'] },
    }
    estado.respuestas.borrar_cuentas = {
      status: 200,
      cuerpo: { cuentasPendientes: [] },
    }
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await abrirCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar cliente' }))
    const hoja = screen.getByRole('dialog', { name: 'Eliminar Clínica Prueba' })
    fireEvent.click(
      within(hoja).getByRole('button', { name: /Descargar respaldo/ }),
    )
    await within(hoja).findByRole('button', { name: /Respaldo descargado/ })
    fireEvent.change(within(hoja).getByLabelText(/para confirmar/), {
      target: { value: 'Clínica Prueba' },
    })
    fireEvent.click(
      within(hoja).getByRole('button', {
        name: 'Eliminar cliente y sus datos',
      }),
    )
    expect(await within(hoja).findByRole('status')).toHaveTextContent(
      '1 cuenta de acceso no se pudo borrar',
    )
    fireEvent.click(within(hoja).getByRole('button', { name: 'Reintentar' }))
    expect(
      await screen.findByRole('button', { name: /Nuevo cliente/ }),
    ).toBeInTheDocument()
    expect(estado.llamadas).toContainEqual({
      accion: 'borrar_cuentas',
      usuarioIds: ['u2'],
    })
  })
})
