---

description: "Task list for 025-consumir-sin-atajo"
---

# Tasks: "Consumir" sin atajo

**Input**: Design documents from `/specs/025-consumir-sin-atajo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. Las definen plan.md (Testing) y `contracts/ui-contracts.md` §6. Patrón del proyecto:
Vitest + RTL con `fireEvent` y los helpers de `tests/helpers/` (`memoryDb.ts`, `lugarFalso.ts`,
`tenancy.ts`). Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

**Desvíos al implementar**:

- **Foco en desktop**: `BottomSheet` enfoca el primer control de la hoja en un `useEffect` que corre
  después del `autoFocus` de React y lo pisaba. La hoja ahora prioriza un control marcado
  `data-autofocus`, y `ConsumoForm` lo pone en la cantidad solo en desktop (R4).
- **Texto del aviso**: `registrarConsumo` pasa "Consumido 4 cajas de …" en `detalle` y
  `AvisosConsumo` lo usa (T016), igual que el traslado.
- **Pruebas de US2 y US3** quedaron en `tests/integration/acciones-rapidas.test.tsx` junto a las de
  US1 (mismo arnés con `AvisosConsumo`); T015 y T017 reemplazan los casos de la spec 007.
- **`ingreso-precio.test.tsx`** solo cambió el nombre de la prop (`onConsumir`).
- **Línea base** (T001): 1131 pruebas; ~10 fallan por timeout de 5 s con la máquina cargada (load ≈
  20) y cambian de una corrida a otra (paginación, tratamientos, reportes, enviar-pedido, etc.).

- **Final** (T022): lint y build en verde; suite completa 1140 pruebas. En la corrida con la máquina
  cargada fallaron 17 por timeout; un fallo real (`tests/integration/consumo.test.tsx`, cuyo mock de
  Dexie no tenía `transaction`) se corrigió. Repetidos con `--maxWorkers=2`, los 9 archivos pasan salvo
  `enviar-pedido`, que pasa solo (8/8), igual que en la línea base.
- **Recorrido** (T023, `run-indentory`): móvil 375 px y desktop 1440 px. La hoja abre con 1 y el lote
  vigente (L-VIG, no L-VEN); 2 toques consumen 1; "Fresa" (solo vencido) muestra "Lote vencido"; el
  menú solo tiene "Ver detalle" (personal); en desktop el campo abre enfocado y escribir 4 reemplaza
  el 1; los avisos dicen "Consumido 1 caja" y "Consumido 4 cajas". El "Error de sincronización" de
  las capturas es por no tener backend local.

**Organization**: por historia de spec.md. `R#` = research.md, "UI §n" = `contracts/ui-contracts.md`,
"DM" = data-model.md, "QS" = quickstart.md. No hay migración ni cambio de Dexie.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US3 de spec.md

---

## Phase 1: Setup

- [X] T001 Confirmar la línea base en la rama `025-consumir-sin-atajo`: `npm run lint && npm test` en
  verde (anotar el total de pruebas y las intermitentes conocidas por timeout)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: selección de lote y registro de consumo compartidos (R1, R2, UI §4).

- [X] T002 [P] Pruebas de `selectLoteConsumo` en `tests/unit/fefo.test.ts`: vigente antes que vencido
  aunque el vencido venza antes; vence hoy = vigente; sin fecha al final; ninguno cubre → primer
  vigente; solo vencidos → vencido más próximo; sin stock → `null` (DM Reglas)
- [X] T003 [P] Pruebas de `tests/unit/insumos/consumo.test.ts` (migrar desde
  `tests/unit/insumos/consumoRapido.test.ts` los casos de deshacer y concurrencia):
  `disponibilidadConsumo` (stock 0,5 → ok; solo vencido → ok; 0 → `sin-stock`); `registrarConsumo`
  escribe 1 `consumo` con unidad y lugar, vibra y agrega el aviso `consumo`; rechaza sin escribir si
  el stock recalculado no alcanza; dos registros concurrentes de 1 sobre un lote de 1 → solo uno
  escribe; `deshacerConsumo` restaura una sola vez
- [X] T004 Implementar `selectLoteConsumo(lotesConStock, cantidad, hoy)` en
  `src/features/insumos/lib/fefo.ts` usando `estaVencido` de `src/features/alertas/lib/caducidad.ts`
  (R1); actualizar el comentario de `repartirFefo` que cita "Consumir 1"
- [X] T005 Crear `src/features/insumos/lib/consumo.ts` con `disponibilidadConsumo`,
  `lotesConStockDeInsumo`, `registrarConsumo` (transacción `rw` lotes/movimientos/insumos/
  cambiosInsumo, stock vía `movimientosNormalizadosDeLote`, error tipado de stock insuficiente con el
  mensaje actual, `vibrarLeve` y aviso tras el commit) y `deshacerConsumo` movido sin cambios (R2, R3)
- [X] T006 Cambiar el import de `deshacerConsumo` en `src/stores/avisosStore.ts` y en
  `tests/unit/avisosStore.test.ts`

**Checkpoint**: T002 y T003 en verde; `consumoRapido.ts` todavía existe.

---

## Phase 3: User Story 1 — Consumir eligiendo la cantidad desde el botón principal (P1) 🎯 MVP

**Goal**: "Consumir" abre la hoja con cantidad 1 y lote vigente; confirmar registra; nada se registra
sin confirmar.

**Independent Test**: QS pasos 1, 2, 4–7, 9–11.

### Tests (primero, deben fallar)

- [X] T007 [P] [US1] En `tests/integration/acciones-rapidas.test.tsx`, reemplazar los casos de
  "Consumir 1": tocar "Consumir" abre "Consumir <insumo>" sin escribir movimientos; cantidad inicial
  1; confirmar registra 1 y cierra la hoja conservando el filtro de texto; escribir 4 registra 4;
  cerrar sin confirmar no escribe; vencido + vigente → propone el vigente; solo vencido → botón
  habilitado y "Lote vencido" visible; stock 0 → "Sin stock" deshabilitado; stock 0,5 ml → habilitado
- [X] T008 [P] [US1] `tests/integration/inventario-tabla.test.tsx`: "Consumir" en la fila abre la
  hoja; confirmar registra; "Sin stock" con stock 0
- [X] T009 [P] [US1] `tests/integration/vista-todos.test.tsx`: en "Todos", "Consumir" pregunta el
  lugar y registra en el elegido sin salir de "Todos"
- [X] T010 [P] [US1] `tests/integration/conversion-unidad.test.tsx`: el caso "Consumir 1 descuenta
  una unidad, no una caja" pasa a `registrarConsumo` con cantidad 1; revisar
  `tests/integration/ingreso-precio.test.tsx`

### Implementation

- [X] T011 [US1] `src/features/insumos/components/ConsumoForm.tsx`: prop `cantidadInicial`; lote por
  defecto con `selectLoteConsumo(lotesConStock, cantidad, new Date())`; opción del selector con "—
  vencido"; badge "Lote vencido" en lugar de "Recomendado FEFO" si el lote elegido está vencido (R6);
  `onFocus` selecciona el contenido; `autoFocus` solo si `useDisposicion() === 'desktop'` (R4);
  enviar con `registrarConsumo` y mostrar su error en la hoja; quitar `mensajeExito`
- [X] T012 [P] [US1] `src/features/insumos/components/InsumoCard.tsx`: prop `onConsumir` y
  `disponibilidad: DisponibilidadConsumo`; texto "Consumir", `aria-label` "Consumir <insumo>";
  `MOTIVO_DESHABILITADO` solo con `sin-stock` (UI §1)
- [X] T013 [P] [US1] `src/features/insumos/components/InventarioTabla.tsx`: mismo cambio que T012
- [X] T014 [US1] `src/features/insumos/components/InventarioView.tsx`: `disponibilidadConsumo` en
  lugar de `selectLoteConsumoRapido`; `abrirConsumo(insumoId)` (en "Todos" → `elegirLugar` con
  `accion: 'consumir'`; si no → `overlay: { tipo: 'consumir' }`); quitar `handleConsumirUno`,
  `consumirUno` y `'consumirUno'` de `AccionConLugar`; pasar `cantidadInicial={1}` a `ConsumoForm`;
  actualizar el comentario de spec 007 (R5)

**Checkpoint**: T007–T010 en verde. MVP utilizable.

---

## Phase 4: User Story 2 — Deshacer un consumo recién registrado (P2)

**Goal**: el consumo confirmado desde la hoja muestra el aviso con "Deshacer".

**Independent Test**: QS paso 3.

- [X] T015 [US2] En `tests/integration/acciones-rapidas.test.tsx` (con `AvisosConsumo` montado):
  confirmar desde la hoja muestra "Deshacer consumo de <insumo>"; tocarlo restaura el stock; un
  segundo toque no cambia nada; el aviso expira a `DURACION_AVISO_MS`
- [X] T016 [US2] `src/app/AvisosConsumo.tsx` (`textoAviso`) hoy dice siempre "Consumido 1 <unidad>
  de <insumo>": usar la cantidad real. `registrarConsumo` la pasa en `detalle` del aviso (como el
  traslado) con `formatearCantidad` ("Consumido 4 cartuchos de Anestesia"); prueba en
  `tests/unit/avisosStore.test.ts` o en T015

**Checkpoint**: T015 en verde.

---

## Phase 5: User Story 3 — Sin acciones duplicadas en el menú (P3)

**Goal**: el menú "⋮" no tiene "Consumir otra cantidad".

**Independent Test**: QS paso 8.

- [X] T017 [US3] Prueba en `tests/integration/acciones-rapidas.test.tsx`: el menú (botón "⋮" y toque
  largo) muestra Ver detalle y, para admin, Editar/Eliminar, pero no "Consumir otra cantidad"
- [X] T018 [US3] `src/features/insumos/components/InsumoAccionesMenu.tsx`: quitar la opción y la prop
  `onConsumirOtraCantidad`; quitar el `onConsumirOtraCantidad` que pasa `InventarioView.tsx`

---

## Phase 6: Polish & Cross-Cutting

- [X] T019 Eliminar `src/features/insumos/lib/consumoRapido.ts` y
  `tests/unit/insumos/consumoRapido.test.ts`; `grep -rn "consumoRapido\|Consumir 1\|consumirUno"
  src tests` sin resultados (salvo comentarios históricos que se reescriban)
- [X] T020 [P] Actualizar comentarios que citan "Consumir 1" en `src/features/insumos/lib/traslado.ts`
  y `src/features/tratamientos/lib/registro.ts`
- [X] T021 [P] Nota al inicio de `specs/007-acciones-rapidas-consumo-edicion/spec.md`: FR-001 a FR-003
  y FR-007 reemplazados por la spec 025; y en `ROADMAP-006-010.md` junto a "Consumir 1"
- [X] T022 `npm run lint && npm run build && npm test` en verde (incluye `lecturas-movimientos`)
- [X] T023 Recorrido manual de [quickstart.md](./quickstart.md) con `run-indentory` (móvil y
  desktop) y capturas
- [X] T024 Notas de despliegue en `README.md` (release solo front, sin `db push`; avisar al equipo del
  cambio a "Consumir")

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T006)** → US1 (T007–T014) → US2 (T015–T016) y US3
  (T017–T018), que pueden ir en paralelo → Polish (T019–T024).
- US2 depende de que la hoja registre con `registrarConsumo` (T011). US3 es independiente de US2.
- T019 va al final: hasta entonces `consumoRapido.ts` puede seguir existiendo sin usarse.

### Parallel Opportunities

- T002 ∥ T003 (pruebas en archivos distintos).
- T007 ∥ T008 ∥ T009 ∥ T010 (un archivo de pruebas cada una).
- T012 ∥ T013 (componentes distintos), después de T005.
- T020 ∥ T021.

## Implementation Strategy

1. **MVP**: Phases 1–3. Con eso el botón ya hace lo pedido y el lote por defecto es seguro.
2. **Incremento**: Phase 4 (Deshacer) y Phase 5 (menú).
3. **Cierre**: Phase 6, PR a `develop` con capturas, release solo front.
