import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import type {
  CambioInsumo,
  Categoria,
  ConfiguracionAlertas,
  Insumo,
  Lote,
  Movimiento,
  UsuarioActual,
} from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      tratamientosRealizados: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      categorias: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      borradores: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { resolverLugarActivo, useLugarStore } from '../../src/stores/lugarStore'
import { lugar1 } from '../helpers/lugarFalso'
import type { Lugar } from '../../src/lib/db'
import { useAuthStore } from '../../src/stores/authStore'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { AppHeader } from '../../src/app/AppHeader'
import { TENANT_1 } from '../helpers/tenancy'
import { esperarQueLaRuedaNoCambie } from '../helpers/rueda'
import { CATEGORIAS_PRECARGADAS } from '../../src/features/insumos/lib/categorias'

const insumosT = db.insumos as unknown as MemoryTable<Insumo>
const lotesT = db.lotes as unknown as MemoryTable<Lote>
const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>
const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>
const configAlertasT = db.configuracionAlertas as unknown as MemoryTable<
  ConfiguracionAlertas & { id: string }
>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>
const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const prefNotifT = db.preferenciasNotificaciones as unknown as MemoryTable<{
  id: string
  stockBajo: boolean
  caducidad: boolean
}>

function insumo(id: string, nombre: string, overrides: Partial<Insumo> = {}): Insumo {
  return {
    unidadCompra: 'caja',
    contenido: 1,
    tenantId: TENANT_1,
    id,
    nombre,
    categoria: 'Cirugía',
    unidadMedida: 'caja',
    permiteDecimales: false,
    caduca: true,
    codigoFabricante: null,
    creadoEn: '2026-01-01T00:00:00.000Z',
    stockMinimo: 5,
    dadoDeBajaEn: null,
    dadoDeBajaPor: null,
    creadoPor: null,
    ...overrides,
  }
}

function categoria(id: string, nombre: string, overrides: Partial<Categoria> = {}): Categoria {
  return {
    tenantId: TENANT_1,
    id,
    nombre,
    creadoPor: 'admin-1',
    creadoEn: '2026-01-01T00:00:00.000Z',
    sincronizado: true,
    rechazadoEn: null,
    desactivadoEn: null,
    ...overrides,
  }
}

const personal: UsuarioActual = {
  tenantId: TENANT_1,
  desactivadoEn: null,
  id: 'personal-1',
  email: 'p@x.cl',
  nombre: 'Personal Uno',
  rol: 'personal',
  autenticadoEn: 'x',
}
const admin: UsuarioActual = {
  ...personal,
  id: 'admin-1',
  email: 'admin@x.cl',
  nombre: 'Admin Uno',
  rol: 'administrador',
}

/** Mirrors inventoryStore's/alertasStore's liveQuery subscriptions. */
function reflejarStore() {
  useInventoryStore.setState({
    insumos: insumosT.all().filter((i) => !i.dadoDeBajaEn),
    insumosDadosDeBaja: insumosT.all().filter((i) => !!i.dadoDeBajaEn),
    lotes: lotesT.all(),
    movimientos: movimientosT.all(),
    cambiosInsumo: cambiosT.all(),
    categorias: categoriasT.all(),
    isReady: true,
  })
  const config = configAlertasT.all()[0]
  useAlertasStore.setState({
    nivelesAvisoDias: config?.nivelesAvisoDias ?? [30, 7, 1],
    isReady: true,
  })
  const lugares = lugaresT.all()
  useLugarStore.setState({
    lugares,
    lugarActivoId: resolverLugarActivo(lugares, useLugarStore.getState().lugarActivoId ?? undefined),
    isReady: true,
  })
  const pref = prefNotifT.all()[0]
  useAlertasStore.setState({
    preferenciaStockBajo: pref?.stockBajo ?? true,
    preferenciaCaducidad: pref?.caducidad ?? true,
  })
}

function seed() {
  insumosT.seed([insumo('a', 'Anestesia local'), insumo('b', 'Bisturí')])
  lotesT.seed([])
  movimientosT.seed([])
  cambiosT.seed([])
  configAlertasT.seed([])
  categoriasT.seed([])
  lugaresT.seed([lugar1])
  prefNotifT.seed([])
  reflejarStore()
}

/**
 * Spec 019: Ajustes abre en un índice; cada caso entra a su sección tocando la
 * tarjeta, como la persona (SC-007: los casos anteriores se conservan).
 */
function renderSeccion(titulo: string, ui: ReactElement = <AjustesView />) {
  const resultado = render(ui)
  fireEvent.click(screen.getByRole('button', { name: titulo }))
  return resultado
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  onMemoryDbChange(reflejarStore)
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
  seed()
})

afterEach(() => {
  onMemoryDbChange(null)
  useAuthStore.setState({ usuario: null, isReady: true })
})

describe('Ajustes — Configuración de Alertas (User Story 1)', () => {
  it('lets an administrador find and change stock mínimo / niveles de aviso from Ajustes, same behavior as before', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Notificaciones y avisos')

    expect(
      screen.getByText(/stock mínimo por insumo/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Configurar niveles de aviso de caducidad'),
    ).toBeInTheDocument()

    const input = screen.getByLabelText('Stock mínimo de Anestesia local')
    expect(input).toHaveValue(5)
  })

  it('hides the config controls for a non-administrador', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    renderSeccion('Notificaciones')

    expect(
      screen.queryByText(/stock mínimo por insumo/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('Configurar niveles de aviso de caducidad'),
    ).not.toBeInTheDocument()
  })
})

describe('Ajustes — Perfil (User Story 2)', () => {
  it('shows nombre/correo/rol and closes the session on "Cerrar sesión"', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    renderSeccion('Perfil')

    expect(screen.getByText('Personal Uno')).toBeInTheDocument()
    expect(screen.getByText('p@x.cl')).toBeInTheDocument()
    expect(screen.getByText('personal')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cerrar sesión'))

    await waitFor(() => {
      expect(useAuthStore.getState().usuario).toBeNull()
    })
  })
})

describe('Ajustes — Categorías (User Story 4)', () => {
  it('creates, renames (cascading to insumos), deactivates and reactivates a category', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    insumosT.seed([insumo('a', 'Anestesia local', { categoria: 'Ortodoncia' })])
    reflejarStore()
    renderSeccion('Categorías')

    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Prótesis' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(screen.getByText('Prótesis')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Renombrar Ortodoncia/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Endodoncia' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      expect(screen.getByText('Endodoncia')).toBeInTheDocument()
      expect((await db.insumos.get('a'))!.categoria).toBe('Endodoncia')
    })

    fireEvent.click(screen.getByRole('button', { name: /Desactivar Endodoncia/i }))
    await waitFor(() => {
      expect(screen.getByText('Desactivada')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Reactivar Endodoncia/i }))
    await waitFor(() => {
      expect(screen.queryByText('Desactivada')).not.toBeInTheDocument()
    })
  })

  it('hides Categorías for a non-administrador', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(<AjustesView />)

    expect(screen.queryByText('Categorías')).not.toBeInTheDocument()
  })
})

function AjustesConHeader() {
  return (
    <div>
      <AppHeader />
      <AjustesView />
    </div>
  )
}

describe('Ajustes — Lugares de trabajo (spec 014 US4)', () => {
  it('crea un lugar: aparece en la lista y el encabezado pasa a tener selector', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Lugares de trabajo', <AjustesConHeader />)

    expect(screen.queryByRole('button', { name: /Lugar de trabajo:/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Nuevo lugar/ }))
    fireEvent.change(screen.getByLabelText('Nombre del lugar'), {
      target: { value: 'Box Las Condes' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear lugar' }))

    await waitFor(() => expect(screen.getByText('Box Las Condes')).toBeInTheDocument())
    expect(lugaresT.all().find((l) => l.nombre === 'Box Las Condes')).toMatchObject({
      tenantId: TENANT_1,
      sincronizado: false,
      desactivadoEn: null,
    })
    expect(screen.getByRole('button', { name: /Lugar de trabajo:/ })).toBeInTheDocument()
  })

  it('no acepta un nombre repetido sin distinguir mayúsculas', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Lugares de trabajo')

    fireEvent.click(screen.getByRole('button', { name: /Nuevo lugar/ }))
    fireEvent.change(screen.getByLabelText('Nombre del lugar'), {
      target: { value: '  CLÍNICA ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear lugar' }))

    expect(await screen.findByText('Ya existe un lugar con ese nombre.')).toBeInTheDocument()
    expect(lugaresT.all()).toHaveLength(1)
  })

  it('renombra un lugar', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Lugares de trabajo')

    fireEvent.click(screen.getByRole('button', { name: 'Renombrar Clínica' }))
    fireEvent.change(screen.getByLabelText('Nombre del lugar'), {
      target: { value: 'Clínica Providencia' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(lugaresT.all()[0].nombre).toBe('Clínica Providencia'))
  })

  it('no deja desactivar el último lugar activo', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Lugares de trabajo')

    expect(screen.getByRole('button', { name: /Desactivar/ })).toBeDisabled()
  })

  it('desactivar un lugar con stock pide confirmación, y se puede reactivar', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    lugaresT.seed([lugar1, { ...lugar1, id: 'box', nombre: 'Box', creadoEn: '2026-03-01T00:00:00.000Z' }])
    lotesT.seed([
      {
        cantidadIngresada: null,
        unidadIngresada: null,
        contenido: 1,
        unidadConsumo: 'unidad',
        precioCompra: null,
        id: 'l1',
        tenantId: TENANT_1,
        lugarId: 'box',
        insumoId: 'a',
        numeroLote: 'L1',
        proveedor: 'P',
        fechaCaducidad: null,
        codigoFabricante: null,
        estado: 'activo',
        creadoEn: 'x',
      },
    ])
    movimientosT.seed([
      {
        tratamientoRealizadoId: null,
        unidad: 'unidad',
        id: 'm1',
        tenantId: TENANT_1,
        lugarId: 'box',
        trasladoId: null,
        tipo: 'ingreso',
        loteId: 'l1',
        cantidad: 3,
        usuarioId: 'x',
        movimientoOrigenId: null,
        creadoEn: 'x',
        sincronizado: true,
      },
    ])
    reflejarStore()
    renderSeccion('Lugares de trabajo')

    expect(screen.getByText('1 insumo con stock')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Desactivar/ })[1])
    const dialogo = screen.getByRole('dialog', { name: '¿Desactivar Box?' })
    expect(dialogo).toHaveTextContent('Su stock dejará de verse en el selector')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() =>
      expect(lugaresT.all().find((l) => l.id === 'box')!.desactivadoEn).not.toBeNull(),
    )
    fireEvent.click(screen.getByRole('button', { name: /Reactivar/ }))
    await waitFor(() =>
      expect(lugaresT.all().find((l) => l.id === 'box')!.desactivadoEn).toBeNull(),
    )
  })

  it('el personal no ve la gestión de lugares (US4-4)', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(<AjustesView />)

    expect(screen.queryByText('Lugares de trabajo')).not.toBeInTheDocument()
  })
})

describe('Ajustes — Insumos dados de baja (User Story 6)', () => {
  it('lists a dado-de-baja insumo and restores it', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    insumosT.seed([
      insumo('a', 'Anestesia local'),
      insumo('bajado', 'Composite Viejo', {
        dadoDeBajaEn: '2026-09-01T00:00:00.000Z',
        dadoDeBajaPor: 'admin-1',
      }),
    ])
    reflejarStore()
    renderSeccion('Insumos dados de baja')

    expect(screen.getByText('Composite Viejo')).toBeInTheDocument()
    expect(
      screen.getByText(/Dado de baja el 2026-09-01/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Restaurar/i }))

    await waitFor(async () => {
      expect((await db.insumos.get('bajado'))!.dadoDeBajaEn).toBeNull()
    })
    await waitFor(() => {
      expect(screen.getByText('Ningún insumo está dado de baja.')).toBeInTheDocument()
    })
  })

  it('shows an empty state when nothing is dado de baja', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Insumos dados de baja')

    expect(screen.getByText('Ningún insumo está dado de baja.')).toBeInTheDocument()
  })

  it('hides Insumos dados de baja for a non-administrador', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(<AjustesView />)

    expect(screen.queryByText('Insumos dados de baja')).not.toBeInTheDocument()
  })
})

describe('Ajustes — Notificaciones (User Story 7)', () => {
  it('toggling each Switch persists and reflects on reopen, for any authenticated user', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    renderSeccion('Notificaciones')

    const stockBajoSwitch = screen.getByRole('switch', {
      name: 'Incluir stock bajo en el indicador de la navegación',
    })
    expect(stockBajoSwitch).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(stockBajoSwitch)

    await waitFor(() => {
      expect(prefNotifT.all()[0]).toMatchObject({ stockBajo: false, caducidad: true })
    })
    expect(useAlertasStore.getState().preferenciaStockBajo).toBe(false)

    const caducidadSwitch = screen.getByRole('switch', {
      name: 'Incluir caducidad en el indicador de la navegación',
    })
    fireEvent.click(caducidadSwitch)

    await waitFor(() => {
      expect(prefNotifT.all()[0]).toMatchObject({ stockBajo: false, caducidad: false })
    })
  })
})

describe('rueda del mouse (spec 018 FR-005)', () => {
  it('no cambia el mínimo por insumo; al soltar el foco guarda lo escrito', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Notificaciones y avisos')

    esperarQueLaRuedaNoCambie(screen.getByLabelText('Stock mínimo de Anestesia local'), '8')

    await waitFor(() =>
      expect(insumosT.all().find((i) => i.nombre === 'Anestesia local')?.stockMinimo).toBe(8),
    )
  })

  it('no cambia las horas de aviso de cambios sin subir', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Notificaciones y avisos')
    esperarQueLaRuedaNoCambie(screen.getByLabelText(/Avisar si un cambio lleva más de/), '12')
  })
})

describe('Índice de Ajustes (spec 019 US1)', () => {
  const tarjetas = () =>
    within(screen.getByRole('list', { name: 'Secciones de Ajustes' })).getAllByRole('button')

  it('abre en el índice con las cinco tarjetas en orden y sus resúmenes', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    categoriasT.seed([categoria('c1', 'Ortodoncia')])
    insumosT.seed([insumo('a', 'Anestesia local', { categoria: 'Ortodoncia' })])
    reflejarStore()
    render(<AjustesView />)

    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
    expect(tarjetas().map((b) => b.getAttribute('aria-labelledby') && b.textContent)).toEqual([
      'Perfil y equipoAdmin Uno · Administradora',
      'Lugares de trabajo1 lugar',
      'Notificaciones y avisosStock bajo y caducidad · Avisos a 30, 7 y 1 días',
      `Categorías${CATEGORIAS_PRECARGADAS.length + 1} categorías`,
      'Insumos dados de bajaSin insumos dados de baja',
    ])
    expect(screen.getByRole('button', { name: 'Categorías' })).toHaveAccessibleDescription(
      `${CATEGORIAS_PRECARGADAS.length + 1} categorías`,
    )
  })

  it('cada tarjeta abre su sección sola, con "Volver", y la URL la recuerda', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    render(<AjustesView onNavegar={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Categorías' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Volver a Ajustes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nueva categoría/ })).toBeInTheDocument()
    expect(window.location.hash).toBe('#ajustes/categorias')
    expect(screen.queryByRole('list', { name: 'Secciones de Ajustes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Compras/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reportes/ })).not.toBeInTheDocument()
  })

  it('"Volver" y el "atrás" del navegador regresan al índice, con el foco en la tarjeta', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    render(<AjustesView />)

    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }))
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Ajustes' }))
    // `history.back()` es asíncrono en jsdom: llega como `popstate`.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Categorías' })).toHaveFocus(),
    )
    expect(window.location.hash).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Lugares de trabajo' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Lugares de trabajo' })).toBeInTheDocument()
    window.history.back()
    await waitFor(() =>
      expect(screen.getByRole('list', { name: 'Secciones de Ajustes' })).toBeInTheDocument(),
    )
  })

  it('con la sección en la URL (recarga), abre directo en ella y "Volver" quita el hash', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    window.history.replaceState(null, '', '/#ajustes/lugares')
    render(<AjustesView />)

    expect(screen.getByRole('heading', { level: 1, name: 'Lugares de trabajo' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Ajustes' }))
    expect(window.location.hash).toBe('')
    expect(screen.getByRole('list', { name: 'Secciones de Ajustes' })).toBeInTheDocument()
  })

  it('los cambios guardados en una sección se ven en el resumen al volver (FR-008)', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    render(<AjustesView />)
    const antes = CATEGORIAS_PRECARGADAS.length
    expect(screen.getByRole('button', { name: 'Categorías' })).toHaveAccessibleDescription(
      `${antes} categorías`,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Categorías' }))
    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/i }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Prótesis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.getByText('Prótesis')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Volver a Ajustes' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Categorías' })).toHaveAccessibleDescription(
        `${antes + 1} categorías`,
      ),
    )
  })

  it('en móvil, Compras y Reportes siguen arriba del índice', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    const onNavegar = vi.fn()
    render(<AjustesView onNavegar={onNavegar} />)

    fireEvent.click(screen.getByRole('button', { name: /Compras/ }))
    expect(onNavegar).toHaveBeenCalledWith('compras')
    fireEvent.click(screen.getByRole('button', { name: /Reportes/ }))
    expect(onNavegar).toHaveBeenCalledWith('reportes')
  })

  it('"Perfil y equipo" reúne el perfil con "Cerrar sesión" y el equipo', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Perfil y equipo')

    expect(screen.getByText('admin@x.cl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeInTheDocument()
  })
})

describe('Permisos por rol (spec 019 US2)', () => {
  const tarjetas = () =>
    within(screen.getByRole('list', { name: 'Secciones de Ajustes' })).getAllByRole('button')

  it('el personal ve solo "Perfil" y "Notificaciones", con resúmenes de personal', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(<AjustesView />)

    expect(tarjetas().map((b) => b.textContent)).toEqual([
      'PerfilPersonal Uno · Personal',
      'NotificacionesStock bajo y caducidad',
    ])
  })

  it('en "Perfil" el personal no ve el equipo', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    renderSeccion('Perfil')

    expect(screen.getByText('p@x.cl')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Equipo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Invitar/ })).not.toBeInTheDocument()
  })

  it('en "Notificaciones" el personal ve solo los interruptores', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    renderSeccion('Notificaciones')

    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.queryByText(/niveles de aviso/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/cambios sin subir/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/stock mínimo por insumo/i)).not.toBeInTheDocument()
  })

  it('una sección de administración en la URL muestra el índice al personal, sin sumar entrada', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    window.history.replaceState(null, '', '/#ajustes/categorias')
    const largo = window.history.length
    render(<AjustesView />)

    expect(screen.getByRole('list', { name: 'Secciones de Ajustes' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Categorías' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
    expect(window.history.length).toBe(largo)
  })

  it('si el rol cambia a personal con una sección de administración abierta, vuelve al índice', async () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Lugares de trabajo')
    expect(screen.getByRole('heading', { level: 1, name: 'Lugares de trabajo' })).toBeInTheDocument()

    act(() => useAuthStore.setState({ usuario: { ...admin, rol: 'personal' } }))

    await waitFor(() => expect(tarjetas()).toHaveLength(2))
    expect(window.location.hash).toBe('')
  })

  it('la administración ve en "Notificaciones y avisos" interruptores, niveles, horas y mínimos', () => {
    useAuthStore.setState({ usuario: admin, isReady: true })
    renderSeccion('Notificaciones y avisos')

    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getByText(/niveles de aviso de caducidad/i)).toBeInTheDocument()
    expect(screen.getByText('Aviso de cambios sin subir')).toBeInTheDocument()
    expect(screen.getByText(/stock mínimo por insumo/i)).toBeInTheDocument()
  })
})
