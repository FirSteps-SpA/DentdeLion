# Data Model: Lugares que comparten bodega

## lugares (servidor) — columna nueva

| Campo | Tipo | Regla |
|---|---|---|
| `bodega_id` | `uuid null` | `null` = bodega propia. Igual en todos los lugares que comparten bodega. Nunca igual al `id` de un lugar (research R1). Solo administración la cambia (policy existente "lugares: administrador actualiza"). |

Índice `lugares_bodega_idx (tenant_id, bodega_id)`. Sin FK: la bodega no es una fila. Los datos
existentes quedan con `null`, así que nada cambia (FR-019).

## Lugar (Dexie) — campo nuevo, sin cambio de versión

```ts
interface Lugar {
  // …campos actuales
  /** Spec 033: null = bodega propia. Ausente en filas viejas = null. */
  bodegaId?: string | null
}
```

No es índice de Dexie, así que no hace falta `db.version(18)`. `toLugarRow`/`fromLugarRow` mapean
`bodega_id`.

## Bodega (derivada, solo cliente)

```ts
/** La bodega de un lugar: su `bodegaId` o, sin él, su propio id. */
bodegaDe(lugar): string
/** Ids de los lugares activos que comparten bodega con `lugarId` (incluido él). */
lugaresDeBodega(lugarId, lugares): Set<string>
/** "Box 1 + Box 2", por nombre. */
rotuloBodega(lugarIds, lugares): string
```

Solo cuentan los lugares **activos** (un lugar desactivado se separa antes de desactivarse, FR-010).

## Stock de un lote en una bodega

`stock(lote, bodega) = Σ movimientos(lote) con lugarId ∈ lugaresDeBodega`, en la unidad actual
(`movimientosNormalizadosDeLote`, spec 015). Un lote es visible en la bodega si su `lugarId` o
alguno de sus movimientos está en el conjunto (`lotesEnBodega`).

## minimos_lugar — sin cambios de esquema

- **Efectivo de la bodega** = máx. de `minimoEfectivo(insumo, l)` para `l` ∈ bodega.
- **Editar** en un lugar de una bodega compartida hace upsert de la misma fila en cada lugar de la
  bodega.
- **Juntar** escribe el valor elegido en todos los lugares del resultado.

## Movimientos al separar

Por cada lote con saldo propio `s ≠ 0` en el lugar que se separa (`L`), con `D` = otro lugar activo
de la bodega:

| Saldo | `traslado_salida` | `traslado_entrada` |
|---|---|---|
| `s > 0` | en `L`, cantidad `s` | en `D`, cantidad `s` |
| `s < 0` | en `D`, cantidad `-s` | en `L`, cantidad `-s` |

Ambos con el mismo `traslado_id`, unidad de consumo actual, autor y fecha. Después,
`L.bodegaId = null`, y también el de `D` si quedó solo.

## Transiciones de un lugar

```
propio ──juntar──▶ en bodega compartida ──separar──▶ propio
                         │
                         └──desactivar──▶ (separar) ──▶ desactivado
```
