import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Spec 015 (research.md R4, T023): el stock de un insumo convertido solo sale
 * bien si los movimientos se leen normalizados a la unidad actual. Cualquier
 * lectura de colecciones de `db.movimientos` fuera de estos archivos debe usar
 * `movimientosNormalizadosDeLote` (o los movimientos de `inventoryStore`). Las
 * escrituras y la lectura de un movimiento por id (`get`) no calculan stock.
 */
const PERMITIDOS = [
  'src/lib/db/',
  'src/lib/sync/index.ts',
  'src/lib/tenancy/',
  'src/features/insumos/lib/stock.ts',
]

const LECTURA =
  /(?:db\.movimientos|table\(\s*['"]movimientos['"]\s*\))\s*\.\s*(?:where|toArray|filter|each|toCollection|orderBy)\b/

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : []
  })
}

describe('lecturas de db.movimientos (spec 015 R4)', () => {
  it('la regla detecta una lectura y no una escritura', () => {
    expect(LECTURA.test("await db.movimientos.where('loteId').equals(id).toArray()")).toBe(true)
    expect(LECTURA.test('await db.movimientos\n  .where("loteId")')).toBe(true)
    expect(LECTURA.test("tx.table('movimientos').toCollection()")).toBe(true)
    expect(LECTURA.test('await db.movimientos.add(movimiento)')).toBe(false)
    expect(LECTURA.test('await db.movimientos.get(id)')).toBe(false)
    expect(LECTURA.test("db.transaction('rw', db.movimientos, async () => {})")).toBe(false)
  })

  it('solo los archivos permitidos leen colecciones de movimientos', () => {
    const raiz = join(__dirname, '../..')
    const infractores = archivos(join(raiz, 'src'))
      .map((ruta) => relative(raiz, ruta).replaceAll('\\', '/'))
      .filter((ruta) => !PERMITIDOS.some((permitido) => ruta.startsWith(permitido)))
      .filter((ruta) => LECTURA.test(readFileSync(join(raiz, ruta), 'utf8')))
    expect(
      infractores,
      'Usa movimientosNormalizadosDeLote (stock.ts) para leer movimientos: si el insumo ' +
        'cambió de unidad de consumo, las cantidades crudas están en otra unidad.',
    ).toEqual([])
  })
})
