# Data Model: Detalles de alertas y formularios

**Feature**: 018-detalles-alertas-y-formularios | **Date**: 2026-10-22

## Esquema

**Sin cambios.** No hay tablas, columnas, migraciones de Supabase ni versión nueva de Dexie (sigue la
v12). La sincronización no cambia. Todo lo de esta spec es presentación derivada en memoria.

## Entidades existentes que se leen (sin modificar)

| Entidad | Campos usados | Para qué |
|---|---|---|
| `Insumo` | `id`, `nombre`, `caduca`, `stockMinimo` (efectivo del lugar), `unidadMedida` | Nombre del renglón, "¿Caduca?" del alta, umbral de stock |
| `Lote` | `id`, `insumoId`, `numeroLote`, `fechaCaducidad` (`AAAA-MM-DD` o vacío) | Fecha del renglón; número solo en el detalle |
| `Movimiento` | los de la vista del lugar | Stock del lote y del insumo (cálculos existentes) |
| `Lugar` | `id`, `nombre` | Chip en "Todos" y lugar del detalle abierto |

## Vistas derivadas (ya existen; cambia solo cómo se muestran)

- **`AlertaCaducidad`** (`features/alertas/lib/caducidad.ts`): `{ lote, insumo, diasRestantes, nivel }`
  + `lugar` desde `porLugar`. Sin cambios.
- **Alerta de stock bajo** (`computeInsumosStockBajo`): `{ insumo, stockActual }` + `lugar`. Sin
  cambios.
- **`AlertaInicio` / `VencimientoInicio`** (`features/inicio/lib/resumenInicio.ts`): sin cambios.

## Tipos nuevos de presentación (no persistidos)

```ts
// features/alertas/lib/etiquetaStock.ts (R6)
interface EtiquetaStock {
  texto: 'Sin stock' | 'Bajo mínimo'
  variante: 'danger' | 'warning-30'   // BadgeVariant existente
  icono: typeof CircleAlert | typeof AlertTriangle
}

// Estado local de AlertasView / InicioView (R5)
interface DetalleAbierto {
  insumoId: string
  lugarId: string | null              // null = sin lugar resuelto o vista de un solo lugar
}
```

## Reglas de derivación

- **Texto de tiempo** (R3, FR-007): función de `diasRestantes`; umbral 60 días; meses = ⌊|días| / 30⌋.
- **Fecha** (R4, FR-006): `fechaCaducidad` se interpreta como fecha local, nunca como UTC.
- **Etiqueta de stock** (R6, FR-011): `stockActual ≤ 0` → "Sin stock"; si no, "Bajo mínimo". Solo se
  evalúa para insumos que ya están en la lista de stock bajo.
- **Detalle** (R5, FR-009): `lotes` = lotes de la vista del lugar del renglón con `insumoId`;
  `movimientos` = movimientos de esa vista. Si el insumo deja de existir mientras el detalle está
  abierto (sincronización), el detalle se cierra.
