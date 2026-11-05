---

description: "Task list for 024-ajuste-de-stock"
---

# Tasks: Descarte de vencidos al reponer y ajuste de stock por lote

**Input**: Design documents from `/specs/024-ajuste-de-stock/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. Las definen plan.md (Testing) y `contracts/ui-contracts.md` §6. Se sigue el patrón del
proyecto: Vitest + RTL con `fireEvent` (no hay `user-event`) y los helpers de `tests/helpers/`
(`memoryDb.ts`, `tablasMemoria.ts`, `lugarFalso.ts`, `authFalso.ts`, `compras.ts`, `proveedor.ts`).
Las pruebas de cada historia se escriben primero y deben fallar antes de implementar.

**Desvíos al implementar**:

- **`guardarEdicionInsumo`** va en `insumos/lib/ajusteStock.ts`, no en `catalogo.ts`. Así se evita un
  import circular, porque `ajusteStock` ya importa `exigirAdministrador`/`editarInsumo` de `catalogo`.
- **Mock de Dexie** (`tests/helpers/memoryDb.ts`): `transaction()` encolaba todo y una transacción
  anidada se bloqueaba esperando a la externa. Ahora, con `AsyncLocalStorage`, la interna corre dentro
  de la externa y un error revierte todo, como en Dexie. Las pruebas existentes no cambiaron.
- **Pruebas de US2/US3** van en `tests/integration/acciones-rapidas.test.tsx` y no en
  `inventario.test.tsx`, porque ahí viven las de edición y baja (spec 007).
- **`NumeroInput` de Stock por lote** con `step="any"` siempre: con `step=1` el navegador bloqueaba el
  envío con su aviso nativo antes de mostrar "Esta unidad no admite decimales.".
- **Etiqueta de la diferencia**: "Ajuste: −4 cajas" en vez de "→ quedará N (±d)", porque la cantidad
  ya se ve en el campo.
- **`estaVencido`** también la usa `computeAlertasCaducidad` para decidir `'caducado'`. El chequeo
  `< 0` de `nivelAplicable` sigue igual y es equivalente.
- **Línea base**: 1087 pruebas. Con la máquina cargada (load ≈ 18) fallan por timeout de 5 s algunas
  de paginación, `tratamientos`, `rendimiento` y `enviar-pedido`, y cambian de una corrida a otra.
  Corridas solas pasan. En la final pasaron 1130 de 1131; la única falla fue `enviar-pedido`, que pasa
  sola (8/8). No se ve en las capturas, pero ya se veía antes: la tarjeta de Compras dice "6 caja"
  (singular), algo previo a esta spec.

**Organization**: por historia de spec.md. `R#` = research.md, "UI §n" = `contracts/ui-contracts.md`,
"DM" = data-model.md, "QS" = quickstart.md. No hay migración ni cambio de Dexie.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US3 de spec.md

---

## Phase 1: Setup

- [X] T001 Confirmar la línea base en la rama `024-ajuste-de-stock`: `npm run lint && npm test` en
  verde antes de tocar código. Anotar la cantidad de pruebas y archivos para comparar en T030.

---

## Phase 2: Foundational (bloquea US1 y US2)

**Purpose**: helpers puros de "vencido" y de stock por lote, y la detección de sobregiro, que comparten
las tres historias.

- [X] T002 [P] Pruebas de `estaVencido` en `tests/unit/alertas/caducidad.test.ts` (ajustar): vence ayer → `true`; hoy → `false`; mañana → `false`;
  `fechaCaducidad: null` → `false`. Mismo resultado que el nivel `'caducado'` de
  `computeAlertasCaducidad` para las mismas fechas (R2).
- [X] T003 Implementar `export function estaVencido(lote: Pick<Lote, 'fechaCaducidad'>, hoy: Date):
  boolean` en `src/features/alertas/lib/caducidad.ts` (`fechaCaducidad !== null && diasEntre(…) < 0`) y
  usarlo en `nivelAplicable`/`computeAlertasCaducidad` sin cambiar su comportamiento (UI §1).
- [X] T004 [P] Pruebas puras en `tests/unit/insumos/ajusteStock.test.ts` (nuevo) para
  `stockVencidoEnLugar` y `validarCantidadLote` (DM, UI §1):
  - solo devuelve lotes vencidos con stock > 0 en el lugar pedido;
  - ignora los de otro lugar;
  - un insumo con `caduca: false` devuelve `[]`;
  - un lote vencido en 0 no aparece;
  - la validación de cantidad rechaza negativos, `NaN` y decimales cuando `permiteDecimales: false`,
    con los mensajes de DM.
- [X] T005 Crear `src/features/insumos/lib/ajusteStock.ts` con `stockVencidoEnLugar(insumo, lotes,
  movimientos, lugarId, hoy = new Date())` (usa `stockLoteEnLugar` y `estaVencido`), el tipo
  `CorreccionStock` y `validarCantidadLote(cantidad, insumo)`. Comentarios en el estilo del módulo
  (`Spec 024 (R2/R4) — …`).
- [X] T006 [P] Prueba en `tests/unit/sync-sobregiro-ajuste.test.ts` (nuevo), siguiendo el armado de
  `tests/unit/sync-movimientos-fallo.test.ts`: un `ajuste` con `cantidad < 0` que sube (push) o llega
  (pull) y deja su lote negativo lo marca `estado: 'revision'`. Un ajuste positivo no dispara la
  verificación (R6).
- [X] T007 Cambiar `restaStock` en `src/lib/sync/index.ts` para que reciba `{ tipo, cantidad }` y cuente
  también `tipo === 'ajuste' && cantidad < 0`. Actualizar sus dos llamadas, en el push (≈ línea 1463,
  `Movimiento`) y en el pull (≈ línea 1979, `MovimientoRow`) (R6).

**Checkpoint**: `npm test` en verde, sin cambios de UI.

---

## Phase 3: User Story 1 — Reponer un insumo vencido y descartar lo vencido (Priority: P1) 🎯 MVP

**Goal**: la recepción de Compras ofrece descartar el stock vencido del lugar, marcado por defecto, en
la misma transacción que el lote nuevo.

**Independent Test**: insumo con 4 cajas vencidas, se recibe 1 caja con la casilla marcada. Debe quedar
con 1 caja, sin Caducado y fuera de Compras por vencimiento. Con la casilla desmarcada debe quedar con
5 cajas y Caducado (QS paso 1–2).

### Tests for User Story 1

- [X] T008 [P] [US1] Pruebas en `tests/unit/compras/recepcion.test.ts` (ajustar):
  - con `descartarVencidos: true` escribe un `ajuste` sin `movimientoOrigenId` por `−stock` en cada
    lote vencido con stock del lugar de la recepción, y el lote vencido queda en 0;
  - con `false` o ausente no escribe ajustes;
  - no toca vencidos de otro lugar;
  - el lote recién recibido, aunque venga vencido (con `confirmarCaducado`), no se descarta;
  - si falla algo de la transacción (por ejemplo, el proveedor), no queda ni el lote ni los ajustes;
  - un insumo con una conversión de unidad (cambio `unidadMedida` con factor) descarta la cantidad
    normalizada.
- [X] T009 [P] [US1] Prueba en `tests/unit/compras/sugeridos.test.ts` (ajustar) del caso reportado:
  4 vencidas + ingreso de 1 + ajuste −4 → `computeItemsSugeridos` ya no lo marca `caducado`; con el
  mínimo en 2 sigue como `stockBajo`.
- [X] T010 [P] [US1] Prueba en `tests/unit/reportes/gasto.test.ts` (ajustar): un `ajuste` sin origen no
  cambia `consumosValorizados` ni los montos (FR-011, SC-004).
- [X] T011 [P] [US1] Pruebas de integración en `tests/integration/compras.test.tsx` (ajustar), UI §2:
  - con vencidos en el lugar aparece la casilla "Descartar stock vencido (4 cajas)" marcada, con la
    lista "Lote … (venció …)";
  - sin vencidos, o con un insumo que no caduca, no aparece;
  - al confirmar con la casilla marcada, el ítem sale de los sugeridos por vencimiento;
  - desmarcada, el insumo sigue Caducado.

### Implementation for User Story 1

- [X] T012 [US1] En `src/features/insumos/lib/ajusteStock.ts`, implementar
  `descartarVencidosEnTransaccion(insumo, lugarId, hoy)`:
  - lee los lotes del insumo (`db.lotes.where('insumoId')`);
  - por cada lote vencido calcula su stock en el lugar con `movimientosNormalizadosDeLote` + filtro
    `lugarId` (nunca lee `db.movimientos` directo; prueba de arquitectura);
  - si es mayor que 0, crea un ajuste con `crearMovimiento({ tipo: 'ajuste', loteId, cantidad:
    −stock, lugarId })`;
  - devuelve los movimientos creados.
  Documentar que el llamador debe tener abierta una transacción con `lotes, insumos, cambiosInsumo,
  movimientos` (R2).
- [X] T013 [US1] En `src/features/compras/lib/recepcion.ts`:
  - sumar `descartarVencidos?: boolean` a `RecepcionInput`;
  - ampliar la transacción de `recibirEnInsumo` a `db.insumos` y `db.cambiosInsumo`;
  - si `input.descartarVencidos && insumo.caduca`, llamar a `descartarVencidosEnTransaccion` **antes**
    de `db.lotes.add(lote)`;
  - actualizar el JSDoc de la función (R2, UI §1).
- [X] T014 [US1] En `src/features/compras/components/RecibirItemForm.tsx` (UI §2, R3):
  - leer `lotes` y `movimientos` de `useInventoryStore`;
  - resolver el lugar con `getLugarParaEscribir(lugarId)`;
  - calcular `stockVencidoEnLugar`;
  - si la suma es mayor que 0, renderizar antes de los botones un `<label className="touch-target …">`
    con un checkbox (estado inicial `true`) y "Descartar stock vencido (" +
    `formatearCantidad(total, insumo.unidadMedida)` + `formatearEquivalente` si aplica + ")";
  - debajo, la lista "Lote X (venció AAAA-MM-DD)" en `text-xs text-text-muted`;
  - pasar `descartarVencidos` en `intentarGuardar`, incluido el reintento tras
    `ConfirmarLoteCaducadoDialog`.
- [X] T015 [US1] En `src/features/insumos/components/InsumoDetalle.tsx`, agregar `ajustesDe(loteId)`
  junto a `trasladosDe`:
  - filtra `tipo === 'ajuste' && movimientoOrigenId === null` y ordena de más nuevo a más viejo;
  - texto "Ajuste de stock: −4 cajas · <fecha> · <autor>", con signo "+" si es positivo, usando
    `cantidadConOriginal` y `autor` (R7, UI §5);
  - prueba en `tests/integration/alertas-detalle.test.tsx` (ajustar): el historial muestra la línea con
    su autor.

**Checkpoint**: el MVP resuelve el error reportado. Correr QS pasos 1, 2 y 7.

---

## Phase 4: User Story 2 — Corregir la cantidad de cada lote al editar (Priority: P2)

**Goal**: administración corrige el stock de cada `(lote, lugar)` desde Editar, y todo el formulario se
guarda en una sola transacción.

**Independent Test**: como admin, en un insumo con lotes de 3 y 5, cambiar el de 5 a 2 y guardar. El
total queda en 5 y el historial del lote muestra un ajuste de −3 (QS paso 3, 4 y 6).

### Tests for User Story 2

- [X] T016 [P] [US2] Pruebas puras de `filasStockPorLote` en `tests/unit/insumos/ajusteStock.test.ts`
  (R4):
  - en un lugar, devuelve los lotes visibles (`lotesEnLugar`), incluidos los que están en 0;
  - en `'todos'`, devuelve un renglón por cada `(lote, lugar)` con stock distinto de 0, con
    `nombreLugar`;
  - orden: vencimiento ascendente, luego los que no caducan, y en empate `creadoEn`;
  - `vencido` usa `estaVencido`.
- [X] T017 [P] [US2] Pruebas en `tests/unit/insumos/ajustarStockLotes.test.ts` (nuevo):
  - `ajustarStockLotes` escribe un ajuste por `cantidad − actual` (positivo y negativo);
  - una corrección sin diferencia no escribe nada;
  - el personal recibe "Solo un administrador puede ajustar el stock de insumos.";
  - una cantidad inválida lanza antes de escribir;
  - con un insumo convertido de unidad, el ajuste usa el stock normalizado;
  - `guardarEdicionInsumo` con un cambio de nombre válido más una corrección inválida no guarda
    ninguno de los dos, y con un error en `guardarMinimoLugar` revierte catálogo y ajustes.
- [X] T018 [P] [US2] Pruebas de integración en `tests/integration/inventario.test.tsx` (ajustar), UI §3:
  - como admin, Editar muestra "Stock por lote" con insignia "Vencido" en el lote vencido;
  - cambiar una cantidad activa Guardar y muestra la diferencia;
  - guardar crea el ajuste y el stock total cambia;
  - 1,5 en un insumo sin decimales muestra el error bajo el lote;
  - en "Todos" se ve el nombre del lugar por renglón;
  - como personal, la sección no se renderiza.

### Implementation for User Story 2

- [X] T019 [US2] En `src/features/insumos/lib/ajusteStock.ts`, implementar
  `filasStockPorLote(insumo, lotes, movimientos, vista, lugares, hoy)` y el tipo `FilaStockLote` (DM).
- [X] T020 [US2] En `src/features/insumos/lib/ajusteStock.ts`, implementar
  `ajustarStockLotes(insumoId, correcciones)`:
  - `exigirAdministrador('ajustar el stock de')`;
  - valida con `validarCantidadLote`;
  - abre `db.transaction('rw', [lotes, insumos, cambiosInsumo, movimientos])`, que pasa a ser
    subtransacción si el llamador ya tiene una;
  - por cada corrección recalcula el actual con `movimientosNormalizadosDeLote` + filtro `lugarId` y
    escribe `crearMovimiento({ tipo: 'ajuste', loteId, cantidad: diff, lugarId })` cuando
    `Math.abs(diff) > 1e-9`;
  - devuelve los ajustes creados.
- [X] T021 [US2] En `src/features/insumos/lib/catalogo.ts`, implementar
  `guardarEdicionInsumo({ insumo, cambios, correcciones, minimoLugar })` (UI §1, R4):
  - una transacción `rw` sobre `insumos, cambiosInsumo, categorias, lotes, marcas, movimientos,
    minimosLugar`;
  - dentro, llama a `editarInsumo` (si hay cambios), `ajustarStockLotes` (si hay correcciones) y
    `guardarMinimoLugar` (si `minimoLugar`).
  Si Dexie lanza `SubTransactionError`, completar la lista de tablas.
- [X] T022 [US2] En `src/features/insumos/components/EditarInsumoForm.tsx` (UI §3):
  - leer `movimientos`, `lugares`, `lugarActivoId` y el rol (`useAuthStore`);
  - calcular las filas con `filasStockPorLote`;
  - guardar el estado `cantidades` por clave `${loteId}|${lugarId}`, precargado con el stock;
  - renderizar "Stock por lote" (solo admin y con filas) antes de los botones. Cada renglón lleva:
    - "Lote X · vence …" y la insignia "Vencido" (tono `danger` + ícono caducado + texto);
    - el lugar, solo en Todos;
    - −/`NumeroInput`/+ de 48 px con `aria-label="Cantidad del lote X"` y la unidad;
    - "→ quedará N (±d unidad)" si cambió;
    - el error con `role="alert"`;
  - `hayCambios` incluye las correcciones;
  - `handleSubmit` valida las cantidades con `validarCantidadLote` y reemplaza las llamadas sueltas a
    `editarInsumo`/`guardarMinimoLugar` por una sola a `guardarEdicionInsumo`.

**Checkpoint**: US1 y US2 funcionan juntas. Correr QS pasos 3, 4 y 6.

---

## Phase 5: User Story 3 — Eliminar un insumo desde Editar (Priority: P3)

**Goal**: botón "Eliminar insumo" en el formulario, con la misma confirmación y la misma baja que el
menú.

**Independent Test**: Editar → cambiar el nombre → Eliminar insumo → Cancelar: el formulario conserva el
nombre. Luego Eliminar insumo → Eliminar: el insumo desaparece (QS paso 5).

### Tests for User Story 3

- [X] T023 [P] [US3] Pruebas de integración en `tests/integration/inventario.test.tsx` (ajustar):
  - como admin, Editar muestra "Eliminar insumo";
  - Cancelar en la confirmación conserva lo escrito en el formulario;
  - confirmar da de baja (mismo `CambioInsumo` `'baja'` que desde el menú) y cierra el formulario;
  - como personal, el botón no aparece.

### Implementation for User Story 3

- [X] T024 [US3] En `src/features/insumos/components/EditarInsumoForm.tsx`, sumar la prop
  `onEliminado?: () => void` y el estado `confirmandoBaja`, `bajaPendiente` y `errorBaja`. Si hay
  `onEliminado` y el rol es admin, renderizar al final un `TouchButton variant="ghost"` con
  `text-danger` e ícono `Trash`, "Eliminar insumo", que abre `ConfirmarBajaDialog`:
  - `stockTotal` = suma de `computeStockLote` de los lotes del insumo;
  - `onConfirmar` → `darDeBajaInsumo(insumo.id)` → `onEliminado()`;
  - el error se muestra en el diálogo;
  - `onCancelar` solo cierra el diálogo (R5).
- [X] T025 [US3] En `src/features/insumos/components/InventarioView.tsx`, pasar
  `onEliminado={() => { if (insumoSeleccionadoId === insumoOverlay.id) setInsumoSeleccionadoId(null);
  cerrarOverlay() }}` a `EditarInsumoForm` (UI §4).

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting

- [X] T026 [P] Revisar con `grep` que ningún archivo nuevo lea `db.movimientos` directo y que
  `tests/unit/lecturas-movimientos.test.ts` (arquitectura) pase.
- [X] T027 [P] Verificar táctil y visual con el skill `run-indentory`: capturas de la recepción con la
  casilla y de "Stock por lote" en teléfono (360 px), tablet y desktop. Todos los objetivos deben medir
  48 px o más y no debe haber desborde horizontal (Constitución III; QS paso 8).
- [X] T028 Recorrido manual completo de `quickstart.md` (pasos 1–7) y anotar los desvíos al inicio de
  este archivo, como en la 023.
- [X] T029 [P] Actualizar `specs/024-ajuste-de-stock/checklists/requirements.md` y, si cambió algún
  supuesto al implementar, `spec.md` (Assumptions).
- [X] T030 Corrida final: `npm run lint && npm run build && npm test` en verde. Comparar el conteo de
  pruebas con T001.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002–T007)** → US1, US2 y US3.
- **US1 (T008–T015)** depende de T003 y T005.
- **US2 (T016–T022)** depende de T003 y T005. Es independiente de US1, pero T022 y T024 tocan
  `EditarInsumoForm.tsx`, así que van en serie.
- **US3 (T023–T025)** no depende de Foundational y puede ir en paralelo a US1. Comparte archivo con
  US2 (T022 → T024).
- **Polish (T026–T030)** va después de las historias que se entreguen.

### Within Each Story

- Las pruebas [P] se escriben primero y deben fallar.
- Orden de las librerías: `ajusteStock.ts` → `recepcion.ts`/`catalogo.ts` → componentes.
- T012, T019 y T020 tocan el mismo `ajusteStock.ts`, así que van en serie.

### Parallel Opportunities

- Foundational: T002, T004 y T006 (pruebas en archivos distintos) en paralelo, y T003 ∥ T007.
- US1: T008, T009, T010 y T011 en paralelo, y después T014 ∥ T015 cuando T013 esté listo.
- US2: T016, T017 y T018 en paralelo.
- US1 y US3 completas en paralelo: no comparten archivos.

## Parallel Example: User Story 1

```bash
# Pruebas primero, en paralelo:
Task: "T008 recepcion.test.ts: descartarVencidos"
Task: "T009 sugeridos.test.ts: caso reportado"
Task: "T010 gasto.test.ts: ajuste sin origen"
Task: "T011 compras.test.tsx: casilla"
# Luego, en serie: T012 → T013, y en paralelo T014 ∥ T015
```

## Implementation Strategy

### MVP First (User Story 1)

1. T001–T007 (base).
2. T008–T015: el error reportado queda resuelto.
3. **Validar** con QS pasos 1, 2 y 7. Se puede publicar como 2.6.1 si urge.

### Incremental Delivery

1. MVP (US1) → corrige el error en producción.
2. US2 → corrección de cantidades para administración (además da salida a los lotes "En revisión").
3. US3 → comodidad: eliminar desde Editar.
4. Polish → release 2.7.0.
