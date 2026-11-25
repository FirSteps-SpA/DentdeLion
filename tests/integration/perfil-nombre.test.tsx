import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { UsuarioActual } from '../../src/lib/db'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      usuarioActual: new MemoryTable(),
      usuariosConocidos: new MemoryTable(),
    }),
  }
})

const rpc = vi.fn()
const conexion = { ok: true }
vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () =>
    conexion.ok
      ? { client: { rpc }, error: null }
      : { client: null, error: { message: 'sin configuración' } },
}))

vi.mock('../../src/features/auth/useLogout', () => ({
  useLogout: () => ({ signOut: vi.fn(), isPending: false }),
}))

import { db } from '../../src/lib/db'
import { useAuthStore } from '../../src/stores/authStore'
import { PerfilSection } from '../../src/features/ajustes/components/PerfilSection'
import { MenuPerfil } from '../../src/app/MenuPerfil'
import { TENANT_1 } from '../helpers/tenancy'

const personal: UsuarioActual = {
  id: 'p1',
  email: 'ana@x.cl',
  nombre: 'Ana',
  rol: 'personal',
  autenticadoEn: 'x',
  tenantId: TENANT_1,
  desactivadoEn: null,
}

function Pantalla() {
  return (
    <>
      <MenuPerfil />
      <PerfilSection />
    </>
  )
}

beforeEach(async () => {
  conexion.ok = true
  rpc.mockReset()
  await db.usuarioActual.clear()
  await db.usuariosConocidos.clear()
  await db.usuarioActual.put(personal)
  useAuthStore.setState({ usuario: personal, isReady: true })
})

function editarA(nombre: string) {
  fireEvent.click(screen.getByRole('button', { name: /Editar nombre/ }))
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: nombre } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
}

describe('editar el nombre propio (spec 032 US2, FR-009/010)', () => {
  it('el personal guarda su nombre: cambian el perfil, las iniciales y el autor conocido', async () => {
    rpc.mockResolvedValue({ data: 'Dra. Ana Pérez', error: null })
    render(<Pantalla />)
    expect(screen.getByRole('button', { name: 'Menú de Ana' })).toHaveTextContent('A')

    editarA('  Dra. Ana Pérez ')

    expect(await screen.findByText('Dra. Ana Pérez')).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith('actualizar_mi_nombre', { p_nombre: 'Dra. Ana Pérez' })
    expect(screen.getByRole('button', { name: 'Menú de Dra. Ana Pérez' })).toHaveTextContent('AP')
    expect((await db.usuarioActual.toArray())[0]?.nombre).toBe('Dra. Ana Pérez')
    expect(await db.usuariosConocidos.get('p1')).toMatchObject({ nombre: 'Dra. Ana Pérez' })
    expect(screen.queryByLabelText('Tu nombre')).not.toBeInTheDocument()
  })

  it('un nombre vacío muestra un error y no llama al servidor', async () => {
    render(<Pantalla />)

    editarA('   ')

    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe tu nombre.')
    expect(rpc).not.toHaveBeenCalled()
    expect(useAuthStore.getState().usuario?.nombre).toBe('Ana')
  })

  it('sin conexión muestra el aviso y conserva el nombre', async () => {
    conexion.ok = false
    render(<Pantalla />)

    editarA('Otra')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas conexión para cambiar tu nombre.',
    )
    expect(useAuthStore.getState().usuario?.nombre).toBe('Ana')
  })

  it('si el servidor falla, muestra el aviso y no cambia nada', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    render(<Pantalla />)

    editarA('Otra')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas conexión para cambiar tu nombre.',
    )
    expect(useAuthStore.getState().usuario?.nombre).toBe('Ana')
  })

  it('Cancelar vuelve al nombre sin guardar', () => {
    render(<Pantalla />)

    fireEvent.click(screen.getByRole('button', { name: /Editar nombre/ }))
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Otra' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(rpc).not.toHaveBeenCalled()
  })
})
