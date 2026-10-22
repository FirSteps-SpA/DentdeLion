# UI Contracts: Detalles de alertas y formularios

**Feature**: 018-detalles-alertas-y-formularios | **Date**: 2026-10-22

## 1. `NumeroInput` (`src/components/ui/NumeroInput.tsx`) — R1

```ts
type NumeroInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  ref?: React.Ref<HTMLInputElement>
}
```

- Renderiza `<input type="number" {...props}>`. No impone estilos ni valores: cada uso conserva sus
  `className`, `id`, `min`, `step`, `inputMode`, `aria-*`, `value` y `onChange` actuales.
- `onWheel`: si el campo es `document.activeElement`, llama `blur()`; luego invoca el `onWheel` recibido,
  si lo hay. Nunca llama `preventDefault()` (la página debe desplazarse, FR-002).
- Reenvía `ref` (algunos formularios enfocan el primer campo con error).

**Invariantes probadas**:
1. Con foco y valor 200, un evento `wheel` deja el valor en 200 y el campo sin foco.
2. Sin foco, un evento `wheel` no cambia nada ni lanza errores.
3. `change` con "35" llama `onChange` como un `input` normal.
4. Ningún archivo de `src/` fuera de `NumeroInput.tsx` contiene `type="number"` (prueba de
   arquitectura, R2).

**Usos** (reemplazan el `<input type="number">` actual, sin otros cambios):

| Archivo | Campos |
|---|---|
| `components/ui/Stepper.tsx` | el campo central (cubre alta, cantidad de ingreso, presentación, traslado, compras manuales, registrar tratamiento) |
| `insumos/components/ConsumoForm.tsx` | cantidad a consumir |
| `insumos/components/EditarInsumoForm.tsx` | stock mínimo del catálogo y mínimo del lugar |
| `insumos/components/ConvertirUnidadDialog.tsx` | factor |
| `insumos/components/PrecioIngresoField.tsx` | precio (alta, recepción, editar precio) |
| `ajustes/components/ConfiguracionAlertasSection.tsx` | stock mínimo por insumo (guarda en `onBlur`) y horas de aviso de pendientes |
| `ajustes/components/LugaresSection.tsx` | % profesional |
| `tratamientos/components/TratamientoForm.tsx` | precio en cada lugar (las cantidades de materiales usan `Stepper`) |

## 2. Textos de caducidad (`src/features/alertas/lib/textoCaducidad.ts`) — R3, R4

```ts
export function textoTiempoCaducidad(diasRestantes: number): string
export function formatearFechaCaducidad(fecha: string): string   // 'AAAA-MM-DD' → '3 nov 2026'
```

| Entrada | `textoTiempoCaducidad` |
|---|---|
| 0 | `vence hoy` |
| 1 | `vence en 1 día` |
| 12 | `vence en 12 días` |
| 59 | `vence en 59 días` |
| 60 / 89 | `vence en 2 meses` |
| 90 | `vence en 3 meses` |
| 170 | `vence en 5 meses` |
| −1 | `caducado hace 1 día` |
| −5 | `caducado hace 5 días` |
| −59 | `caducado hace 59 días` |
| −60 | `caducado hace 2 meses` |

`formatearFechaCaducidad('2026-11-03')` devuelve `3 nov 2026` con el proceso en
`TZ=America/Santiago` (no `2 nov`). Fecha vacía o inválida → `''`.

## 3. Etiqueta de stock (`src/features/alertas/lib/etiquetaStock.ts`) — R6

```ts
export function etiquetaStockBajo(stockActual: number): EtiquetaStock
```

| `stockActual` | texto | variante | ícono |
|---|---|---|---|
| ≤ 0 (incluye negativos) | `Sin stock` | `danger` | `CircleAlert` |
| > 0 (incluye 0,5) | `Bajo mínimo` | `warning-30` | `AlertTriangle` |

## 4. Renglones de alerta (Alertas e Inicio) — FR-006 a FR-012, R5

**Caducidad** (Alertas y resumen de Inicio):

```
[ícono]  Lidocaína 2 %                              [badge nivel]
         Vence 3 nov 2026 · vence en 12 días  [chip lugar en "Todos"]
```

- Sin "lote", sin `AAAA-MM-DD`, sin "nivel N días" en el texto. El badge conserva sus variantes y
  textos actuales (`Caducado`, `30 días`, `7 días`, `1 día` en Alertas; `Caducado` / `Por vencer` en
  Inicio).
- Caducado: segunda línea `Venció 28 oct 2026 · caducado hace 5 días`.

**Próximos vencimientos** (Inicio): mismo texto de segunda línea, con el punto de color actual.

**Stock bajo** (Alertas y resumen de Inicio): texto de stock actual sin cambios; badge con
`etiquetaStockBajo` ("Stock crítico" desaparece).

**Interacción**:
- Cada renglón de caducidad, stock bajo y próximo vencimiento es un `<button type="button">` de ancho
  completo y alto ≥ 48 px, con `aria-label` "Ver detalle de {nombre}".
- Al activarlo se renderiza `InsumoDetalle` con los lotes y movimientos de la vista del lugar del
  renglón; `onClose` vuelve a la misma pantalla con el mismo scroll.
- "Lotes en revisión" no cambia (sigue mostrando el lote y "Marcar como resuelto").

## 5. Alta de material — FR-013, FR-014, R7

Orden dentro de la tarjeta del lote:

1. Número de lote
2. Proveedor
3. **Interruptor `¿Caduca?`** (`role="switch"`, `aria-checked`, texto Sí/No)
4. Fecha de vencimiento (solo si `¿Caduca?` = Sí) + vida útil estimada

Fuera de la tarjeta, el interruptor ya no aparece. Comportamiento de `toggleCaduca` y validaciones sin
cambios.
