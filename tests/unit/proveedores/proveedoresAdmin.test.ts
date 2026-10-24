import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lote, Lugar, Proveedor, UsuarioActual } from '../../../src/lib/db'
import type { MemoryTable } from '../../helpers/memoryDb'

vi.mock('../../../src/lib/db', async () => {
  const { createMemoryDb, MemoryTable } = await import('../../helpers/memoryDb')
  return {
    db: createMemoryDb({
      proveedores: new MemoryTable(),
      marcas: new MemoryTable(),
      lugares: new MemoryTable(),
      lotes: new MemoryTable(),
    }),
  }
})

import { db } from '../../../src/lib/db'
import { useAuthStore } from '../../../src/stores/authStore'
import {
  MENSAJE_CON_LOTES,
  MENSAJE_NOMBRE_REPETIDO,
  MENSAJE_NOMBRE_VACIO,
  ProveedorDesactivado,
  crearProveedor,
  desactivarProveedor,
  editarProveedor,
  eliminarProveedor,
  fijarPredeterminado,
  reactivarProveedor,
} from '../../../src/features/proveedores/lib/proveedoresAdmin'
import { lugar1, lugar2 } from '../../helpers/lugarFalso'
import { proveedorFalso } from '../../helpers/proveedor'
import { TENANT_1 } from '../../helpers/tenancy'

const proveedoresT = db.proveedores as unknown as MemoryTable<Proveedor>
const lugaresT = db.lugares as unknown as MemoryTable<Lugar>
const lotesT = db.lotes as unknown as MemoryTable<Lote>

const admin: UsuarioActual = {
  id: 'admin-1',
  tenantId: TENANT_1,
  email: 'a@x.cl',
  nombre: 'Admin',
  rol: 'administrador',
  autenticadoEn: '2026-01-01T00:00:00.000Z',
  desactivadoEn: null,
}
const personal: UsuarioActual = { ...admin, id: 'personal-1', rol: 'personal' }

const sur = proveedorFalso({ id: 'sur', nombre: 'Dental Sur' })
const norte = proveedorFalso({ id: 'norte', nombre: 'Casa Norte' })

beforeEach(() => {
  useAuthStore.setState({ usuario: admin, isReady: true })
  proveedoresT.seed([sur, norte])
  lugaresT.seed([
    { ...lugar1, proveedorPredeterminadoId: 'sur' },
    { ...lugar2, proveedorPredeterminadoId: 'sur' },
  ])
  lotesT.seed([])
})

/** Spec 021 T026 (US2, FR-008, Clarifications Q4). */
describe('crearProveedor', () => {
  it.each([
    ['administración', admin],
    ['personal', personal],
  ])(
    '%s crea un proveedor pendiente de subir, a su nombre',
    async (_rol, usuario) => {
      useAuthStore.setState({ usuario, isReady: true })
      const nuevo = await crearProveedor({
        nombre: '  Proveedor   Nuevo ',
        whatsapp: '9 1234 5678',
      })
      expect(proveedoresT.all().find((p) => p.id === nuevo.id)).toMatchObject({
        nombre: 'Proveedor Nuevo',
        whatsapp: '56912345678',
        contacto: null,
        creadoPor: usuario.id,
        tenantId: TENANT_1,
        sincronizado: false,
        desactivadoEn: null,
        eliminadoEn: null,
      })
    },
  )

  it('con la misma clave devuelve el existente sin crear (selector), o lo rechaza (Ajustes)', async () => {
    expect(await crearProveedor({ nombre: ' dental  súr' })).toMatchObject({
      id: 'sur',
    })
    expect(proveedoresT.all()).toHaveLength(2)
    await expect(
      crearProveedor({ nombre: 'DENTAL SUR' }, { estricto: true }),
    ).rejects.toThrow(MENSAJE_NOMBRE_REPETIDO)
  })

  it('con el nombre de un desactivado lanza ProveedorDesactivado', async () => {
    proveedoresT.seed([{ ...sur, desactivadoEn: '2026-05-01' }])
    await expect(
      crearProveedor({ nombre: 'Dental Sur' }),
    ).rejects.toBeInstanceOf(ProveedorDesactivado)
  })

  it('rechaza un nombre vacío o un WhatsApp inválido', async () => {
    await expect(crearProveedor({ nombre: '   ' })).rejects.toThrow(
      MENSAJE_NOMBRE_VACIO,
    )
    await expect(
      crearProveedor({ nombre: 'X', whatsapp: '123' }),
    ).rejects.toThrow(/WhatsApp/)
  })
})

/** Spec 021 T038 (US3, FR-011..FR-016). */
describe('administración del catálogo', () => {
  it('personal no edita, desactiva, reactiva, elimina ni fija el predeterminado', async () => {
    useAuthStore.setState({ usuario: personal, isReady: true })
    await expect(editarProveedor('sur', { nombre: 'X' })).rejects.toThrow(
      /administrador/,
    )
    await expect(desactivarProveedor('sur')).rejects.toThrow(/administrador/)
    await expect(reactivarProveedor('sur')).rejects.toThrow(/administrador/)
    await expect(eliminarProveedor('norte')).rejects.toThrow(/administrador/)
    await expect(fijarPredeterminado(lugar1.id, 'norte')).rejects.toThrow(
      /administrador/,
    )
  })

  it('renombra y edita el contacto; no deja repetir otro nombre', async () => {
    await editarProveedor('sur', {
      nombre: 'Dental Sur Ltda.',
      contacto: ' Paula ',
    })
    expect(proveedoresT.all().find((p) => p.id === 'sur')).toMatchObject({
      nombre: 'Dental Sur Ltda.',
      contacto: 'Paula',
      sincronizado: false,
    })
    await expect(
      editarProveedor('sur', { nombre: 'casa norte' }),
    ).rejects.toThrow(MENSAJE_NOMBRE_REPETIDO)
    // Cambiar solo mayúsculas del propio nombre sí se puede.
    await editarProveedor('norte', { nombre: 'CASA NORTE' })
  })

  it('desactivar lo quita de los predeterminados (marcando los lugares para subir)', async () => {
    await desactivarProveedor('sur')
    expect(
      proveedoresT.all().find((p) => p.id === 'sur')?.desactivadoEn,
    ).not.toBeNull()
    expect(
      lugaresT.all().map((l) => [l.proveedorPredeterminadoId, l.sincronizado]),
    ).toEqual([
      [null, false],
      [null, false],
    ])
    await reactivarProveedor('sur')
    expect(
      proveedoresT.all().find((p) => p.id === 'sur')?.desactivadoEn,
    ).toBeNull()
  })

  it('eliminar: con lotes lanza; sin lotes pone eliminadoEn (baja lógica)', async () => {
    lotesT.seed([{ id: 'l1', proveedorId: 'sur' } as Lote])
    await expect(eliminarProveedor('sur')).rejects.toThrow(MENSAJE_CON_LOTES)
    await eliminarProveedor('norte')
    expect(proveedoresT.all().find((p) => p.id === 'norte')).toMatchObject({
      sincronizado: false,
    })
    expect(
      proveedoresT.all().find((p) => p.id === 'norte')?.eliminadoEn,
    ).not.toBeNull()
  })

  it('el predeterminado de un lugar reemplaza el anterior solo en ese lugar', async () => {
    await fijarPredeterminado(lugar1.id, 'norte')
    expect(lugaresT.all().map((l) => l.proveedorPredeterminadoId)).toEqual([
      'norte',
      'sur',
    ])
    await fijarPredeterminado(lugar2.id, null)
    expect(lugaresT.all().map((l) => l.proveedorPredeterminadoId)).toEqual([
      'norte',
      null,
    ])
  })

  it('no fija como predeterminado un proveedor desactivado', async () => {
    proveedoresT.seed([sur, { ...norte, desactivadoEn: '2026-05-01' }])
    await expect(fijarPredeterminado(lugar1.id, 'norte')).rejects.toThrow(
      /Reactiva/,
    )
  })
})
