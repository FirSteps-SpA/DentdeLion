---

description: "Task list for 016-tratamientos-y-costo-por-tratamiento"
---

# Tasks: Tratamientos y Costo por Tratamiento

**Input**: Design documents from `/specs/016-tratamientos-y-costo-por-tratamiento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ, las que define research.md R10 (unitarias, integración RTL y `test:rls`), con el
patrón del proyecto: Vitest + RTL, `tests/helpers/memoryDb.ts`, `clienteFalso.ts`,
`tablasMemoria.ts`, `authFalso.ts`, `lugarFalso.ts`. Verificación visual con `run-indentory`.

**Organization**: por historia de spec.md. `R#` = research.md, "esquema" =
`contracts/supabase-schema.md`, "UI" = `contracts/ui-contracts.md`, "DM" = data-model.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

- [X] T001 Crear `supabase/migrations/20261022000000_tratamientos.sql` con `begin;`/`commit;` y un
  comentario por bloque del esquema (§1 `tratamientos`, §2 `cambios_tratamiento`, §3
  `tratamientos_realizados` + trigger, §4 `movimientos.tratamiento_realizado_id`).
- [X] T002 [P] Crear la carpeta `src/features/tratamientos/{lib,components}` y agregar `Stethoscope`
  a las exportaciones de `src/components/icons/index.tsx` (mismo patrón que los otros íconos Lucide).

---

## Phase 2: Foundational (esquema, Dexie v12, store, sync y montos)

**Purpose**: modelo y cálculo listos; ninguna pantalla nueva todavía. Las pruebas existentes siguen
en verde.

### Servidor (en serie, mismo archivo)

- [X] T003 Bloque §1 del esquema: tabla `tratamientos` con `unique (id, tenant_id)`, RLS (leer del
  tenant; insert solo `es_administrador(auth.uid())` con `creado_por = auth.uid()` y
  `tenant_id = tenant_actual()`), sin update/delete.
- [X] T004 Bloque §2: tabla `cambios_tratamiento` con FKs compuestas a `tratamientos` y `lugares`,
  los checks de campo/valor del esquema, índices y RLS (leer del tenant; insert administración como
  sí misma).
- [X] T005 Bloque §3: tabla `tratamientos_realizados` con checks, FKs compuestas, RLS (leer del
  tenant; insert como uno mismo; política de pendientes previos a la desactivación como en
  `cambios_lote`; update en el tenant con `anulado_por = auth.uid()`) y trigger
  `proteger_tratamiento_realizado` (`security definer`, `search_path = public`): en update conserva
  `old` en todo salvo `anulado_en`/`anulado_por`, y si `old.anulado_en` no es nulo conserva también
  la anulación.
- [X] T006 Bloque §4: `movimientos.tratamiento_realizado_id uuid` + FK compuesta
  `(tratamiento_realizado_id, tenant_id)` + índice parcial.
- [X] T007 Aplicar con `DOCKER_HOST=unix:///var/run/docker.sock supabase db reset` y correr el
  `npm run test:rls` existente en verde.

### Dispositivo

- [X] T008 En `src/lib/db/index.ts`: tipos `Tratamiento`, `CambioTratamiento`,
  `MaterialTratamiento`, `TratamientoRealizado` (DM) y `Movimiento.tratamientoRealizadoId:
  string | null`; tablas `tratamientos`, `cambiosTratamiento`, `tratamientosRealizados`; `version(12)`
  con los índices de DM y el `upgrade` (`tratamientoRealizadoId ??= null` en movimientos).
- [X] T009 [P] Test `tests/unit/dexie-v12.test.ts` con `fake-indexeddb`, siguiendo
  `tests/unit/dexie-v11.test.ts`: una base v11 con movimientos pendientes pasa a v12 con
  `tratamientoRealizadoId: null` y las tablas nuevas vacías. Ajustar `dexie-v10/v11.test.ts` a
  `verno` 12.
- [X] T010 Agregar `tratamientoRealizadoId: null` a `crearMovimiento` (input opcional
  `tratamientoRealizadoId`) en `src/features/insumos/lib/movements.ts`, y corregir los fixtures de
  tests con el script de parcheo usado en la 015 (o a mano) hasta `npx tsc -b` sin errores.
- [X] T011 Crear `src/features/tratamientos/lib/proyeccion.ts` (R1): `proyectarTratamientos(filas,
  cambios)` → `TratamientoProyectado[]` (DM) y `porcentajesPorLugar(cambios)` → `Map<lugarId,
  number>`; por campo (y por lugar en `precio`/`porcentajeProfesional`) gana `(creadoEn, id)`
  (reutilizar `compararCambios` de `insumos/lib/proyeccion.ts`); cambios con `rechazadoEn` no
  cuentan; valor `null` en precio/porcentaje = sin valor.
- [X] T012 [P] Test `tests/unit/tratamientos/proyeccion.test.ts`: último cambio gana por campo, por
  lugar independiente, orden de llegada indiferente, rechazados ignorados, `activo: false` oculta de
  activos, precio `null` borra el precio.
- [X] T013 Crear `src/features/tratamientos/lib/montos.ts` (R3): `cantidadEfectiva(material,
  insumo, cambiosInsumo)` con `factoresDeUnidad` (R2); `calcularCostoTratamiento(materiales, insumos,
  costos, cambiosInsumo)` → `{ lineas, costoMateriales, completo }`; `calcularGanancia(precio,
  porcentaje, costoMateriales)` → `{ comision, ganancia, motivo? }`; textos `ETIQUETA_GANANCIA =
  'Ganancia estimada'` y `NOTA_GANANCIA = 'No es utilidad contable'`.
- [X] T014 [P] Test `tests/unit/tratamientos/montos.test.ts`: ejemplo del DS (precio $45.000, 40 %,
  costo $3.480 → comisión $18.000, ganancia $14.520), material sin precio (`completo: false`),
  sin precio / sin porcentaje (`motivo`), ganancia negativa, precio 0, cantidad convertida tras una
  conversión de unidad (caja → unidad ×100).
- [X] T015 Crear `src/stores/tratamientosStore.ts` (Zustand + `liveQuery` + `delTenant`):
  `tratamientos` proyectados, `porcentajes`, `realizados`, `cambiosTratamiento`, `isReady`,
  `subscribe()`; montarlo donde se monta `inventoryStore` (`src/app/App.tsx`). Agregar las tres
  tablas a `TablasPorTenant` y al aislamiento local de `src/lib/tenancy/index.ts` (pendientes se
  conservan; los lotes/tratamientos que referencian se conservan).
- [X] T016 En `src/lib/sync/index.ts` (esquema §5): rows y conversores de las tres tablas y
  `tratamiento_realizado_id` en `MovimientoRow`; `pushTratamientos`/`pullTratamientos` y
  `pushCambiosTratamiento`/`pullCambiosTratamiento` con el patrón de `categorias`/`cambios_insumo`
  (pendientes del usuario, `rechazadoEn` ante RLS, reintento por fila); `pushTratamientosRealizados`
  (insert de no sincronizados con `ignoreDuplicates`, luego `update` de anulaciones con
  `anulacionSincronizada: false`) y `pullTratamientosRealizados`; orden del ciclo del esquema §5
  (realizados antes que movimientos); incluir las tres en `subirPendientesPrevios`.
- [X] T017 En `src/lib/sync/indicador.ts`, `src/stores/pendientesStore.ts` y `src/app/SyncSheet.tsx`:
  contar cambios de tratamiento, registros y anulaciones pendientes ("Tratamientos" en el desglose).
- [X] T018 [P] Test `tests/unit/sync-tratamientos.test.ts` (patrón `sync-cambios-lote.test.ts`):
  push solo propio, rechazo por rol en cambios de catálogo marca `rechazadoEn`, orden realizados →
  movimientos, anulación sube como update, pull de las tres tablas. Agregar las tablas nuevas a
  `tests/helpers/tablasMemoria.ts`.
- [X] T019 Correr `npm test && npm run lint && npx tsc -b`: todo verde (cierre de fase).

**Checkpoint**: modelo, store, sync y montos listos.

---

## Phase 3: User Story 1 - Definir un tratamiento con sus materiales (Priority: P1) 🎯 MVP

**Goal**: administración crea, edita y desactiva tratamientos con precio por lugar y materiales;
todos los ven; aparece la sección Tratamientos.

**Independent Test**: crear "Restauración clase II" con 1 cartucho y 2 g de resina, $45.000 en
Providencia y $50.000 en Las Condes; la lista muestra el precio del lugar activo (quickstart 2).

### Tests for User Story 1

- [X] T020 [P] [US1] Test `tests/unit/tratamientos/catalogo.test.ts` para `catalogo.ts` (T022):
  validación (nombre vacío/duplicado sin distinguir mayúsculas, cantidad ≤ 0, decimales según
  unidad, insumo repetido, precio < 0), un `CambioTratamiento` por campo realmente cambiado (y por
  lugar en precios), desactivar/reactivar, personal rechazado.
- [X] T021 [P] [US1] Test de integración `tests/integration/tratamientos.test.tsx`: crear con
  materiales y precios por lugar como administración; editar precio sin tocar registros previos;
  desactivar; personal ve la lista sin "+ Tratamiento" ni "Editar"; "Sin precio en este lugar".

### Implementation for User Story 1

- [X] T022 [US1] Crear `src/features/tratamientos/lib/catalogo.ts`: `validarTratamiento(input,
  existentes, insumos)`, `crearTratamiento(input)` (fila + cambios `nombre`, `materiales`, `activo`,
  y `precio` por lugar con valor) y `editarTratamiento(id, input)` (solo los cambios reales),
  `cambiarActivo(id, activo)`; `exigirAdministrador`; transacción Dexie; materiales con la `unidad`
  de consumo actual del insumo.
- [X] T023 [US1] En `src/app/navegacion.ts` agregar `'tratamientos'` a `Vista` y a `SECCIONES`
  (ícono `Stethoscope`, después de Inventario) con una marca `soloLateral` para Compras en móvil
  (R7); `src/app/BottomNav.tsx` muestra Inicio, Inventario, Tratamientos, Alertas, Más;
  `src/features/ajustes/components/AjustesView.tsx` (la vista de "Más") recibe una prop
  `onNavegar` (como `InicioView` en `src/app/App.tsx`) y, solo en móvil, muestra arriba un botón
  "Compras" (48 px, ícono `ShoppingCart`) que llama `onNavegar('compras')`; `src/app/App.tsx` pasa
  `onNavegar={setVista}` a `AjustesView` y renderiza `TratamientosView`. Ajustar `tests/integration/bottom-nav.test.tsx` y
  `navegacion-responsiva.test.tsx`.
- [X] T024 [P] [US1] Crear `src/features/tratamientos/components/TratamientoForm.tsx` (UI §3):
  nombre, precios por lugar activo, materiales con `SearchPicker` + `Stepper` y sufijo de unidad,
  quitar material, vista previa (usa `montos.ts`), desactivar/reactivar; ≥ 48 px.
- [X] T025 [US1] Crear `src/features/tratamientos/components/TratamientosView.tsx` (UI §2):
  pestañas Tratamientos | Historial (Historial en US5), lista con nombre y precio del lugar activo o
  "Sin precio en este lugar", "+ Tratamiento" y "Editar" solo administración, "Mostrar
  desactivados".

---

## Phase 4: User Story 2 - Ver el costo de materiales y la ganancia estimada (Priority: P1)

**Goal**: cada tratamiento muestra costo por material, costo total, comisión y "Ganancia
estimada" en el lugar activo (o por lugar en "Todos").

**Independent Test**: el ejemplo del DS da $3.480 / $18.000 / $14.520 con 40 % (quickstart 3–5).

- [X] T026 [P] [US2] Ampliar `tests/integration/tratamientos.test.tsx`: detalle con líneas y
  montos del ejemplo del DS; material sin precio → "desde $X" y aviso; sin porcentaje → "Define el %
  profesional del lugar"; cambio de lugar recalcula; nunca aparece "utilidad"; costo se recalcula
  al cambiar el costo unitario.
- [X] T027 [US2] Crear `src/features/tratamientos/lib/useMontosTratamiento.ts`: hook que combina
  `useCostosUnitarios`, `inventoryStore.insumos/cambiosInsumo`, `tratamientosStore.porcentajes` y el
  lugar activo (o todos) → montos por tratamiento y lugar.
- [X] T028 [US2] Crear `src/features/tratamientos/components/TratamientoDetalle.tsx` (UI §4):
  tabla de materiales, bloque de montos con "Ganancia estimada" + nota, negativos en rojo con signo,
  historial de cambios del tratamiento. Los materiales de insumos dados de baja se marcan "Dado de
  baja" y, para administración, con el aviso "Reemplázalo en el tratamiento" (Edge Cases).
- [X] T029 [US2] En `TratamientosView.tsx`, mostrar costo de materiales y ganancia estimada (o su
  motivo) en cada fila; en "Todos", la ganancia por lugar. Para administración, un indicador en las
  filas con materiales dados de baja.

---

## Phase 5: User Story 3 - Registrar un tratamiento realizado (Priority: P1)

**Goal**: registrar con cantidades estándar editables; descuento FEFO atómico; snapshot; deshacer;
offline.

**Independent Test**: registrar la Restauración clase II descuenta 1 cartucho y 2 g por FEFO y el
registro guarda precio, costo y ganancia del momento (quickstart 6–9, 11).

### Tests for User Story 3

- [X] T030 [P] [US3] Test `tests/unit/fefo-reparto.test.ts` para `repartirFefo` (T032): un lote,
  varios lotes en orden FEFO, sin vencimiento al final, excluye caducados, cantidad mayor al
  disponible → resto sin cubrir.
- [X] T031 [P] [US3] Test `tests/unit/tratamientos/registro.test.ts`: registro + consumos en una
  transacción con `tratamientoRealizadoId`, `unidad` y lugar; snapshot (precio, porcentaje, costos
  unitarios, ganancia); cantidad 0 no genera movimiento; `StockInsuficienteError` con detalle y sin
  escribir; reparto entre lotes; anulación escribe ajustes vinculados e idempotente; registro sin
  precio; sin red queda pendiente.

### Implementation for User Story 3

- [X] T032 [US3] En `src/features/insumos/lib/fefo.ts`, `repartirFefo(lotesConStock, cantidad, hoy)`
  → `{ partes: { lote, cantidad }[], faltante }` (R4).
- [X] T033 [US3] Crear `src/features/tratamientos/lib/registro.ts`: `StockInsuficienteError`;
  `registrarTratamiento(tratamiento, { lugarId?, cantidades })` en una transacción `rw` sobre
  `lotes`, `movimientos`, `insumos`, `cambiosInsumo`, `tratamientosRealizados` (relee stock con
  `movimientosNormalizadosDeLote`, reparte con `repartirFefo`, escribe consumos con
  `crearMovimiento({ tratamientoRealizadoId, unidad })`, guarda el snapshot con `montos.ts` y los
  costos de `costosUnitariosPorInsumo`); `anularTratamiento(id)` (R5). Los materiales de insumos
  **dados de baja** no se descuentan: quedan en el snapshot con cantidad 0 y `dadoDeBaja: true`.
  Un faltante cuyo único stock está caducado se informa con motivo `solo-caducado` (FR-015).
- [X] T034 [US3] Crear `src/features/tratamientos/components/RegistrarTratamientoSheet.tsx`
  (UI §5): cantidades con `Stepper`, disponible por material en el lugar, aviso de faltante y botón
  deshabilitado, montos en vivo; en "Todos" pide el lugar con `ElegirLugarSheet`.
- [X] T035 [US3] Aviso "Registrada {tratamiento}" con **Deshacer** en `src/stores/avisosStore.ts`
  (tipo `'tratamiento'`, llama `anularTratamiento`) y `src/app/AvisosConsumo.tsx`.
- [X] T036 [US3] Botón **Registrar** en cada fila de `TratamientosView.tsx` y en
  `TratamientoDetalle.tsx` (tratamientos activos).
- [X] T037 [US3] En `src/features/insumos/components/InsumoDetalle.tsx`, mostrar los consumos de un
  tratamiento como "{tratamiento} · {cantidad}" (FR-018).
- [X] T038 [US3] Test de integración `tests/integration/registrar-tratamiento.test.tsx`: flujo
  completo con ajuste de cantidad, falta de stock (incluido "solo stock caducado"), material dado de
  baja no descontado, deshacer desde el aviso, "Todos" pide lugar, personal registra. Incluir el
  caso de SC-001: desde la lista, registrar con las cantidades estándar toma 2 interacciones
  ("Registrar" en la fila y "Registrar" en el panel), contadas con `fireEvent` y comparadas con el
  límite de 3.

---

## Phase 6: User Story 4 - Porcentaje profesional del lugar (Priority: P2)

**Goal**: administración fija el % profesional de cada lugar; aplica hacia adelante con historial.

**Independent Test**: Providencia 40 % y Las Condes 50 % cambian la ganancia del mismo tratamiento
(quickstart 1, 4).

- [X] T039 [P] [US4] Test en `tests/unit/tratamientos/catalogo.test.ts`: `fijarPorcentajeLugar`
  valida 0–100, escribe un `CambioTratamiento` `porcentajeProfesional` con `lugarId` y sin
  `tratamientoId`, solo administración, no escribe si no cambia.
- [X] T040 [US4] `fijarPorcentajeLugar(lugarId, porcentaje)` en
  `src/features/tratamientos/lib/catalogo.ts`.
- [X] T041 [US4] Campo **% profesional** (y "Clínica: N %") al editar un lugar en
  `src/features/ajustes/components/LugaresSection.tsx` (UI §7), con el historial del porcentaje
  debajo ("40 % → 45 % · Ana · 19-10-2026", desde los `CambioTratamiento`
  `porcentajeProfesional` del lugar, FR-012); ampliar `tests/integration/lugares.test.tsx`.

---

## Phase 7: User Story 5 - Historial de tratamientos realizados (Priority: P3)

**Goal**: lista de registros con totales por período, anulados tachados.

**Independent Test**: tres registros (uno anulado) en el mes muestran conteo y sumas sin el
anulado (quickstart 12).

- [X] T042 [P] [US5] Test `tests/unit/tratamientos/historial.test.ts` para `historial.ts` (T043):
  filtros hoy/semana (lunes a hoy)/mes en hora local, orden, totales sin anulados, registros sin
  precio no suman a precio ni ganancia, por lugar.
- [X] T043 [US5] Crear `src/features/tratamientos/lib/historial.ts` (R8).
- [X] T044 [US5] Crear `src/features/tratamientos/components/HistorialTratamientos.tsx` (UI §6) y
  conectarlo a la pestaña Historial de `TratamientosView.tsx`, con **Deshacer** por registro.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T045 Agregar a `scripts/test-rls.mjs` los 7 casos del esquema §6.
- [X] T046 [P] Prueba de rendimiento (plan): 100 tratamientos con montos < 100 ms y un registro de 10
  materiales < 300 ms, en `tests/unit/tratamientos/montos.test.ts`.
- [X] T047 Ensayo de migración (quickstart "Migración" 1) sobre un **respaldo nuevo** de producción
  en una base desechable (como la T071 de la 015); borrar la copia al terminar. *(Hecho 2026-10-20
  sobre el respaldo de producción de ese día, que ya tiene la 014: respaldo → 015 → 016. 60 stocks
  lote/lugar, 73 mínimos y los conteos idénticos en cada paso; ningún movimiento con tratamiento;
  tablas nuevas con RLS y el trigger `tratamientos_realizados_proteger`. Copia borrada.)*
- [X] T048 Dexie v12 en Chromium real desde el build de `develop` (v11) con un consumo pendiente
  (como la T072 de la 015).
- [X] T049 [P] Verificación visual con `run-indentory` en 375, 768 y 1440 px: navegación, lista,
  formulario, detalle con montos, registrar (con faltante), historial, % en Lugares; agregar al
  driver un comando `seed-tratamiento` si hace falta.
- [X] T050 [P] README: nota de despliegue de la 016 (respaldo → `db push` → front).
- [X] T051 Recorrer los 13 escenarios de `quickstart.md` (automatizados o en el navegador).
- [X] T052 Correr `npm run lint && npm run build && npm test && npm run test:rls`, todo verde.
- [X] T053 [P] *(Hecho: roadmap y backlog de 1stDocs en `457ac54`, con la decisión de la barra móvil y los pendientes del release.)* En `../1stDocs`, actualizar roadmap y backlog al abrir el PR (incluida la decisión de
  la barra inferior móvil, R7).
- [X] T054 Descripción del PR: tablas, RLS y trigger (tabla de políticas), decisión de navegación,
  resultados de T045–T051.

---

## Dependencies & Execution Order

- **Setup** (T001–T002) → **Foundational** (T003–T019). T003–T007 en serie (mismo archivo).
  T008 → T009/T010; T011 → T012; T013 → T014; T015 → T016 → T017/T018; T019 cierra.
- **US1** (T020–T025) depende de Foundational. MVP.
- **US2** (T026–T029) depende de US1 (lista y detalle). Muestra "Define el %" hasta US4.
- **US3** (T030–T038) depende de US1 (tratamientos) y del montos de Foundational; independiente de
  US2 salvo T036 (botón en el detalle de US2, hacer después de T028).
- **US4** (T039–T041) depende de Foundational; independiente de US1–US3.
- **US5** (T042–T044) depende de US3 (registros).
- **Polish** al final.

```text
Setup ─► Foundational ─┬─► US1 ─┬─► US2 ───────────┐
                       │        └─► US3 ─► US5 ────┼─► Polish
                       └─► US4 ────────────────────┘
```

## Parallel Examples

- **Foundational**: T009, T012, T014 y T018 en paralelo tras sus tareas base.
- **US1**: T020, T021 y T024 en paralelo; luego T022 → T023 → T025.
- **US2**: T026 en paralelo con T027; luego T028 → T029.
- **US3**: T030 y T031 en paralelo; luego T032 → T033 → T034 → T035 → T036 → T037 → T038.
- **US4** completa en paralelo con US2/US3.
- **Polish**: T046, T049, T050 y T053 en paralelo.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: catálogo de tratamientos con precio por lugar y la sección
   en la navegación.
2. **+ US2 + US4**: montos y ganancia estimada (el valor de negocio de la spec).
3. **+ US3**: registrar realizados con descuento FEFO (el uso diario).
4. **+ US5**: historial con totales.
5. **Polish**: RLS, rendimiento, ensayo de migración, Chromium, capturas, documentación y PR.
