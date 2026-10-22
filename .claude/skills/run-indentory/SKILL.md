---
name: run-indentory
description: Build, run, and drive inDENTory (the dental inventory PWA). Use when asked to start the app, take a screenshot of its UI, verify a UI change actually renders, or interact with a running screen (login, Registrar, Consumir, Alertas).
---

inDENTory is a Vite + React PWA with no real backend required for local UI
work — it runs fully offline (Constitution I) against IndexedDB. Drive it by
starting the Vite dev server, then controlling a headless Chromium tab via
`.claude/skills/run-indentory/driver.mjs`, a small chromium-cli-style REPL
(`chromium-cli` itself isn't installed in this container, so this driver is
the stand-in). All paths below are relative to the repo root.

## Prerequisites

One-time per container — no root/sudo needed for any of this:

```bash
npm install                              # installs `playwright` (devDependency)
bash .claude/skills/run-indentory/setup.sh
```

`setup.sh` downloads the Chromium Headless Shell browser via Playwright,
then checks whether `chrome-headless-shell` is missing native shared
libraries (`libnspr4`, `libnss3`, `libasound2`) — true on a bare
Ubuntu/Debian container. `playwright install --with-deps` would fix that
but needs `sudo`, which this container doesn't have, so the script instead
fetches just those `.deb` packages with `apt-get download` (works
unprivileged) and extracts them with `dpkg-deb -x` into
`.claude/skills/run-indentory/pw-libs/` — `driver.mjs` auto-detects that
directory and sets `LD_LIBRARY_PATH` itself, so no manual export is needed
afterward. Re-running `setup.sh` is safe/idempotent.

## Run (agent path)

1. Start the dev server and wait for it to actually serve (don't `sleep`):

   ```bash
   npm run dev &
   timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
   ```

2. Pipe commands to the driver, one per line:

   ```bash
   node .claude/skills/run-indentory/driver.mjs <<'EOF'
   nav http://localhost:5173
   wait-for text=Ingresar
   screenshot login
   seed-user administrador Test Admin
   reload
   wait-for text=Cerrar sesión
   screenshot shell-registrar
   click text=Alertas
   screenshot shell-alertas
   console --errors
   quit
   EOF
   ```

   Screenshots land in `.claude/skills/run-indentory/screenshots/<name>.png`
   (gitignored — regenerate, don't commit them).

3. Stop the dev server when done (`npm run dev &`'s `$!` is only the npm
   wrapper — npm doesn't forward the kill to the Vite process it spawned):

   ```bash
   lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
   ```

Driver commands:

| command | what it does |
|---|---|
| `nav <url>` | Navigate, waits for network idle |
| `wait-for text=<text>` / `wait-for sel=<css>` | Wait up to 15s for an element |
| `click <text-or-selector>` | Tries as visible text first, then as a CSS selector |
| `fill <selector> <value>` | Fill an input by CSS selector (e.g. `fill #buscar-insumo Guantes`) |
| `screenshot [name]` | Saves to `screenshots/<name or shot-N>.png` |
| `seed-user <administrador\|personal> <nombre...>` | Writes a `usuarioActual` row (tenant 1) and lugar 1 directly into the app's Dexie/IndexedDB — the only way to reach the authenticated shell without a real Supabase project. **Call `reload` right after.** |
| `seed-insumo <id> <nombre...>` | Writes one demo `Insumo` (categoría "Protección", unidad "caja", `stockMinimo: 10`) so Registrar/Consumir/Alertas have something to show |
| `seed-lote <insumoId> <loteId> <días\|none> <cantidad> [lugarId]` | Writes one `Lote` expiring in `<días>` (negative = already expired, `none` = no expiry) plus an `ingreso` of `<cantidad>` in `lugarId` (default: lugar 1), so the insumo has stock for "Consumir 1" |
| `seed-presentacion <insumoId> <unidadConsumo> <unidadCompra> <contenido>` | Spec 015: sets a purchase presentation directly on the insumo row (e.g. `seed-presentacion art cartucho caja 50`). Call it **before** `seed-lote`, which records the ingreso in the insumo's consumption unit. Screenshot-only shortcut: it bypasses the `cambiosInsumo` ledger |
| `wait <ms>` | Pause (e.g. `wait 400` so a modal's fade-in finishes before `screenshot`) |
| `viewport <ancho> [alto]` | Resize the page (375 = móvil, 768 = tablet, 1440 = desktop) |
| `seed-reportes` | Spec 017: 5 insumos con precio (categorías distintas), 6 meses de consumos y tratamientos realizados en el lugar 1 y en `…0012` (créalo antes con `seed-lugar`), para ver Reportes e Inicio con datos. **Call `reload` right after.** |
| `seed-lugar <id> <nombre...>` | Spec 014: writes another lugar de trabajo of tenant 1, so the selector, "Todos" and "Trasladar" show up. **Call `reload` right after.** |
| `reload` | Reload the page (picks up seeded IndexedDB data on boot) |
| `console [--errors]` | Dump captured console/page-error messages (`--errors` filters to just errors) |
| `quit` / `exit` | Close the browser and exit |

## Run (human path)

`npm run dev` and open the printed `http://localhost:5173` URL in a real
browser. No backend configuration is required to see the login screen; see
the repo README's "Configurar backend de desarrollo" for connecting a real
Supabase project to actually authenticate.

## Test

```bash
npm run lint    # ESLint
npm run test    # Vitest
npm run build   # tsc -b && vite build
```

All three exit 0 with no output when the repo is healthy.

---

## Gotchas

- **No `chromium-cli` in this container.** The `/run` skill's default
  web-app pattern assumes it's installed; here it isn't, and there's no
  apparent way to install it — hence this custom Playwright-based
  `driver.mjs` instead of a `chromium-cli` heredoc.
- **`playwright install --with-deps` needs root.** `sudo` prompts for a
  password that doesn't exist in this container (`sudo -n true` fails).
  `setup.sh`'s `apt-get download` + `dpkg-deb -x` workaround needs no
  privilege at all — that's the whole reason it exists instead of just
  calling `--with-deps`.
- **No real backend, no real login.** There is no Supabase project
  configured in this container, so you cannot type credentials and sign in
  for real. Use `seed-user`/`seed-insumo` to write directly into the app's
  local Dexie/IndexedDB (the same store `authStore`/`inventoryStore` read
  from on boot) instead of driving the login form.
- **`seed-user`/`seed-insumo` need a `reload` after them.** They write to
  IndexedDB but the app's Zustand stores only pick up `usuarioActual` via
  `authStore.hydrate()` on mount — nothing re-reads it live.
- **`apt-get download` package names are Ubuntu-24.04-(noble)-specific.**
  If `setup.sh` fails with "Unable to locate package," the base image is a
  different release — `libasound2t64` in particular was renamed from
  `libasound2` around Ubuntu 23.10; check `apt-cache search asound` and
  update `setup.sh`.
- **A CSS comment containing a literal `*/` mid-sentence corrupts the
  build silently in `npm run dev`/`vitest`, only surfacing in `npm run
  build`.** Hit this once in `src/styles/index.css`: a comment describing
  Tailwind utilities as `bg-*/text-*/border-*` closed the CSS comment
  early at the first `*/`, spilling the rest of the sentence into actual
  CSS. If `npm run build`'s CSS step throws `Unexpected token Delim('*')`
  pointing into a `.css` file, check every comment there for a stray `*/`
  inside the sentence.

## Troubleshooting

- **`error while loading shared libraries: libnspr4.so: cannot open shared
  object file`** when the driver launches Chromium: `setup.sh` either
  wasn't run or was interrupted before extracting `pw-libs/`. Re-run it.
- **`sudo: a password is required`** from `playwright install --with-deps`:
  expected — don't use `--with-deps` here, use `setup.sh`.
- **`ECONNRESET` partway through `playwright install chromium`'s ~114 MiB
  download**: this container's network resets long-lived connections
  sometimes; Playwright's installer retries automatically — just let it
  keep running (it succeeded within a few retries when this was authored).
