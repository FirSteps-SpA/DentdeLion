---

description: "Task list for 033-bodega-compartida"
---

# Tasks: Lugares que comparten bodega

**Input**: Design documents from `/specs/033-bodega-compartida/`

**Tests**: SÍ (plan.md § Testing).

**Orden**: US2 se implementa antes que US1 (plan.md § Orden sugerido): juntar sin stock común no
sirve. Las fases siguen ese orden de ejecución; las prioridades de la spec no cambian.

## Phase 1: Setup

- [ ] T001 Línea base: `npm run lint && npx tsc -b && npx vitest run --testTimeout=20000` y
  `npm run test:rls` (anotar las fallas previas conocidas: timeouts por carga y "estimación: sin
  clave…")

## Phase 2: Foundational (bloquea todas las historias)

**Checkpoint**: con todos los lugares en `bodegaId = null` nada cambia (FR-019). La suite actual
debe seguir en verde al terminar esta fase.

- [ ] T002 Migración `supabase/migrations/20261128000000_bodega_compartida.sql`: `bodega_id`, índice y
  check `lugares_bodega_no_es_lugar` (contracts/api.md). Aplicar con `supabase migration up --local`
- [ ] T003 Controles 1–6 de contracts/api.md en `scripts/test-rls.mjs`; `npm run test:rls` en verde
  (salvo las fallas previas de T001)
- [ ] T004 [P] `Lugar.bodegaId` en `src/lib/db/index.ts` (sin versión nueva de Dexie) y mapeo
  `bodega_id` en `toLugarRow`/`fromLugarRow` de `src/lib/sync/index.ts`. Test de ida y vuelta, con
  una fila sin la clave igual a `null`
- [ ] T005 [P] Consultas de bodega en `src/stores/lugarStore.ts`: `bodegaDe`, `lugaresDeBodega`
  (solo activos, memoizado) y `rotuloBodega` (data-model § Bodega), con
  `tests/unit/bodega.test.ts`
- [ ] T006 Stock por conjunto en `src/features/insumos/lib/stock.ts`: `lotesEnBodega` y
  `stockLoteEnBodega` (reemplazan las versiones por lugar, que quedan como caso de un elemento)
- [ ] T007 `datosDeBodega` en `src/features/insumos/lib/vistaLugar.ts` (filtro por `Set`, research
  R2). `useInventarioDeLugar` usa la bodega del lugar activo
- [ ] T008 Mínimo efectivo de la bodega (el mayor) en `src/features/insumos/lib/minimos.ts`
  (research R4), con `tests/unit/minimos-bodega.test.ts`
- [ ] T009 Correr la suite completa: sin regresiones con bodegas propias (FR-019)

## Phase 3: US2 — Consumir y reponer desde cualquier lugar de la bodega (P1) 🎯

**Goal**: con `bodegaId` compartido (puesto a mano en los tests), todos los lugares de la bodega ven
y usan el mismo stock.

**Independent Test**: spec US2, quickstart §2 y §4.

- [ ] T010 [P] [US2] Validación contra el stock común en `src/features/insumos/lib/consumo.ts`,
  `ajusteStock.ts` y `conversion.ts` (research R3), con casos en `tests/unit/consumo-bodega.test.ts`:
  consumir en Box 2 un lote ingresado en Box 1
- [ ] T011 [P] [US2] Consumo de tratamientos contra el stock común en
  `src/features/tratamientos/lib/registro.ts` y `RegistrarTratamientoSheet.tsx`
- [ ] T012 [P] [US2] `reconcileOverdraft` por bodega en `src/lib/sync/reconcileOverdraft.ts`, con
  `tests/unit/reconcile-bodega.test.ts` (dos consumos sin conexión en dos lugares → En revisión)
- [ ] T013 [US2] Traslados en `src/features/insumos/lib/traslado.ts` y `TrasladoForm.tsx`: destinos
  sin la misma bodega, validación con `stockLoteEnBodega`, y sin "Trasladar" si no hay destinos
  (FR-016, ui-contracts §4)
- [ ] T014 [US2] "Todos" por bodega en `vistasDeLugar`/`porLugar` (`vistaLugar.ts`):
  `VistaLugar.lugares` y rótulo. Adaptar `InventarioView.tsx`, `AlertasView.tsx` e `InicioView.tsx`
  (FR-014, ui-contracts §3)
- [ ] T015 [US2] Compras comunes en `src/features/compras/components/ComprasView.tsx`: ítems de la
  bodega y "Agregado en …" en bodegas compartidas (FR-013, research R8)
- [ ] T016 [US2] Valor del inventario por bodega en `src/features/reportes/lib/valorInventario.ts` y
  su vista: "Stock compartido con …" y filas por bodega en "Todos", sin doble conteo (FR-015,
  SC-004). Verificar que consumo, gasto y KPIs siguen por lugar del movimiento
- [ ] T017 [US2] Mínimo en Editar insumo y en el editor de Ajustes escribe en todos los lugares de la
  bodega: `EditarInsumoForm.tsx`, `src/features/ajustes/lib/minimosEditor.ts` y `guardarMinimoLugar`
- [ ] T018 [US2] Selector de lugar "Box 2 · bodega con Box 1" en `src/app/SelectorLugar.tsx`
  (ui-contracts §2)
- [ ] T019 [P] [US2] `tests/integration/inventario-bodega.test.tsx`: mismo stock y lotes en ambos
  lugares, consumo cruzado, alertas una sola vez, "Todos" sin duplicar, traslado sin destinos de la
  bodega
- [ ] T020 [P] [US2] `tests/integration/compras-bodega.test.tsx` y
  `tests/integration/reportes-bodega.test.tsx` (ítem visible y recibible en el otro lugar; valor sin
  doble conteo; consumo por lugar del movimiento)

## Phase 4: US1 — Configurar dos lugares para que compartan bodega (P1)

**Goal**: administración junta lugares desde Ajustes con una confirmación que resume el efecto y
unifica mínimos.

**Independent Test**: spec US1, quickstart §1.

- [ ] T021 [US1] `compartirBodega(lugarId, conLugarId, minimosElegidos)` en
  `src/features/insumos/lib/bodega.ts` (research R5): `bodegaId` resultante, unión de grupos,
  mínimos escritos en todos, `sincronizado: false`, sin movimientos. Más
  `resumenDeJuntar` (insumos con stock en ambos y mínimos distintos)
- [ ] T022 [P] [US1] `tests/unit/compartir-bodega.test.ts`: uuid nuevo, unir a una bodega existente,
  unir dos bodegas, mínimos por defecto el mayor, stock común = suma (SC-001)
- [ ] T023 [US1] UI en `src/features/ajustes/components/LugaresSection.tsx`: "Comparte bodega con …",
  "Compartir bodega con…", confirmación con resumen y selector de mínimos, solo administración
  (ui-contracts §1, FR-004/005)
- [ ] T024 [P] [US1] `tests/integration/lugares-bodega.test.tsx` (juntar): confirmación, resultado en
  Inventario de ambos lugares, el personal no ve la acción, un solo lugar → sin opción

## Phase 5: US3 — Dejar de compartir bodega (P2)

**Goal**: separar un lugar (queda en 0, la bodega conserva todo) y desactivar lugares de una bodega.

**Independent Test**: spec US3, quickstart §3.

- [ ] T025 [US3] `separarDeBodega(lugarId)` en `src/features/insumos/lib/bodega.ts` (research R6,
  data-model § Movimientos al separar): traslados por saldo propio ±, `bodegaId = null` y también el
  del último lugar si queda solo, en una transacción
- [ ] T026 [P] [US3] `tests/unit/separar-bodega.test.ts`: saldo positivo, negativo y cero, bodega de
  dos y de tres lugares, historial intacto, stock final (Box 2 = 0, el resto = total), mínimo que
  conserva el separado
- [ ] T027 [US3] UI "Dejar de compartir bodega" y desactivar con separación previa en
  `LugaresSection.tsx` (FR-007/010, ui-contracts §1)
- [ ] T028 [P] [US3] Casos de separar y desactivar en `tests/integration/lugares-bodega.test.tsx`

## Phase 6: Polish

- [ ] T029 [P] Guía de uso en `src/features/ayuda/contenido.ts` ("Lugares": compartir y dejar de
  compartir bodega; aviso de traslados dentro de la bodega) y `tests/integration/ayuda.test.tsx`
- [ ] T030 [P] README: paso de despliegue (no configurar bodegas hasta actualizar los dispositivos,
  research R9)
- [ ] T031 `npm run lint && npm run build && npx vitest run --testTimeout=20000`; `test:rls`; recorrido
  de quickstart §1–§4 con el driver (móvil y desktop)

## Dependencies

- Phase 2 bloquea todo. Dentro de ella: T002 → T003. T004 y T005 en paralelo. T006 → T007 → T008 →
  T009.
- US2 (Phase 3) depende de Phase 2. T010–T012 en paralelo; T013–T018 en cualquier orden; los tests
  T019–T020 al final de la fase.
- US1 (Phase 4) depende de Phase 2. Puede ir en paralelo con US2, pero no se publica sin US2.
- US3 (Phase 5) depende de US1 (necesita bodegas para separar) y de T006 (saldo propio por lote).
- Polish al final.

## Parallel Examples

- Phase 2: T004 + T005 a la vez, mientras corre T003.
- US2: T010 + T011 + T012 a la vez (archivos distintos).
- US1 + US3: T022 y T026 (tests unitarios puros) a la vez una vez escritos T021 y T025.

## Implementation Strategy

1. **Fundación sin cambios visibles** (Phase 2): se puede integrar y publicar sola. Prepara el dato y
   no cambia nada para nadie (FR-019).
2. **MVP = Phase 2 + US2 + US1**: juntar y operar. Es lo que la clínica necesita.
3. **US3** completa la reversibilidad. Se puede publicar en la misma versión o justo después, pero
   antes de que la clínica configure bodegas en producción, para que no queden sin forma de
   separarlas.
4. Desplegar según quickstart § Despliegue: migración → front → esperar actualización de los
   dispositivos → recién ahí configurar bodegas.
