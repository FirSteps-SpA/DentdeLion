// Genera los íconos PNG de la app instalada a partir de public/icons/icon.svg
// (spec 013 research R11). Uso: `node scripts/generar-iconos.mjs`.
// Requiere el Chromium de Playwright (devDependency; en contenedores sin libs
// nativas, ver .claude/skills/run-indentory/setup.sh).
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const raiz = join(import.meta.dirname, '..')
const libs = join(
  raiz,
  '.claude/skills/run-indentory/pw-libs/usr/lib/x86_64-linux-gnu',
)
process.env.LD_LIBRARY_PATH = [libs, process.env.LD_LIBRARY_PATH]
  .filter(Boolean)
  .join(':')

const svg = await readFile(join(raiz, 'public/icons/icon.svg'), 'utf8')
const navegador = await chromium.launch({ args: ['--no-sandbox'] })
for (const lado of [192, 512]) {
  const pagina = await navegador.newPage({
    viewport: { width: lado, height: lado },
  })
  await pagina.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`,
  )
  await pagina.screenshot({ path: join(raiz, `public/icons/icon-${lado}.png`) })
  await pagina.close()
  console.log(`public/icons/icon-${lado}.png`)
}
await navegador.close()
