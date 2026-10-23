#!/usr/bin/env node
// Minimal chromium-cli-style REPL for driving inDENTory in a headless
// container where chromium-cli itself isn't available. Reads one command
// per line from stdin. See SKILL.md for the command list and examples.
//
// Usage:
//   node .claude/skills/run-indentory/driver.mjs <<'EOF'
//   nav http://localhost:5173
//   wait-for text=Ingresar
//   screenshot login
//   EOF

import { chromium } from 'playwright'
import { createInterface } from 'node:readline'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
const SCREENSHOT_DIR = join(SKILL_DIR, 'screenshots')
mkdirSync(SCREENSHOT_DIR, { recursive: true })

// Auto-detect the locally-extracted native libs from setup.sh, so callers
// don't have to export LD_LIBRARY_PATH by hand.
const LOCAL_LIBS = join(SKILL_DIR, 'pw-libs/usr/lib/x86_64-linux-gnu')
process.env.LD_LIBRARY_PATH = [LOCAL_LIBS, process.env.LD_LIBRARY_PATH]
  .filter(Boolean)
  .join(':')

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })

const consoleMessages = []
page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => consoleMessages.push({ type: 'pageerror', text: String(err) }))

let shotCounter = 0

/** Resolves `text=...` / `sel=...` / a bare string (tried as text first, then as a CSS selector). */
function resolveLocator(arg) {
  if (arg.startsWith('text=')) return page.getByText(arg.slice(5))
  if (arg.startsWith('sel=')) return page.locator(arg.slice(4))
  return page.locator(`text=${arg}`).or(page.locator(arg))
}

async function runCommand(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const [cmd, ...rest] = trimmed.split(' ')
  const arg = rest.join(' ')

  switch (cmd) {
    case 'nav':
      await page.goto(arg, { waitUntil: 'networkidle' })
      console.log(`ok: navigated to ${arg}`)
      break

    case 'wait-for':
      await resolveLocator(arg).first().waitFor({ timeout: 15000 })
      console.log(`ok: found ${arg}`)
      break

    case 'screenshot': {
      shotCounter += 1
      const name = arg || `shot-${shotCounter}`
      const path = join(SCREENSHOT_DIR, `${name}.png`)
      await page.screenshot({ path })
      console.log(`ok: screenshot -> ${path}`)
      break
    }

    case 'click':
      await resolveLocator(arg).first().click()
      console.log(`ok: clicked ${arg}`)
      break

    case 'fill': {
      const spaceIdx = arg.indexOf(' ')
      const sel = arg.slice(0, spaceIdx)
      const value = arg.slice(spaceIdx + 1)
      await page.fill(sel, value)
      console.log(`ok: filled ${sel}`)
      break
    }

    case 'select': {
      const spaceIdx = arg.indexOf(' ')
      const sel = arg.slice(0, spaceIdx)
      const value = arg.slice(spaceIdx + 1)
      await page.selectOption(sel, { label: value })
      console.log(`ok: selected ${value} in ${sel}`)
      break
    }

    case 'reload':
      await page.reload({ waitUntil: 'networkidle' })
      console.log('ok: reloaded')
      break

    // Spec 018: rueda real del mouse sobre un campo enfocado. Informa valor
    // antes/después, si conserva el foco y cuánto se desplazó la página.
    case 'wheel': {
      const campo = page.locator(arg).first()
      await campo.scrollIntoViewIfNeeded()
      await campo.focus()
      const antes = await campo.inputValue()
      const box = await campo.boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      // Desplazamiento del contenedor con scroll más cercano (o de la página).
      const posicion = () =>
        campo.evaluate((el) => {
          for (let n = el.parentElement; n; n = n.parentElement) {
            const { overflowY } = getComputedStyle(n)
            if (/(auto|scroll)/.test(overflowY) && n.scrollHeight > n.clientHeight) return n.scrollTop
          }
          return window.scrollY
        })
      const scrollAntes = await posicion()
      await page.mouse.wheel(0, 120)
      await page.waitForTimeout(300)
      const despues = await campo.inputValue()
      const conFoco = await campo.evaluate((el) => document.activeElement === el)
      const scroll = (await posicion()) - scrollAntes
      console.log(
        `${despues === antes ? 'ok' : 'FAIL'}: wheel ${arg} valor ${antes} -> ${despues}, foco ${conFoco ? 'sí' : 'no'}, scroll ${scroll}px`,
      )
      break
    }

    case 'press':
      await page.keyboard.press(arg)
      console.log(`ok: pressed ${arg}`)
      break

    // --- inDENTory-specific: seed Dexie/IndexedDB directly, since there is
    // no real Supabase backend in this container (spec 003's offline-first
    // local session cache is exactly what makes this possible). ---
    case 'seed-user': {
      const [rol, ...nombreParts] = rest
      const nombre = nombreParts.join(' ') || 'Usuario de Prueba'
      if (rol !== 'administrador' && rol !== 'personal') {
        console.log('error: seed-user <administrador|personal> <nombre...>')
        break
      }
      await page.evaluate(
        ({ rol, nombre }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('inDENToryDB')
            req.onsuccess = () => {
              const db = req.result
              // Spec 014: el usuario y el lugar 1 del tenant 1 (Dexie v10).
              const tablas = ['usuarioActual']
              if (db.objectStoreNames.contains('lugares')) tablas.push('lugares')
              const tx = db.transaction(tablas, 'readwrite')
              tx.objectStore('usuarioActual').put({
                id: 'driver-seed-user',
                email: 'driver@test.local',
                nombre,
                rol,
                autenticadoEn: new Date().toISOString(),
                tenantId: '00000000-0000-4000-8000-000000000001',
                desactivadoEn: null,
              })
              if (tablas.includes('lugares')) {
                tx.objectStore('lugares').put({
                  id: '00000000-0000-4000-8000-000000000011',
                  tenantId: '00000000-0000-4000-8000-000000000001',
                  nombre: 'Clínica',
                  desactivadoEn: null,
                  creadoEn: '2026-01-01T00:00:00.000Z',
                  sincronizado: true,
                })
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { rol, nombre },
      )
      console.log(`ok: seeded usuarioActual (${rol}, ${nombre}) — call 'reload' next`)
      break
    }

    case 'seed-insumo': {
      const [id, ...nombreParts] = rest
      const nombre = nombreParts.join(' ') || 'Insumo de Prueba'
      await page.evaluate(
        ({ id, nombre }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('inDENToryDB')
            req.onsuccess = () => {
              const db = req.result
              const tx = db.transaction('insumos', 'readwrite')
              tx.objectStore('insumos').put({
                id,
                tenantId: '00000000-0000-4000-8000-000000000001',
                nombre,
                categoria: 'Protección',
                unidadMedida: 'caja',
                // Spec 015 (Dexie v11): sin presentación distinta.
                unidadCompra: 'caja',
                contenido: 1,
                permiteDecimales: false,
                caduca: true,
                codigoFabricante: null,
                creadoEn: new Date().toISOString(),
                stockMinimo: 10,
                dadoDeBajaEn: null,
                dadoDeBajaPor: null,
                creadoPor: null,
              })
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { id, nombre },
      )
      console.log(`ok: seeded insumo ${id} (${nombre})`)
      break
    }

    case 'seed-lote': {
      // seed-lote <insumoId> <loteId> <diasHastaVencer|none> <cantidad> [lugarId]
      const [insumoId, loteId, dias, cantidad, lugarArg] = rest
      const lugarId = lugarArg ?? '00000000-0000-4000-8000-000000000011'
      if (!insumoId || !loteId || !dias || !cantidad) {
        console.log('error: seed-lote <insumoId> <loteId> <diasHastaVencer|none> <cantidad>')
        break
      }
      await page.evaluate(
        ({ insumoId, loteId, dias, cantidad, lugarId }) =>
          new Promise((resolve, reject) => {
            let fechaCaducidad = null
            if (dias !== 'none') {
              const hoy = new Date()
              const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))
              d.setUTCDate(d.getUTCDate() + Number(dias))
              fechaCaducidad = d.toISOString().slice(0, 10)
            }
            const req = indexedDB.open('inDENToryDB')
            req.onsuccess = () => {
              const db = req.result
              const tx = db.transaction(['insumos', 'lotes', 'movimientos'], 'readwrite')
              const ahora = new Date().toISOString()
              const tenantId = '00000000-0000-4000-8000-000000000001'
              // Spec 015 (Dexie v11): el lote y el ingreso en la unidad de consumo del insumo.
              const getInsumo = tx.objectStore('insumos').get(insumoId)
              getInsumo.onsuccess = () => {
              const unidad = getInsumo.result?.unidadMedida ?? 'caja'
              const contenido = getInsumo.result?.contenido ?? 1
              tx.objectStore('lotes').put({
                id: loteId,
                tenantId,
                lugarId,
                insumoId,
                numeroLote: loteId.toUpperCase(),
                proveedor: 'Proveedor Demo',
                fechaCaducidad,
                codigoFabricante: null,
                estado: 'activo',
                creadoEn: ahora,
                cantidadIngresada: Number(cantidad),
                unidadIngresada: unidad,
                contenido,
                unidadConsumo: unidad,
                precioCompra: null,
              })
              tx.objectStore('movimientos').put({
                id: `ingreso-${loteId}`,
                tenantId,
                lugarId,
                trasladoId: null,
                tipo: 'ingreso',
                loteId,
                cantidad: Number(cantidad),
                unidad,
                usuarioId: 'driver-seed-user',
                movimientoOrigenId: null,
                creadoEn: ahora,
                sincronizado: true,
              })
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { insumoId, loteId, dias, cantidad, lugarId },
      )
      console.log(`ok: seeded lote ${loteId} for ${insumoId} (${cantidad} u.)`)
      break
    }

    case 'seed-reportes': {
      // Spec 017: insumos con precio, consumos de 6 meses y tratamientos
      // realizados en el lugar 1 y en el lugar 2 (si existe), para Reportes.
      await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('inDENToryDB')
            req.onsuccess = () => {
              const db = req.result
              const tx = db.transaction(
                ['insumos', 'lotes', 'movimientos', 'tratamientosRealizados'],
                'readwrite',
              )
              const tenantId = '00000000-0000-4000-8000-000000000001'
              const L1 = '00000000-0000-4000-8000-000000000011'
              const L2 = '00000000-0000-4000-8000-000000000012'
              const hoy = new Date()
              const fecha = (mesesAtras, dia) =>
                new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, dia, 11).toISOString()
              const insumos = [
                ['rep-anest', 'Anestesia lidocaína', 'Anestesia', 'cartucho', 650],
                ['rep-resina', 'Resina A2', 'Restauración', 'g', 1200],
                ['rep-guante', 'Guantes nitrilo M', 'Protección', 'unidad', 90],
                ['rep-gasa', 'Gasa estéril', 'Curación', 'unidad', 40],
                ['rep-hilo', 'Hilo retractor', 'Periodoncia', 'unidad', 300],
              ]
              let n = 0
              const mov = (tipo, loteId, cantidad, unidad, creadoEn, lugarId = L1) =>
                tx.objectStore('movimientos').put({
                  id: `rep-m${++n}`, tenantId, lugarId, trasladoId: null, tipo, loteId, cantidad,
                  unidad, tratamientoRealizadoId: null, usuarioId: 'driver-seed-user',
                  movimientoOrigenId: null, creadoEn, sincronizado: true,
                })
              insumos.forEach(([id, nombre, categoria, unidad, precio], i) => {
                tx.objectStore('insumos').put({
                  id, tenantId, nombre, categoria, unidadMedida: unidad, unidadCompra: unidad,
                  contenido: 1, permiteDecimales: unidad === 'g', caduca: false,
                  codigoFabricante: null, creadoEn: fecha(7, 1), stockMinimo: null,
                  dadoDeBajaEn: null, dadoDeBajaPor: null, creadoPor: null,
                })
                const loteId = `${id}-lote`
                tx.objectStore('lotes').put({
                  id: loteId, tenantId, lugarId: L1, insumoId: id, numeroLote: loteId.toUpperCase(),
                  proveedor: 'Proveedor Demo', fechaCaducidad: null, codigoFabricante: null,
                  estado: 'activo', creadoEn: fecha(7, 1), cantidadIngresada: 400,
                  unidadIngresada: unidad, contenido: 1, unidadConsumo: unidad, precioCompra: precio,
                })
                mov('ingreso', loteId, 400, unidad, fecha(7, 1))
                mov('ingreso', loteId, 100, unidad, fecha(7, 1), L2)
                for (let m = 5; m >= 0; m--) {
                  mov('consumo', loteId, 4 + ((i + m) % 5) * 3, unidad, fecha(m, 3 + i))
                  mov('consumo', loteId, 2 + (i % 3), unidad, fecha(m, 6 + i), L2)
                }
              })
              const tratamientos = [
                ['Restauración clase II', 45000, 14520],
                ['Limpieza', 30000, 11200],
                ['Endodoncia', 120000, 41000],
              ]
              let r = 0
              for (let m = 5; m >= 0; m--) {
                tratamientos.forEach(([nombre, precio, ganancia], i) => {
                  for (let k = 0; k < 2 + ((m + i) % 3); k++) {
                    const lugarId = (k + i) % 3 === 0 ? L2 : L1
                    tx.objectStore('tratamientosRealizados').put({
                      id: `rep-r${++r}`, tenantId, lugarId, tratamientoId: `rep-t${i}`, nombre,
                      precio: lugarId === L2 ? precio + 5000 : precio, porcentajeProfesional: 40,
                      materiales: [], costoMateriales: 3480, costoCompleto: true,
                      gananciaEstimada: lugarId === L2 ? ganancia + 2000 : ganancia,
                      usuarioId: 'driver-seed-user', creadoEn: fecha(m, 2 + k * 3 + i),
                      anuladoEn: null, anuladoPor: null, sincronizado: true,
                      anulacionSincronizada: true,
                    })
                  }
                })
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      console.log('ok: seeded reportes (5 insumos con precio, 6 meses de consumos y tratamientos)')
      break
    }

    case 'wait': {
      // wait <ms> — p. ej. para que termine la animación de entrada de un modal antes de la captura.
      await page.waitForTimeout(Number(arg) || 300)
      console.log(`ok: waited ${Number(arg) || 300}ms`)
      break
    }

    case 'viewport': {
      // viewport <ancho> <alto> — p. ej. 375 812 (móvil), 768 1024 (tablet), 1440 900 (desktop).
      const [ancho, alto] = rest.map(Number)
      await page.setViewportSize({ width: ancho, height: alto || 900 })
      console.log(`ok: viewport ${ancho}x${alto || 900}`)
      break
    }

    case 'seed-presentacion': {
      // Spec 015: seed-presentacion <insumoId> <unidadConsumo> <unidadCompra> <contenido>
      // — escribe la presentación directo en la fila (solo para capturas: sin ledger).
      const [id, unidadMedida, unidadCompra, contenido] = rest
      await page.evaluate(
        ({ id, unidadMedida, unidadCompra, contenido }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('inDENToryDB')
            req.onsuccess = () => {
              const tx = req.result.transaction('insumos', 'readwrite')
              const store = tx.objectStore('insumos')
              const get = store.get(id)
              get.onsuccess = () => {
                if (get.result) {
                  store.put({ ...get.result, unidadMedida, unidadCompra, contenido: Number(contenido) })
                }
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { id, unidadMedida, unidadCompra, contenido },
      )
      console.log(`ok: presentación de ${id}: ${unidadCompra} × ${contenido} ${unidadMedida} — seed-lote después`)
      break
    }

    case 'seed-lugar': {
      // Spec 014: seed-lugar <id> <nombre...> — un lugar más del tenant 1.
      const [id, ...nombreParts] = rest
      const nombre = nombreParts.join(' ') || 'Otro lugar'
      await page.evaluate(
        ({ id, nombre }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('inDENToryDB')
            req.onsuccess = () => {
              const db = req.result
              const tx = db.transaction('lugares', 'readwrite')
              tx.objectStore('lugares').put({
                id,
                tenantId: '00000000-0000-4000-8000-000000000001',
                nombre,
                desactivadoEn: null,
                creadoEn: new Date().toISOString(),
                sincronizado: true,
              })
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { id, nombre },
      )
      console.log(`ok: seeded lugar ${id} (${nombre}) — call 'reload' next`)
      break
    }

    case 'console': {
      const errors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'pageerror')
      console.log(JSON.stringify(rest[0] === '--errors' ? errors : consoleMessages, null, 2))
      break
    }

    case 'quit':
    case 'exit':
      await browser.close()
      process.exit(0)
      break

    default:
      console.log(`unknown command: ${cmd}`)
  }
}

const rl = createInterface({ input: process.stdin })
for await (const line of rl) {
  try {
    await runCommand(line)
  } catch (err) {
    console.log(`error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
await browser.close()
