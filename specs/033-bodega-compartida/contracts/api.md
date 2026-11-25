# Contract: API (Supabase)

Migración `supabase/migrations/20261128000000_bodega_compartida.sql`:

```sql
alter table public.lugares add column bodega_id uuid;
create index lugares_bodega_idx on public.lugares (tenant_id, bodega_id);
alter table public.lugares add constraint lugares_bodega_no_es_lugar
  check (bodega_id is null or bodega_id <> id);
```

Sin funciones ni policies nuevas: la columna viaja con el upsert de `lugares` (administración). Los
movimientos de separación son traslados normales (`verificar_traslado`).

## Controles en `scripts/test-rls.mjs`

1. Administración pone el mismo `bodega_id` a dos lugares → 200 y queda guardado.
2. Personal intenta cambiar `bodega_id` → 0 filas, sin cambios.
3. `bodega_id = id` del propio lugar → rechazado (`lugares_bodega_no_es_lugar`).
4. Upsert de un lugar **sin** la clave `bodega_id` (cliente 2.11) → conserva el `bodega_id`.
5. Otro tenant no lee el `bodega_id` (aislamiento existente de `lugares`).
6. Un traslado de separación (salida + entrada, mismo lote, lugares de la misma bodega) se acepta.
