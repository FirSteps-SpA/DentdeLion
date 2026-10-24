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

## Clientes y cuentas (desarrollo)

Desde la spec 014 la app atiende a varios clientes (tenants) aislados, cada uno con sus lugares de
trabajo. No hay autorregistro: First Steps da de alta cada cliente y su administradora, y ella
invita a su equipo desde **Ajustes → Equipo** con un enlace (correo, WhatsApp o copiar).

1. Con Supabase local corriendo, sirve la Edge Function de invitaciones en otra terminal:

   ```sh
   supabase functions serve --no-verify-jwt
   ```

2. Da de alta un cliente de prueba; el script imprime el enlace de invitación de su
   administradora:

   ```sh
   npm run alta-tenant -- --nombre "Clínica X" --lugar "Sede Centro" --admin admin@test.local
   ```

3. Abre el enlace con `npm run dev` corriendo, define nombre y contraseña, y entra.

Los datos que ya existían quedan en el tenant 1 / lugar 1 (UUID fijos de la migración
`20261020000000_multi_tenant.sql`). El procedimiento de producción está en
`1stDocs/004-operacion/alta-tenant.md`.

## Verificaciones de calidad

Antes de proponer un cambio, corre localmente:

```sh
npm run lint    # orden de código (ESLint)
npm run test    # pruebas (Vitest)
npm run test:rls  # RLS, triggers e invitaciones contra Supabase local
                  # (requiere supabase start y supabase functions serve)
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

### Orden de despliegue con cambios de esquema

1. Respaldo: `~/1STEPS/1stDocs/004-operacion/respaldo/respaldo.sh DentdeLion`.
2. Migraciones: `supabase db push --linked`.
3. Recién después, el front (merge a `main` → Netlify). Los clientes en caché siguen funcionando:
   el servidor completa las columnas nuevas que no envían.

**Spec 015 (unidades y costo unitario):** antes de la **primera conversión de unidad de consumo**
de un tenant ("Convertir unidad" en la edición de un insumo), confirmar que todos sus
dispositivos ya cargaron la versión nueva (abrir la app una vez con red). Una versión anterior no
conoce el factor de conversión y mostraría el stock sin convertir.

**Spec 016 (tratamientos y costo por tratamiento):** mismo orden (respaldo → `db push` → front).
La migración solo agrega tablas y la columna opcional `movimientos.tratamiento_realizado_id`, así
que una versión anterior sigue sincronizando: ve los consumos de un tratamiento como consumos
sueltos y no muestra el catálogo ni el historial hasta actualizarse. La barra inferior del celular
cambia (Compras pasa a "Más"); avisar al equipo.

**Spec 017 (reportes y KPIs):** sin migración. Agrega Reportes (en la sidebar y en "Más" en el
celular) y "Valor de inventario" en Inicio. La sincronización ahora pagina las descargas: antes,
pasadas las 1.000 filas por tabla (`max_rows` de PostgREST), un dispositivo nuevo bajaba la
historia truncada sin error. Los dispositivos ya instalados recuperan lo que les faltara en su
primera sincronización con la versión nueva.

**Release 2.4.0 (specs 015, 016 y 017):** un solo `supabase db push --linked` aplica las
migraciones `20261021000000_unidades_y_costo` y `20261022000000_tratamientos`, en ese orden.
Respaldo → `db push` → merge a `main`.

**Specs 018, 019 y 020 (detalles de alertas, Ajustes por secciones, paginación):** sin migración.
Ajustes pasa a un índice de secciones (con URL propia, `#ajustes/<sección>`) y las listas largas se
paginan con "Ver más" (páginas numeradas en la tabla de desktop).

**Spec 021 (proveedores):** migración `20261023000000_proveedores` y Dexie v13. Crea un proveedor por
cada nombre distinto de `lotes.proveedor` y asocia todos los lotes (la migración aborta si cambia la
cantidad de lotes o alguno queda sin proveedor); elimina `configuracion_clinica`. Antes de publicar:
`npm run proveedores -- listar` sobre la restauración del respaldo, enviar la lista a la clienta y,
después del `db push`, aplicar sus fusiones con `npm run proveedores -- fusionar … --ensayo` y luego sin
`--ensayo` (con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de producción; pide confirmar). Una 2.4.0
en caché sigue registrando el proveedor como texto: el trigger `resolver_proveedor_lote` lo asocia por
nombre. Cuando todos los dispositivos muestren 2.5.0, se puede retirar el texto (backlog).

**Spec 022 (compras: selección, subtotal y WhatsApp):** migración `20261024000000_saludo_pedido`
(una columna en `configuracion_alertas`), sin versión nueva de Dexie. Corrige además la subida de
`items_compra`, que fallaba entera en cada ciclo en dispositivos con ítems de otra persona.

**Release 2.5.0 (specs 018–022):** un solo `supabase db push --linked` aplica
`20261023000000_proveedores` y `20261024000000_saludo_pedido`, en ese orden. Respaldo → `db push` →
fusiones de proveedores → merge a `main`. Ensayado el 2026-10-24 sobre la restauración del respaldo
del 2026-10-22 (con 015 y 016 encima): 77 lotes antes y después, ninguno sin proveedor, 12
proveedores sin claves repetidas.

**Spec 023 (marcas):** migración `20261025000000_marcas` y Dexie v14, sin cambios de datos (los insumos
existentes quedan sin marca). `insumos.marca_id` se fija en el alta y después solo lo cambia un
`cambios_insumo` con `campo = 'marcaId'` (solo administración): `proteger_catalogo_insumo` lo conserva
en todo UPDATE. Por eso una 2.5.0 en caché, que no manda la columna, o un dispositivo recién
actualizado que sube sus insumos antes del primer pull, no borran la marca (casos de `test:rls`).

**Release 2.6.0 (spec 023):** respaldo → `supabase db push --linked` (aplica
`20261025000000_marcas`) → comprobar que la 2.5.0 publicada sigue sincronizando → merge a `main`. Si el
front falla, se revierte solo el front: la 2.5.0 convive con el servidor nuevo. Ensayado el 2026-10-24
sobre la restauración del respaldo del 2026-10-24 con 021, 022 y 023 encima: 73 insumos (todos sin
marca), 77 lotes (ninguno sin proveedor), 12 proveedores y los 28 cambios del historial, igual que
antes.

## ¿Quedó bien configurado mi entorno?

Checklist manual (sin script) — cada punto debe poder confirmarse a simple vista en menos de 2
minutos:

- [ ] `npm install` terminó sin errores en la terminal.
- [ ] `npm run dev` muestra `VITE ... ready` y una URL local.
- [ ] Esa URL abre en el navegador y muestra el texto "inDENTory".
- [ ] La consola del navegador no muestra errores en rojo (una advertencia amarilla de backend no
      configurado es esperada si no creaste un `.env`).
- [ ] `npm run lint`, `npm run test` y `npm run build` terminan cada uno sin errores.
