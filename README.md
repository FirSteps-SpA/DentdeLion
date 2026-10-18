# inDENTory

PWA de gestión de inventario dental, offline-first (Vite + React + TypeScript + Tailwind CSS +
Zustand + IndexedDB + Supabase). Ver [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
para los principios de arquitectura del proyecto.

**Onboarding, en orden:** [Requisitos](#requisitos) → [Puesta en marcha](#puesta-en-marcha) →
[Configurar backend de desarrollo](#configurar-backend-de-desarrollo) →
[Cuentas de personal clínico (desarrollo)](#cuentas-de-personal-clínico-desarrollo) →
[Verificaciones de calidad](#verificaciones-de-calidad) →
[¿Quedó bien configurado mi entorno?](#quedó-bien-configurado-mi-entorno)

## Requisitos

- **Node.js** 24 LTS (o ≥ 22.22.2; lo exigen jsdom y vitest)
- **npm** (se instala junto con Node.js)

Si tu versión de Node/npm no cumple el mínimo, `npm install` mostrará una advertencia indicando
la incompatibilidad (ver campo `engines` en `package.json`).

## Puesta en marcha

```sh
git clone <url-del-repositorio>
cd inDENTory
npm install
npm run dev
```

Abre la URL que imprime `npm run dev` (por defecto `http://localhost:5173`) en tu navegador. La
app queda funcionando localmente **sin necesidad de configurar backend** — ver
"Configurar backend de desarrollo" más abajo para conectarla a Supabase local.

## Configurar backend de desarrollo

El desarrollo se hace contra un **Supabase local** (Supabase CLI + Docker), nunca contra
producción. Esto reemplaza la decisión de la spec `001-project-setup-local-dev` (proyecto
de desarrollo en la nube): el plan gratuito de Supabase no admite un proyecto adicional.

Requisitos extra: Docker y la
[Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

1. Levanta Supabase local; aplica todas las migraciones de
   [`supabase/migrations/`](supabase/migrations) sobre una base vacía:

   ```sh
   supabase start
   ```

   `supabase db reset` recrea la base desde cero; `supabase stop` la detiene conservando los
   datos. Solo puede haber un stack local a la vez (VetApp usa los mismos puertos).
2. Crea `.env.local` (ignorado por git; Vite lo prioriza sobre `.env`) con los valores que
   imprime `supabase status` — son claves de demostración del stack local:

   ```sh
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<ANON_KEY de supabase status>
   ```

3. Reinicia `npm run dev`. Si la conexión es exitosa verás `[inDENTory] Conectado a Supabase.` en
   la consola del navegador; si falta o es inválida alguna variable, verás un mensaje explícito
   indicando cuál.

### Cambios de esquema

La fuente de verdad del esquema es `supabase/migrations/`; los archivos
`specs/*/contracts/supabase-schema.md` quedan como documentación histórica de cada feature.

1. `supabase migration new <nombre>` crea el archivo de migración.
2. Pruébalo con `supabase db reset` + `npm run test:rls`.
3. El CI repite esas pruebas en cada push/PR a `main` y `develop`.
4. Tras el release, aplícalo a producción con `supabase db push` (proyecto vinculado con
   `supabase link`). Haz un respaldo antes.

### Credenciales — nunca las subas al repositorio

- El archivo real `.env` está excluido de git (ver `.gitignore`) — solo `.env.example` (sin
  secretos) se versiona.
- Nunca pegues una clave real de Supabase en `.env.example`, en un commit, o en un PR.
- Si accidentalmente commiteaste una clave real, rota la clave en el panel de Supabase de
  inmediato (no basta con borrarla del historial).

## Cuentas de personal clínico (desarrollo)

No existe una pantalla de autorregistro ni de alta de usuarios en la app (spec
`003-login-personal-clinico`, FR-009) — las cuentas se crean manualmente en el Supabase
local:

1. Con Supabase local corriendo, abre Studio (`http://127.0.0.1:54323`).
2. En **Authentication → Users**, crea un usuario de prueba (correo + contraseña) por cada rol
   que quieras probar.
3. Para cada usuario creado, inserta su fila correspondiente en `perfiles` (mismo `id` que el
   usuario de Auth, `rol` en `'administrador'` o `'personal'`).
4. Inicia sesión en la app local con esas credenciales para verificar el flujo de
   [`quickstart.md`](specs/003-login-personal-clinico/quickstart.md).

## Verificaciones de calidad

Antes de proponer un cambio, corre localmente:

```sh
npm run lint    # orden de código (ESLint)
npm run test    # pruebas (Vitest)
npm run test:rls  # RLS y triggers contra Supabase local (requiere supabase start)
npm run build   # compilación (tsc + Vite)
```

Cada comando termina con código de salida `0` y sin salida de error si todo está en orden, o con
código distinto de cero y un mensaje explícito señalando el problema si algo falla.

## Deploy

La app se despliega como sitio estático en **Netlify** (`netlify.toml`: build `npm run build`,
publish `dist`). El repo debe estar conectado como sitio en el dashboard de Netlify (deploy
automático en cada push a `main`, previews en cada PR).

En **Site settings → Environment variables** del sitio en Netlify, configura las mismas variables
que en `.env` local (producción, no las de desarrollo):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

CI (`.github/workflows/ci.yml`) corre `lint`, `test` y `build` en cada push/PR a `main` y
`develop`, independiente del deploy.

## ¿Quedó bien configurado mi entorno?

Checklist manual (sin script) — cada punto debe poder confirmarse a simple vista en menos de 2
minutos:

- [ ] `npm install` terminó sin errores en la terminal.
- [ ] `npm run dev` muestra `VITE ... ready` y una URL local.
- [ ] Esa URL abre en el navegador y muestra el texto "inDENTory".
- [ ] La consola del navegador no muestra errores en rojo (una advertencia amarilla de backend no
      configurado es esperada si no creaste un `.env`).
- [ ] `npm run lint`, `npm run test` y `npm run build` terminan cada uno sin errores.
