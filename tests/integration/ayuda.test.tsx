import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { UsuarioActual } from '../../src/lib/db'
import { useAuthStore } from '../../src/stores/authStore'
import { EncabezadoVista } from '../../src/components/ui/EncabezadoVista'
import { GuiaUsoSection } from '../../src/features/ayuda/components/GuiaUsoSection'
import { configuracionAyuda } from '../../src/features/ayuda/ayudasVistas'
import { AYUDAS, ORDEN_AYUDAS, tituloAyuda } from '../../src/features/ayuda/contenido'
import { TENANT_1 } from '../helpers/tenancy'

/** Spec 030 T006, T008, T010 (FR-001..FR-006). */
const admin: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'admin-1',
  email: 'a@x.cl',
  nombre: 'Ana',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
}
const personal: UsuarioActual = { ...admin, id: 'p1', nombre: 'Paula', rol: 'personal' }

beforeEach(() => {
  localStorage.clear()
  configuracionAyuda.automatica = false
  useAuthStore.setState({ usuario: admin, isReady: true })
})
afterEach(() => {
  configuracionAyuda.automatica = false
})

describe('"?" en cada pantalla (US1)', () => {
  it.each(ORDEN_AYUDAS)('%s: botón de ayuda y hoja con sus secciones', (id) => {
    const titulo = tituloAyuda(id, 'administrador')
    render(<EncabezadoVista titulo={titulo} ayuda={id} />)

    const boton = screen.getByRole('button', { name: `Ayuda de ${titulo}` })
    expect(boton).toHaveClass('touch-target')
    fireEvent.click(boton)

    const hoja = screen.getByRole('dialog', { name: `Ayuda: ${titulo}` })
    expect(within(hoja).getByRole('heading', { name: 'Para qué sirve' })).toBeInTheDocument()
    expect(within(hoja).getByText(AYUDAS[id].paraQue)).toBeInTheDocument()
    expect(within(hoja).getByRole('heading', { name: 'Cómo se hace…' })).toBeInTheDocument()
    for (const tarea of AYUDAS[id].tareas) {
      expect(within(hoja).getByRole('heading', { name: new RegExp(`^${tarea.nombre}`) })).toBeInTheDocument()
    }

    fireEvent.click(within(hoja).getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('la administración ve las tareas de administración marcadas; personal no las ve', () => {
    const { unmount } = render(<EncabezadoVista titulo="Inventario" ayuda="inventario" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda de Inventario' }))
    expect(
      screen.getByRole('heading', { name: 'Editar o eliminar un material Solo administración' }),
    ).toBeInTheDocument()
    unmount()

    useAuthStore.setState({ usuario: personal })
    render(<EncabezadoVista titulo="Inventario" ayuda="inventario" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda de Inventario' }))
    expect(screen.queryByText('Editar o eliminar un material')).not.toBeInTheDocument()
    expect(screen.queryByText('Solo administración')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Consumir un material' })).toBeInTheDocument()
  })

  it('la hoja se dibuja fuera del encabezado, para que la barra inferior no la tape', () => {
    const { container } = render(<EncabezadoVista titulo="Inicio" ayuda="inicio" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda de Inicio' }))
    const hoja = screen.getByRole('dialog', { name: 'Ayuda: Inicio' })
    expect(container.contains(hoja)).toBe(false)
    expect(hoja.closest('.z-10')).toBeNull()
  })

  it('personal no ve "?" en una pantalla solo de administración', () => {
    useAuthStore.setState({ usuario: personal })
    render(<EncabezadoVista titulo="Lugares de trabajo" ayuda="ajustes:lugares" />)
    expect(screen.queryByRole('button', { name: /^Ayuda de/ })).not.toBeInTheDocument()
  })
})

describe('primera visita (US2)', () => {
  beforeEach(() => {
    configuracionAyuda.automatica = true
  })

  it('se abre sola una vez por pantalla y persona', () => {
    const primera = render(<EncabezadoVista titulo="Compras" ayuda="compras" />)
    expect(screen.getByRole('dialog', { name: 'Ayuda: Compras' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    primera.unmount()

    // Volver a la pantalla: no se abre sola; el "?" sigue funcionando.
    const segunda = render(<EncabezadoVista titulo="Compras" ayuda="compras" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda de Compras' }))
    expect(screen.getByRole('dialog', { name: 'Ayuda: Compras' })).toBeInTheDocument()
    segunda.unmount()

    // Otra pantalla, sí.
    const otra = render(<EncabezadoVista titulo="Alertas" ayuda="alertas" />)
    expect(screen.getByRole('dialog', { name: 'Ayuda: Alertas' })).toBeInTheDocument()
    otra.unmount()

    // Otra persona en el mismo dispositivo, sí.
    act(() => useAuthStore.setState({ usuario: personal }))
    render(<EncabezadoVista titulo="Compras" ayuda="compras" />)
    expect(screen.getByRole('dialog', { name: 'Ayuda: Compras' })).toBeInTheDocument()
  })

  it('abrirla con "?" también la marca como vista', () => {
    configuracionAyuda.automatica = false
    const r = render(<EncabezadoVista titulo="Reportes" ayuda="reportes" />)
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda de Reportes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    r.unmount()

    configuracionAyuda.automatica = true
    render(<EncabezadoVista titulo="Reportes" ayuda="reportes" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('no abre dos hojas a la vez', () => {
    render(
      <>
        <EncabezadoVista titulo="Inicio" ayuda="inicio" />
        <EncabezadoVista titulo="Alertas" ayuda="alertas" />
      </>,
    )
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('sin almacenamiento la app sigue funcionando', () => {
    const original = Storage.prototype.getItem
    const originalSet = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('bloqueado')
    }
    Storage.prototype.setItem = () => {
      throw new Error('bloqueado')
    }
    try {
      render(<EncabezadoVista titulo="Inventario" ayuda="inventario" />)
      expect(screen.getByRole('dialog', { name: 'Ayuda: Inventario' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } finally {
      Storage.prototype.getItem = original
      Storage.prototype.setItem = originalSet
    }
  })
})

describe('Ajustes → "Guía de uso" (US3)', () => {
  it('la administración ve las 15 pantallas en orden, desplegables', () => {
    const { container } = render(<GuiaUsoSection />)
    const resumenes = [...container.querySelectorAll('summary')].map((s) => s.textContent)
    expect(resumenes).toEqual(
      ORDEN_AYUDAS.map((id) =>
        id.startsWith('ajustes:')
          ? `Ajustes · ${tituloAyuda(id, 'administrador')}`
          : tituloAyuda(id, 'administrador'),
      ),
    )
    expect(screen.getByText(AYUDAS.compras.paraQue)).toBeInTheDocument()
  })

  it('personal ve solo las pantallas que puede abrir', () => {
    useAuthStore.setState({ usuario: personal })
    const { container } = render(<GuiaUsoSection />)
    expect([...container.querySelectorAll('summary')].map((s) => s.textContent)).toEqual([
      'Inicio',
      'Inventario',
      'Tratamientos',
      'Compras',
      'Reportes',
      'Alertas',
      'Ajustes',
      'Ajustes · Perfil',
      'Ajustes · Notificaciones',
    ])
  })
})
