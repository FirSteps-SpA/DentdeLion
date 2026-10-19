import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Insumo, Movimiento, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'
import {
  crearClienteFalso,
  crearEstado,
  reiniciar,
} from '../helpers/clienteFalso'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  const { tablasMemoria } = await import('../helpers/tablasMemoria')
  return {
    db: createMemoryDb({
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      ...Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
      borradores: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
    }),
  }
})

const estado = crearEstado()
const client = crearClienteFalso(estado)

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { sincronizarAhora, startBackgroundSync } from '../../src/lib/sync'
import { agruparPendientes } from '../../src/lib/sync/indicador'
import { AppHeader } from '../../src/app/AppHeader'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { ConsumoForm } from '../../src/features/insumos/components/ConsumoForm'
import {
  HORAS_AVISO_PENDIENTES_POR_DEFECTO,
  useAlertasStore,
} from '../../src/stores/alertasStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { usePendientesStore } from '../../src/stores/pendientesStore'
import { useSyncStore } from '../../src/stores/syncStore'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'
import { usarLugar1 } from '../helpers/lugarFalso'

const movimientosT = db.movimientos as unknown as MemoryTable<Movimiento>

let enLinea = true
Object.defineProperty(window.navigator, 'onLine', {
  configurable: true,
  get: () => enLinea,
})

function cambiarConexion(valor: boolean) {
  enLinea = valor
  act(() => {
    window.dispatchEvent(new Event(valor ? 'online' : 'offline'))
  })
}

/** Espejo de los `liveQuery` de los stores: el memoryDb no los dispara. */
async function refrescarStores() {
  const pendientes = agruparPendientes(
    await db.movimientos.toArray(),
    await db.cambiosInsumo.toArray(),
    await db.categorias.toArray(),
  )
  const config = await db.configuracionAlertas.get('global')
  usePendientesStore.setState({
    pendientes,
    usuariosConocidos: await db.usuariosConocidos.toArray(),
    ahora: Date.now(),
  })
  useSyncStore.setState({
    ultimaExitosaEn: (await db.estadoSync.get('local'))?.ultimaExitosaEn ?? null,
  })
  useAlertasStore.setState({
    horasAvisoPendientes:
      config?.horasAvisoPendientes ?? HORAS_AVISO_PENDIENTES_POR_DEFECTO,
  })
}

const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

function consumo(id: string, usuarioId = 'B', creadoEn = new Date().toISOString()): Movimiento {
  return {
    unidad: 'unidad',
    tenantId: TENANT_1,
    lugarId: LUGAR_1,
    trasladoId: null,
    id,
    tipo: 'consumo',
    loteId: 'l1',
    cantidad: 1,
    usuarioId,
    movimientoOrigenId: null,
    creadoEn,
    sincronizado: false,
  }
}

function usuario(rol: UsuarioActual['rol'] = 'personal'): UsuarioActual {
  return { tenantId: TENANT_1, desactivadoEn: null, id: 'B', email: 'b@x.cl', nombre: 'Bea', rol, autenticadoEn: 'x' }
}

const indicador = () => screen.getByRole('button', { name: /Estado de sincronización/ })

async function esperarIndicador(texto: RegExp) {
  await waitFor(() => expect(indicador()).toHaveAccessibleName(texto))
}

async function ciclo() {
  await act(async () => {
    await sincronizarAhora()
  })
  await act(refrescarStores)
}

async function abrirPanel() {
  fireEvent.click(indicador())
  return screen.findByRole('dialog', { name: 'Sincronización' })
}

let detener: (() => void) | null = null

beforeEach(async () => {
  reiniciar(estado)
  enLinea = true
  for (const tabla of [
    'movimientos',
    'cambiosInsumo',
    'categorias',
    'estadoSync',
    'usuariosConocidos',
    'configuracionAlertas',
    'lotes',
    'insumos',
  ] as const) {
    await db[tabla].clear()
  }
  useAuthStore.setState({ usuario: usuario(), isReady: true })
  useSyncStore.setState({ fase: 'inactivo', ultimoResultado: null, ultimaExitosaEn: null })
  useInventoryStore.setState({ insumos: [], lotes: [], movimientos: [], isReady: true })
  await refrescarStores()
  // Sin `act`: los cambios llegan en medio de otros `act` (un ciclo en curso) y
  // React no admite solaparlos; `waitFor` ya espera el re-render.
  onMemoryDbChange(() => {
    void refrescarStores()
  })
})

afterEach(() => {
  detener?.()
  detener = null
  onMemoryDbChange(null)
})

// Spec 014: un tenant de un solo lugar, como la clínica original.
beforeEach(usarLugar1)

describe('US1 — ver si hay cambios sin subir', () => {
  it('(1) sin pendientes y ciclo ok: Sincronizado', async () => {
    render(<AppHeader />)
    await ciclo()

    await esperarIndicador(/Sincronizado/)
  })

  it('(2–3) sin red cuenta los registros y al volver la red baja a 0 sin recargar', async () => {
    render(<AppHeader />)
    cambiarConexion(false)
    for (const id of ['m1', 'm2', 'm3']) await db.movimientos.add(consumo(id))

    await esperarIndicador(/Sin conexión · 3/)

    detener = startBackgroundSync(60_000)
    cambiarConexion(true)

    await waitFor(() => expect(movimientosT.all().every((m) => m.sincronizado)).toBe(true))
    await esperarIndicador(/Sincronizado/)
  })

  it('(4) un error del servidor muestra Error con los pendientes', async () => {
    await db.movimientos.add(consumo('m1'))
    estado.errorUpsert.movimientos = { code: '500', message: 'internal error' }
    render(<AppHeader />)
    await ciclo()

    await esperarIndicador(/Error de sincronización · 1/)
  })

  it('(5) un error de red con el navegador en línea es Sin conexión', async () => {
    await db.movimientos.add(consumo('m1'))
    estado.errorUpsert.movimientos = { message: 'TypeError: Failed to fetch' }
    render(<AppHeader />)
    await ciclo()

    await esperarIndicador(/Sin conexión · 1/)
  })

  it('(6) el siguiente ciclo ok limpia el error', async () => {
    await db.movimientos.add(consumo('m1'))
    estado.errorUpsert.movimientos = { code: '500', message: 'internal error' }
    render(<AppHeader />)
    await ciclo()
    await esperarIndicador(/Error/)

    estado.errorUpsert = {}
    await ciclo()

    await esperarIndicador(/Sincronizado/)
  })
})

describe('US2 — última sincronización exitosa', () => {
  it('(a, c) el panel se abre y dice Nunca sincronizado antes del primer ciclo ok', async () => {
    render(<AppHeader />)
    const panel = await abrirPanel()

    expect(within(panel).getByText('Nunca sincronizado')).toBeInTheDocument()
  })

  it('(b) muestra la hora del último ciclo ok y un ciclo sin red no la cambia', async () => {
    render(<AppHeader />)
    await ciclo()
    const panel = await abrirPanel()
    const texto = within(panel).getByText(/Última sincronización: hoy/).textContent

    estado.errorUpsert.lotes = { message: 'Failed to fetch' }
    await db.lotes.put({
      cantidadIngresada: null,
      unidadIngresada: null,
      contenido: 1,
      unidadConsumo: 'unidad',
      precioCompra: null,
      tenantId: TENANT_1,
      lugarId: LUGAR_1,
      id: 'l1',
      insumoId: 'i1',
      numeroLote: 'A',
      proveedor: 'P',
      fechaCaducidad: null,
      codigoFabricante: null,
      estado: 'activo',
      creadoEn: 'x',
    })
    await ciclo()

    expect(within(panel).getByText(/Última sincronización: hoy/).textContent).toBe(texto)
  })

  it('(d) desglosa los pendientes propios por tipo', async () => {
    await db.movimientos.add(consumo('m1'))
    await db.movimientos.add(consumo('m2'))
    await db.cambiosInsumo.add({
      factor: null,
      tenantId: TENANT_1,
      id: 'c1',
      insumoId: 'i1',
      campo: 'nombre',
      valorAnterior: 'a',
      valorNuevo: 'b',
      usuarioId: 'B',
      creadoEn: new Date().toISOString(),
      sincronizado: false,
      rechazadoEn: null,
    })
    render(<AppHeader />)
    await esperarIndicador(/3 pendientes/)
    const panel = await abrirPanel()

    expect(within(panel).getByText('Consumos e ingresos: 2')).toBeInTheDocument()
    expect(within(panel).getByText('Cambios de insumo: 1')).toBeInTheDocument()
    expect(within(panel).queryByText(/Categorías nuevas/)).not.toBeInTheDocument()
  })

  it('(e) abrir y cerrar el panel conserva lo escrito en el formulario de consumo', async () => {
    const insumo: Insumo = {
      unidadCompra: 'mL',
      contenido: 1,
      tenantId: TENANT_1,
      id: 'i1',
      nombre: 'Anestesia local',
      categoria: 'Farmacia',
      unidadMedida: 'mL',
      permiteDecimales: true,
      caduca: true,
      codigoFabricante: null,
      creadoEn: 'x',
      stockMinimo: null,
      dadoDeBajaEn: null,
      dadoDeBajaPor: null,
      creadoPor: null,
    }
    useInventoryStore.setState({ insumos: [insumo], lotes: [], isReady: true })
    render(
      <>
        <AppHeader />
        <ConsumoForm />
      </>,
    )
    fireEvent.change(screen.getByLabelText('Buscar insumo'), { target: { value: 'Anest' } })

    await abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Buscar insumo')).toHaveValue('Anest')
  })
})

describe('US3 — Sincronizar ahora', () => {
  it('(a, b) muestra el ciclo en curso, no lo duplica y termina en Listo', async () => {
    await db.movimientos.add(consumo('m1'))
    let soltar: () => void = () => {}
    estado.esperarSesion = new Promise((resolve) => (soltar = resolve))
    render(<AppHeader />)
    const panel = await abrirPanel()

    fireEvent.click(within(panel).getByRole('button', { name: 'Sincronizar ahora' }))
    const enCurso = await within(panel).findByRole('button', { name: 'Sincronizando…' })
    expect(enCurso).toBeDisabled()
    fireEvent.click(enCurso)

    await act(async () => soltar())
    expect(await within(panel).findByRole('status')).toHaveTextContent('Listo')
    expect(estado.llamadasSesion).toBe(1)
    await esperarIndicador(/Sincronizado/)
  })

  it('(c) sin conexión avisa que se subirán al volver la red y el panel se cierra', async () => {
    estado.errorSesion = { message: 'Failed to fetch' }
    render(<AppHeader />)
    const panel = await abrirPanel()

    fireEvent.click(within(panel).getByRole('button', { name: 'Sincronizar ahora' }))

    expect(await within(panel).findByRole('status')).toHaveTextContent(
      'Sin conexión: se subirán al volver la red',
    )
    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('una sesión vencida pide volver a iniciar sesión (FR-015)', async () => {
    estado.sesionUserId = null
    render(<AppHeader />)
    await ciclo()
    const panel = await abrirPanel()

    expect(within(panel).getByText(/Tu sesión expiró/)).toBeInTheDocument()
  })
})

describe('US4 — aviso de pendientes antiguos', () => {
  it('(a) un pendiente de más de 24 h muestra la alerta y su detalle', async () => {
    await db.movimientos.add(consumo('m1', 'B', haceHoras(30)))
    render(<AppHeader />)

    await waitFor(() => expect(indicador()).toHaveAttribute('data-alerta', 'true'))
    const panel = await abrirPanel()
    expect(within(panel).getByText(/1 cambio lleva más de 24 h sin subir/)).toBeInTheDocument()
  })

  it('(b) un administrador baja el umbral en Ajustes y la alerta aparece sin recargar', async () => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    await db.movimientos.add(consumo('m1', 'B', haceHoras(2)))
    render(
      <>
        <AppHeader />
        <AjustesView />
      </>,
    )
    expect(indicador()).not.toHaveAttribute('data-alerta')

    const campo = screen.getByLabelText('Horas sin subir antes de avisar')
    fireEvent.change(campo, { target: { value: '1' } })
    fireEvent.blur(campo)

    await waitFor(() => expect(indicador()).toHaveAttribute('data-alerta', 'true'))
    expect((await db.configuracionAlertas.get('global'))?.sincronizado).toBe(false)
  })

  it.each(['0', '200'])('(c) %s horas es inválido y no se guarda', async (valor) => {
    useAuthStore.setState({ usuario: usuario('administrador'), isReady: true })
    render(<AjustesView />)

    const campo = screen.getByLabelText('Horas sin subir antes de avisar')
    fireEvent.change(campo, { target: { value: valor } })
    fireEvent.blur(campo)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ingresa un número de horas entre 1 y 168.',
    )
    expect(await db.configuracionAlertas.get('global')).toBeUndefined()
  })

  it('(d) quien no es administrador no ve el campo, pero sí el umbral en el panel', async () => {
    render(
      <>
        <AppHeader />
        <AjustesView />
      </>,
    )

    expect(screen.queryByLabelText('Horas sin subir antes de avisar')).not.toBeInTheDocument()
    const panel = await abrirPanel()
    expect(within(panel).getByText('Aviso tras 24 h sin subir')).toBeInTheDocument()
  })
})

describe('US5 — pendientes de otro usuario', () => {
  beforeEach(async () => {
    await db.usuariosConocidos.put({ id: 'A', nombre: 'Ana', vistoEn: 'x' })
  })

  it('(1–2) no cuentan para B y el panel nombra a su autora', async () => {
    await db.movimientos.add(consumo('m1', 'A'))
    render(<AppHeader />)
    await ciclo()

    await esperarIndicador(/Sincronizado/)
    expect(movimientosT.all()[0].sincronizado).toBe(false)
    const panel = await abrirPanel()
    expect(
      within(panel).getByText(
        'Hay 1 cambio de Ana que se subirá cuando esa persona inicie sesión en este dispositivo.',
      ),
    ).toBeInTheDocument()
  })

  it('(3) si es antiguo activa la alerta y pide que inicie sesión pronto', async () => {
    await db.movimientos.add(consumo('m1', 'A', haceHoras(30)))
    render(<AppHeader />)

    await waitFor(() => expect(indicador()).toHaveAttribute('data-alerta', 'true'))
    const panel = await abrirPanel()
    expect(within(panel).getByText(/Pídele que inicie sesión pronto\./)).toBeInTheDocument()
  })
})
