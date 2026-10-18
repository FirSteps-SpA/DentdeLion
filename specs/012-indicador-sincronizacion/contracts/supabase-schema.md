# Contract: Esquema Supabase y ciclo de sincronización

**Feature**: 012-indicador-sincronizacion

## Migración `supabase/migrations/20261019000000_horas_aviso_pendientes.sql`

```sql
alter table public.configuracion_alertas
  add column horas_aviso_pendientes integer not null default 24
  constraint configuracion_alertas_horas_aviso_pendientes_check
    check (horas_aviso_pendientes between 1 and 168);
```

- Sin políticas nuevas: siguen las de la tabla (todos los autenticados leen, solo el
  administrador escribe).
- Es compatible con clientes 2.1.0: no envían la columna y el upsert la conserva
  (research.md R6).
- Se aplica en local con `supabase db reset` y en producción con el flujo habitual de
  migraciones, **antes** de publicar el front: un front nuevo contra un esquema viejo haría fallar
  el push de configuración de un administrador con "column does not exist".

## Fila de `configuracion_alertas`

```text
{ id: 'global', niveles_aviso_dias: int[], horas_aviso_pendientes?: int }
```

`horas_aviso_pendientes` se omite del JSON si el campo local es `undefined`.

## Ciclo `runSyncBatch(): Promise<ResultadoCiclo>`

Cambios respecto del contrato de la spec 008/010 (el orden de etapas no cambia):

0. **Nuevo**: valida la sesión con `client.auth.getSession()` (research.md R3). Si hay error de
   red, el ciclo devuelve `sin-red`. Si no hay sesión o no es del usuario local, devuelve `sesion`.
   En ambos casos no se hace ningún push ni pull. Además, si **cualquier** etapa posterior recibe
   un error de sesión (`PGRST301`, 401 o `/jwt/i`), el ciclo se corta en esa etapa y devuelve
   `sesion` (R2/R3). Un error de red también corta el ciclo (devuelve `sin-red`), y con
   `navigator.onLine === false` no se hace ninguna petición (R9, ajustes tras la
   implementación).
1. `pushCategorias`: **solo** las de `creadoPor === usuario actual` (R4).
2. `pushInsumos`: sin cambios, pero su `{ error }` ahora se registra.
3. `pushCambiosInsumo`: **solo** los de `usuarioId === usuario actual` (R4).
4. Los pulls de catálogo y la reproyección no cambian.
5. `pushLotes` y `pushItemsCompra`: sin cambios, pero su `{ error }` ahora se registra.
6. `pushConfiguracionAlertas` y `pushConfiguracionClinica`: solo si `sincronizado === false` **y**
   el rol es `administrador`. Marcan `sincronizado: true` si no hubo error. Si el servidor rechaza
   por permisos, descartan el cambio local (`sincronizado: true`, sin error); cualquier otro error
   deja `false` (R5).
7. `pushMovimientos`: sin cambios de lógica, pero un rechazo de fila **sí** se registra como
   error (los movimientos no tienen `rechazadoEn`, R1).
8. Los pulls de configuración escriben `sincronizado: true`. **No** pisan una fila local con
   `sincronizado: false` solo si el usuario actual es administrador (R5).
9. **Nuevo**: al final, clasifica el resultado (R2). Si es `ok`, escribe
   `estadoSync.ultimaExitosaEn`. Siempre actualiza `syncStore`.

Invariantes que se mantienen:
- `runSyncBatch` nunca lanza (Constitución I).
- Un movimiento, cambio de insumo o categoría solo se marca `sincronizado: true` si el servidor lo
  aceptó. La única excepción es la configuración global rechazada por permisos, que se descarta a
  favor del valor del servidor (R5).

## Guardián de ciclo (`src/lib/sync/index.ts`)

```text
sincronizarAhora(): Promise<ResultadoCiclo>
  // si hay un ciclo en curso devuelve esa misma promesa; si no, lanza uno
startBackgroundSync(intervalMs = 30_000): () => void
  // tick inmediato + intervalo + listeners 'online' (un ciclo nuevo, después del que
  // esté en curso) y 'offline'
  // (estado sin-red); los ticks pasan por el mismo guardián; la función de
  // retorno limpia intervalo y listeners
```

## `test:rls`: casos nuevos (`scripts/test-rls.mjs`)

| Caso | Esperado |
|---|---|
| Administrador hace upsert con `horas_aviso_pendientes: 12` | OK, y el valor queda en 12 |
| `personal` hace upsert de `configuracion_alertas` | Rechazado (42501) |
| Administrador escribe `0` o `169` | Rechazado (23514, check) |
| Upsert sin la columna sobre una fila con 12 (cliente 2.1.0) | Queda en 12 |
