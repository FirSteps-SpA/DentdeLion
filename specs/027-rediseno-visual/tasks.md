---

description: "Task list for 027-rediseno-visual"
---

# Tasks: Rediseño visual de la app

**Input**: Design documents from `/specs/027-rediseno-visual/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ, para componentes nuevos y contraste (`contracts/ui-contracts.md` §5). La suite existente
es la red de regresión (SC-003): debe pasar sin cambiar lo que verifica. La validación visual es el
recorrido con `run-indentory` (quickstart).

**Organization**: por historia de spec.md. `R#` = research.md, "UI §n" = `contracts/ui-contracts.md`,
"QS" = quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US3 de spec.md

---

## Phase 1: Setup

- [ ] T001 Línea base: `npm run lint && npm test`; capturas "antes" con `run-indentory` de Inicio y de
  cada sección en 375 y 1440 px (QS)

---

## Phase 2: Foundational (bloquea todas las historias)

- [ ] T002 Tokens nuevos en `src/styles/index.css` (UI §1, R2) y sus pares en
  `tests/unit/contraste.test.ts`
- [ ] T003 [P] Pruebas `tests/unit/decoracion.test.tsx`: cada decorado con `aria-hidden`, sin texto,
  `pointer-events-none` y `print:hidden`
- [ ] T004 Decorados en `src/components/decoracion/` (`DienteLinea`, `OndasFondo`, `OndaSidebar`,
  `MiniBarras`, `IconoFondo`) (R3)
- [ ] T005 [P] Pruebas `tests/unit/encabezados.test.tsx`: `EncabezadoVista` (h1, subtítulo, acción,
  decorado oculto), `EncabezadoSeccion` (nivel, tono, acción), `EstadoVacio` (texto y acción)
- [ ] T006 `src/components/ui/EncabezadoVista.tsx`, `EncabezadoSeccion.tsx`, `EstadoVacio.tsx` (UI §2)
- [ ] T007 [P] Prueba `tests/unit/kpiCard.test.tsx`: tinte del ícono por tono, ícono de fondo,
  "Ver detalle →" solo con `onClick`, variante destacada
- [ ] T008 `KpiCard` en `src/components/ui/Card.tsx` y `Badge.tsx` (R6, UI §3)

**Checkpoint**: T003, T005 y T007 en verde; la suite existente sigue en verde.

---

## Phase 3: User Story 1 — Barras de navegación (P1) 🎯 MVP

**Goal**: barra lateral, barra superior, encabezado del teléfono y barra inferior como la referencia.

**Independent Test**: QS pasos 1 (barras), 2 (encabezado), 4, 6, 7.

- [ ] T009 [P] [US1] Pruebas `tests/unit/sidebar.test.tsx` (activo con pastilla llena; ilustración solo
  expandida; burbuja) y `tests/unit/syncIndicator.test.tsx` (fondo por estado y alerta)
- [ ] T010 [US1] `src/app/Sidebar.tsx`: activo lleno, inactivos, pie con `OndaSidebar` + `DienteLinea`
  (R4)
- [ ] T011 [P] [US1] `src/app/SelectorLugar.tsx`: pastilla con `Building` y `ChevronDown`, ambas
  variantes
- [ ] T012 [P] [US1] `src/app/SyncIndicator.tsx`: pastilla con fondo por estado
- [ ] T013 [US1] `src/app/TopBar.tsx`, `AppHeader.tsx`, `BottomNav.tsx` (activo en pastilla) y
  `AppShell.tsx` (`OndasFondo` detrás del `<main>`, sin desmontar la vista)

**Checkpoint**: T009 en verde; capturas de barras en 375, 900 y 1440 px.

---

## Phase 4: User Story 2 — Inicio (P1)

**Goal**: Inicio como la imagen.

**Independent Test**: QS pasos 1–2; SC-001.

- [ ] T014 [US2] Ajustar `tests/integration/inicio*.test.tsx` (o la prueba que cubre Inicio): la
  tarjeta "¿Qué necesitas comprar?" ya no está (FR-010); el resto igual
- [ ] T015 [US2] `src/features/inicio/components/InicioView.tsx`: `EncabezadoVista` con diente,
  `KpiCard` con tonos y destacada, secciones con `EncabezadoSeccion`, línea de tiempo de
  vencimientos (`RenglonAlerta variante="linea"`), sin tarjeta de compras (R6, R8)
- [ ] T016 [US2] `src/features/alertas/components/RenglonAlerta.tsx`: variante `linea`

**Checkpoint**: captura de Inicio 1280×800 junto a la referencia; T014 en verde.

---

## Phase 5: User Story 3 — Resto de las vistas (P2)

**Goal**: mismo lenguaje en todas las vistas, sin cambios de comportamiento.

**Independent Test**: QS pasos 3, 5, 8; SC-002.

- [ ] T017 [P] [US3] Inventario: `EncabezadoVista` ("Inventario", acción "+ Material"),
  `ResumenAlertasBanner` con tintes, `EstadoVacio` sin resultados
  (`src/features/insumos/components/InventarioView.tsx`, `ResumenAlertasBanner.tsx`)
- [ ] T018 [P] [US3] Tratamientos e Historial: `EncabezadoVista`, `EncabezadoSeccion` en totales,
  `EstadoVacio` (`TratamientosView.tsx`, `HistorialTratamientos.tsx`)
- [ ] T019 [P] [US3] Compras: `EncabezadoVista`, grupos con `EncabezadoSeccion`, `EstadoVacio`
  (`ComprasView.tsx`)
- [ ] T020 [P] [US3] Reportes: `EncabezadoVista`, `TarjetaGrafico` con ícono y `EstadoVacio`, KPI
  nuevas (`ReportesView.tsx`, `charts/TarjetaGrafico.tsx`, `TarjetaKpiReporte.tsx`,
  `EstadoVacioReportes.tsx`)
- [ ] T021 [P] [US3] Alertas: `EncabezadoVista` y las tres secciones con `EncabezadoSeccion`
  (`AlertasView.tsx`)
- [ ] T022 [P] [US3] Ajustes: índice y pantalla de sección con `EncabezadoVista`; tarjetas del índice
  con tinte; catálogos vacíos con `EstadoVacio` (`AjustesIndice.tsx`, `SeccionAjustesPantalla.tsx`,
  `TarjetaSeccion.tsx`, secciones con "Todavía no hay…")
- [ ] T023 [P] [US3] Acceso: `LoginForm.tsx`, `AceptarInvitacion.tsx`, `AccesoDesactivado.tsx` y el
  arranque en `App.tsx` con `OndasFondo` y `DienteLinea`
- [ ] T024 [US3] Ajustar pruebas existentes que choquen por textos de encabezado nuevos ("Inventario",
  "Alertas") usando consultas por rol; sin cambiar lo que verifican

**Checkpoint**: suite completa en verde.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T025 `npm run lint && npm run build && npm test` en verde
- [ ] T026 Recorrido de [quickstart.md](./quickstart.md) con `run-indentory`: capturas "después" de
  cada vista en 375 y 1440 px, tablet 900, Inicio 1280×800 junto a la referencia, desborde a 360 px
- [ ] T027 Notas de despliegue en `README.md` (solo front; aviso de cambio de apariencia)

---

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002–T008) → US1 (T009–T013) y US2 (T014–T016), que pueden ir en
  paralelo → US3 (T017–T024) → Polish (T025–T027).
- US3 depende de los componentes de Foundational; no depende de US1/US2.

### Parallel Opportunities

- T003 ∥ T005 ∥ T007; T011 ∥ T012; T017–T023 (una vista por archivo).

## Implementation Strategy

1. **MVP**: Phases 1–4 (barras + Inicio): lo que muestra la referencia.
2. **Incremento**: Phase 5, vista por vista.
3. **Cierre**: Phase 6, PR a `develop` con capturas antes/después.
