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

- **Node.js** ≥ 20 (LTS)
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
"Configurar backend de desarrollo" más abajo para conectarla a un proyecto Supabase de desarrollo.

## Configurar backend de desarrollo

El proyecto usa un proyecto **Supabase alojado en la nube** para desarrollo (compartido por el
equipo o una cuenta individual gratuita en [supabase.com](https://supabase.com)) — no se usa ni
se soporta una instancia local autoalojada vía Docker.

1. Crea (o pide acceso a) un proyecto Supabase de desarrollo.
2. En el panel del proyecto, copia la **Project URL** y la **anon public key**
   (Project Settings → API).
3. Copia la plantilla de configuración y complétala:

   ```sh
   cp .env.example .env
   ```

   Edita `.env` y reemplaza `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con esos valores.
4. Reinicia `npm run dev`. Si la conexión es exitosa verás `[inDENTory] Conectado a Supabase.` en
   la consola del navegador; si falta o es inválida alguna variable, verás un mensaje explícito
   indicando cuál.
5. Aplica el esquema de base de datos (tablas, índices, RLS y triggers) versionado en
   [`supabase/migrations/`](supabase/migrations) con la Supabase CLI:

   ```sh
   supabase link --project-ref <ref-del-proyecto>
   supabase db push
   ```

   Los archivos `specs/*/contracts/supabase-schema.md` quedan como documentación histórica de
   cada feature; la fuente de verdad del esquema es `supabase/migrations/`. Cualquier cambio
   nuevo al esquema va como una migración nueva (`supabase migration new <nombre>`).

### Credenciales — nunca las subas al repositorio

- El archivo real `.env` está excluido de git (ver `.gitignore`) — solo `.env.example` (sin
  secretos) se versiona.
- Nunca pegues una clave real de Supabase en `.env.example`, en un commit, o en un PR.
- Si accidentalmente commiteaste una clave real, rota la clave en el panel de Supabase de
  inmediato (no basta con borrarla del historial).

## Cuentas de personal clínico (desarrollo)

No existe una pantalla de autorregistro ni de alta de usuarios en la app (spec
`003-login-personal-clinico`, FR-009) — las cuentas se crean manualmente en el proyecto Supabase
de desarrollo:

1. Asegúrate de haber aplicado las migraciones (paso 5 de la sección anterior); incluyen la
   tabla `perfiles` y sus políticas RLS.
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
