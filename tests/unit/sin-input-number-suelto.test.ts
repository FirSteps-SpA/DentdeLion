import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Spec 018 (research.md R2): un `<input type="number">` cambia su valor con la
 * rueda del mouse. Todos los campos numéricos pasan por `NumeroInput`, que lo
 * evita; esta prueba impide que vuelva a aparecer uno suelto.
 */
const PERMITIDO = 'src/components/ui/NumeroInput.tsx'

const TIPO_NUMBER = /type\s*=\s*(?:"number"|'number'|\{\s*['"]number['"]\s*\})/

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) return archivos(ruta)
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : []
  })
}

describe('campos numéricos sin NumeroInput (spec 018 R2)', () => {
  it('la regla detecta las formas de escribir type="number"', () => {
    expect(TIPO_NUMBER.test('<input type="number" />')).toBe(true)
    expect(TIPO_NUMBER.test("<input type='number' />")).toBe(true)
    expect(TIPO_NUMBER.test("<input type={'number'} />")).toBe(true)
    expect(TIPO_NUMBER.test('<input type="text" inputMode="numeric" />')).toBe(false)
  })

  it('solo NumeroInput declara un input numérico', () => {
    const raiz = process.cwd()
    const infractores = archivos(join(raiz, 'src'))
      .map((ruta) => relative(raiz, ruta))
      .filter((ruta) => ruta !== PERMITIDO)
      .filter((ruta) => TIPO_NUMBER.test(readFileSync(join(raiz, ruta), 'utf8')))
    expect(infractores).toEqual([])
  })
})
