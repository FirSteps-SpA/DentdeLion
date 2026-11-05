# Data Model: Descarte de vencidos al reponer y ajuste de stock por lote

**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Sin cambios de esquema: no hay migración de Postgres, la versión de Dexie no cambia y el sync de tablas
tampoco.

## Movimiento — `tipo: 'ajuste'` independiente (sin cambios de forma)

| Campo | Valor en esta spec |
|---|---|
| `tipo` | `'ajuste'` |
| `movimientoOrigenId` | `null`. Esto lo distingue de una anulación de consumo, que lleva el id del consumo |
| `tratamientoRealizadoId` | `null` |
| `trasladoId` | `null` |
| `cantidad` | con signo, en `unidad`: `−stock` en un descarte y `nueva − actual` en una corrección. Nunca 0 |
| `unidad` | unidad de consumo actual del insumo (por defecto en `crearMovimiento`) |
| `lugarId` | lugar de la recepción (descarte) o del renglón corregido |
| `usuarioId`, `creadoEn`, `sincronizado` | como cualquier movimiento |

**Invariantes**

- Tras un descarte, `stockLoteEnLugar(lote, lugar) === 0` en el dispositivo que lo hizo (R2).
- Tras una corrección, `stockLoteEnLugar(lote, lugar) === cantidad escrita` en el dispositivo que la
  hizo (R4).
- Un ajuste sin origen nunca aparece en `consumosValorizados` (R1).
- Un ajuste con `cantidad < 0` cuenta como "resta stock" en la reconciliación de sobregiro del sync
  (R6).

## View-models nuevos (nunca persistidos)

### `LoteVencidoEnLugar` (`compras/lib/recepcion.ts` o `insumos/lib/ajusteStock.ts`)

```ts
{ lote: Lote; stock: number }   // stock > 0, en unidad de consumo actual
```

Lo calcula `stockVencidoEnLugar(insumo, lotes, movimientos, lugarId, hoy)`. Devuelve `[]` si
`!insumo.caduca`.

### `FilaStockLote` (`insumos/lib/ajusteStock.ts`)

```ts
{
  lote: Lote
  lugarId: string
  nombreLugar: string | null   // solo en "Todos"
  stock: number                // actual en ese lugar
  vencido: boolean             // estaVencido(lote, hoy)
}
```

Lo calcula `filasStockPorLote(insumo, lotes, movimientos, vista, lugares, hoy)` (ver R4: qué filas y en
qué orden).

## Entradas de lib

### `RecepcionInput` (+1 campo)

```ts
descartarVencidos?: boolean   // ausente = false: sin cambio para quien no lo pase
```

### `CorreccionStock`

```ts
{ loteId: string; lugarId: string; cantidad: number }   // cantidad final deseada
```

Validación (`validarCantidadLote(cantidad, insumo)`):

- `Number.isFinite(cantidad) && cantidad >= 0` → si no, "Ingresa una cantidad de 0 o más."
- `!insumo.permiteDecimales && !Number.isInteger(cantidad)` → "Esta unidad no admite decimales."

## Estados del lote

Sin estados nuevos. Un lote en 0 sigue siendo `'activo'`. Un lote que queda negativo por concurrencia
pasa a `'revision'` por el flujo existente (feature 002) y vuelve a `'activo'` con "Marcar resuelto"
(R6).
