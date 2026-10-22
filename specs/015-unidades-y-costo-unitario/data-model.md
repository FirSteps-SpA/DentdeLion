# Data Model: Unidades y Costo Unitario

**Feature**: 015-unidades-y-costo-unitario | **Date**: 2026-10-19

Cambios sobre el modelo de la spec 014 (Dexie v10, migración `20261020000000_multi_tenant.sql`).
Nombres en camelCase para Dexie/TypeScript y snake_case en Postgres. Las decisiones están en
[research.md](./research.md); el SQL, en [contracts/supabase-schema.md](./contracts/supabase-schema.md).

## Unidad (constante de código, no se persiste)

| Campo | Tipo | Notas |
|---|---|---|
| `clave` | `'caja' \| 'frasco' \| 'botella' \| 'jeringa' \| 'cartucho' \| 'paquete' \| 'kit' \| 'unidad' \| 'rollo' \| 'mL' \| 'L' \| 'g' \| 'mg' \| 'm' \| 'cm'` | Lo que se guarda en las filas |
| `singular` / `plural` | string | "Caja"/"cajas", "Cartucho"/"cartuchos", "mL"/"mL" |
| `decimales` | boolean | `true` en mL, L, g, mg, m, cm (FR-002) |

`normalizarUnidad('pieza') = 'unidad'` (R1). Reemplaza `UNIDADES_MEDIDA` y `ETIQUETAS_UNIDAD`.

## Insumo (se amplía)

| Campo | Tipo | Cambio | Validación |
|---|---|---|---|
| `unidadMedida` | Unidad | **Significa unidad de consumo**. `pieza` → `unidad` | En el catálogo |
| `unidadCompra` | Unidad | Nuevo. Migración: `= unidadMedida` | En el catálogo |
| `contenido` | number | Nuevo. Migración: `1` | `> 0`; `= 1` si `unidadCompra = unidadMedida` (FR-004); entero si la unidad de consumo no admite decimales |
| `stockMinimo` | number \| null | Se expresa en unidad de consumo (sin cambio de valor) | Igual que hoy |

Proyectados desde `cambiosInsumo` como el resto del catálogo. Derivados en memoria (no se guardan):
`factores` (R3) y `costoUnitario` (R7).

## CambioInsumo (se amplía)

| Campo | Cambio |
|---|---|
| `campo` | Agrega `'unidadCompra'` y `'contenido'` |
| `factor` | Nuevo, `number \| null`. Solo en `campo = 'unidadMedida'`: unidades nuevas por unidad anterior (`> 0`). `null` = cambio de etiqueta previo a 015 (vale 1) |

Una **conversión** (FR-007a) es una transacción Dexie que escribe: un cambio `unidadMedida` con
`factor`; un cambio `stockMinimo` convertido (si hay mínimo); opcionalmente cambios `unidadCompra` y
`contenido` (la UI propone `unidadCompra = anterior`, `contenido = factor`); y `minimosLugar`
convertidos. Validación en R3.

## Lote (se amplía con el snapshot del ingreso)

| Campo | Tipo | Notas |
|---|---|---|
| `cantidadIngresada` | number \| null | Lo que escribió la persona. `null` en lotes previos a 015 |
| `unidadIngresada` | Unidad \| null | `unidadCompra` o `unidadMedida` del insumo al ingresar |
| `contenido` | number | Contenido vigente al ingresar. Migración: `1` |
| `unidadConsumo` | Unidad | Unidad de consumo al ingresar. Migración: la del insumo |
| `precioCompra` | number \| null | Pesos por unidad de compra del snapshot. `null` = sin precio, `0` = gratis (FR-014). `≥ 0` |

Inmutables después del alta (trigger `proteger_lote`, R5). Derivados: `presentaciones =
cantidadIngresada` si `unidadIngresada ≠ unidadConsumo`, si no `cantidad del ingreso / contenido`;
`precioVigente` = último `CambioLote` o `precioCompra`; `costoUnitario = precioVigente / (contenido ×
f[unidadConsumo])`.

## Movimiento (se amplía)

| Campo | Tipo | Notas |
|---|---|---|
| `unidad` | Unidad | Nuevo. Unidad en que está `cantidad` (la de consumo vigente al registrar). Migración: la del insumo; servidor la completa si llega `null` (cliente 2.3.0) |

`cantidad` sigue en unidad de consumo (FR-008). Valor en la unidad actual: `cantidad ×
f[unidad]` (R4). En un traslado, salida y entrada tienen la misma `unidad`.

## CambioLote (nuevo, append-only)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `tenantId` | uuid | `default tenant_actual()` en servidor |
| `loteId` | uuid | FK `lotes` (mismo tenant) |
| `campo` | `'precioCompra'` | Check; deja lugar a otros campos |
| `valorAnterior` / `valorNuevo` | number \| null | Pesos por unidad de compra; `null` = sin precio |
| `usuarioId` | uuid | `= auth.uid()` |
| `creadoEn` | timestamptz | Orden `(creadoEn, id)` |
| `sincronizado` | boolean | Solo local |

Dexie: `cambiosLote: 'id, loteId, creadoEn, sincronizado, tenantId'`. Lo inserta cualquier miembro
activo del tenant (Q3). Sin update ni delete.

## ItemSugerido (view-model, se amplía)

| Campo | Tipo | Notas |
|---|---|---|
| `presentacionesSugeridas` | number \| null | `max(1, ceil((mínimo efectivo − stock) / contenido))` si está bajo mínimo; `null` si solo está caducado (R8) |

## Dexie v11

```text
cambiosLote: 'id, loteId, creadoEn, sincronizado, tenantId'   # tabla nueva
(resto de índices sin cambios)
```

`upgrade`:

1. `insumos`: `pieza` → `unidad`; `unidadCompra ??= unidadMedida`; `contenido ??= 1`.
2. `cambiosInsumo` con `campo = 'unidadMedida'`: `pieza` → `unidad` en `valorAnterior`/`valorNuevo`;
   `factor ??= null`.
3. `lotes`: `contenido ??= 1`, `unidadConsumo ??= unidad del insumo`, `cantidadIngresada`,
   `unidadIngresada` y `precioCompra ??= null`.
4. `movimientos`: `unidad ??= unidad del insumo de su lote`. `sincronizado` no se toca: las filas ya
   subidas reciben la misma `unidad` del backfill del servidor.

## Reglas de estado

- Insumo: la presentación se edita en cualquier momento (admin). La unidad de consumo se cambia por
  conversión; el factor queda en el ledger para siempre.
- Lote: precio `sin precio → con precio → corregido` (todas las transiciones son filas nuevas de
  `CambioLote`; el valor original del lote no cambia).
