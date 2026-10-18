import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CambioInsumo, Categoria } from '../../src/lib/db'
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
    db: createMemoryDb(
      Object.fromEntries(tablasMemoria.map((t) => [t, new MemoryTable()])),
    ),
  }
})

const estado = crearEstado()
const client = crearClienteFalso(estado)

vi.mock('../../src/lib/supabase', () => ({
  getSupabaseStatus: () => ({ client, error: null }),
}))

import { db } from '../../src/lib/db'
import { runSyncBatch } from '../../src/lib/sync'
import { useAuthStore } from '../../src/stores/authStore'

const cambiosT = db.cambiosInsumo as unknown as MemoryTable<CambioInsumo>
const categoriasT = db.categorias as unknown as MemoryTable<Categoria>

const rlsComoAutor = (campo: string) => (fila: Record<string, unknown>) =>
  fila[campo] === 'B'
    ? null
    : { code: '42501', message: 'new row violates row-level security policy' }

function cambio(id: string, usuarioId: string): CambioInsumo {
  return {
    id,
    insumoId: 'i1',
    campo: 'nombre',
    valorAnterior: 'X',
    valorNuevo: 'Y',
    usuarioId,
    creadoEn: '2026-10-18T10:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
  }
}

function categoria(id: string, creadoPor: string): Categoria {
  return {
    id,
    nombre: `Cat ${id}`,
    creadoPor,
    creadoEn: '2026-10-18T10:00:00.000Z',
    sincronizado: false,
    rechazadoEn: null,
    desactivadoEn: null,
  }
}

beforeEach(() => {
  reiniciar(estado)
  estado.rechazarFila.cambios_insumo = rlsComoAutor('usuario_id')
  estado.rechazarFila.categorias = rlsComoAutor('creado_por')
  cambiosT.seed([cambio('cA', 'A'), cambio('cB', 'B')])
  categoriasT.seed([categoria('kA', 'A'), categoria('kB', 'B')])
  useAuthStore.setState({
    usuario: {
      id: 'B',
      email: 'b@x.cl',
      nombre: 'Bea',
      rol: 'administrador',
      autenticadoEn: 'x',
    },
    isReady: true,
  })
})

describe('en un dispositivo compartido, cada quien sube solo lo suyo (spec 012 R4)', () => {
  it('sube los cambios de insumo de B y deja intactos los de A', async () => {
    await runSyncBatch()

    const subidos = estado.upserts
      .filter((u) => u.tabla === 'cambios_insumo')
      .flatMap((u) => u.filas.map((f) => f.id))
    expect(subidos).toEqual(['cB'])
    expect(cambiosT.all().find((c) => c.id === 'cA')).toMatchObject({
      sincronizado: false,
      rechazadoEn: null,
    })
  })

  it('sube las categorías de B y deja intactas las de A', async () => {
    await runSyncBatch()

    const subidas = estado.upserts
      .filter((u) => u.tabla === 'categorias')
      .flatMap((u) => u.filas.map((f) => f.id))
    expect(subidas).toEqual(['kB'])
    expect(categoriasT.all().find((c) => c.id === 'kA')).toMatchObject({
      sincronizado: false,
      rechazadoEn: null,
    })
  })
})
