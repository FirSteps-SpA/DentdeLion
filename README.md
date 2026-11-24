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

**Spec 024 (descarte de vencidos y ajuste de stock por lote):** sin migración ni versión nueva de
Dexie. Los descartes y las correcciones son movimientos `ajuste` sin `movimiento_origen_id` (las
anulaciones de consumo sí lo llevan), que el servidor ya aceptaba. Al recibir desde Compras, una
casilla marcada por defecto deja en 0 los lotes vencidos del lugar. En Editar, administración corrige
el stock de cada lote y puede eliminar el insumo. Una 2.6.0 en caché ya suma estos ajustes al stock:
solo no muestra la casilla, la sección ni la línea del historial.

**Release 2.7.0 (spec 024 y plural de unidades):** solo front, sin `db push`. Merge a `main` y
comprobar en un dispositivo que el caso reportado (reponer un insumo vencido) deja el insumo fuera de
Compras. Si el front falla, se revierte sin tocar el servidor.

**Release 2.8.0 (ganancia del profesional y próximos vencimientos):** solo front, sin `db push` ni
cambios de datos. En Tratamientos, Historial y Reportes el dato principal pasa a ser la ganancia del
profesional (precio × % profesional, calculada desde el snapshot de cada registro, así que vale para
los registros antiguos); el neto tras materiales (antes "Ganancia estimada") queda como dato
adicional. En Inicio, "Próximos vencimientos" ya no repite los lotes caducados de Alertas. Merge a
`main` y comprobar en un dispositivo el detalle de un tratamiento y la tarjeta de Reportes. Si el
front falla, se revierte sin tocar el servidor.

**Spec 025 ("Consumir" sin atajo):** solo front, sin `db push` ni cambios de datos. El botón
"Consumir 1" de Inventario pasa a "Consumir" y abre la hoja de consumo con cantidad 1; ya no hay
consumo de un toque ni "Consumir otra cantidad" en el menú. La hoja propone el lote vigente más
próximo a vencer (antes podía proponer uno vencido) y marca "Lote vencido" si solo queda stock
vencido. El aviso con "Deshacer" muestra la cantidad real. Avisar al equipo del cambio. Una 2.8.0 en
caché sigue mostrando "Consumir 1" y escribe los mismos movimientos, así que conviven. Comprobar en
un teléfono que al abrir la hoja "Confirmar consumo" queda a la vista (sin teclado) y que consumir 1
toma 2 toques. Si el front falla, se revierte sin tocar el servidor.

**Spec 026 (categorías de tratamientos y % por categoría):** **con migración**
(`20261123000000_categorias_tratamiento.sql`). Orden: respaldo de producción (`respaldo.sh`), ensayo de
la migración sobre su restauración (cada tenant con 9 categorías y el resto de las filas igual),
`supabase db push` **con visto bueno explícito** y comprobación en producción (9 categorías por
tenant), y recién después el front. El ensayo sobre el respaldo del 2026-11-23 dio 412 filas antes y
421 después (las 9 categorías de Clínica Denart); producción todavía no tenía tratamientos ni
registros. Mientras un dispositivo tenga una versión anterior en caché, no ve categorías y sus
registros llevan el % general del lugar, aunque la categoría tenga uno propio: avisar al equipo que
actualice. En Ajustes, "Categorías" pasa a llamarse "Categorías de insumos".

**Spec 027 (rediseño visual):** solo front, sin `db push` ni cambios de datos. Barra lateral con el
activo en turquesa lleno y el diente al pie, pastillas para el lugar y la sincronización, ondas de
fondo, tarjetas con íconos de fondo, encabezados y estados vacíos comunes en todas las vistas. Inicio
ya no tiene la tarjeta "¿Qué necesitas comprar?" (queda la KPI "Para comprar"). Nada cambia de lugar
ni de comportamiento; avisar al equipo del cambio de apariencia.

**Spec 028 (paciente en cada tratamiento realizado):** **con migración**
(`20261124000000_pacientes_registro.sql`, va después de la de la 026). Orden: respaldo, ensayo,
`supabase db push` **con visto bueno explícito**, y luego el front. El ensayo de las migraciones 026 y
028 sobre el respaldo del 2026-11-23 dio 412 → 421 filas (las 9 categorías; `pacientes_registro`
vacía). Es un **dato de salud**: antes de anunciarlo a la clienta, revisar con asesoría legal las
obligaciones de la ley de protección de datos. Solo lo ven quien registró y la administración; al
cerrar sesión se borran del dispositivo los ya subidos. Incluye además un arreglo de la 027: en el
teléfono, la barra inferior tapaba el pie de las hojas.

**Release 2.9.0 (specs 025–028):** **con migraciones**. Un solo `supabase db push --linked` aplica
`20261123000000_categorias_tratamiento` (026) y `20261124000000_pacientes_registro` (028), en ese
orden. Pasos:

1. Respaldo de producción (`respaldo.sh`).
2. `supabase db push --linked` (**con visto bueno explícito**) y comprobar en producción: cada tenant
   con 9 categorías de tratamientos, `pacientes_registro` vacía y el resto de las tablas con los
   mismos conteos que el respaldo.
3. Comprobar que la 2.8.0 publicada sigue sincronizando contra el servidor nuevo (ignora los campos
   nuevos y registra con el % general).
4. Merge del PR `release/2.9.0` a `main` (Netlify publica el front), tag `2.9.0` y merge de vuelta a
   `develop`.
5. Comprobar en un teléfono: "Consumir" abre la hoja con 1; las hojas no quedan tapadas por la barra
   inferior; Ajustes → Categorías de tratamientos con las 9; un registro con categoría y % propio;
   el rediseño en Inicio.
6. Avisar al equipo: "Consumir 1" pasa a "Consumir", categorías de tratamientos con % por lugar, el
   cambio de apariencia y que actualice la app (una versión en caché registra con el % general y sin
   categoría ni paciente).

Ensayado el 2026-11-23 sobre la restauración del respaldo del 2026-11-23: 412 filas antes, 421
después (las 9 categorías de Clínica Denart), `pacientes_registro` vacía y el resto igual. Si el
front falla, se revierte solo el front: la 2.8.0 convive con el servidor nuevo. **Spec 028**: el
paciente es un dato de salud; revisar con asesoría legal antes de anunciarlo a la clienta.

**Spec 029 (estimación de materiales con IA):** **con migración**
(`20261125000000_estimaciones_ia.sql`, solo agrega la tabla `estimaciones_ia` y la función
`reservar_estimacion`; ningún dato existente cambia) y **una Edge Function nueva**,
`estimar-materiales`, que llama a Claude (`claude-opus-5-5`). Orden:

1. Respaldo y `supabase db push --linked` (**con visto bueno explícito**).
2. En la consola de Anthropic: crear la clave de API para DentdeLion y fijar un **tope de gasto
   mensual**. Guardarla como secreto: `supabase secrets set ANTHROPIC_API_KEY=… --project-ref …`
   (nunca en el repositorio ni en `.env` versionado).
3. `supabase functions deploy estimar-materiales`.
4. Front. Sin la clave, el botón responde "La estimación no está disponible" y nada más se afecta.

Límite: 20 estimaciones por cliente por día (medianoche de Chile), reservadas antes de llamar a la
IA; cada una queda en `estimaciones_ia` (quién, cuándo, resultado; nunca la respuesta). A la IA solo
van el nombre del tratamiento y el nombre, unidad y presentación de los materiales (sin pacientes,
precios ni stock). Probar en local sin costo con `supabase functions serve` sin clave
(`npm run test:rls`); una prueba real cuesta y requiere visto bueno.

**Spec 030 (guía de uso):** solo front, sin `db push` ni cambios de datos. Botón "?" en el
encabezado de las 7 vistas y de las 8 secciones de Ajustes, con la ayuda de esa pantalla (filtrada
por rol), y Ajustes → "Guía de uso" con todas. Los textos están en
`src/features/ayuda/contenido.ts`: **la clienta los revisa antes del release**. La primera vez que
cada persona entra a cada pantalla en un dispositivo, la ayuda se abre sola (se recuerda en
`localStorage`, no se sincroniza): avisar al equipo que, al actualizar, verá esas ayudas una vez.

**Historial sin tratamientos deshechos (PR #29) e Inicio con la ganancia del mes (PR #30):** solo
front. Los registros anulados con "Deshacer" ya no se listan (siguen en la base). Inicio muestra la
ganancia del profesional del mes en vez del valor de inventario, que pasa a Reportes; "Este mes" se
compara con los mismos días del mes anterior.

**Release 2.10.0 (specs 029 y 030, PR #29 y #30):** **con migración** y **una Edge Function nueva**.
Pasos:

1. Respaldo de producción (`respaldo.sh`).
2. `supabase db push --linked` (**con visto bueno explícito**): aplica solo
   `20261125000000_estimaciones_ia` (tabla `estimaciones_ia` y función `reservar_estimacion`; ningún
   dato existente cambia). Comprobar en producción: 21 tablas, `estimaciones_ia` vacía y el resto con
   los mismos conteos que el respaldo.
3. Clave de **producción** de Anthropic (distinta de la local) con tope de gasto mensual en la
   consola; `supabase secrets set ANTHROPIC_API_KEY=… --project-ref <ref>`.
4. `supabase functions deploy estimar-materiales --project-ref <ref>`; comprobar que sin sesión
   responde `sin_sesion` (sin gastar).
5. Merge del PR `release/2.10.0` a `main` (Netlify publica el front), tag `2.10.0` y merge de vuelta
   a `develop`.
6. Comprobar en un teléfono: la ayuda de Inicio se abre sola una vez; "?" en cada pantalla; Ajustes →
   "Guía de uso"; Inicio con la ganancia del mes; Reportes con el valor de inventario; el historial
   sin deshechos; como administración, una estimación real en un tratamiento (cuenta para el límite
   de 20 diarias).
7. Avisar al equipo: la ayuda se abrirá sola una vez en cada pantalla; Inicio muestra la ganancia del
   mes; los tratamientos deshechos ya no aparecen; la administración puede sugerir cantidades con IA.

Antes del release, **la clienta revisa los textos de la guía** (`src/features/ayuda/contenido.ts`).

Ensayado el 2026-11-23 sobre la restauración de un respaldo de producción tomado después de la
2.9.0 (20 tablas, 421 filas): la migración agrega `estimaciones_ia` (21 tablas), las 421 filas
quedan iguales, `authenticated` no puede ejecutar `reservar_estimacion` y la reserva acepta 20 y
rechaza la 21. Una 2.9.0 en caché sigue funcionando con el servidor nuevo (no usa la tabla ni la
función). Si el front falla, se revierte solo el front.

**Spec 031 (administración de la plataforma):** **con migración**
(`20261126000000_administracion_plataforma.sql`) y **una Edge Function nueva**, `plataforma`. La
migración quita las FKs de historial a `auth.users` (para poder borrar una cuenta conservando sus
registros) y agrega tablas y funciones nuevas; ningún dato existente cambia. Orden: respaldo, ensayo
sobre la restauración, `supabase db push` (**con visto bueno explícito**), `supabase functions deploy
plataforma`, front. Después, agregar la cuenta del operador **a mano** (nunca en una migración: el
repositorio es público):

```sql
insert into public.administradores_plataforma (usuario_id)
select id from auth.users where lower(email) = lower('<correo del operador>');
```

El panel aparece en Ajustes → "Plataforma" solo para esas cuentas. Eliminar un cliente es
**irreversible**: el panel descarga antes un respaldo JSON. Las acciones quedan en
`auditoria_plataforma` (solo service role). El script `npm run alta-tenant` sigue como alternativa.

**Release 2.11.0 (spec 031):** **con migración** y **una Edge Function nueva**. Pasos:

1. Respaldo de producción (`respaldo.sh`).
2. `supabase db push --linked` (**con visto bueno explícito**): aplica solo
   `20261126000000_administracion_plataforma`. Comprobar en producción: 24 tablas (nuevas
   `administradores_plataforma`, `auditoria_plataforma` y `usuarios_eliminados`, vacías), el resto con
   los mismos conteos que el respaldo, y que la única FK de `public` a `auth.users` sea
   `perfiles_id_fkey` en cascada.
3. `supabase functions deploy plataforma --project-ref <ref>`; comprobar que sin sesión responde
   `sin_sesion`.
4. Merge del PR `release/2.11.0` a `main` (Netlify publica el front), tag `2.11.0` y merge de vuelta
   a `develop`.
5. Agregar la cuenta del operador con el SQL de la spec 031 (arriba) y activarle 2FA.
6. Comprobar con esa cuenta: Ajustes → "Plataforma" lista los clientes; con una cuenta de la clínica,
   la tarjeta no aparece.

Ensayado el 2026-11-23 sobre la restauración de un respaldo de producción tomado después de la 2.10.0
y del alta de "First Steps (dev)" (21 tablas, 434 filas): 24 tablas, 434 filas iguales; permisos
correctos; `eliminar_cliente` sobre la clínica en una transacción revertida borró todo y pasó la
verificación; el propio cliente del operador se rechaza. Una 2.10.0 en caché sigue funcionando con el
servidor nuevo (no usa las tablas nuevas; sin la tabla local de eliminados, muestra "otra persona").
Si el front falla, se revierte solo el front.

## ¿Quedó bien configurado mi entorno?

Checklist manual (sin script) — cada punto debe poder confirmarse a simple vista en menos de 2
minutos:

- [ ] `npm install` terminó sin errores en la terminal.
- [ ] `npm run dev` muestra `VITE ... ready` y una URL local.
- [ ] Esa URL abre en el navegador y muestra el texto "inDENTory".
- [ ] La consola del navegador no muestra errores en rojo (una advertencia amarilla de backend no
      configurado es esperada si no creaste un `.env`).
- [ ] `npm run lint`, `npm run test` y `npm run build` terminan cada uno sin errores.
