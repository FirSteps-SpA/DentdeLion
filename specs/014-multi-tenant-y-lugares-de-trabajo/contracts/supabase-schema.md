# Contract: Esquema, RLS, Edge Function y scripts

**Feature**: 014-multi-tenant-y-lugares-de-trabajo

## Migración `supabase/migrations/20261020000000_multi_tenant.sql`

Va en una sola transacción y en este orden (research.md R9):

1. Crea `tenants`, `lugares` y `minimos_lugar`, y siembra `TENANT_1` y `LUGAR_1` con el nombre de
   `configuracion_clinica` (o "Clínica").
2. Agrega `tenant_id` (y `lugar_id` donde corresponde, ver data-model.md) como `null`, hace backfill
   y luego `not null`, con FK y FK compuestas `(lugar_id, tenant_id)`.
3. `perfiles.tenant_id = TENANT_1` para todos, y agrega `desactivado_en`.
4. Cambia la PK de `configuracion_alertas` a `tenant_id`.
5. `movimientos`: amplía el check de `tipo`, agrega `traslado_id` y el índice `(traslado_id)`.
6. Crea las funciones y triggers de data-model.md y la tabla `invitaciones` con sus RPC.
7. Elimina todas las políticas `using (true)` y `with check (true)`, y crea las políticas por tenant.

| Tabla | select | insert | update | delete |
|---|---|---|---|---|
| `tenants` | `id = tenant_actual()` | service role | administrador (solo `nombre`) | — |
| `lugares` | tenant | administrador | administrador | — |
| `perfiles` | propio perfil, o todo el tenant si es administrador | service role (Edge Function / script) | administrador del tenant (`rol`, `desactivado_en`, `nombre`); triggers de protección | — |
| `insumos` | tenant | tenant | tenant (trigger de catálogo actual) | — |
| `categorias`, `cambios_insumo` | tenant | administrador y autor = `uid` (como hoy) | administrador | — |
| `lotes` | tenant | tenant | tenant (trigger de resolución actual) | — |
| `movimientos` | tenant | tenant y autor = `uid` | — | — |
| `items_compra` | tenant | tenant y autor = `uid` | tenant | — |
| `minimos_lugar`, `configuracion_alertas` | tenant | administrador | administrador | — |
| `invitaciones` | administrador del tenant | RPC `crear_invitacion` | RPC `revocar_invitacion` | — |

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
tiene perfil en el **mismo** tenant, se reactiva. Todo con service role y en una transacción, con un
RPC interno `consumir_invitacion`. La app inicia sesión después con el correo y la contraseña.

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
| `traslado_salida` sin su `traslado_entrada` en la misma transacción | Rechazado al confirmar |
| Par de traslado completo entre los dos lugares de A | OK; el stock por lugar es correcto |
| Personal de A crea un lugar o una invitación | Rechazado |
| Desactivar el último lugar o la última administradora | Rechazado |
| Usuario de A desactivado | 0 filas en todo |
| Cliente sin `tenant_id` ni `lugar_id` (forma 2.2.0) inserta un movimiento | Queda en su tenant y en el lugar principal |
| Aceptar invitación: vigente / vencida / revocada / correo de otro tenant | OK / `invitacion_vencida` / `invitacion_invalida` / `correo_en_otro_tenant` |
