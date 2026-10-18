/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest corre desde la raíz del repo (jsdom no da una URL file:// a import.meta).
const css = readFileSync(join(process.cwd(), 'src/styles/index.css'), 'utf8')

/**
 * Spec 013 FR-005 / SC-003: los pares texto–fondo e ícono–fondo que usa la app
 * cumplen WCAG 2.1 AA (contracts/design-tokens.md, "Pares verificados"). Lee
 * los tokens directamente del `@theme` de `src/styles/index.css`, así que
 * cambiar un color que rompa un par hace fallar esta prueba.
 */
const tema = css.slice(
  css.indexOf('@theme {'),
  css.indexOf('}', css.indexOf('@theme {')),
)
const tokens = new Map(
  [...tema.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [
    m[1],
    m[2],
  ]),
)

function color(nombre: string): string {
  if (nombre === 'blanco') return '#FFFFFF'
  const valor = tokens.get(nombre)
  if (!valor) throw new Error(`Token --color-${nombre} no definido en @theme`)
  return valor
}

function luminancia(hex: string): number {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** [uso, primer plano, fondos, mínimo] — contracts/design-tokens.md. */
const PARES: [string, string[], string[], number][] = [
  ['Texto principal', ['text'], ['surface', 'bg', 'bg-secondary'], 4.5],
  ['Texto secundario', ['text-muted'], ['surface', 'bg', 'bg-secondary'], 4.5],
  [
    'Botón primario',
    ['blanco'],
    ['primary', 'primary-dark', 'primary-active'],
    4.5,
  ],
  [
    'Botón secundario / sidebar activo',
    ['primary-text'],
    ['primary-soft', 'bg-secondary', 'secondary-bg'],
    4.5,
  ],
  ['Botón outline', ['teal-dark'], ['surface', 'bg'], 4.5],
  ['Badge stock OK', ['success-text'], ['success-bg'], 4.5],
  [
    'Badge stock bajo / caducidad 30 d',
    ['warning-30-text'],
    ['warning-30-bg'],
    4.5,
  ],
  ['Caducidad 7 d', ['urgent-7-text'], ['urgent-7-bg'], 4.5],
  ['Caducidad 1 d', ['urgent-1-text'], ['urgent-1-bg'], 4.5],
  ['Crítico / caducado / errores', ['danger'], ['danger-bg', 'surface'], 4.5],
  ['Aviso (toast)', ['blanco'], ['text'], 4.5],
  ['Ícono activo', ['brand-icon'], ['surface', 'primary-soft'], 3],
  [
    'Íconos de estado',
    ['success-icon', 'warning-icon', 'danger', 'info-icon'],
    ['surface'],
    3,
  ],
  ['Logotipo', ['teal-dark'], ['surface', 'bg'], 4.5],
]

const casos = PARES.flatMap(([uso, frentes, fondos, minimo]) =>
  frentes.flatMap((frente) =>
    fondos.map((fondo) => [uso, frente, fondo, minimo] as const),
  ),
)

describe('contraste de los tokens del Design System (spec 013 FR-005)', () => {
  it.each(casos)('%s: %s sobre %s ≥ %s:1', (_uso, frente, fondo, minimo) => {
    expect(contraste(color(frente), color(fondo))).toBeGreaterThanOrEqual(
      minimo,
    )
  })

  it('los cuatro niveles de caducidad tienen fondos distinguibles (Constitución IV)', () => {
    const fondos = [
      'warning-30-bg',
      'urgent-7-bg',
      'urgent-1-bg',
      'danger-bg',
    ].map(color)
    expect(new Set(fondos.map((f) => f.toUpperCase())).size).toBe(4)
    // Dentro de cada familia (ámbar 30/7 d, rojo 1 d/caducado) difieren en luminancia.
    const dif = (a: string, b: string) =>
      Math.abs(luminancia(color(a)) - luminancia(color(b)))
    expect(dif('warning-30-bg', 'urgent-7-bg')).toBeGreaterThanOrEqual(0.05)
    expect(dif('urgent-1-bg', 'danger-bg')).toBeGreaterThanOrEqual(0.05)
  })
})
