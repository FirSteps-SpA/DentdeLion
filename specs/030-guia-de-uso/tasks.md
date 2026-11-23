---

description: "Task list for 030-guia-de-uso"
---

# Tasks: Guía de uso con botón de ayuda

**Input**: Design documents from `/specs/030-guia-de-uso/`

**Tests**: SÍ.

## Phase 1: Setup

- [ ] T001 Línea base: `npm run lint && npm test`

## Phase 2: Foundational

- [ ] T002 `src/features/ayuda/contenido.ts`: tipos, `ayudaParaRol` y los textos de las 15 pantallas
  (R2), redactados a partir del comportamiento actual
- [ ] T003 [P] `tests/unit/ayuda/contenido.test.ts`: las 15 existen, ≤ 6 tareas, filtro por rol

## Phase 3: US1 — Ayuda en cada pantalla (P1) 🎯 MVP

- [ ] T004 `AyudaContenido`, `BotonAyuda` y prop `ayuda` en `EncabezadoVista` (R1, R3)
- [ ] T005 Pasar el id en las 7 vistas y en `SeccionAjustesPantalla`
- [ ] T006 [P] `tests/integration/ayuda.test.tsx`: "?" en cada pantalla, hoja con secciones, rol

## Phase 4: US2 — Primera visita (P2)

- [ ] T007 `ayudasVistas.ts` (localStorage por persona, try/catch) y autoabrir (R4)
- [ ] T008 Pruebas: una vez por pantalla y persona; otra persona sí; almacenamiento bloqueado

## Phase 5: US3 — Guía reunida (P2)

- [ ] T009 Sección `'guia'` en Ajustes y `GuiaUsoSection` (R5)
- [ ] T010 Pruebas: tarjeta para ambos roles, una entrada por pantalla visible

## Phase 6: Polish

- [ ] T011 `npm run lint && npm run build && npm test`; recorrido en la app con el driver
- [ ] T012 Nota de release en `README.md` (sin migración; la primera vez se abrirán solas)
