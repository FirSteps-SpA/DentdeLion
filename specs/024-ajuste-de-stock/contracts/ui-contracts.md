# UI & lib contracts: spec 024

## 1. Lib

### `alertas/lib/caducidad.ts`

```ts
export function estaVencido(lote: Pick<Lote, 'fechaCaducidad'>, hoy: Date): boolean
// fechaCaducidad !== null && diasEntre(fechaCaducidad, hoy) < 0
```

`nivelAplicable` / `computeAlertasCaducidad` usan la misma comparación, sin cambio de comportamiento.

### `insumos/lib/ajusteStock.ts` (nuevo)

```ts
export function stockVencidoEnLugar(
  insumo: Insumo, lotes: Lote[], movimientos: Movimiento[], lugarId: string, hoy?: Date,
): { lote: Lote; stock: number }[]

export function filasStockPorLote(
  insumo: Insumo, lotes: Lote[], movimientos: Movimiento[],
  vista: string /* lugarId | 'todos' */, lugares: Lugar[], hoy?: Date,
): FilaStockLote[]

export function validarCantidadLote(cantidad: number, insumo: Insumo): string | null

/** Dentro de la transacción del llamador si la hay. Solo administración. */
export async function ajustarStockLotes(
  insumoId: string, correcciones: CorreccionStock[],
): Promise<Movimiento[]>   // los ajustes creados (sin las correcciones sin diferencia)

/** Escribe los descartes de los vencidos del lugar; lo usa recibirEnInsumo dentro de su tx. */
export async function descartarVencidosEnTransaccion(
  insumo: Insumo, lugarId: string, hoy: Date,
): Promise<Movimiento[]>
```

### `insumos/lib/catalogo.ts`

```ts
export async function guardarEdicionInsumo(input: {
  insumo: Insumo
  cambios: CambiosInsumoInput          // puede estar vacío
  correcciones: CorreccionStock[]      // puede estar vacío
  minimoLugar: { lugarId: string; valor: number | null } | null
}): Promise<void>                      // una sola transacción (R4)
```

### `compras/lib/recepcion.ts`

`RecepcionInput.descartarVencidos?: boolean`. `recibirEnInsumo` llama a
`descartarVencidosEnTransaccion` **antes** de `db.lotes.add` cuando es `true` e `insumo.caduca`.

### `lib/sync/index.ts`

`restaStock(m: { tipo; cantidad })` es `consumo | traslado_salida | (ajuste && cantidad < 0)`. Se usa
en el push y el pull de movimientos.

## 2. `RecibirItemForm`

- Calcula `vencidos = stockVencidoEnLugar(insumo, lotes, movimientos, getLugarParaEscribir(lugarId))`
  desde `useInventoryStore`.
- Si `vencidos.length > 0`, antes de los botones muestra:
  - `<label class="touch-target">` con `<input type="checkbox" checked>` y el texto
    **"Descartar stock vencido (4 cajas)"**, más el equivalente si aplica;
  - debajo, en `text-xs text-text-muted`, los lotes: "Lote L-1 (venció 2026-09-01) · Lote L-2 (…)".
- El estado inicial es `descartarVencidos: true`. Desmarcarlo envía `false`.
- Si no hay vencidos, no se renderiza nada y no se envía `descartarVencidos`.

## 3. `EditarInsumoForm`

Props: `+ onEliminado?: () => void`.

**Sección "Stock por lote"** (solo `rol === 'administrador'`, y solo si hay filas):

```
Stock por lote
┌───────────────────────────────────────────┐
│ Lote L-1 · vence 2026-09-01  [⚠ Vencido] │
│ (Lugar: Clínica Centro)        ← solo Todos│
│ [ −  ][   4   ][ + ]  cajas               │
│ → quedará 0 (−4 cajas)                    │
└───────────────────────────────────────────┘
```

- `NumeroInput` con `aria-label="Cantidad del lote L-1"`, `inputMode` decimal/numeric según
  `permiteDecimales`, área ≥ 48 px, y los botones −/+ como el del mínimo.
- La insignia "Vencido" usa el tono `danger`, el ícono de caducado y texto.
- El error de cada renglón va con `role="alert"` bajo el campo (`id="error-lote-<id>-<lugar>"`).
- La diferencia se muestra solo si es distinta de 0.

**Guardar**: activo si hay cambios de catálogo, de mínimo por lugar **o** de alguna corrección. Valida
todo y llama a `guardarEdicionInsumo` una sola vez.

**Eliminar insumo** (solo admin y con `onEliminado`): al final, separado de Cancelar/Guardar, es un
botón ghost en color `text-danger` con ícono `Trash`. Abre `ConfirmarBajaDialog` dentro del
formulario. Al confirmar llama a `darDeBajaInsumo` y luego a `onEliminado()`. Si falla, el error queda
en el diálogo. Cancelar cierra solo el diálogo.

## 4. `InventarioView`

Pasa `onEliminado={() => { deseleccionar si era el seleccionado; cerrarOverlay() }}` a
`EditarInsumoForm`.

## 5. `InsumoDetalle`

Por lote, después de los traslados, agrega
`ajustesDe(loteId)`: los `tipo === 'ajuste' && movimientoOrigenId === null`, de más nuevo a más
viejo. Cada uno se muestra como `"Ajuste de stock: −4 cajas · <fecha> · <autor>"` (con "+" si es
positivo).

## 6. Pruebas

| Archivo | Qué cubre |
|---|---|
| `tests/unit/insumos/ajusteStock.test.ts` (nuevo) | `estaVencido`, `stockVencidoEnLugar` (lugar, no caduca, lote en 0, sin lugar), `filasStockPorLote` (lugar, Todos, orden), `validarCantidadLote` |
| `tests/unit/insumos/ajustarStockLotes.test.ts` (nuevo) | diferencia ±, sin diferencia no escribe, no-admin rechaza, unidad convertida (normalización), `guardarEdicionInsumo` revierte todo si falla una parte |
| `tests/unit/compras/recepcion.test.ts` (ajustado) | `descartarVencidos` true/false, solo el lugar de la recepción, el lote nuevo vencido no se descarta, rollback si falla |
| `tests/unit/compras/sugeridos.test.ts` (ajustado) | el caso reportado: tras el descarte, el insumo deja de ser sugerido por vencimiento |
| `tests/unit/reportes/gasto.test.ts` (ajustado) | un ajuste sin origen no cambia consumos ni gasto |
| `tests/unit/sync-sobregiro-ajuste.test.ts` (nuevo) | un ajuste negativo (push y pull) dispara la verificación de sobregiro y marca el lote en revisión |
| `tests/integration/compras.test.tsx` (ajustado) | casilla visible y marcada, oculta sin vencidos, el recorrido reportado de punta a punta |
| `tests/integration/inventario.test.tsx` (ajustado) | Stock por lote (admin sí, personal no), guardar crea ajuste, error de decimales, Eliminar desde Editar y cancelar conserva el formulario |
| `tests/integration/alertas-detalle.test.tsx` (ajustado) | el historial muestra "Ajuste de stock" con su autor |
