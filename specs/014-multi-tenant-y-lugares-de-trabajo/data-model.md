# Data Model: Multi-tenant y Lugares de Trabajo

**Feature**: 014-multi-tenant-y-lugares-de-trabajo | **Date**: 2026-10-18

Constantes de migración (research.md R8 y R9):

```text
TENANT_1 = '00000000-0000-4000-8000-000000000001'
LUGAR_1  = '00000000-0000-4000-8000-000000000011'
```

## Servidor (Supabase)

### Tablas nuevas

| Tabla | Columnas | Reglas |
|---|---|---|
| `tenants` | `id uuid pk`, `nombre text`, `creado_en` | La crea solo service role (alta manual, FR-003). Los usuarios leen su propio tenant |
| `lugares` | `id uuid pk`, `tenant_id`, `nombre text`, `desactivado_en`, `creado_en`; `unique (id, tenant_id)` para FK compuestas; índice único `(tenant_id, lower(trim(nombre)))` | Lee el tenant y escribe solo el administrador. No se puede desactivar el último lugar activo (trigger) |
| `minimos_lugar` | `tenant_id`, `insumo_id`, `lugar_id`, `stock_minimo numeric null` (null = usar el del catálogo, así volver al catálogo es un upsert y no un borrado); PK `(insumo_id, lugar_id)`; FK compuestas `(insumo_id, tenant_id)` y `(lugar_id, tenant_id)` | Lee el tenant y escribe solo el administrador |
| `invitaciones` | `id`, `tenant_id`, `correo`, `rol`, `token_hash`, `invitado_por`, `vence_en` (creación + 7 días), `estado` (`pendiente`/`aceptada`/`revocada`), `aceptada_por`, `creado_en` | Solo el administrador del tenant crea, lee y revoca. Solo la acepta la Edge Function (service role). "Vencida" se deriva de `vence_en < now()` |

### Columnas nuevas en tablas existentes

| Tabla | Nuevas | Notas |
|---|---|---|
| `perfiles` | `tenant_id not null`, `desactivado_en` | Es la membresía (R1). Rol sin cambios |
| `insumos`, `categorias`, `cambios_insumo` | `tenant_id not null default tenant_actual()`; `insumos` con `unique (id, tenant_id)` | Catálogo compartido por los lugares del tenant. `cambios_insumo` con FK compuesta `(insumo_id, tenant_id)`. La categoría del insumo es texto, sin FK |
| `lotes` | `tenant_id`, `lugar_id` (lugar de alta); `unique (id, tenant_id)` | FK compuestas `(lugar_id, tenant_id)` e `(insumo_id, tenant_id)` |
| `movimientos` | `tenant_id`, `lugar_id not null`, `traslado_id uuid null`; `tipo` admite `traslado_salida` y `traslado_entrada` | El stock por lugar sale de aquí (R3). FK compuestas `(lugar_id, tenant_id)` y `(lote_id, tenant_id)` |
| `items_compra` | `tenant_id`, `lugar_id not null` | Lista de compras por lugar. FK compuestas `(lugar_id, tenant_id)` e `(insumo_id, tenant_id)` cuando `insumo_id` no es nulo |
| `configuracion_alertas` | `tenant_id` (nueva PK); se quita el check singleton | Una fila por tenant |
| `configuracion_clinica` | `tenant_id` | Se conserva una versión solo por compatibilidad (R7) |

### Funciones y triggers

| Nombre | Qué hace |
|---|---|
| `tenant_actual()` | `tenant_id` del perfil activo de `auth.uid()`, o `null` |
| `es_administrador(uid)` | Rol administrador y perfil no desactivado |
| `lugar_por_defecto()` (trigger `before insert` en `lotes`, `movimientos` e `items_compra`) | Completa `lugar_id` nulo con el lugar activo más antiguo del tenant (clientes 2.2.0) |
| `verificar_traslado()` (constraint trigger `deferrable initially deferred`) | Al cerrar la transacción, cada `traslado_id` tiene una salida y una entrada del mismo lote y cantidad, en lugares distintos del mismo tenant |
| `proteger_ultimo_lugar()` | Impide desactivar el último lugar activo del tenant |
| `proteger_ultimo_admin()` | Impide desactivar o degradar a la última administradora activa |
| `crear_invitacion(correo, rol)` / `revocar_invitacion(id)` | RPC `security definer` para administradores: genera el token, guarda su hash y devuelve el token una sola vez |
| `ver_invitacion(token)` | RPC `security definer` **público** (`anon`): devuelve `{correo, tenant}` solo si el hash coincide con una invitación pendiente y vigente; si no, nada. Es la única función que se puede llamar sin sesión |
| `revisar_invitacion(token_hash)` | Solo service role (Edge Function): `{correo, rol, tenant_id, codigo, usuario_id}`; `codigo` es `invitacion_invalida`, `invitacion_vencida` o `correo_en_otro_tenant`, o `null` si se puede aceptar. Evita listar `auth.users` desde la función |
| `consumir_invitacion(token_hash, uid, nombre)` | Solo service role (Edge Function): marca la invitación aceptada y crea o reactiva el perfil, en una transacción |
| `equipo_tenant()` (RPC `security definer`) | `id`, `nombre`, `correo` (de `auth.users.email`), `rol`, `desactivado_en` de los perfiles del tenant. Solo devuelve filas si `es_administrador(auth.uid())`. Es una función y no una vista para no exponer `auth.users` a `anon` |
| `tenant_del_perfil()` / `desactivado_en_propio()` | `tenant_id` y `desactivado_en` del perfil de `auth.uid()` **aunque esté desactivado**. Solo se usan en la política de pendientes previos a la desactivación |
| `hash_token(token)` | SHA-256 en hex; el mismo cálculo hacen la Edge Function y `scripts/alta-tenant.mjs` |

**Pendientes de un usuario desactivado (FR-021)**: una política extra de `insert` en `lotes` y
`movimientos` acepta filas con `tenant_id` = su tenant y `creado_en < desactivado_en` (en
`movimientos`, además `usuario_id = auth.uid()`). Todo lo demás le devuelve 0 filas, salvo su propio
perfil, que siempre puede leer para que la app detecte la desactivación. El último envío usa INSERT
simple (un 23505 significa "ya estaba arriba"): `ON CONFLICT` exige además la política SELECT, que
un desactivado no pasa.

## Dispositivo (Dexie v10)

| Tabla | Cambio |
|---|---|
| `insumos`, `categorias`, `cambiosInsumo`, `lotes`, `movimientos`, `itemsCompra`, `configuracionAlertas` | `+ tenantId` (índice). `lotes`, `movimientos` e `itemsCompra`: `+ lugarId` (índice). `movimientos`: `+ trasladoId` |
| `lugares` | **Nueva**, sincronizada: `id, tenantId, nombre, desactivadoEn, creadoEn, sincronizado` |
| `minimosLugar` | **Nueva**, sincronizada: `[insumoId+lugarId], tenantId, stockMinimo` (`null` = el del catálogo), `sincronizado` |
| `lugarActivo` | **Nueva**, local: fila `id: 'local'`, `lugarId: string \| 'todos'` |
| `usuarioActual` | `+ tenantId`, `+ desactivadoEn` |

**Upgrade v10**: todas las filas existentes reciben `tenantId = TENANT_1` y, donde corresponde,
`lugarId = LUGAR_1`. `configuracionClinica` se conserva, aunque la interfaz ya no la usa.

**Regla de aislamiento local (FR-004)**: toda lectura filtra por `usuarioActual.tenantId`. Cuando
entra un usuario de otro tenant, se borran las filas sincronizadas de tenants distintos al suyo y se
conservan los pendientes (`sincronizado: false`) de otros usuarios.

## View-models y reglas

- **Vista de un lugar** (`datosDeLugar` / `useInventarioDeLugar`, `src/features/insumos/lib/vistaLugar.ts`):
  en vez de un parámetro de lugar en cada cálculo, las funciones existentes (estado, alertas,
  sugeridos, Inicio) reciben solo los movimientos y lotes del lugar e insumos con su mínimo
  efectivo. "Todos" aplica lo mismo a cada lugar (`useVistasDeLugar`, `porLugar`).

- **Stock de un lote en un lugar** = suma de sus movimientos con ese `lugarId`: `ingreso` y
  `traslado_entrada` suman; `consumo` y `traslado_salida` restan; `ajuste` según su signo, como hoy.
- **Lotes visibles en un lugar**: los de `lote.lugarId = L`, más los que tienen stock distinto de 0
  en L.
- **Mínimo efectivo** del insumo `i` en el lugar `L` = `minimosLugar[i, L]` si existe; si no,
  `insumo.stockMinimo`.
- **"Todos"**: las mismas funciones aplicadas por lugar y concatenadas. Cada fila lleva `lugarId`, y
  los KPIs de Inicio son sumas.
- **Traslado**: `{ trasladoId, loteId, origenId, destinoId, cantidad, usuarioId, creadoEn }`, que
  genera dos `Movimiento`. Validaciones: `origenId ≠ destinoId`, ambos activos y del mismo tenant,
  `0 < cantidad ≤ stock(lote, origen)` y decimales según el insumo.
- **Invitación**: estado `pendiente` → `aceptada` | `revocada`. "Vencida" es `pendiente` con
  `vence_en < ahora`.
