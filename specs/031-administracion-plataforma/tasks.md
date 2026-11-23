---

description: "Task list for 031-administracion-plataforma"
---

# Tasks: Administración de la plataforma

**Input**: Design documents from `/specs/031-administracion-plataforma/`

**Tests**: SÍ.

## Phase 1: Setup

- [ ] T001 Línea base: `npm run lint && npm test`

## Phase 2: Foundational

- [ ] T002 Migración `20261126000000_administracion_plataforma.sql` (data-model: tablas, FKs, funciones)
- [ ] T003 Edge Function `plataforma` (`logica.ts` puro + `index.ts`) y `[functions.plataforma]`
- [ ] T004 [P] `tests/unit/plataforma/logica.test.ts` (validación de entradas, armado del respaldo)
- [ ] T005 Controles en `scripts/test-rls.mjs` (contracts/api.md §1–7); `test:rls` en verde local

## Phase 3: US1 + US2 — Ver, crear, invitar (P1) 🎯 MVP

- [ ] T006 `src/features/plataforma/lib/plataforma.ts` (cliente de la función) y su prueba
- [ ] T007 Sección `plataforma` en Ajustes (visible por `es_operador_plataforma`), lista, detalle,
  "Nuevo cliente", "Invitar" con enlace y "Copiar"
- [ ] T008 [P] Pruebas de UI: tarjeta solo para operadores, sin conexión, lista y detalle, crear e
  invitar

## Phase 4: US3 — Eliminar usuario (P2)

- [ ] T009 Confirmación escribiendo el correo; errores de única administradora y propia cuenta
- [ ] T010 Dexie v17 `usuariosEliminados`, pull en el sync y "Usuario eliminado" donde se muestra el
  autor (historial, detalle de insumo, cambios de precio, lugares)
- [ ] T011 Cuenta borrada: el sync detecta `user_not_found`, limpia datos locales y cierra sesión con
  aviso (R5); pruebas (y que un error de red no borre nada)

## Phase 5: US4 — Eliminar cliente (P2)

- [ ] T012 "Eliminar cliente": descarga del respaldo, luego confirmación por nombre; resultado con
  cuentas pendientes y reintento
- [ ] T013 Pruebas de UI del flujo

## Phase 6: Polish

- [ ] T014 Ayuda de la sección (spec 030) y guía
- [ ] T015 `npm run lint && npm run build && npm test`; `test:rls`; recorrido con el driver
- [ ] T016 README: despliegue (migración, función, alta del operador con SQL sin versionar) y
  actualizar `1stDocs/004-operacion/alta-tenant.md` (alternativa desde el panel)
