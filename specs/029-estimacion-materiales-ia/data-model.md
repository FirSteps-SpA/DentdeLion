# Data Model: Estimación de materiales con IA

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## Supabase — `estimaciones_ia` (nueva)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid | FK `tenants` |
| `usuario_id` | uuid | quien pidió |
| `creado_en` | timestamptz | `now()` |
| `tratamiento` | text | 1–80 |
| `materiales` | int | 1–20 |
| `resultado` | text | `pendiente` · `ok` · `no_reconocido` · `error_modelo` · `error_servicio` |

RLS: `select` para administración del tenant. Sin insert/update/delete por la API: solo
`reservar_estimacion` (security definer, ejecutable solo por `service_role`) y un `update` de
`resultado` con service role desde la función.

`reservar_estimacion(p_tenant uuid, p_usuario uuid, p_tratamiento text, p_materiales int) → uuid | null`:
bloqueo por tenant, cuenta las de hoy (`America/Santiago`), inserta si son < 20.

No hay tablas ni Dexie nuevos en el cliente: las sugerencias viven en el estado del formulario.
