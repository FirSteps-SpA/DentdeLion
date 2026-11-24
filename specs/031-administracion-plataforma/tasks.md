---

description: "Task list for 031-administracion-plataforma"
---

# Tasks: Administración de la plataforma

**Input**: Design documents from `/specs/031-administracion-plataforma/`

**Tests**: SÍ.

## Phase 1: Setup

- [x] T001 Línea base: `npm run lint && npm test`

## Phase 2: Foundational

- [x] T002 Migración `20261126000000_administracion_plataforma.sql` (data-model: tablas, FKs, funciones)
- [x] T003 Edge Function `plataforma` (`logica.ts` puro + `index.ts`) y `[functions.plataforma]`
- [x] T004 [P] `tests/unit/plataforma/logica.test.ts` (validación de entradas, armado del respaldo)
- [x] T005 Controles en `scripts/test-rls.mjs` (contracts/api.md §1–7); `test:rls` en verde local

## Phase 3: US1 + US2 — Ver, crear, invitar (P1) 🎯 MVP

- [x] T006 `src/features/plataforma/lib/plataforma.ts` (cliente de la función) y su prueba
- [x] T007 Sección `plataforma` en Ajustes (visible por `es_operador_plataforma`), lista, detalle,
  "Nuevo cliente", "Invitar" con enlace y "Copiar"
- [x] T008 [P] Pruebas de UI: tarjeta solo para operadores, sin conexión, lista y detalle, crear e
  invitar

## Phase 4: US3 — Eliminar usuario (P2)

- [x] T009 Confirmación escribiendo el correo; errores de única administradora y propia cuenta
- [x] T010 Dexie v17 `usuariosEliminados`, pull en el sync y "Usuario eliminado" donde se muestra el
  autor (historial, detalle de insumo, cambios de precio, lugares)
- [x] T011 Cuenta borrada: el sync detecta `user_not_found`, limpia datos locales y cierra sesión con
  aviso (R5); pruebas (y que un error de red no borre nada)

## Phase 5: US4 — Eliminar cliente (P2)

- [x] T012 "Eliminar cliente": descarga del respaldo, luego confirmación por nombre; resultado con
  cuentas pendientes y reintento
- [x] T013 Pruebas de UI del flujo

## Phase 6: Polish

- [x] T014 Ayuda de la sección (spec 030) y guía — decidido: "Plataforma" no lleva "?" ni entra en
  la guía (es solo para operadores de First Steps; la guía la leen los clientes)
- [x] T015 `npm run lint && npm run build && npm test`; `test:rls`; recorrido con el driver (2026-11-23,
  login real contra Supabase local con una cuenta operadora: tarjeta, lista, crear cliente, detalle y
  hoja de eliminación). Ensayo de la migración sobre la restauración del respaldo de producción (con
  la 029 antes): 21 → 24 tablas, 421 filas iguales; `eliminar_cliente` sobre los datos reales en una
  transacción revertida borró todo y pasó la verificación
- [x] T016 README: despliegue (migración, función, alta del operador con SQL sin versionar) y
  actualizar `1stDocs/004-operacion/alta-tenant.md` (alternativa desde el panel; al hacer merge)
