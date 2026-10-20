# Data Model: Tratamientos y Costo por Tratamiento

**Feature**: 016-tratamientos-y-costo-por-tratamiento | **Date**: 2026-10-19

Sobre el modelo de la spec 015 (Dexie v11, `20261021000000_unidades_y_costo.sql`). camelCase en
Dexie/TypeScript, snake_case en Postgres. Decisiones en [research.md](./research.md); SQL en
[contracts/supabase-schema.md](./contracts/supabase-schema.md).

## Tratamiento (fila de identidad)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `tenantId` | uuid | `default tenant_actual()` |
| `creadoPor` | uuid | administración |
| `creadoEn` | timestamptz | |
| `sincronizado` | boolean | local |
| `rechazadoEn` | timestamptz \| null | local (rol perdido) |

## CambioTratamiento (ledger append-only)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `tenantId` | uuid | |
| `tratamientoId` | uuid \| null | `null` solo en `porcentajeProfesional` |
| `lugarId` | uuid \| null | obligatorio en `precio` y `porcentajeProfesional`; `null` en el resto |
| `campo` | `'nombre' \| 'materiales' \| 'activo' \| 'precio' \| 'porcentajeProfesional'` | |
| `valorAnterior` / `valorNuevo` | json | ver validación |
| `usuarioId` | uuid | `= auth.uid()`, administración |
| `creadoEn` | timestamptz | orden `(creadoEn, id)` |
| `sincronizado` / `rechazadoEn` | | locales |

Validación de `valorNuevo` por campo: `nombre` texto 1–80, único en el tenant (en minúsculas y sin
espacios extremos, validado en el dispositivo); `materiales` arreglo de `{ insumoId, cantidad > 0,
unidad }` sin insumos repetidos; `activo` boolean; `precio` número ≥ 0 o `null`;
`porcentajeProfesional` número 0–100 o `null`.

## TratamientoProyectado (view-model, no se persiste)

`{ id, nombre, activo, materiales: MaterialTratamiento[], precios: Map<lugarId, number>, creadoEn }`
y, aparte, `porcentajes: Map<lugarId, number>` del tenant. Proyección pura del ledger (R1); un
tratamiento sin cambio `nombre` vigente no se muestra.

## MaterialTratamiento (dentro de `materiales`)

| Campo | Tipo | Notas |
|---|---|---|
| `insumoId` | uuid | del catálogo del tenant |
| `cantidad` | number | > 0, en `unidad` |
| `unidad` | Unidad | unidad de consumo al definirlo; se convierte con los factores de la 015 (R2) |

## TratamientoRealizado

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `tenantId` / `lugarId` | uuid | lugar donde se realizó |
| `tratamientoId` | uuid | |
| `nombre` | text | snapshot |
| `precio` | number \| null | snapshot del precio en ese lugar |
| `porcentajeProfesional` | number \| null | snapshot |
| `materiales` | `{ insumoId, nombre, cantidad, unidad, costoUnitario: number \| null, dadoDeBaja?: true }[]` | cantidades **usadas** (pueden diferir del estándar o ser 0; un insumo dado de baja queda con 0) |
| `costoMateriales` | number | Σ de los que tienen costo |
| `costoCompleto` | boolean | `false` si algún material usado no tenía precio |
| `gananciaEstimada` | number \| null | `null` sin precio o sin porcentaje |
| `usuarioId` / `creadoEn` | | autor y fecha |
| `anuladoEn` / `anuladoPor` | timestamptz / uuid \| null | anulación (R5) |
| `sincronizado` / `anulacionSincronizada` | boolean | locales |

Estados: `vigente → anulado` (una vez; la primera anulación gana en el servidor).

## Movimiento (se amplía)

| Campo | Tipo | Notas |
|---|---|---|
| `tratamientoRealizadoId` | uuid \| null | en los `consumo` del registro y en los `ajuste` de su anulación |

## Dexie v12

```text
tratamientos:            'id, tenantId, creadoEn, sincronizado'
cambiosTratamiento:      'id, tratamientoId, lugarId, campo, creadoEn, sincronizado, tenantId'
tratamientosRealizados:  'id, tratamientoId, lugarId, creadoEn, sincronizado, tenantId'
movimientos:             (índices de v10) + 'tratamientoRealizadoId'
```

`upgrade`: `movimientos.tratamientoRealizadoId ??= null`. Nada más cambia.
