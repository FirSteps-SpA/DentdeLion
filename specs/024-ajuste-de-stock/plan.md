# Implementation Plan: Descarte de vencidos al reponer y ajuste de stock por lote

**Branch**: `024-ajuste-de-stock` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-ajuste-de-stock/spec.md`

## Summary

Hoy no hay forma de sacar del inventario el stock que no se consumió. La spec la agrega reutilizando
el movimiento `ajuste` que el modelo ya tiene, **sin** `movimientoOrigenId` para distinguirlo de las
anulaciones (R1). Todo es del lado del cliente: sin migración, sin cambio de Dexie y sin tablas nuevas
en el sync.

- **Recepción con descarte** (P1): `RecibirItemForm` muestra "Descartar stock vencido (N)", marcada
  por defecto, con los lotes vencidos del lugar. `recibirEnInsumo` recalcula el stock vencido dentro
  de su transacción y escribe un ajuste `−stock` por lote, junto al lote nuevo y al ítem comprado
  (R2, R3).
- **Stock por lote en Editar** (P2): sección solo para administración, con un `NumeroInput` por
  `(lote, lugar)`. `guardarEdicionInsumo` guarda en **una** transacción los cambios de catálogo, las
  correcciones (ajuste por la diferencia, recalculada al guardar) y el mínimo por lugar (R4).
- **Eliminar desde Editar** (P3): botón al final del formulario que abre la misma
  `ConfirmarBajaDialog` dentro del formulario. Cancelar conserva lo editado (R5).
- **Transversal**: un ajuste negativo entra en la verificación de sobregiro del sync (R6), y el
  detalle del lote lista los ajustes con su autor (R7).

## Technical Context

**Language/Version**: TypeScript ~6.0 (React 19), Node.js ^22.22 o ≥24.15.

**Primary Dependencies**: sin dependencias nuevas (React, Zustand, Dexie, Tailwind, `lucide-react`).

**Storage**: Dexie sin cambio de versión y Postgres sin migración. Se reutilizan
`movimientos.tipo = 'ajuste'` y `movimiento_origen_id` nulo ([data-model.md](./data-model.md)).

**Testing**: Vitest + RTL: unit de `ajusteStock`, recepción, sugeridos, gasto y sync de sobregiro;
integración de Compras, Inventario/Editar y detalle. Además, la prueba de arquitectura
`lecturas-movimientos` debe seguir pasando, y se toman capturas con `run-indentory`
([quickstart.md](./quickstart.md)).

**Target Platform**: PWA (teléfono, tablet, desktop) + Supabase.

**Project Type**: PWA con backend Supabase (solo front en esta spec).

**Performance Goals**: el cálculo de vencidos y de filas recorre los lotes del insumo (decenas), sin
costo perceptible. La recepción suma como mucho una lectura de movimientos por lote vencido dentro de
la transacción.

**Constraints**:

- Sin conexión (Constitución I): descartes y correcciones se escriben primero en Dexie y suben con el
  push de movimientos existente.
- Solo `movimientosNormalizadosDeLote` lee movimientos de Dexie (prueba de arquitectura): los cálculos
  dentro de transacciones pasan por ahí.
- "Todo o nada" (FR-002, FR-008): una sola transacción Dexie por guardado. Las transacciones de
  `editarInsumo` y `recibirEnInsumo` se anidan como subtransacciones.
- Táctil ≥ 48 px (Constitución III) en la casilla, los `NumeroInput`, los botones −/+ y Eliminar.
- Ningún cambio en los totales de Reportes (SC-004).

**Scale/Scope**: 1 módulo nuevo (`insumos/lib/ajusteStock.ts`); cambios en `recepcion.ts`,
`catalogo.ts` (`guardarEdicionInsumo`), `caducidad.ts` (`estaVencido`), `sync/index.ts`
(`restaStock`), `RecibirItemForm`, `EditarInsumoForm`, `InventarioView` e `InsumoDetalle`. 3 archivos
de prueba nuevos y ~6 ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Estado |
|---|---|---|
| I. Offline-First | Descartes y correcciones son movimientos en Dexie, en transacción local; suben con el push existente; los conflictos concurrentes no pierden ningún movimiento y terminan en la alerta de revisión (R6) | ✅ |
| II. Zustand | La UI lee lotes y movimientos de `inventoryStore`; sin store nuevo; el liveQuery refleja los ajustes al instante | ✅ |
| III. Táctil 48 px | Casilla en `label.touch-target`, `NumeroInput` y −/+ de 48 px, botón Eliminar `TouchButton` | ✅ |
| IV. Trazabilidad | Cada descarte o corrección es un movimiento por lote con autor, fecha y lugar, visible en el historial (R7); "Vencido" con color, ícono y texto | ✅ |
| V. Búsqueda manual | No toca la búsqueda ni la cámara | ✅ |
| VI. Multi-usuario | `usuarioId` en cada ajuste; la corrección por lote exige administración (`exigirAdministrador`), igual que la edición del catálogo | ✅ |
| Pila obligatoria | Sin dependencias nuevas | ✅ |

**Re-check post-diseño**: sin violaciones. La restricción a administración de las correcciones es
solo del cliente, porque RLS deja insertar movimientos a cualquier miembro. Es el mismo criterio que
ya se usa con los consumos y las anulaciones, y queda documentado en el Assumption de la spec.

## Project Structure

### Documentation (this feature)

```text
specs/024-ajuste-de-stock/
├── plan.md
├── research.md          # R1–R7
├── data-model.md        # ajuste independiente, view-models, validación
├── quickstart.md        # pruebas, recorrido manual, publicación
├── contracts/
│   └── ui-contracts.md  # lib, RecibirItemForm, EditarInsumoForm, detalle, pruebas
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── lib/sync/index.ts                        # restaStock cuenta ajustes negativos (R6)
└── features/
    ├── alertas/lib/caducidad.ts             # estaVencido (R2)
    ├── insumos/
    │   ├── lib/ajusteStock.ts               # NUEVO: vencidos, filas, validación, ajustar, descartar
    │   ├── lib/catalogo.ts                  # guardarEdicionInsumo (R4)
    │   └── components/
    │       ├── EditarInsumoForm.tsx         # Stock por lote + Eliminar insumo
    │       ├── InventarioView.tsx           # onEliminado
    │       └── InsumoDetalle.tsx            # historial de ajustes
    └── compras/
        ├── lib/recepcion.ts                 # descartarVencidos en la transacción
        └── components/RecibirItemForm.tsx   # casilla

tests/
├── unit/insumos/ajusteStock.test.ts, unit/insumos/ajustarStockLotes.test.ts   # NUEVOS
├── unit/sync-sobregiro-ajuste.test.ts                                        # NUEVO
└── (ajustados) unit/compras/{recepcion,sugeridos}.test.ts, unit/reportes/gasto.test.ts,
    integration/{compras,inventario,alertas-detalle}.test.tsx
```

**Structure Decision**: la lógica de stock por lote va en `insumos/lib` porque es del dominio del
insumo y la usan tanto Compras como Editar. `recepcion.ts` solo la invoca dentro de su transacción.

## Complexity Tracking

Sin violaciones de la constitución; no aplica.

## Notas

- **Riesgo principal**: anidar transacciones Dexie. Si una tabla de la transacción interna falta en
  la externa, Dexie lanza `SubTransactionError`. La prueba de rollback de `guardarEdicionInsumo` y la
  de recepción con descarte cubren las dos composiciones.
- **Revisión de sobregiro**: `revision.ts` ya daba por hecho que administración corregía con un
  `ajuste`, pero no había UI para hacerlo. "Stock por lote" la provee. Un enlace desde la alerta En
  revisión a Editar queda fuera de alcance.
- **Clientes 2.6.0 en caché**: suman los ajustes en el stock, pero no muestran la línea del historial
  ni la casilla. No hay riesgo de datos.
