# Contract: API (Supabase)

Migración `supabase/migrations/20261127000000_nombre_propio.sql`.

## `rpc/actualizar_mi_nombre`

```sql
create function public.actualizar_mi_nombre(p_nombre text) returns text
  language plpgsql security definer set search_path = public
```

| Caso | Resultado |
|---|---|
| Usuario activo, `trim(p_nombre)` de 1–80 caracteres | Actualiza `perfiles.nombre` de `auth.uid()` y devuelve el nombre guardado |
| Nombre vacío, solo espacios o > 80 | `raise 'nombre_invalido'` (P0001), sin cambios |
| Usuario desactivado o sin perfil | `42501`, sin cambios |
| `anon` | Sin `execute` (`revoke ... from public, anon`; `grant ... to authenticated`) |

No hay parámetro de id: una persona no puede cambiar el nombre de otra. `rol`, `tenant_id` y
`desactivado_en` no se tocan.

## Controles en `scripts/test-rls.mjs`

1. Personal activo cambia su nombre → 200, y `perfiles.nombre` actualizado.
2. Personal intenta `PATCH /perfiles?id=eq.<propio>` con `rol=administrador` → 0 filas (policy
   existente).
3. Nombre `'   '` → error `nombre_invalido`.
4. Usuario desactivado → 42501.
5. `anon` → 401/404.
