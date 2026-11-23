---

description: "Task list for 029-estimacion-materiales-ia"
---

# Tasks: Estimación de materiales con IA

**Input**: Design documents from `/specs/029-estimacion-materiales-ia/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ (research.md R7). Ninguna prueba automática llama a la IA real.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Línea base: `npm run lint && npm test`

## Phase 2: Foundational

- [x] T002 Migración `supabase/migrations/20261125000000_estimaciones_ia.sql` (data-model)
- [x] T003 [P] `tests/unit/tratamientos/estimacion-logica.test.ts`: armado del prompt (etiquetas,
  escape), esquema, validación (ids, rangos, enteros, notas, null) (R4, R5)
- [x] T004 `supabase/functions/estimar-materiales/logica.ts` (puro, sin Deno)
- [x] T005 `supabase/functions/estimar-materiales/index.ts` (R1–R3) y `[functions.estimar-materiales]`
  en `supabase/config.toml`
- [x] T006 Controles en `scripts/test-rls.mjs` (contracts/api.md) y servir la función en el CI;
  `test:rls` en verde local

## Phase 3: US1 — Sugerir (P1) 🎯 MVP

- [x] T007 [P] [US1] `tests/unit/tratamientos/estimacion-cliente.test.ts`: llamada, mapeo de errores
- [x] T008 [P] [US1] `tests/integration/tratamientos.test.tsx`: botón, espera, sugerencias, "Usar
  sugerencias", "Sin sugerencia", enteros, descarte al cambiar nombre o materiales
- [x] T009 [US1] `src/features/tratamientos/lib/estimacion.ts` y `TratamientoForm.tsx` (R6)

## Phase 4: US2 — Uso protegido (P1)

- [x] T010 [US2] `tratamientos.test.tsx`: sin conexión deshabilitado; mensajes de límite, no
  reconocido, servicio caído y no configurado
- [x] T011 [US2] Revisar en `index.ts` el orden de controles de contracts/api.md (la clave antes de
  reservar; reservar antes de la IA)

## Phase 5: Polish

- [x] T012 `npm run lint && npm run build && npm test`; `test:rls`
- [ ] T013 Prueba real con costo (quickstart) — **solo con clave y visto bueno** (pendiente: falta la
  clave de Anthropic)
- [x] T014 Notas de despliegue en `README.md` (migración, secreto, tope de gasto, deploy de la función)

## Dependencies

Setup → Foundational (T002–T006) → US1 → US2 → Polish. T005 depende de T004; T006 de T002 y T005.
