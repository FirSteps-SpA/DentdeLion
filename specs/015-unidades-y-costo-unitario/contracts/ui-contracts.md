# Contract: interfaz — Unidades y Costo Unitario

Todos los controles nuevos miden al menos 48 × 48 px (Constitución III, FR-023) y usan los tokens del
DS (spec 013). Montos en CLP con `Intl.NumberFormat('es-CL')`, sin decimales (FR-017). Todo funciona
sin red (FR-022). Ningún formulario activa la cámara (Constitución V).

## 1. Presentación en alta y edición de insumo (US1)

`AltaMaterialView` y `EditarInsumoForm`, sección "Unidades":

| Campo | Control | Reglas |
|---|---|---|
| Unidad de consumo | Selector del catálogo (R1) | Obligatorio. En edición con movimientos, abre la conversión (§5) en vez de cambiar directo |
| Se compra por | Selector; por defecto "igual que la de consumo" | Si es igual, no se muestra Contenido (FR-004) |
| Contenido | `Stepper`/número, sufijo con el plural de la unidad de consumo | `> 0`; entero si la unidad no admite decimales |
| Vista previa | Texto | "Caja × 50 cartuchos" |

En el alta, cualquier rol define la presentación (FR-006, US1-7). En la edición, solo administración
ve estos campos editables; personal ve la presentación en el detalle (US1-6).

## 2. Ingreso: alta con stock inicial y recepción de compras (US2, US3)

`AltaMaterialView` (stock inicial) y `RecibirItemForm`:

- **Cantidad** con selector segmentado de unidad `[Cajas | Cartuchos]` (solo si `unidadCompra ≠
  unidadMedida`; por defecto unidad de compra). Debajo, en vivo: "2 cajas = 100 cartuchos".
- **Precio** (opcional), selector segmentado `[Por caja | Total]`. Debajo, en vivo: "2 × $32.500 =
  $65.000 · $650 por cartucho". Vacío = sin precio; `0` se acepta (FR-014).
- Error si la conversión no da entero en una unidad sin decimales (US2-4).
- En recepción desde un sugerido, la cantidad viene propuesta con `presentacionesSugeridas`.

## 3. Tabla y tarjetas de inventario (US3, US4)

- `InventarioTabla`: columnas nuevas **Presentación** ("Caja × 50") y **Costo unitario** ("$650" o
  "Sin precio" en tono secundario), en el orden del DS §22. La columna Stock agrega el equivalente
  en una segunda línea ("≈ 2 cajas + 20", FR-021).
- `InsumoCard` (móvil): presentación en la línea secundaria ("Cartucho · Caja × 50") y costo
  unitario junto al stock.

## 4. Detalle del insumo y lote (US3, US5)

`InsumoDetalle`:

- Cabecera: presentación, costo unitario con la nota "según la última compra con precio (fecha)".
- Cada lote: "Ingreso: 2 cajas (100 cartuchos) · $32.500 por caja" o "Sin precio", y botón
  **Editar precio** (todo el equipo, Q3).
- Diálogo de precio: mismo selector `[Por caja | Total]` que el ingreso; guarda un `CambioLote`.
  Historial de precios del lote (autor, fecha, anterior → nuevo).
- Historial de movimientos: cada movimiento en su unidad original y, si difiere de la actual, el
  equivalente ("3 cajas = 300 unidades").

## 5. Conversión de unidad de consumo (Q1, FR-007a)

Diálogo desde la edición del insumo, solo administración:

```text
Cambiar unidad de consumo
De: Caja   A: [Unidad ▼]
1 caja = [100] unidades
Stock actual: 3 cajas → 300 unidades (en todos los lugares)
Mínimo: 2 cajas → 200 unidades
[x] Comprar por Caja × 100 unidades
[Cancelar]  [Convertir]
```

- Bloquea con mensaje si algún lote no da entero (Edge Cases).
- Confirma que el historial previo se sigue viendo en cajas.

## 6. Compras (US4)

`ItemSugeridoCard`: "Pedir 2 cajas (100 cartuchos)" bajo el motivo (bajo mínimo / caducado). El
texto compartido de la lista (`compartir.ts`) incluye la misma cantidad.

## 7. Textos

- "Costo unitario", "Sin precio", "Presentación", "Se compra por", "Contenido", "Precio por {unidad
  de compra}", "Total pagado", "Editar precio".
- Nada de "utilidad" ni "ganancia" en esta spec (eso es 016).
