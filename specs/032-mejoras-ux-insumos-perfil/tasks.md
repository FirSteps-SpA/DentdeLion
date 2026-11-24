---

description: "Task list for 032-mejoras-ux-insumos-perfil"
---

# Tasks: Mejoras de UX en Nuevo insumo, perfil y tabla de inventario

**Input**: Design documents from `/specs/032-mejoras-ux-insumos-perfil/`

**Tests**: SÍ (plan.md § Testing).

## Phase 1: Setup

- [x] T001 Línea base: `npm run lint && npm test`. Lint ok. 24 tests fallan en `develop` por
  timeout (5 s) con la máquina cargada; aislados pasan casi todos y la falla restante también es por
  timeout

## Phase 2: Foundational

Sin tareas bloqueantes compartidas: cada historia toca archivos distintos y se puede hacer en
cualquier orden (ver Dependencies).

## Phase 3: US1 — Dar de alta un insumo sin jerga (P1) 🎯 MVP

**Goal**: rótulos simples, ejemplo, campos dobles compra|consumo y código de barras oculto en Nuevo y
Editar insumo.

**Independent Test**: spec US1, quickstart §1 (ácido fosfórico: 3 jeringas ↔ 9 ml, 0,5 ml ↔ ≈ 0,17).

- [ ] T002 [P] [US1] Conversión pura (compra↔consumo, "≈", ≤ 2 decimales, contenido cambiado según
  `ultimoEditado`, vacío, contenido inválido) en `src/features/insumos/lib/cantidadDoble.ts`
  (data-model § Cantidad doble)
- [ ] T003 [US1] `src/components/ui/CantidadDobleField.tsx` según ui-contracts §3 (dos `NumeroInput`
  ≥ 48 px, `aria-label` por unidad, derivado con `aria-live`, un solo campo con unidades iguales,
  segundo deshabilitado sin contenido válido)
- [ ] T004 [P] [US1] `tests/unit/CantidadDobleField.test.tsx`: conversión en ambos sentidos, "≈",
  respeta `unidadAdmiteDecimales` al escribir, el derivado no se redondea a entero, vaciar el mínimo
  vacía ambos, recalcula al cambiar el contenido
- [ ] T005 [P] [US1] Rótulos, ayudas y "Igual que como lo uso" en
  `src/features/insumos/components/PresentacionFields.tsx` (ui-contracts §1)
- [ ] T006 [P] [US1] `MOSTRAR_CODIGO_BARRAS = false` en `src/lib/scanner/` (research R4)
- [ ] T007 [US1] `src/features/insumos/components/AltaMaterialView.tsx`: ejemplo plegable
  (ui-contracts §2), stock inicial y mínimo con `CantidadDobleField` (`unidadStockInicial` =
  `unidadMedida`, research R1), ayuda del mínimo, sin campo ni verificación de código
- [ ] T008 [US1] `src/features/insumos/components/EditarInsumoForm.tsx`: mínimo del catálogo y del
  lugar con `CantidadDobleField`, sin "Código de fabricante" (se conserva el valor original al
  guardar)
- [ ] T009 [US1] Actualizar `tests/integration/alta-material.test.tsx` y
  `tests/integration/presentacion.test.tsx` (rótulos, sin código, caso del ácido fosfórico extremo a
  extremo, la cantidad guardada en unidad de consumo) y agregar un caso de Editar que conserva
  `codigoFabricante`

## Phase 4: US2 — Atajo de perfil y editar mi nombre (P2)

**Goal**: menú del avatar con Ver perfil/Cerrar sesión, y nombre propio editable (online).

**Independent Test**: spec US2, quickstart §2.

- [ ] T010 [US2] Migración `supabase/migrations/20261127000000_nombre_propio.sql` con
  `actualizar_mi_nombre` (contracts/api.md: 1–80, `nombre_invalido`, 42501 si está desactivado,
  grants)
- [ ] T011 [US2] Controles 1–5 de contracts/api.md en `scripts/test-rls.mjs`; `supabase db reset &&
  npm run test:rls` en verde
- [ ] T012 [P] [US2] `guardarNombrePropio(nombre)` (rpc, mensajes "Escribe tu nombre." / "Necesitas
  conexión para cambiar tu nombre.") en `src/lib/supabase/perfiles.ts`
- [ ] T013 [P] [US2] `actualizarNombre` (usuarioActual + `usuariosConocidos`) en
  `src/stores/authStore.ts`, y `revisarPerfil` que refresca el nombre en `src/lib/sync/index.ts`
- [ ] T014 [US2] "Editar nombre" con Guardar/Cancelar en
  `src/features/ajustes/components/PerfilSection.tsx` (ui-contracts §5)
- [ ] T015 [P] [US2] `irASeccionAjustes(id)` en `src/app/useVista.ts` (setVista('mas') +
  `abrirSeccion` + `popstate`, research R6), y pasarla por `src/app/App.tsx` y `src/app/AppShell.tsx`
- [ ] T016 [US2] `src/app/MenuPerfil.tsx` (ui-contracts §4: `role="menu"`, teclado, click fuera,
  foco)
- [ ] T017 [US2] Usar `MenuPerfil` en `src/app/AppHeader.tsx` y `src/app/TopBar.tsx`; actualizar el
  comentario de spec 011 en `AppHeader`
- [ ] T018 [P] [US2] `tests/integration/menu-perfil.test.tsx`: abre/cierra (Escape, click fuera), el
  foco vuelve al avatar, Ver perfil abre Perfil desde otra vista y con Ajustes ya montado en otra
  sección, Cerrar sesión, móvil y desktop
- [ ] T019 [P] [US2] `tests/integration/perfil-nombre.test.tsx`: personal guarda su nombre, las
  iniciales cambian, vacío da error, sin conexión da error, el sync con otro nombre lo refresca

## Phase 5: US3 — Encabezado de la tabla fijo (P3)

**Goal**: `th` fijo bajo la `TopBar` al bajar en la tabla de desktop.

**Independent Test**: spec US3, quickstart §3.

- [x] T020 [US3] `src/features/insumos/components/InventarioTabla.tsx`: contenedor `overflow-x-clip`,
  `th` `sticky top-[72px] z-10 bg-surface` con borde inferior, Producto y Presentación pueden partirse
  (research R7, ui-contracts §6)
- [x] T021 [US3] Actualizar `tests/integration/inventario-tabla.test.tsx` (clases sticky en `th`,
  contenedor sin `overflow-x-auto`)
- [x] T022 [US3] Verificar a 1200 px con sidebar expandida que no se cortan columnas. Si se cortan,
  aplicar la alternativa de research R7 y registrar la decisión en research.md. Hecho: no cabía; la
  alternativa se descartó y se aplicó el modo compacto (research R7, decisión final)

## Phase 6: Polish

- [ ] T023 [P] Guía y ayuda en `src/features/ayuda/contenido.ts`: "completa nombre, categoría y cómo
  lo usas", atajo del avatar en "Perfil y equipo", editar nombre; ajustar
  `tests/integration/ayuda.test.tsx` si cambia
- [ ] T024 [P] Revisar áreas táctiles ≥ 48 px (avatar, ítems del menú, `summary`, inputs dobles) en
  móvil 390 px
- [ ] T025 `npm run lint && npm run build && npm test`; `test:rls`; recorrido de quickstart §1–§3

## Dependencies

- Las historias no dependen entre sí. Orden sugerido en plan.md: US3 → US1 → US2 (de menor a mayor
  riesgo). US2 es la única con migración.
- US1: T002 → T003 → T007/T008 → T009. T004–T006 en paralelo con T003.
- US2: T010 → T011. T012/T013/T015 en paralelo. T014 depende de T012–T013. T016 → T017 depende de T015.
  T018/T019 al final.
- US3: T020 → T021 → T022.
- Polish después de las historias que se entreguen.

## Parallel Examples

- US1: T002 + T005 + T006 a la vez. Luego T003 + T004.
- US2: T012 + T013 + T015 a la vez mientras corre T011.
- Entre historias: US3 completa (T020–T022) en paralelo con cualquier tarea de US1 o US2.

## Implementation Strategy

1. **MVP = US1** (el alta es la primera tarea de toda clienta nueva). Se puede publicar sola.
2. US3 es chica y aislada: conviene hacerla primero para calentar y entregarla junto con US1.
3. US2 al final, porque requiere `db push` de la migración antes o junto con el front (plan §
   Despliegue: el orden no importa).
