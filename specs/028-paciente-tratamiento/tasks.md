---

description: "Task list for 028-paciente-tratamiento"
---

# Tasks: Paciente opcional en cada tratamiento realizado

**Input**: Design documents from `/specs/028-paciente-tratamiento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ (contracts/ui-contracts.md §4 y contracts/supabase-schema.md). Primero las pruebas.

**Desvíos al implementar**:

- **Arreglo de la 027 encontrado en el recorrido** (no era de esta spec): el `z-10` del `<main>` y del
  encabezado móvil en `AppShell` creaba un contexto de apilamiento, y en el teléfono la barra inferior
  (z-20) tapaba el pie de **todas** las hojas (p. ej. "Guardar"). Se quitó y se agregó una prueba en
  `barras.test.tsx` para que no vuelva.
- **Limpieza por tenant** (`aislarDatosLocales`): no incluía `categoriasTratamiento` (hueco de la
  026); ahora incluye esa tabla y `pacientesRegistro` (un paciente pendiente conserva su registro).
- **Mock de Dexie** (`memoryDb`): acepta `registroId` como clave. Ocho pruebas con su propia base en
  memoria necesitaron la tabla nueva (el cierre de sesión y el sync la usan).
- **Sentry**: la prueba (SC-005) cubre el filtro de breadcrumbs `ui.input` y que los mensajes de
  error de `guardarPaciente` no incluyen el texto; no se simuló un envío real a Sentry.
- **Búsqueda**: colapsa espacios también en el paciente guardado (no solo en lo que se escribe).
- **Ensayo** (T018): respaldo del 2026-11-23 en un proyecto temporal, migraciones 026 y 028 en orden:
  412 → 421 filas; `pacientes_registro` vacía; el resto igual.
- **Recorrido** (T019, teléfono 390 px, personal): editar el paciente desde el lápiz, ver "Paciente:
  …", buscar "perez" con totales del filtro; sin desborde. Registrar con paciente y la visibilidad
  entre usuarios quedaron cubiertos por pruebas (el driver no siembra catálogo de tratamientos ni
  segundos usuarios).
- **Suite final**: 1256 pruebas en verde en una corrida; `test:rls` completo OK (15 controles nuevos).

**Organization**: por historia. `R#` = research.md, "UI §n" / "SQL" = contracts.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Línea base: `npm run lint && npm test`

---

## Phase 2: Foundational

- [X] T002 Migración `supabase/migrations/20261124000000_pacientes_registro.sql` (SQL, R2, R3)
- [X] T003 Controles nuevos en `scripts/test-rls.mjs` (SQL 1–9); `test:rls` en verde con Supabase local
- [X] T004 [P] `tests/unit/dexie-v16.test.ts`; tipo `PacienteRegistro` y Dexie v16 en `src/lib/db/index.ts`
  (+ `tablasMemoria`, `TablasPorTenant`)
- [X] T005 [P] `tests/unit/tratamientos/pacientes.test.ts` (normalización, visibilidad, edición, filtro)
- [X] T006 `src/features/tratamientos/lib/pacientes.ts` (UI §3)
- [X] T007 [P] `tests/unit/sync-pacientes.test.ts`; push/pull en `src/lib/sync/index.ts` (después de
  registros; pull reemplaza sincronizados) (R4, R5)
- [X] T008 `tratamientosStore`: `pacientes` visibles para la sesión

---

## Phase 3: US1 — Anotar al registrar (P1) 🎯 MVP

- [X] T009 [P] [US1] `registro.test.ts`: con paciente escribe registro + fila en una transacción; sin
  paciente no; error → nada
- [X] T010 [P] [US1] `registrar-tratamiento.test.tsx`: campo opcional, registra con paciente
- [X] T011 [US1] `registro.ts` (`paciente` en `RegistroInput`) y `RegistrarTratamientoSheet.tsx` (UI §1)

---

## Phase 4: US2 — Solo quien corresponde (P1)

- [X] T012 [P] [US2] `tests/unit/logout-pacientes.test.ts`; `authStore.logout` borra sincronizados
- [X] T013 [P] [US2] `tests/unit/sentry-paciente.test.ts`; `beforeBreadcrumb` en `src/lib/sentry.ts`
  (R6)
- [X] T014 [US2] `historial-tratamientos.test.tsx`: "Paciente: …" solo a autor/administración

---

## Phase 5: US3 — Corregir y buscar (P2)

- [X] T015 [P] [US3] `historial-tratamientos.test.tsx`: lápiz, corregir, quitar, sin lápiz para ajeno
  o anulado; buscador con totales y combinado con categoría
- [X] T016 [US3] `HistorialTratamientos.tsx` y `historial.ts`: paciente, hoja de edición, buscador
  (UI §2, R7)

---

## Phase 6: Polish

- [X] T017 `npm run lint && npm run build && npm test`; `npm run test:rls`
- [X] T018 Ensayo de la migración sobre el respaldo (QS)
- [X] T019 Recorrido con `run-indentory` (QS)
- [X] T020 Notas de despliegue en `README.md` (migración, visto bueno, revisión legal)

## Dependencies

Setup → Foundational (T002–T008) → US1 → US2 → US3 → Polish. T003 depende de T002; T007 de T004.
