import { describe, expect, it } from 'vitest'
import {
  activos,
  buscarProveedores,
  claveNombre,
  coincidencia,
  desactivados,
  mapaPorId,
  nombreDelLote,
  ordenarProveedores,
  predeterminadoDe,
} from '../../../src/features/proveedores/lib/proveedores'
import { proveedorFalso } from '../../helpers/proveedor'

/** Spec 021 T012 (research.md R1, R8, R11; FR-002, FR-005, FR-006, FR-014). */
const sur = proveedorFalso({ id: 'sur', nombre: 'Dental Sur' })
const norte = proveedorFalso({ id: 'norte', nombre: 'Ápice Norte' })
const viejo = proveedorFalso({
  id: 'viejo',
  nombre: 'Casa Vieja',
  desactivadoEn: '2026-05-01',
})
const borrado = proveedorFalso({
  id: 'borrado',
  nombre: 'Borrado',
  eliminadoEn: '2026-05-01',
})
const todos = [sur, norte, viejo, borrado]

describe('claveNombre (paridad con clave_nombre del servidor)', () => {
  it.each([
    [' Dental  Sur ', 'dental sur'],
    ['DENTAL SÚR', 'dental sur'],
    ['dental\tsur', 'dental sur'],
    ['Peña', 'pena'],
    ['Ñandú Dental', 'nandu dental'],
    ['Crème Brûlée', 'creme brulee'],
  ])('%j → %j', (nombre, clave) => {
    expect(claveNombre(nombre)).toBe(clave)
  })
})

describe('listas', () => {
  it('ordena sin distinguir tildes ni mayúsculas', () => {
    expect(ordenarProveedores([sur, norte]).map((p) => p.id)).toEqual([
      'norte',
      'sur',
    ])
  })

  it('activos excluye desactivados y eliminados; desactivados, solo los desactivados', () => {
    expect(activos(todos).map((p) => p.id)).toEqual(['norte', 'sur'])
    expect(desactivados(todos).map((p) => p.id)).toEqual(['viejo'])
  })

  it('busca entre los activos sin tildes ni mayúsculas', () => {
    expect(buscarProveedores(todos, 'APICE').map((p) => p.id)).toEqual([
      'norte',
    ])
    expect(buscarProveedores(todos, ' sur').map((p) => p.id)).toEqual(['sur'])
    expect(buscarProveedores(todos, 'vieja')).toEqual([])
    expect(buscarProveedores(todos, '')).toHaveLength(2)
  })
})

describe('coincidencia', () => {
  it('activo, desactivado o ninguna, por clave; ignora eliminados', () => {
    expect(coincidencia(todos, 'dental  súr')).toEqual({
      tipo: 'activo',
      proveedor: sur,
    })
    expect(coincidencia(todos, 'CASA VIEJA')).toEqual({
      tipo: 'desactivado',
      proveedor: viejo,
    })
    expect(coincidencia(todos, 'borrado')).toEqual({ tipo: 'ninguna' })
    expect(coincidencia(todos, 'Dental')).toEqual({ tipo: 'ninguna' })
    expect(coincidencia(todos, '   ')).toEqual({ tipo: 'ninguna' })
  })
})

describe('predeterminadoDe', () => {
  it('devuelve el del lugar solo si sigue activo', () => {
    expect(predeterminadoDe({ proveedorPredeterminadoId: 'sur' }, todos)).toBe(
      sur,
    )
    expect(
      predeterminadoDe({ proveedorPredeterminadoId: 'viejo' }, todos),
    ).toBeNull()
    expect(
      predeterminadoDe({ proveedorPredeterminadoId: 'borrado' }, todos),
    ).toBeNull()
    expect(
      predeterminadoDe({ proveedorPredeterminadoId: 'no-existe' }, todos),
    ).toBeNull()
    expect(
      predeterminadoDe({ proveedorPredeterminadoId: null }, todos),
    ).toBeNull()
    expect(predeterminadoDe(undefined, todos)).toBeNull()
  })
})

describe('nombreDelLote', () => {
  const porId = mapaPorId(todos)
  it('usa el nombre actual del catálogo; sin proveedorId o sin el proveedor, el texto', () => {
    expect(
      nombreDelLote(
        { proveedorId: 'sur', proveedor: 'dental sur viejo' },
        porId,
      ),
    ).toBe('Dental Sur')
    expect(
      nombreDelLote({ proveedorId: null, proveedor: ' Texto ' }, porId),
    ).toBe('Texto')
    expect(
      nombreDelLote({ proveedorId: 'otro', proveedor: 'Texto' }, porId),
    ).toBe('Texto')
  })
})
