# Research: Multi-tenant y Lugares de Trabajo

**Feature**: 014-multi-tenant-y-lugares-de-trabajo | **Date**: 2026-10-18

Hallazgos sobre el esquema actual (`supabase/migrations/20261017000000_baseline.sql` y las
migraciones posteriores), el ciclo de sync (`src/lib/sync/index.ts`) y Dexie (`src/lib/db`), y las
decisiones que resuelven cada punto del plan.

## R1 · Modelo de tenancy: `perfiles` es la membresía

**Hallazgo**: `perfiles(id, nombre, rol)` ya es "un usuario, un rol" y lo leen `es_administrador()`,
los triggers de catálogo y el login (`fetchPerfilPropio`). La spec fija que un usuario pertenece a un
solo tenant.

**Decisión**:
- Tablas nuevas `tenants(id, nombre, creado_en)` y `lugares(id, tenant_id, nombre, desactivado_en,
  creado_en)`, con nombre único por tenant (sin distinguir mayúsculas).
- `perfiles` gana `tenant_id` (obligatorio) y `desactivado_en`, y pasa a ser la membresía (usuario ↔
  tenant ↔ rol ↔ estado).
- Queda preparado para el acceso por lugar (aclaración 1): una tabla futura `accesos_lugar(usuario_id,
  lugar_id)` donde "sin filas = todos los lugares". No se crea ahora.

**Alternativa descartada**: una tabla `membresias` aparte. Duplicaría el rol, obligaría a reescribir
`es_administrador()`, los triggers y el login, y no aporta nada mientras haya un tenant por usuario.

## R2 · RLS por tenant con una función de contexto

**Decisión**:
- Funciones `security definer`, `stable` y con `search_path = public` (como las de
  `20261018000000_endurecer_funciones.sql`):
  - `tenant_actual()`: devuelve el `tenant_id` del perfil de `auth.uid()` si no está desactivado; si
    no, `null`;
  - `es_administrador(uid)`: además exige que el perfil no esté desactivado.
- **Todas** las tablas de negocio (`insumos`, `categorias`, `cambios_insumo`, `lotes`,
  `movimientos`, `items_compra`, `configuracion_alertas`, `minimos_lugar`, `lugares`, `tenants`)
  ganan `tenant_id not null default tenant_actual()`.
- Las políticas `using (true)` se reemplazan por `tenant_id = tenant_actual()` en `select`, y por lo
  mismo más las reglas actuales (autor = `auth.uid()`, solo administrador) en `insert`/`update`.
- Consistencia lugar ↔ tenant: FK compuesta `(lugar_id, tenant_id) → lugares(id, tenant_id)`, de modo
  que una fila no puede apuntar a un lugar de otro tenant aunque el cliente lo intente.
- Un usuario desactivado tiene `tenant_actual() = null`, así que no lee ni escribe nada (FR-021).

**Compatibilidad con clientes 2.2.0 en caché**: no envían `tenant_id` ni `lugar_id`. Los `default`
(`tenant_actual()` y el lugar principal, ver R3) los completan, y sus `select('*')` ya vienen
filtrados por RLS. Así siguen funcionando durante la transición.

## R3 · Lotes y movimientos: el lugar va en el movimiento

**Hallazgo**: el stock de un lote es la suma de sus movimientos (`computeStockLote`). El traslado
(aclaración 2) tiene que mover stock del **mismo lote** (número, proveedor, caducidad) entre lugares,
para conservar la trazabilidad (Constitución IV).

**Decisión**:
- `movimientos.lugar_id` (obligatorio) es la fuente de verdad: el stock de un lote en un lugar es la
  suma de sus movimientos en ese lugar.
- `lotes.lugar_id` es el **lugar de alta** del lote; sirve para mostrarlo en el lugar donde se creó
  aunque todavía no tenga movimientos.
- Un lote "está" en un lugar si se creó ahí o si tiene movimientos ahí.
- `items_compra.lugar_id` es obligatorio (lista de compras por lugar, FR-006).
- `default` del servidor para clientes viejos: un trigger `before insert` completa `lugar_id` con el
  lugar principal del tenant (el más antiguo activo) cuando viene `null`.

**Alternativa descartada**: crear en el destino un lote "espejo" con los mismos datos. Duplica la
identidad del lote, complica el historial y deshacer el traslado.

## R4 · Traslados como par de movimientos atómico

**Decisión**:
- `movimientos.tipo` admite `traslado_salida` (lugar origen, resta) y `traslado_entrada` (lugar
  destino, suma). Ambos comparten `traslado_id`, tienen la misma cantidad y el mismo lote.
  `computeStockLote` los suma o resta como hoy hace con consumo e ingreso.
- **Atomicidad en el dispositivo**: los dos movimientos se escriben en una sola transacción de Dexie.
- **Atomicidad en el servidor**: un trigger de restricción `deferrable initially deferred` exige, al
  final de cada transacción, que cada `traslado_id` tenga exactamente una salida y una entrada, del
  mismo lote y cantidad, en lugares distintos del mismo tenant. Si falta una mitad, el commit falla y
  no queda nada a medias (FR-023, SC-008).
- **Sync**: `pushMovimientos` sube los pares en el mismo `upsert`, que es una transacción. El
  reintento fila por fila (spec 012) trata cada par como una unidad, sin separarlo.
- **Deshacer**: un traslado inverso (`traslado_salida` en el destino y `traslado_entrada` en el
  origen) con `movimiento_origen_id` apuntando a la salida original. Es el mismo patrón que deshacer
  un consumo (spec 007, que usa un `ajuste` con `movimiento_origen_id`).
- **Validación**: no se puede trasladar más que el stock del lote en el origen. Se reutiliza la
  validación de sobreconsumo.

## R5 · Invitaciones con enlace propio, sin servidor de correo

**Hallazgo**:
- El correo integrado de Supabase en plan gratuito solo envía a miembros del equipo del proyecto.
  Invitar a terceros por correo exige configurar un SMTP propio (proveedor externo, cuenta y clave).
- El enlace de invitación nativo de Auth (`inviteUserByEmail`) vence según el OTP, como máximo en
  24 h, y la spec pide 7 días.

**Decisión**:
- **Invitación propia**: tabla `invitaciones(id, tenant_id, correo, rol, token_hash, invitado_por,
  vence_en, estado, creado_en)`. Al crearla, la app muestra el enlace `…/?invitacion=<token>`, que la
  administradora envía por **correo, WhatsApp o copia** (botones "Enviar por correo" con `mailto:`,
  "WhatsApp" y "Copiar"). El token es aleatorio de 32 bytes y solo se guarda su hash.
- **Aceptación**: una Edge Function `aceptar-invitacion` con service role:
  - valida el token (pendiente y vigente) y que el correo no pertenezca a otro tenant;
  - crea el usuario en Auth (`admin.createUser` con `email_confirm`, la contraseña elegida y la
    política de contraseñas existente) y su `perfil` con tenant, rol y nombre;
  - marca la invitación como aceptada.

  Después la app inicia sesión normalmente.
- **Creación y revocación** vía RPC con RLS (solo administrador del tenant). No hace falta Edge
  Function porque no se crean usuarios.
- **Alta de tenant** (FR-003): `scripts/alta-tenant.mjs` (service role, solo para First Steps)
  crea el tenant, su primer lugar y la invitación de la administradora, e imprime el enlace.
  Reutiliza el mismo flujo de aceptación.

**Ajuste a la spec**: FR-019 decía "invitar por correo". Ahora la invitación es un enlace que la
administradora envía por correo, WhatsApp o copia. El resultado para la invitada es el mismo y no
depende de configurar un SMTP. La spec se actualiza.

**Alternativa**: SMTP propio con `inviteUserByEmail`. Queda como mejora si se pasa al plan Pro o se
contrata un proveedor de correo.

## R6 · Stock mínimo por lugar

**Decisión**: tabla `minimos_lugar(tenant_id, insumo_id, lugar_id, stock_minimo)` con PK
`(insumo_id, lugar_id)`. El mínimo efectivo en un lugar es el del lugar si existe y, si no, el de
`insumos.stock_minimo` (FR-007). `computeInsumosStockBajo` recibe el lugar y el mapa de mínimos.
Editar el mínimo en Ajustes, con un lugar activo, escribe en `minimos_lugar`. Solo lo hace un
administrador, igual que hoy.

## R7 · Configuración: nombre del tenant y del lugar

**Decisión**:
- `configuracion_alertas` pasa de una fila `'global'` a una fila por tenant (PK `tenant_id`).
  Localmente la fila conserva `id: 'global'`, porque Dexie es por tenant (R8).
- `configuracion_clinica.nombre` se migra a `lugares.nombre` del lugar 1 y a `tenants.nombre`. El
  chip de la barra muestra el lugar activo, y Ajustes → Clínica pasa a "Lugares de trabajo".
- La tabla `configuracion_clinica` se conserva una versión, con RLS por tenant, para no romper a los
  clientes 2.2.0, y se elimina en la spec siguiente.

## R9 · Migración de datos del servidor

**Decisión**: una migración `20261020000000_multi_tenant.sql`, en una transacción:
1. Crea `tenants` y `lugares`, y siembra **tenant 1** y **lugar 1** con UUID fijos y conocidos
   (`00000000-0000-4000-8000-000000000001` / `…0011`). Toma los nombres de
   `configuracion_clinica.nombre` o, si no hay, de "Clínica".
2. Agrega las columnas `tenant_id` y `lugar_id` como `null`, las rellena con tenant 1 / lugar 1 y
   luego las pasa a `not null` con FK.
3. Hace lo mismo con `perfiles.tenant_id`: todos los usuarios actuales quedan en tenant 1 con su rol.
4. Agrega funciones, triggers (lugar por defecto, par de traslado) y políticas nuevas, y elimina las
   políticas `using (true)`.

Se prueba sobre una restauración del respaldo de producción, como la migración de la 012, y se
verifican los conteos antes y después y el aislamiento con un tenant 2 de prueba.

## R8 · Dexie v10: datos locales por tenant

**Decisión**:
- Todas las tablas sincronizadas ganan `tenantId` (y `lugarId` donde corresponde) con índices.
- Tablas nuevas: `lugares` (sincronizada), `minimosLugar` (sincronizada), `invitaciones` (solo para
  la administradora, no offline) y `lugarActivo` (local, fila única).
- **Upgrade**: las filas existentes reciben `tenantId = TENANT_1` y `lugarId = LUGAR_1`, los UUID
  fijos de R9. Así los pendientes de la versión 2.2.0 suben al lugar 1 (FR-018).
- **Aislamiento local (FR-004)**: todos los stores y el ciclo filtran por el `tenantId` del usuario
  con sesión. Al iniciar sesión con un usuario de **otro** tenant, se borran las filas **ya
  sincronizadas** de los otros tenants (se pueden volver a bajar) y se conservan sus pendientes, que
  quedan ocultos hasta que su dueño vuelva a entrar (spec 012).
- Verificación en Chromium real con el build 2.2.0 y luego el de la rama, como la v8 y la v9.

## R10 · Lugar activo y vista "Todos"

**Decisión**:
- `lugarStore` (Zustand) guarda `lugarActivoId: string | 'todos'`, persistido en Dexie
  `lugarActivo`. El valor inicial es el lugar principal si hay uno solo, o el último usado.
- Los selectores de inventario y alertas reciben `lugarId | 'todos'`, y las funciones puras
  (`computeStockLote`, `computeEstadoInsumo`, `computeInsumosStockBajo`, `computeAlertasCaducidad`,
  `computeItemsSugeridos` y `resumenInicio`) filtran movimientos y lotes por lugar. En "Todos"
  agregan por lugar y devuelven el lugar en cada fila (FR-013).
- En "Todos", "Consumir 1", el alta, el ingreso, la recepción y el traslado abren primero un
  selector de lugar (FR-014).

## R11 · Pruebas

- **`test:rls`** se amplía con dos tenants (A y B, cada uno con administrador y personal) y dos
  lugares en A. Debe cubrir:
  - 0 lecturas y escrituras cruzadas en cada tabla;
  - FK compuesta: una fila de A no puede apuntar a un lugar de B;
  - par de traslado incompleto rechazado;
  - usuario desactivado sin acceso;
  - invitación: crear y revocar solo como administrador; aceptar con token vencido, revocado o de un
    correo de otro tenant da error.
- **Unitarias**: funciones puras por lugar y "Todos", traslado (validación, par atómico en Dexie,
  deshacer), sync de pares, upgrade de Dexie v10 y filtro por tenant.
- **Integración**: selector de lugar (oculto con uno solo), cambio de lugar, "Todos" con pedido de
  lugar, gestión de lugares, equipo e invitaciones (aceptación con la Edge Function simulada).
- **Edge Function**: prueba con `supabase functions serve` contra Supabase local en `test:rls`.
- **Migración**: ensayo sobre la restauración del respaldo de producción (script de la 2.2.0).
