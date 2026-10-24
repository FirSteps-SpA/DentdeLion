# Contract: servidor y sincronización

**Research**: [R1](../research.md#r1--dónde-se-guarda-el-saludo-columna-en-configuracion_alertas),
[R6](../research.md#r6--deuda-subir-los-ítems-de-compra-por-autor-y-si-hace-falta-uno-por-uno)

## Migración `supabase/migrations/20261024000000_saludo_pedido.sql`

```sql
alter table public.configuracion_alertas
  add column saludo_pedido text
    constraint configuracion_alertas_saludo_pedido_check
      check (saludo_pedido is null or char_length(btrim(saludo_pedido)) between 1 and 500);
```

- Sin datos que migrar: todas las filas quedan en `null` (= saludo de la clienta).
- Sin políticas nuevas: "configuracion_alertas: leer del tenant" y "administrador escribe" (014) ya
  cubren lectura por tenant y escritura solo de administración.
- Se despliega **antes** que el front (un front nuevo que sube `saludo_pedido` contra un servidor sin la
  columna falla con `PGRST204`).

## `test:rls` (`scripts/test-rls.mjs`, sección "spec 022")

| Caso | Esperado |
|---|---|
| Administración del tenant 1 hace upsert con `saludo_pedido` | OK; lo lee `personal` del tenant 1 |
| `personal` del tenant 1 hace upsert/update con `saludo_pedido` | Rechazado o 0 filas; el valor no cambia |
| Usuario del tenant 2 lee `configuracion_alertas` | No ve el saludo del tenant 1 |
| Usuario del tenant 2 intenta actualizar la fila del tenant 1 | 0 filas |
| Saludo de 501 caracteres o solo espacios | `23514` (check) |
| `saludo_pedido: null` | OK (restablecer) |
| Upsert de administración **sin** la columna (cliente anterior) | El saludo guardado se conserva |
| `items_compra`: upsert de un ítem existente creado por otra persona | Rechazado (`42501`): Postgres aplica el check de INSERT a todo el upsert (R6) |
| `items_compra`: UPDATE de un ítem de otra persona del tenant | OK |
| `items_compra`: UPDATE de un ítem que aún no está en el servidor | 0 filas, no lo crea |
| `items_compra`: UPDATE desde otro tenant | No cambia nada |
| `items_compra`: upsert de un ítem nuevo con `creado_por` de otra persona | Rechazado (`42501`) |

## Sincronización (`src/lib/sync/index.ts`)

### `ConfiguracionAlertasRow`

```ts
interface ConfiguracionAlertasRow {
  // …existentes
  saludo_pedido?: string | null
}
```

- `toConfiguracionAlertasRow`: incluye `saludo_pedido` solo si `config.saludoPedido !== undefined`.
- `fromConfiguracionAlertasRow`: `saludoPedido = row.saludo_pedido ?? null` si la columna viene en la
  respuesta (`'saludo_pedido' in row`); si no viene (servidor sin migrar), no lo define.
- `pushConfiguracionAlertas` y `pullConfiguracionAlertas`: sin cambios de lógica (solo administración
  sube; el pull respeta el cambio local pendiente).

### `pushItemsCompra` (R6)

```text
items   = delTenantActual(itemsCompra)
propios = items con creadoPor === usuario actual
ajenos  = el resto, solo con cambioLocal

upsert(propios)                    → error: ciclo.registrar('push items_compra', …)
por cada ajeno: update(cambios).eq('id').select('id')
  ├─ 1 fila   → subido
  ├─ 0 filas  → aún no está en el servidor: queda pendiente, sin error
  ├─ permisos → reportarErrorSync('push items_compra ajeno', …); seguir
  └─ otro     → ciclo.registrar(…); cortar
subidos sin cambios desde que se leyeron → cambioLocal: false
pullItemsCompra: no pisa los ítems locales con cambioLocal
```

Sin usuario actual (sesión no cargada), no sube nada.

### Pruebas (`tests/unit/sync-items-compra.test.ts`, `tests/unit/sync-configuracion-saludo.test.ts`)

- Los ajenos sin `cambioLocal` no suben; uno marcado comprado aquí sube por UPDATE y se limpia la marca;
  uno que aún no está en el servidor espera sin error; el pull no pisa un cambio local sin subir.
- Un error de red en los propios sí queda en el ciclo.
- `saludoPedido` `undefined` no viaja; `null` y texto sí; el pull convierte `null` a `null`.
- `personal` con `saludoPedido` local no sube (regla existente).
