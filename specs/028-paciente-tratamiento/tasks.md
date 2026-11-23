---

description: "Task list for 028-paciente-tratamiento"
---

# Tasks: Paciente opcional en cada tratamiento realizado

**Input**: Design documents from `/specs/028-paciente-tratamiento/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ (contracts/ui-contracts.md §4 y contracts/supabase-schema.md). Primero las pruebas.

**Organization**: por historia. `R#` = research.md, "UI §n" / "SQL" = contracts.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Línea base: `npm run lint && npm test`

---

## Phase 2: Foundational

- [ ] T002 Migración `supabase/migrations/20261124000000_pacientes_registro.sql` (SQL, R2, R3)
- [ ] T003 Controles nuevos en `scripts/test-rls.mjs` (SQL 1–9); `test:rls` en verde con Supabase local
- [ ] T004 [P] `tests/unit/dexie-v16.test.ts`; tipo `PacienteRegistro` y Dexie v16 en `src/lib/db/index.ts`
  (+ `tablasMemoria`, `TablasPorTenant`)
- [ ] T005 [P] `tests/unit/tratamientos/pacientes.test.ts` (normalización, visibilidad, edición, filtro)
- [ ] T006 `src/features/tratamientos/lib/pacientes.ts` (UI §3)
- [ ] T007 [P] `tests/unit/sync-pacientes.test.ts`; push/pull en `src/lib/sync/index.ts` (después de
  registros; pull reemplaza sincronizados) (R4, R5)
- [ ] T008 `tratamientosStore`: `pacientes` visibles para la sesión

---

## Phase 3: US1 — Anotar al registrar (P1) 🎯 MVP

- [ ] T009 [P] [US1] `registro.test.ts`: con paciente escribe registro + fila en una transacción; sin
  paciente no; error → nada
- [ ] T010 [P] [US1] `registrar-tratamiento.test.tsx`: campo opcional, registra con paciente
- [ ] T011 [US1] `registro.ts` (`paciente` en `RegistroInput`) y `RegistrarTratamientoSheet.tsx` (UI §1)

---

## Phase 4: US2 — Solo quien corresponde (P1)

- [ ] T012 [P] [US2] `tests/unit/logout-pacientes.test.ts`; `authStore.logout` borra sincronizados
- [ ] T013 [P] [US2] `tests/unit/sentry-paciente.test.ts`; `beforeBreadcrumb` en `src/lib/sentry.ts`
  (R6)
- [ ] T014 [US2] `historial-tratamientos.test.tsx`: "Paciente: …" solo a autor/administración

---

## Phase 5: US3 — Corregir y buscar (P2)

- [ ] T015 [P] [US3] `historial-tratamientos.test.tsx`: lápiz, corregir, quitar, sin lápiz para ajeno
  o anulado; buscador con totales y combinado con categoría
- [ ] T016 [US3] `HistorialTratamientos.tsx` y `historial.ts`: paciente, hoja de edición, buscador
  (UI §2, R7)

---

## Phase 6: Polish

- [ ] T017 `npm run lint && npm run build && npm test`; `npm run test:rls`
- [ ] T018 Ensayo de la migración sobre el respaldo (QS)
- [ ] T019 Recorrido con `run-indentory` (QS)
- [ ] T020 Notas de despliegue en `README.md` (migración, visto bueno, revisión legal)

## Dependencies

Setup → Foundational (T002–T008) → US1 → US2 → US3 → Polish. T003 depende de T002; T007 de T004.
