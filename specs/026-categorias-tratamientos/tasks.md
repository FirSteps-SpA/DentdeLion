---

description: "Task list for 026-categorias-tratamientos"
---

# Tasks: Categorías de tratamientos y % profesional por categoría

**Input**: Design documents from `/specs/026-categorias-tratamientos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. Las definen plan.md (Testing), `contracts/ui-contracts.md` §8 y
`contracts/supabase-schema.md` §5. Patrón del proyecto: Vitest + RTL con `fireEvent` y los helpers de
`tests/helpers/`. Las pruebas de cada historia se escriben primero y deben fallar antes de
implementar.

**Organization**: por historia de spec.md. `R#` = research.md, "UI §n" = `contracts/ui-contracts.md`,
"SQL §n" = `contracts/supabase-schema.md`, "DM" = data-model.md, "QS" = quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US3 de spec.md

---

## Phase 1: Setup

- [ ] T001 Línea base en la rama `026-categorias-tratamientos`: `npm run lint && npm test`; con
  `supabase start`, `npm run test:rls` (anotar totales e intermitentes)

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: esquema, tipos, Dexie, sync y proyección compartidos.

- [ ] T002 Escribir `supabase/migrations/20261123000000_categorias_tratamiento.sql` según SQL §1–§4
  (tabla, RLS, trigger de protección, siembra + trigger en `tenants`, columnas y CHECK de
  `cambios_tratamiento`, columnas y trigger de `tratamientos_realizados`, `revoke` de las funciones)
- [ ] T003 Controles nuevos en `scripts/test-rls.mjs` (SQL §5, 1–9); `supabase db reset` y
  `npm run test:rls` en verde
- [ ] T004 [P] `tests/unit/dexie-v15.test.ts`: upgrade completa `categoriaId`/`categoriaNombre` con
  `null` y crea `categoriasTratamiento`
- [ ] T005 Tipos y Dexie v15 en `src/lib/db/index.ts` (DM: `CategoriaTratamiento`, `CampoTratamiento`,
  `CambioTratamiento.categoriaId`, `TratamientoRealizado.categoriaId/categoriaNombre`); ajustar los
  constructores existentes de `CambioTratamiento` y `TratamientoRealizado` (y fixtures de pruebas) con
  los campos nuevos en `null`
- [ ] T006 [P] `tests/unit/tratamientos/proyeccion-categorias.test.ts`: `categoriaId` (último gana,
  `null`), `porcentajesPorCategoria`, `porcentajeAplicable` (categoría > lugar > null; borrar vuelve al
  general; categoría desactivada aplica)
- [ ] T007 `src/features/tratamientos/lib/proyeccion.ts`: `categoriaId` en `TratamientoProyectado`,
  `porcentajesPorCategoria`, `porcentajeAplicable` (R3–R5)
- [ ] T008 [P] `tests/unit/sync-categorias-tratamiento.test.ts`: push solo admin; `23505` → rechazada y
  aviso; pull sin pisar locales sin subir; columnas nuevas de `cambios_tratamiento` y
  `tratamientos_realizados` en push y pull
- [ ] T009 `src/lib/sync/index.ts`: `pushCategoriasTratamiento`/`pullCategoriasTratamiento` (paginado,
  antes de `cambios_tratamiento` y de `tratamientos_realizados`); mapear columnas nuevas (R8); aviso
  `categoria-tratamiento-repetida` en `src/stores/avisosStore.ts` y su texto en
  `src/app/AvisosConsumo.tsx`
- [ ] T010 `src/stores/tratamientosStore.ts`: `categorias` (no rechazadas, por nombre) y
  `porcentajesCategoria` desde Dexie

**Checkpoint**: T003, T004, T006 y T008 en verde.

---

## Phase 3: User Story 1 — Clasificar los tratamientos por categoría (P1) 🎯 MVP

**Goal**: catálogo de categorías administrable y asignación en el formulario.

**Independent Test**: QS pasos 1, 2, 9 (catálogo), 10, 11.

### Tests (primero, deben fallar)

- [ ] T011 [P] [US1] `tests/unit/tratamientos/categorias.test.ts`: validación de nombre (vacío, > 40,
  repetido por clave, "Sin categoría"); crear (personal rechazado); renombrar; desactivar/reactivar
- [ ] T012 [P] [US1] `tests/integration/ajustes-categorias-tratamiento.test.tsx`: tarjeta e índice,
  sembradas visibles, crear, renombrar, desactivar ("Desactivada" en texto), personal sin la sección
- [ ] T013 [P] [US1] `tests/integration/tratamientos.test.tsx`: selector "Categoría" en el formulario
  (elegir, "Sin categoría", "Agregar categoría"), cambio `categoria` en el ledger, categoría visible y
  chips de filtro en el catálogo, "(desactivada)"

### Implementation

- [ ] T014 [US1] `src/features/tratamientos/lib/categorias.ts`: `validarNombreCategoriaTratamiento`,
  `crearCategoriaTratamiento`, `guardarCategoriaTratamiento` (nombre/activa), `reactivarCategoriaTratamiento`
  (UI §7), con `exigirAdministrador`
- [ ] T015 [US1] `src/features/tratamientos/lib/catalogo.ts`: `categoriaId` en `TratamientoInput`,
  cambio `categoria` al crear/editar si cambió
- [ ] T016 [US1] `src/features/ajustes/lib/secciones.ts`, `useResumenesAjustes.ts` y
  `components/AjustesView.tsx`: sección `'categoriasTratamiento'` (solo administración, después de
  `'lugares'`, ícono `Tag`) con resumen
- [ ] T017 [US1] `src/features/ajustes/components/CategoriasTratamientoSection.tsx`: lista con "Ver
  más", "Nueva categoría", hoja de edición con nombre y "Activa" (UI §1, sin % todavía)
- [ ] T018 [US1] `src/features/tratamientos/components/TratamientoForm.tsx`: `SelectorCatalogo` de
  categoría (UI §2)
- [ ] T019 [US1] `src/features/tratamientos/components/TratamientosView.tsx` y `TratamientoDetalle.tsx`:
  categoría visible y chips de filtro (UI §3)

**Checkpoint**: T011–T013 en verde.

---

## Phase 4: User Story 2 — % profesional por categoría y lugar (P1)

**Goal**: % propio por categoría en cada lugar, aplicado al registrar y mostrado con su origen.

**Independent Test**: QS pasos 3–6; SC-001.

### Tests (primero, deben fallar)

- [ ] T020 [P] [US2] `tests/unit/tratamientos/categorias.test.ts`: `guardarCategoriaTratamiento` con
  `porcentajes` (escribe solo los cambiados, `null` borra, rango 0–100, nada se guarda si uno es
  inválido); `fijarPorcentajeCategoria`
- [ ] T021 [P] [US2] `tests/unit/tratamientos/registro.test.ts`: snapshot con % de categoría,
  `categoriaId` y `categoriaNombre`; sin categoría o sin % de categoría → general; lugar sin general y
  categoría con % → el de la categoría
- [ ] T022 [P] [US2] `tests/integration/registrar-tratamiento.test.tsx`: ejemplo 40/50 (Evaluación
  $10.000, Restauración $8.000); origen del % en la hoja; cambio posterior del % no altera el registro
- [ ] T023 [P] [US2] `tests/integration/ajustes-categorias-tratamiento.test.tsx`: % por lugar con
  placeholder del general y "Sin % general en este lugar"; guardar y borrar

### Implementation

- [ ] T024 [US2] `src/features/tratamientos/lib/catalogo.ts`: `fijarPorcentajeCategoria` (cambio
  `porcentajeCategoria` con `lugarId` y `categoriaId`); `guardarCategoriaTratamiento` acepta
  `porcentajes` en la misma transacción
- [ ] T025 [US2] `src/features/tratamientos/lib/registro.ts`: % con `porcentajeAplicable` y snapshot de
  la categoría (R5, R6)
- [ ] T026 [US2] `src/features/tratamientos/lib/useMontosTratamiento.ts` y
  `components/MontosTratamiento.tsx`/`RegistrarTratamientoSheet.tsx`: % aplicable con origen (FR-012)
- [ ] T027 [US2] `CategoriasTratamientoSection.tsx`: campos de % por lugar activo en la hoja (UI §1) y
  resumen "Clínica A: 50 %" en la lista

**Checkpoint**: T020–T023 en verde.

---

## Phase 5: User Story 3 — Ver lo realizado por categoría (P2)

**Goal**: historial filtrable por categoría y tarjeta en Reportes.

**Independent Test**: QS pasos 7–9; SC-004.

### Tests (primero, deben fallar)

- [ ] T028 [P] [US3] `tests/unit/tratamientos/historial.test.ts`: filtro por categoría (incluye "Sin
  categoría") y totales del filtro
- [ ] T029 [P] [US3] `tests/unit/reportes/kpis.test.ts`: `porCategoriaTratamiento` (por id, nombre
  actual o del snapshot, "Sin categoría", anulados fuera, período y lugar; mismo total que el
  historial filtrado)
- [ ] T030 [P] [US3] `tests/integration/historial-tratamientos.test.tsx` y
  `tests/integration/reportes.test.tsx`: selector y totales; tarjeta y tabla

### Implementation

- [ ] T031 [US3] `src/features/tratamientos/lib/historial.ts` y
  `components/HistorialTratamientos.tsx`: categoría del registro y selector de filtro (UI §5)
- [ ] T032 [US3] `src/features/reportes/lib/kpis.ts` y `components/ReportesView.tsx`: tarjeta "Por
  categoría de tratamiento" (UI §6, R11)

**Checkpoint**: T028–T030 en verde.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T033 `npm run lint && npm run build && npm test` en verde (incluye `rendimiento` de Reportes y
  `lecturas-movimientos`); `npm run test:rls` en verde
- [ ] T034 Ensayo de la migración sobre la restauración del último respaldo de producción (QS "Ensayo"):
  8 categorías por tenant, filas intactas, totales idénticos; anotar los conteos
- [ ] T035 Recorrido de [quickstart.md](./quickstart.md) con `run-indentory` (administración y personal;
  móvil y desktop) y capturas
- [ ] T036 Notas de despliegue en `README.md`: migración antes del front con respaldo y visto bueno;
  convivencia con versiones en caché (registros con % general hasta actualizar)

---

## Dependencies & Execution Order

- Setup (T001) → Foundational (T002–T010) → US1 (T011–T019) → US2 (T020–T027) → US3 (T028–T032) →
  Polish (T033–T036).
- US2 depende de US1 (la hoja de categoría y la asignación). US3 depende de T025 (snapshot) y puede ir
  en paralelo con T026–T027.
- T003 depende de T002; T009 de T005; T010 de T007.

### Parallel Opportunities

- T004 ∥ T006 ∥ T008 (pruebas en archivos distintos).
- T011 ∥ T012 ∥ T013; T020 ∥ T021 ∥ T022 ∥ T023; T028 ∥ T029 ∥ T030.

## Implementation Strategy

1. **MVP**: Phases 1–4 (categorías + % por lugar): resuelve el pedido principal (SC-001).
2. **Incremento**: Phase 5 (Historial y Reportes).
3. **Cierre**: Phase 6, PR a `develop` con capturas. El `db push` a producción queda para el release,
   con visto bueno explícito.
