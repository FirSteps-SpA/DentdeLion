# Data Model: "Consumir" sin atajo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

Sin entidades, tablas, columnas ni versiones de Dexie nuevas. Sin migración de Supabase.

## Entidades usadas (sin cambios)

| Entidad | Uso en esta spec |
|---|---|
| `Movimiento` `tipo: 'consumo'` | Lo escribe `registrarConsumo`: `loteId`, `cantidad` (> 0, entera si la unidad no admite decimales), `unidad` = unidad de consumo actual, `lugarId`, `usuarioId`, `creadoEn` |
| `Movimiento` `tipo: 'ajuste'` con `movimientoOrigenId` | Lo escribe `deshacerConsumo`: misma cantidad y unidad que el consumo, en su lugar. Idempotente |
| `Aviso` (estado de UI, no persistido) | `tipo: 'consumo'`, `movimientoId`, `loteId`, `insumoNombre`, `unidadMedida` |

## Tipos de UI que cambian

```ts
// insumos/lib/consumo.ts — reemplaza DisponibilidadConsumoRapido
export type DisponibilidadConsumo =
  | { ok: true }
  | { ok: false; motivo: 'sin-stock' }

// insumos/components/InventarioView.tsx
type AccionConLugar = 'consumir' | 'alta' | 'trasladar'   // sin 'consumirUno'
```

## Reglas

- **Botón habilitado** ⇔ suma del stock de los lotes del insumo en el lugar (o en todos, en "Todos")
  > 0 (FR-008, FR-009).
- **Lote por defecto** (`selectLoteConsumo`): vigentes con stock en orden FEFO → el primero que cubre
  la cantidad, si no el primero; sin stock vigente, la misma regla con los vencidos (FR-005).
  Vigente = sin fecha o `diasEntre(fecha, hoy) >= 0`.
- **Registro**: se rechaza sin escribir si, recalculado dentro de la transacción, el stock del lote en
  el lugar es menor que la cantidad.
