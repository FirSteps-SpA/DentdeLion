# Contract: Esquema, RLS, Edge Function y scripts

**Feature**: 014-multi-tenant-y-lugares-de-trabajo

## Migración `supabase/migrations/20261020000000_multi_tenant.sql`

Va en una sola transacción y en este orden (research.md R9):

1. Crea `tenants`, `lugares` y `minimos_lugar`, y siembra `TENANT_1` y `LUGAR_1` con el nombre de
   `configuracion_clinica` (o "Clínica").
2. Agrega `tenant_id` (y `lugar_id` donde corresponde, ver data-model.md) como `null`, hace backfill
   y luego `not null`, con FK y FK compuestas `(lugar_id, tenant_id)`, `(insumo_id, tenant_id)` y
   `(lote_id, tenant_id)`, de modo que ninguna referencia cruce tenants.
3. `perfiles.tenant_id = TENANT_1` para todos, y agrega `desactivado_en`.
4. Cambia la PK de `configuracion_alertas` a `tenant_id`.
5. `movimientos`: amplía el check de `tipo`, agrega `traslado_id` y el índice `(traslado_id)`.
6. Crea las funciones y triggers de data-model.md y la tabla `invitaciones` con sus RPC.
7. Elimina todas las políticas `using (true)` y `with check (true)`, y crea las políticas por tenant.

| Tabla | select | insert | update | delete |
|---|---|---|---|---|
| `tenants` | `id = tenant_actual()` | service role | administrador (solo `nombre`) | — |
| `lugares` | tenant | administrador | administrador | — |
| `perfiles` | propio perfil **siempre** (`id = auth.uid()`, aunque esté desactivado), o todo el tenant si es administrador | service role (Edge Function / script) | administrador del tenant (`rol`, `desactivado_en`, `nombre`); triggers de protección | — |
| `insumos` | tenant | tenant | tenant (trigger de catálogo actual) | — |
| `categorias`, `cambios_insumo` | tenant | administrador y autor = `uid` (como hoy) | administrador | — |
| `lotes` | tenant | tenant; o pendiente previo a la desactivación | tenant (trigger de resolución actual) | — |
| `movimientos` | tenant | tenant y autor = `uid`; o pendiente previo a la desactivación | — | — |
| `items_compra` | tenant | tenant y autor = `uid` | tenant | — |
| `minimos_lugar`, `configuracion_alertas` | tenant | administrador | administrador | — |
| `invitaciones` | administrador del tenant | RPC `crear_invitacion` | RPC `revocar_invitacion` | — |
| `equipo_tenant` (vista) | administrador del tenant | — | — | — |

"Pendiente previo a la desactivación" significa `usuario_id = auth.uid()`, `tenant_id = tenant_del_perfil()`
y `creado_en < desactivado_en` del perfil (FR-021, data-model.md).

**RPC públicos**: solo `ver_invitacion(token)` admite `anon`. Devuelve `{correo, tenant}` para una
invitación pendiente y vigente, y nada en cualquier otro caso, sin distinguir si el token no existe,
venció o fue revocado.

"tenant" significa `tenant_id = tenant_actual()`. Las columnas `default tenant_actual()` permiten que
los clientes 2.2.0 sigan escribiendo durante la transición (R2).

## Edge Function `supabase/functions/aceptar-invitacion`

`POST { token, nombre, password }` sin sesión. Responde `200 { correo }` o
`4xx { codigo, mensaje }`.

| Código | Cuándo |
|---|---|
| `invitacion_invalida` | El token no existe o fue revocado |
| `invitacion_vencida` | `vence_en < now()` |
| `correo_en_otro_tenant` | El correo ya tiene perfil en otro tenant |
| `password_debil` | Auth rechaza la contraseña (política: 10+ caracteres, letras y dígitos) |

Si el correo ya tiene un usuario de Auth **sin** perfil, se le asigna el perfil y la contraseña. Si
tiene perfil en el **mismo** tenant, se reactiva. Con service role, primero crea o actualiza el
usuario en Auth y después llama al RPC `consumir_invitacion`, que en una transacción marca la
invitación y crea el perfil. Los dos pasos no son atómicos, pero reintentar es seguro: un usuario de
Auth sin perfil se completa en el siguiente intento. La app inicia sesión después con el correo y la
contraseña.

## Script `scripts/alta-tenant.mjs`

`node scripts/alta-tenant.mjs --nombre "Clínica X" --lugar "Sede Centro" --admin correo@x.cl`, con
service role desde `supabase status` (local) o con variables de entorno (producción).
- Crea el tenant, el lugar y una invitación de administrador, e imprime el enlace.
- En producción pide confirmación interactiva.

## `test:rls`: casos nuevos

Dos tenants (A y B), cada uno con administrador y personal, y dos lugares en A.

| Caso | Esperado |
|---|---|
| Usuario de B lee insumos, lotes, movimientos, compras, categorías, lugares o perfiles de A | 0 filas |
| Usuario de B inserta o actualiza una fila con `tenant_id` de A | Rechazado |
| Fila de A con `lugar_id` de un lugar de B | Rechazado (FK compuesta) |
| Lote de A con `insumo_id` de B, o movimiento de A con `lote_id` de B | Rechazado (FK compuesta) |
| `traslado_salida` sin su `traslado_entrada` en la misma transacción | Rechazado al confirmar |
| Par de traslado completo entre los dos lugares de A | OK; el stock por lugar es correcto |
| Personal de A crea un lugar o una invitación | Rechazado |
| Desactivar el último lugar o la última administradora | Rechazado |
| Usuario de A desactivado | 0 filas en todo salvo su propio perfil (con `desactivado_en`) |
| Usuario desactivado sube un movimiento con `creado_en` anterior / posterior a `desactivado_en` | Aceptado / rechazado |
| `ver_invitacion` sin sesión con token vigente / vencido / inventado | `{correo, tenant}` / nada / nada |
| `equipo_tenant` como administrador / como personal | Perfiles del tenant con correo / 0 filas |
| Cliente sin `tenant_id` ni `lugar_id` (forma 2.2.0) inserta un movimiento | Queda en su tenant y en el lugar principal |
| Aceptar invitación: vigente / vencida / revocada / correo de otro tenant | OK / `invitacion_vencida` / `invitacion_invalida` / `correo_en_otro_tenant` |
