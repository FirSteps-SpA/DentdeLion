import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CambioTratamiento, CategoriaTratamiento, UsuarioActual } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      lotes: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      movimientos: new MemoryTable(),
      categorias: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      preferenciasNotificaciones: new MemoryTable(),
      usuarioActual: new MemoryTable(),
      tratamientos: new MemoryTable(),
      cambiosTratamiento: new MemoryTable(),
      categoriasTratamiento: new MemoryTable(),
    }),
  }
})

import { db } from '../../src/lib/db'
import { onMemoryDbChange } from '../helpers/memoryDb'
import { useAuthStore } from '../../src/stores/authStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { useTratamientosStore } from '../../src/stores/tratamientosStore'
import { AjustesView } from '../../src/features/ajustes/components/AjustesView'
import { CATEGORIAS_TRATAMIENTO_SEMBRADAS } from '../../src/features/tratamientos/lib/categorias'
import {
  claveCategoriaLugar,
  porcentajesPorCategoria,
  porcentajesPorLugar,
} from '../../src/features/tratamientos/lib/proyeccion'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { LUGAR_1, TENANT_1 } from '../helpers/tenancy'

const categoriasT = db.categoriasTratamiento as unknown as MemoryTable<CategoriaTratamiento>
const cambiosT = db.cambiosTratamiento as unknown as MemoryTable<CambioTratamiento>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin Uno',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', nombre: 'Personal', rol: 'personal' }

const sembradas = (): CategoriaTratamiento[] =>
  CATEGORIAS_TRATAMIENTO_SEMBRADAS.map((nombre, i) => ({
    id: `sem-${i}`,
    tenantId: TENANT_1,
    nombre,
    creadoPor: null,
    creadoEn: '2026-11-23T00:00:00.000Z',
    desactivadoEn: null,
    sincronizado: true,
    rechazadoEn: null,
  }))

function porcentajeGeneral(lugarId: string, valor: number): CambioTratamiento {
  return {
    id: `pg-${lugarId}`,
    tenantId: TENANT_1,
    tratamientoId: null,
    lugarId,
    categoriaId: null,
    campo: 'porcentajeProfesional',
    valorAnterior: null,
    valorNuevo: valor,
    usuarioId: 'admin-1',
    creadoEn: '2026-11-01T00:00:00.000Z',
    sincronizado: true,
    rechazadoEn: null,
  }
}

function reflejarStore() {
  const cambios = cambiosT.all()
  useTratamientosStore.setState({
    categorias: categoriasT
      .all()
      .filter((c) => c.rechazadoEn === null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    porcentajes: porcentajesPorLugar(cambios),
    porcentajesCategoria: porcentajesPorCategoria(cambios),
    cambiosTratamiento: cambios,
    isReady: true,
  })
  useInventoryStore.setState({ isReady: true })
  useLugarStore.setState({ lugares: [lugar1, lugar2], lugarActivoId: lugar1.id, isReady: true })
}

function abrirSeccion() {
  render(<AjustesView />)
  fireEvent.click(screen.getByRole('button', { name: 'Categorías de tratamientos' }))
}

const fila = (nombre: string) => screen.getByRole('button', { name: `Editar ${nombre}` })
const hoja = () => screen.getByRole('dialog')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  onMemoryDbChange(reflejarStore)
  useAlertasStore.setState({ nivelesAvisoDias: [30, 7, 1], isReady: true })
  useAuthStore.setState({ usuario: admin, isReady: true })
  categoriasT.seed(sembradas())
  cambiosT.seed([porcentajeGeneral(LUGAR_1, 40)])
  reflejarStore()
})

afterEach(() => {
  onMemoryDbChange(null)
  useTratamientosStore.setState({ categorias: [], porcentajesCategoria: new Map() })
})

/** Spec 026 T012/T023 (US1-1..7, US2-1, US2-7, US2-8; contracts/ui-contracts.md §1). */
describe('Ajustes → Categorías de tratamientos', () => {
  it('la tarjeta va después de Lugares de trabajo, con su resumen', () => {
    render(<AjustesView />)
    const tarjetas = within(screen.getByRole('list', { name: 'Secciones de Ajustes' }))
      .getAllByRole('button')
      .map((b) => b.textContent)
    const i = tarjetas.findIndex((t) => t?.startsWith('Categorías de tratamientos'))
    expect(tarjetas[i]).toBe('Categorías de tratamientos8 categorías')
    expect(tarjetas[i - 1]).toMatch(/^Lugares de trabajo/)
  })

  it('muestra las 8 sembradas en orden alfabético', () => {
    abrirSeccion()
    const nombres = screen
      .getAllByRole('button', { name: /^Editar / })
      .map((b) => b.getAttribute('aria-label')?.replace('Editar ', ''))
    expect(nombres).toEqual(
      [...CATEGORIAS_TRATAMIENTO_SEMBRADAS].sort((a, b) => a.localeCompare(b, 'es')),
    )
  })

  it('crea una categoría; un nombre repetido avisa', async () => {
    abrirSeccion()
    fireEvent.click(screen.getByRole('button', { name: 'Nueva categoría' }))
    fireEvent.change(within(hoja()).getByLabelText('Nombre'), { target: { value: ' evaluacion' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(
      await within(hoja()).findByText('Ya existe una categoría con ese nombre.'),
    ).toBeInTheDocument()

    fireEvent.change(within(hoja()).getByLabelText('Nombre'), {
      target: { value: 'Blanqueamiento' },
    })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fila('Blanqueamiento')).toBeInTheDocument()
  })

  it('renombra y desactiva; "Desactivada" se lee en texto', async () => {
    abrirSeccion()
    fireEvent.click(fila('Urgencia'))
    fireEvent.change(within(hoja()).getByLabelText('Nombre'), { target: { value: 'Urgencias' } })
    fireEvent.click(within(hoja()).getByRole('switch', { name: /Activa/ }))
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(fila('Urgencias')).toHaveTextContent('Desactivada')
    expect(categoriasT.all().find((c) => c.nombre === 'Urgencias')?.desactivadoEn).not.toBeNull()
  })

  it('% por lugar: placeholder del general o "Sin % general", guardar y volver al general', async () => {
    abrirSeccion()
    fireEvent.click(fila('Evaluación'))
    const clinica = within(hoja()).getByLabelText(lugar1.nombre)
    const otro = within(hoja()).getByLabelText(lugar2.nombre)
    expect(clinica).toHaveAttribute('placeholder', 'Usa el general (40 %)')
    expect(otro).toHaveAttribute('placeholder', 'Sin % general en este lugar')

    fireEvent.change(clinica, { target: { value: '50' } })
    expect(within(hoja()).getByText('Profesional 50 % · Clínica 50 %')).toBeInTheDocument()
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    expect(
      useTratamientosStore.getState().porcentajesCategoria.get(claveCategoriaLugar('sem-0', LUGAR_1)),
    ).toBe(50)
    expect(fila('Evaluación')).toHaveTextContent(`${lugar1.nombre}: 50 %`)

    fireEvent.click(fila('Evaluación'))
    fireEvent.change(within(hoja()).getByLabelText(lugar1.nombre), { target: { value: '' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useTratamientosStore.getState().porcentajesCategoria.size).toBe(0)
  })

  it('un % fuera de rango no guarda nada', async () => {
    abrirSeccion()
    fireEvent.click(fila('Evaluación'))
    fireEvent.change(within(hoja()).getByLabelText(lugar1.nombre), { target: { value: '120' } })
    fireEvent.click(within(hoja()).getByRole('button', { name: 'Guardar' }))
    expect(await within(hoja()).findByRole('alert')).toHaveTextContent('entre 0 y 100')
    expect(cambiosT.all()).toHaveLength(1)
  })

  it('personal no ve la sección', () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    render(<AjustesView />)
    expect(
      screen.queryByRole('button', { name: 'Categorías de tratamientos' }),
    ).not.toBeInTheDocument()
  })
})
