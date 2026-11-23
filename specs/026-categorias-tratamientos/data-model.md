# Data Model: Categorías de tratamientos y % profesional por categoría

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## Supabase (migración `20261123000000_categorias_tratamiento.sql`)

### `categorias_tratamiento` (nueva)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid PK | generado por el cliente o por la siembra |
| `tenant_id` | uuid | default `tenant_actual()`, FK `tenants`; `unique (id, tenant_id)` |
| `nombre` | text | 1–40 caracteres (`btrim`) |
| `clave` | text | `generated always as (clave_nombre(nombre)) stored`; único por tenant |
| `creado_por` | uuid null | `null` en las sembradas |
| `creado_en` | timestamptz | default `now()` |
| `desactivado_en` | timestamptz null | |

RLS: leer del tenant; insertar solo administración, como sí misma; actualizar solo administración.
Trigger `proteger_categoria_tratamiento`: conserva `tenant_id`, `creado_por`, `creado_en`.

### `cambios_tratamiento` (cambia)

- Columna nueva `categoria_tratamiento_id uuid null`, FK `(categoria_tratamiento_id, tenant_id)`.
- `campo` admite además `categoria` y `porcentajeCategoria`.

| campo | `tratamiento_id` | `lugar_id` | `categoria_tratamiento_id` | `valor_nuevo` |
|---|---|---|---|---|
| `categoria` | sí | null | null | string (id) o null |
| `porcentajeCategoria` | null | sí | sí | número 0–100 o null |

### `tratamientos_realizados` (cambia)

- `categoria_tratamiento_id uuid null`, FK `(categoria_tratamiento_id, tenant_id)`.
- `categoria_nombre text null`.
- Inmutables vía `proteger_tratamiento_realizado`.

### Siembra

`sembrar_categorias_tratamiento(p_tenant)`: Evaluación, Prevención, Restauración, Endodoncia,
Periodoncia, Cirugía, Prótesis, Urgencia, Odontopediatría, solo si el tenant no tiene categorías. Trigger
`after insert on tenants`.

## Dexie v15

```ts
export interface CategoriaTratamiento {
  id: string
  tenantId: string
  nombre: string
  creadoPor: string | null
  creadoEn: string
  desactivadoEn: string | null
  sincronizado: boolean
  /** Local: el servidor la rechazó (permisos o nombre repetido). */
  rechazadoEn: string | null
}

export type CampoTratamiento = /* existentes */ | 'categoria' | 'porcentajeCategoria'

interface CambioTratamiento { /* … */ categoriaId: string | null }       // solo porcentajeCategoria
interface TratamientoRealizado { /* … */ categoriaId: string | null; categoriaNombre: string | null }
```

Índices: `categoriasTratamiento: 'id, tenantId, sincronizado'`. Upgrade v15 completa con `null`.

## Proyección (cliente)

```ts
interface TratamientoProyectado { /* … */ categoriaId: string | null }

porcentajesPorCategoria(cambios): Map<string /* `${categoriaId}|${lugarId}` */, number>

porcentajeAplicable({ categoriaId, lugarId, porcentajesLugar, porcentajesCategoria }):
  { valor: number | null; origen: 'categoria' | 'lugar' | null }
```

Regla (FR-010): `porcentajesCategoria.get(cat|lugar)` → `porcentajesLugar.get(lugar)` → `null`.

## Reglas de validación

- Nombre: 1–40, único por clave (`claveCategoria`, sin mayúsculas/tildes/espacios), distinto de "Sin
  categoría".
- %: 0–100 (mismo validador que `fijarPorcentajeLugar`).
- Solo administración crea, renombra, (des)activa, asigna y fija %.
