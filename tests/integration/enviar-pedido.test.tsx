import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Borrador, ItemCompra } from '../../src/lib/db'
import type { MemoryTable } from '../helpers/memoryDb'

vi.mock('../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      lugares: new MemoryTable(),
      minimosLugar: new MemoryTable(),
      lugarActivo: new MemoryTable(),
      insumos: new MemoryTable(),
      categorias: new MemoryTable(),
      lotes: new MemoryTable(),
      movimientos: new MemoryTable(),
      cambiosInsumo: new MemoryTable(),
      cambiosLote: new MemoryTable(),
      configuracionAlertas: new MemoryTable(),
      borradores: new MemoryTable(),
      itemsCompra: new MemoryTable(),
      usuarioActual: new MemoryTable(),
    }),
  }
})

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client: null, error: new Error('offline') }),
}))

import { db } from '../../src/lib/db'
import { useInventoryStore } from '../../src/stores/inventoryStore'
import { useAuthStore } from '../../src/stores/authStore'
import { useAlertasStore } from '../../src/stores/alertasStore'
import { useLugarStore } from '../../src/stores/lugarStore'
import { ComprasView } from '../../src/features/compras/components/ComprasView'
import { SALUDO_PEDIDO_POR_DEFECTO } from '../../src/features/compras/lib/pedido'
import { LUGAR_1, LUGAR_2, TENANT_1 } from '../helpers/tenancy'
import { lugar1, lugar2 } from '../helpers/lugarFalso'
import { proveedorFalso } from '../helpers/proveedor'
import {
  ingresoCompra,
  itemManual,
  sugeridoConPrecio,
} from '../helpers/compras'

const borradoresT = db.borradores as unknown as MemoryTable<Borrador>

const dentalSur = proveedorFalso({
  id: 'p-sur',
  nombre: 'Dental Sur',
  whatsapp: '56912345678',
})
const casaNorte = proveedorFalso({
  id: 'p-norte',
  nombre: 'Casa Norte',
  whatsapp: null,
})

function cargar({
  proveedores = [dentalSur, casaNorte],
  manuales = [] as ItemCompra[],
  predeterminado = dentalSur.id as string | null,
} = {}) {
  const articaina = sugeridoConPrecio('i1', 'Articaína', 2, 15000)
  useInventoryStore.setState({
    insumos: [articaina.insumo],
    lotes: [articaina.lote],
    movimientos: [articaina.ingreso],
    itemsCompra: manuales,
    cambiosLote: [],
    cambiosInsumo: [],
    minimosLugar: [],
    proveedores,
    isReady: true,
  })
  useLugarStore.setState({
    lugares: [{ ...lugar1, proveedorPredeterminadoId: predeterminado }],
    lugarActivoId: LUGAR_1,
    isReady: true,
  })
}

function abrirEnvio() {
  fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }))
  return screen.findByRole('dialog', { name: 'Enviar pedido' })
}

function enlace(): HTMLAnchorElement {
  return screen.getByRole('link', {
    name: 'Abrir WhatsApp',
  }) as HTMLAnchorElement
}

function mensajeDelEnlace(): string {
  return decodeURIComponent(enlace().href.split('?text=')[1])
}

beforeEach(() => {
  borradoresT.seed([])
  useAuthStore.setState({
    usuario: {
      tenantId: TENANT_1,
      desactivadoEn: null,
      id: 'usuario-1',
      email: 'a@x.cl',
      nombre: 'Ana',
      rol: 'personal',
      autenticadoEn: '2026-01-01T00:00:00.000Z',
    },
    isReady: true,
  })
  useAlertasStore.setState({ saludoPedido: SALUDO_PEDIDO_POR_DEFECTO })
})

describe('Enviar pedido por WhatsApp (spec 022 US2)', () => {
  it('trae el predeterminado del lugar y abre su chat con el mensaje', async () => {
    cargar({ manuales: [itemManual({ cantidad: 3 })] })
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar todo'))
    await abrirEnvio()

    expect(screen.getByRole('radio', { name: /Dental Sur/ })).toBeChecked()
    expect(screen.getByText('+56 9 1234 5678')).toBeInTheDocument()
    expect(screen.getByText('Sin WhatsApp')).toBeInTheDocument()
    expect(enlace().href.startsWith('https://wa.me/56912345678?text=')).toBe(
      true,
    )
    expect(enlace()).toHaveAttribute('target', '_blank')
    expect(enlace().rel).toContain('noopener')
    expect(mensajeDelEnlace()).toBe(
      `${SALUDO_PEDIDO_POR_DEFECTO}\n\n- Articaína — 2 cajas\n- Torundas — 3`,
    )
    expect(mensajeDelEnlace()).not.toMatch(/\$/)
  })

  it('usa el saludo del tenant', async () => {
    cargar()
    useAlertasStore.setState({ saludoPedido: 'Hola Paula' })
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    await abrirEnvio()

    expect(mensajeDelEnlace()).toBe('Hola Paula\n\n- Articaína — 2 cajas')
  })

  it('un proveedor sin WhatsApp: avisa y deja elegir el chat', async () => {
    cargar()
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    await abrirEnvio()

    fireEvent.click(screen.getByRole('radio', { name: /Casa Norte/ }))
    expect(
      screen.getByText(
        'Casa Norte no tiene WhatsApp: elige el contacto en WhatsApp.',
      ),
    ).toBeInTheDocument()
    expect(enlace().href.startsWith('https://wa.me/?text=')).toBe(true)
  })

  it('sin predeterminado no elige a nadie; "Otro contacto" deja elegir en WhatsApp', async () => {
    cargar({ predeterminado: null })
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    await abrirEnvio()

    expect(screen.getByRole('radio', { name: /Otro contacto/ })).toBeChecked()
    expect(
      screen.getByText('Elige el contacto en WhatsApp.'),
    ).toBeInTheDocument()
    expect(enlace().href.startsWith('https://wa.me/?text=')).toBe(true)
  })

  it('sin proveedores en el catálogo, solo el aviso y el enlace', async () => {
    cargar({ proveedores: [], predeterminado: null })
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    await abrirEnvio()

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(
      screen.getByText('Elige el contacto en WhatsApp.'),
    ).toBeInTheDocument()
    expect(enlace().href.startsWith('https://wa.me/?text=')).toBe(true)
  })

  it('una lista demasiado larga para WhatsApp ofrece Copiar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const manuales = Array.from({ length: 120 }, (_, i) =>
      itemManual({
        id: `m${i}`,
        nombre: `Material de prueba con nombre largo ${i}`,
        cantidad: 2,
      }),
    )
    cargar({ manuales })
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar todo'))
    await abrirEnvio()

    expect(
      screen.getByText(
        'La lista es muy larga para WhatsApp. Cópiala y pégala en el chat.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Abrir WhatsApp' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Copiar' }).at(-1) as HTMLElement,
    )
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    vi.unstubAllGlobals()
  })

  it('al abrir WhatsApp la hoja se cierra y la selección sigue igual (FR-017)', async () => {
    cargar()
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar Articaína'))
    await abrirEnvio()

    fireEvent.click(enlace())
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Enviar pedido' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Seleccionar Articaína')).toBeChecked()
  })

  it('en "Todos", cada renglón lleva su lugar', async () => {
    const articaina = sugeridoConPrecio('i1', 'Articaína', 2, 15000)
    useInventoryStore.setState({
      insumos: [articaina.insumo],
      lotes: [articaina.lote],
      movimientos: [
        articaina.ingreso,
        ingresoCompra(articaina.lote.id, 10, LUGAR_2),
      ],
      itemsCompra: [],
      cambiosLote: [],
      cambiosInsumo: [],
      minimosLugar: [],
      proveedores: [dentalSur],
      isReady: true,
    })
    useLugarStore.setState({
      lugares: [lugar1, lugar2],
      lugarActivoId: 'todos',
      isReady: true,
    })
    render(<ComprasView />)
    fireEvent.click(screen.getByLabelText('Seleccionar todo'))
    await abrirEnvio()

    expect(mensajeDelEnlace().split('\n').slice(2)).toEqual([
      `- Articaína — 2 cajas (${lugar1.nombre})`,
      `- Articaína — 2 cajas (${lugar2.nombre})`,
    ])
  })
})
