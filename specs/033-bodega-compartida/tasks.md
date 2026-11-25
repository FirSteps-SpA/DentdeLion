---

description: "Task list for 033-bodega-compartida"
---

# Tasks: Lugares que comparten bodega

**Input**: Design documents from `/specs/033-bodega-compartida/`

**Tests**: SÍ (plan.md § Testing).

**Orden**: US2 se implementa antes que US1 (plan.md § Orden sugerido): juntar sin stock común no
sirve. Las fases siguen ese orden de ejecución; las prioridades de la spec no cambian.

## Phase 1: Setup

- [x] T001 Línea base: `npm run lint && npx tsc -b && npx vitest run --testTimeout=20000` y
  `npm run test:rls` (anotar las fallas previas conocidas: timeouts por carga y "estimación: sin
  clave…"). Resultado (2026-11-24): lint y tipos ok; 1365/1369. Las 4 que fallan son por carga:
  `enviar-pedido`, `inventario-paginacion` ("Ver más"), `tratamientos` (crear) y `reportes/rendimiento`
  < 300 ms. `test:rls`: solo falla "estimación: sin clave…"

## Phase 2: Foundational (bloquea todas las historias)

**Checkpoint**: con todos los lugares en `bodegaId = null` nada cambia (FR-019). La suite actual
debe seguir en verde al terminar esta fase.

- [x] T002 Migración `supabase/migrations/20261128000000_bodega_compartida.sql`: `bodega_id`, índice y
  check `lugares_bodega_no_es_lugar` (contracts/api.md). Aplicada con `psql` dentro del contenedor
  local más la fila en `schema_migrations`, porque `migration up` se negaba: la base local tiene la
  `20261127…` de la spec 032, que no está en esta rama
- [x] T003 Controles 1–6 de contracts/api.md en `scripts/test-rls.mjs`; `npm run test:rls` en verde
  (salvo las fallas previas de T001)
- [x] T004 [P] `Lugar.bodegaId` en `src/lib/db/index.ts` (sin versión nueva de Dexie) y mapeo
  `bodega_id` en `toLugarRow`/`fromLugarRow` de `src/lib/sync/index.ts`. Test de ida y vuelta, con
  una fila sin la clave igual a `null`
- [x] T005 [P] Consultas de bodega en `src/stores/lugarStore.ts`: `bodegaDe`, `lugaresDeBodega`
  (solo activos, memoizado) y `rotuloBodega` (data-model § Bodega), con
  `tests/unit/bodega.test.ts`. Se agregaron `comparteBodega` y `bodegasActivas` para US1/US2
- [x] T006 Stock por conjunto en `src/features/insumos/lib/stock.ts`: `lotesEnBodega` y
  `stockLoteEnBodega` (reemplazan las versiones por lugar, que quedan como caso de un elemento)
- [x] T007 `datosDeBodega` en `src/features/insumos/lib/vistaLugar.ts` (filtro por `Set`, research
  R2). `useInventarioDeLugar` usa la bodega del lugar activo
- [x] T008 Mínimo efectivo de la bodega (el mayor) en `src/features/insumos/lib/minimos.ts`
  (research R4). Los tests quedaron en `tests/unit/stockPorLugar.test.ts` (describe "bodega
  compartida"), junto a los de la vista por lugar, para reutilizar sus datos
- [x] T009 Correr la suite completa: sin regresiones con bodegas propias (FR-019). Resultado:
  lint y tipos ok; 1375/1377. Las 2 que fallan (`enviar-pedido` y `reportes/rendimiento`) son las de
  la línea base y pasan aisladas

## Phase 3: US2 — Consumir y reponer desde cualquier lugar de la bodega (P1) 🎯

**Goal**: con `bodegaId` compartido (puesto a mano en los tests), todos los lugares de la bodega ven
y usan el mismo stock.

**Independent Test**: spec US2, quickstart §2 y §4.

- [x] T010 [P] [US2] Validación contra el stock común en `src/features/insumos/lib/consumo.ts`,
  `ajusteStock.ts` y `conversion.ts` (research R3), con casos en `tests/unit/consumo-bodega.test.ts`:
  consumir en Box 2 un lote ingresado en Box 1. También `ConsumoForm.tsx`, el descarte de vencidos
  al recibir y "Stock por lote" en Editar (en "Todos", un renglón por bodega). `bodegaSegunStore`
  (lugarStore) da la bodega dentro de las transacciones. La conversión sigue validando el **saldo
  propio** de cada lugar a propósito: es más estricta y deja cada saldo en unidades enteras, que es
  lo que se traslada al separar (US3)
- [x] T011 [P] [US2] Consumo de tratamientos contra el stock común en
  `src/features/tratamientos/lib/registro.ts` y `RegistrarTratamientoSheet.tsx`
- [x] T012 [P] [US2] `reconcileOverdraft` por bodega en `src/lib/sync/reconcileOverdraft.ts`, con
  `tests/unit/reconcile-bodega.test.ts` (dos consumos sin conexión en dos lugares → En revisión).
  Los casos quedaron en `tests/unit/reconcileOverdraft.test.ts` (describe "bodega compartida"), que
  ya tenía el mock de `db`
- [x] T013 [US2] Traslados en `src/features/insumos/lib/traslado.ts` y `TrasladoForm.tsx`: destinos
  sin la misma bodega, validación con `stockLoteEnBodega`, y sin "Trasladar" si no hay destinos
  (FR-016, ui-contracts §4). `destinosDeTraslado`; "Trasladar" aparece con 2 o más bodegas
- [x] T014 [US2] "Todos" por bodega en `vistasDeLugar`/`porLugar` (`vistaLugar.ts`):
  `VistaLugar.lugares` y rótulo. Adaptar `InventarioView.tsx`, `AlertasView.tsx` e `InicioView.tsx`
  (FR-014, ui-contracts §3). La vista de una bodega compartida lleva su primer lugar con el rótulo
  como `nombre`, así los chips no cambian. El desglose de Inventario pasó a "Nombre: N" para que
  "Box 1 + Box 2: 6" no se lea "Box 2 6" (se ajustó `vista-todos.test.tsx`)
- [x] T015 [US2] Compras comunes en `src/features/compras/components/ComprasView.tsx`: ítems de la
  bodega y "Agregado en …" en bodegas compartidas (FR-013, research R8). Un sugerido se identifica
  por el primer lugar de la bodega (`representanteDeBodega`), así lo marcado sigue marcado en el
  otro lugar. Fuera de "Todos", un manual se recibe en el lugar activo
- [x] T016 [US2] Valor del inventario por bodega en `src/features/reportes/lib/valorInventario.ts` y
  su vista: "Stock compartido con …" y filas por bodega en "Todos", sin doble conteo (FR-015,
  SC-004). Verificar que consumo, gasto y KPIs siguen por lugar del movimiento. Hoy "Todos" era un
  solo total: las filas por bodega se agregan como notas de la tarjeta y solo si hay alguna bodega
  compartida (FR-019)
- [x] T017 [US2] Mínimo en Editar insumo y en el editor de Ajustes escribe en todos los lugares de la
  bodega: `EditarInsumoForm.tsx`, `src/features/ajustes/lib/minimosEditor.ts` y `guardarMinimoLugar`.
  El campo muestra `minimoPropioBodega` ("Stock mínimo en Box 1 + Box 2"); el editor de Ajustes
  en "Todos" lista uno por bodega
- [x] T018 [US2] Selector de lugar "Box 2 · bodega con Box 1" en `src/app/SelectorLugar.tsx`
  (ui-contracts §2). También en `ElegirLugarSheet` (selector del teléfono y "¿En qué lugar?")
- [x] T019 [P] [US2] `tests/integration/inventario-bodega.test.tsx`: mismo stock y lotes en ambos
  lugares, consumo cruzado, alertas una sola vez, "Todos" sin duplicar, traslado sin destinos de la
  bodega
- [x] T020 [P] [US2] `tests/integration/compras-bodega.test.tsx` y
  `tests/integration/reportes-bodega.test.tsx` (ítem visible y recibible en el otro lugar; valor sin
  doble conteo; consumo por lugar del movimiento). Checkpoint: lint y tipos ok; 1406/1406

## Phase 4: US1 — Configurar dos lugares para que compartan bodega (P1)

**Goal**: administración junta lugares desde Ajustes con una confirmación que resume el efecto y
unifica mínimos.

**Independent Test**: spec US1, quickstart §1.

- [x] T021 [US1] `compartirBodega(lugarId, conLugarId, minimosElegidos)` en
  `src/features/insumos/lib/bodega.ts` (research R5): `bodegaId` resultante, unión de grupos,
  mínimos escritos en todos, `sincronizado: false`, sin movimientos. Más
  `resumenDeJuntar` (insumos con stock en ambos y mínimos distintos). El `bodegaId` resultante es el
  de `conLugarId`, si no el de `lugarId`, si no uno nuevo
- [x] T022 [P] [US1] `tests/unit/compartir-bodega.test.ts`: uuid nuevo, unir a una bodega existente,
  unir dos bodegas, mínimos por defecto el mayor, stock común = suma (SC-001)
- [x] T023 [US1] UI en `src/features/ajustes/components/LugaresSection.tsx`: "Comparte bodega con …",
  "Compartir bodega con…", confirmación con resumen y selector de mínimos, solo administración
  (ui-contracts §1, FR-004/005). "Compartir bodega" aparece con 2 o más bodegas; el contador "N
  insumos con stock" pasa a ser el de la bodega. Recorrido con el driver (móvil): juntar Box 2 con
  Clínica → los dos muestran "Comparte bodega con …", Inventario muestra 3 cajas (2 + 1) y el
  selector "Box 2 · bodega con Clínica"
- [x] T024 [P] [US1] `tests/integration/lugares-bodega.test.tsx` (juntar): confirmación, resultado en
  Inventario de ambos lugares, el personal no ve la acción, un solo lugar → sin opción. Lo del
  personal queda cubierto porque la sección Lugares es solo de administración
  (`SECCIONES_AJUSTES`) y `compartirBodega` lo rechaza (T022). Checkpoint: lint y tipos ok; 1413/1417. Las 4 que fallan son
  de tiempo (`enviar-pedido` y los rendimientos de `inventario-tabla`, Reportes y montos) y pasan
  aisladas

## Phase 5: US3 — Dejar de compartir bodega (P2)

**Goal**: separar un lugar (queda en 0, la bodega conserva todo) y desactivar lugares de una bodega.

**Independent Test**: spec US3, quickstart §3.

- [x] T025 [US3] `separarDeBodega(lugarId)` en `src/features/insumos/lib/bodega.ts` (research R6,
  data-model § Movimientos al separar): traslados por saldo propio ±, `bodegaId = null` y también el
  del último lugar si queda solo, en una transacción. El traslado sale de `escribirPar`
  (`traslado.ts`, ahora exportado), contra el primer lugar activo que queda en la bodega
- [x] T026 [P] [US3] `tests/unit/separar-bodega.test.ts`: saldo positivo, negativo y cero, bodega de
  dos y de tres lugares, historial intacto, stock final (Box 2 = 0, el resto = total), mínimo que
  conserva el separado. También desactivar con separación previa (`desactivarLugar` separa en la
  misma transacción). Checkpoint: lint y tipos ok; 1426/1427 (falla solo el rendimiento de
  `inventario-tabla` por carga, pasa aislado). `lecturas-movimientos` pidió leer los lotes del
  lugar desde `stock.ts` (`lotesConMovimientosEnLugar`)
- [x] T027 [US3] UI "Dejar de compartir bodega" y desactivar con separación previa en
  `LugaresSection.tsx` (FR-007/010, ui-contracts §1). Recorrido con el driver (móvil): juntar y
  separar Box 2 → Clínica conserva 3 cajas y Box 2 queda en 0 ("Sin stock")
- [x] T028 [P] [US3] Casos de separar y desactivar en `tests/integration/lugares-bodega.test.tsx`

## Phase 6: Polish

- [x] T029 [P] Guía de uso en `src/features/ayuda/contenido.ts` ("Lugares": compartir y dejar de
  compartir bodega; aviso de traslados dentro de la bodega) y `tests/integration/ayuda.test.tsx`
- [x] T030 [P] README: paso de despliegue (no configurar bodegas hasta actualizar los dispositivos,
  research R9)
- [x] T031 `npm run lint && npm run build && npx vitest run --testTimeout=20000`; `test:rls`; recorrido
  de quickstart §1–§4 con el driver (móvil y desktop). Resultado (2026-11-25): lint y build ok;
  1426/1428 (`enviar-pedido` y el rendimiento de Reportes, por carga; pasan aislados); `test:rls`
  con los 6 controles de bodega en verde y solo la falla previa de "estimación". Driver: §1 y §3 en
  móvil (juntar → 3 cajas en los dos; separar → Clínica 3, Box 2 en 0); §1–§2 en desktop con tres
  lugares (rótulo y "Comparte bodega con …", "Todos" con "Clínica + Box 2: 3 · Las Condes: 4" y 2
  alertas, consumo en Box 2 del lote de Clínica, traslado solo hacia Las Condes). §4 (dos pestañas
  sin conexión) no se puede con el driver, que abre un perfil nuevo por corrida; lo cubren las
  pruebas de `reconcileOverdraft`. A 1440 px la columna Acciones de la tabla se corta: es lo que
  arregla la spec 032, que esta rama no tiene

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
