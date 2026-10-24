---

description: "Task list for 020-paginacion-de-listas"
---

# Tasks: Paginación de listas

**Input**: Design documents from `/specs/020-paginacion-de-listas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. plan.md (Testing) y `contracts/ui-contracts.md` (tabla "Tests") las definen. Patrón del
proyecto: Vitest + RTL con `fireEvent` (no hay `user-event`), helpers de `tests/helpers/`
(`memoryDb.ts`, `lugarFalso.ts`, `tenancy.ts`, `matchMedia.ts` con `simularAncho(px)` para desktop).
Verificación visual con `run-indentory`.

**Desvíos al implementar**: `InventarioTabla` recibe `tituloRef` (ref del `<caption>`) en vez de una
`ref` al contenedor; el desplazamiento usa `caption.closest('div')` y el contenedor lleva `scroll-mt-24`
para que el encabezado fijo de desktop no tape la primera fila (visto en las capturas).
`paginasVisibles` muestra el número cuando el hueco es de una sola página (`1 … 4 5 6 7 8` en vez de
`1 … 4 5 6 … 8`). Se agregó el ícono `ChevronLeft`. `seed-volumen.mjs` nombra los insumos con tres
dígitos ("Insumo 007") para que el orden alfabético coincida con el numérico.

**Organization**: por historia de spec.md. `R#` = research.md, "UI" = `contracts/ui-contracts.md`,
"QS §n" = quickstart.md, "DM" = data-model.md. Sin esquema, migración, versión de Dexie, cambios de
sync ni `test:rls` nuevos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US4 de spec.md

---

## Phase 1: Setup

- [X] T001 *(Hecho: lint sin avisos, 850 pruebas en 113 archivos.)* Confirmar la línea base en la rama `020-paginacion-de-listas`: `npm run lint && npm test`
  en verde antes de tocar código, y anotar el número de pruebas y archivos para comparar en T031.
- [X] T002 [P] Agregar la opción `--insumos` (por defecto `40`, el valor actual) a
  `scripts/seed-volumen.mjs` (R8): reemplazar el `Array.from({ length: 40 }, …)` por el valor
  parseado con `parseArgs` y actualizar el comentario de uso del encabezado.

---

## Phase 2: Foundational

**Purpose**: la paginación común (R1–R3, R6) que usan las cuatro historias. Bloquea todo lo demás.

- [X] T003 [P] Escribir `tests/unit/paginacion.test.ts` (DM "Derivados"): `TAMANO_PAGINA === 25`;
  `totalPaginas` con 0 → 1, 25 → 1, 26 → 2, 50 → 2, 200 → 8, 1000 → 40; `paginaDe(75, 200) === 3`,
  `paginaDe(200, 60) === 3` (acotada); `rangoPagina(2, 200)` → `{ desde: 26, hasta: 50 }`,
  `rangoPagina(3, 60)` → `{ 51, 60 }`, `rangoPagina(1, 0)` → `{ 0, 0 }`; `paginasVisibles`: con 5
  páginas todas sin "…"; `(1, 8)` → `[1, 2, '…', 8]` (primera, actual ± 1 y última);
  `(5, 8)` → `[1, '…', 4, 5, 6, '…', 8]`; `(8, 8)` termina en `7, 8`; nunca más de 7 posiciones ni
  "…" contiguos; `textoQuedan(1) === 'queda 1'`, `textoQuedan(3) === 'quedan 3'`.
- [X] T004 [P] Escribir `tests/unit/useListaPaginada.test.tsx` con `renderHook` (UI
  `useListaPaginada`): con 60 ítems en `'ver-mas'`, `visibles` tiene 25, `quedan` 35, `hayControles`
  `true`; `verMas()` → 50 y `indicePrimerNuevo === 25`; otra vez → 60, `quedan` 0; con 25 ítems
  `hayControles` es `false`; en `'paginas'`, `irAPagina(3)` sobre 60 → `visibles` son los ítems 50–59,
  `pagina` 3; cambiar `clave` en `rerender` vuelve a 25 / página 1; achicar `items` a 30 con página 3
  muestra la página 2 (R3) y volver a 60 muestra la 3; cambiar `modo` de `'ver-mas'` (tras dos
  `verMas`, 75) a `'paginas'` da página 3, y al revés desde página 3 da 75 visibles (R1).
- [X] T005 Implementar `src/lib/paginacion.ts` (UI, DM, R1–R3): `TAMANO_PAGINA`, `ModoPaginacion`,
  `totalPaginas`, `paginaDe`, `rangoPagina`, `paginasVisibles`, `textoQuedan` y el hook
  `useListaPaginada(items, { clave, modo })`. Un solo `useState` para `hasta` (empieza en 25) más la
  clave anterior; si `clave` cambia, reiniciar `hasta` durante el render (mismo patrón que
  `claveTanda` en `src/features/ajustes/components/MinimosPorInsumoSection.tsx`), sin `useEffect`.
  La página mostrada se calcula con `paginaDe`, no se guarda. El hook no filtra ni ordena. T003 y T004
  en verde.
- [X] T006 [P] Escribir `tests/unit/VerMas.test.tsx` y `tests/unit/Paginador.test.tsx` (UI): `VerMas`
  no renderiza con `quedan` 0, muestra "Ver más (quedan 35)" / "Ver más (queda 1)", llama `onVerMas`
  y tiene una región `aria-live="polite"` con "Se muestran 25 de 60"; `Paginador` no renderiza con 1
  página, es un `nav` con el `aria-label` dado, "Anterior" deshabilitado en la página 1 y "Siguiente"
  en la última, `aria-current="page"` en la actual, "…" no es botón, muestra "26–50 de 200" y cada
  número llama `onIrAPagina` con su página.
- [X] T007 Implementar `src/components/ui/VerMas.tsx` y `src/components/ui/Paginador.tsx` (UI, R6)
  con `TouchButton`, clases `touch-target` (≥ 48 px, Constitución III) y textos de `textoQuedan` /
  `rangoPagina`; la región `aria-live` con `sr-only`. Estilo del DS como el "Ver más" actual de
  `MinimosPorInsumoSection` (`variant="secondary"`). T006 en verde.

**Checkpoint**: paginación común lista y probada; ninguna pantalla cambió todavía.

---

## Phase 3: User Story 1 - Recorrer el inventario por partes en el teléfono (Priority: P1) 🎯 MVP

**Goal**: Inventario en tarjetas (teléfono y tablet) muestra 25 insumos en orden alfabético con "Ver
más"; el detalle se abre en una hoja y la lista no se mueve.

**Independent Test**: QS §2 — 200 insumos: 25 tarjetas y "Ver más (quedan 175)"; abrir y cerrar el
detalle desde el tercer grupo conserva los 75 visibles.

### Tests for User Story 1

- [X] T008 [P] [US1] Escribir `tests/integration/inventario-paginacion.test.tsx` (parte US1) con el
  store de inventario cargado con 60 insumos generados (nombres desordenados, p. ej. "Insumo 037") y
  ancho móvil: se ven 25 tarjetas en orden alfabético (FR-003a) y "Ver más (quedan 35)"; tocarlo
  muestra 50 y el foco queda en la tarjeta 26 (R6); con 25 insumos no hay "Ver más" (FR-002); tocar un
  insumo del segundo grupo abre un `dialog` "Detalle del insumo" con su contenido, y "Cerrar" lo cierra
  dejando 50 tarjetas (FR-010); "Consumir 1" en una tarjeta del segundo grupo no cambia la cantidad
  visible; dar de baja el insumo con el detalle abierto cierra la hoja.
- [X] T009 [P] [US1] Actualizar los tests que cierran el detalle con "Cerrar detalle" para usar el
  "Cerrar" de la hoja (`within(screen.getByRole('dialog')).getByLabelText('Cerrar')`) y buscar el
  contenido dentro del `dialog`: `tests/integration/inventario.test.tsx`,
  `tests/integration/acciones-rapidas.test.tsx`, `tests/integration/inventario-tabla.test.tsx` y, si
  depende del botón quitado, `tests/integration/alertas-detalle.test.tsx`. No tocar
  `tests/integration/tratamientos.test.tsx` (es el detalle de tratamientos).

### Implementation for User Story 1

- [X] T010 [US1] En `src/features/insumos/components/InsumoDetalle.tsx`, quitar la prop `enHoja` y el
  botón "Cerrar detalle" (R5); mantener `onClose` en las props. En
  `src/features/alertas/components/DetalleDesdeAlerta.tsx`, dejar de pasar `enHoja`.
- [X] T011 [US1] En `src/features/insumos/components/InventarioView.tsx` (UI `InventarioView`):
  ordenar `resultados` por `insumo.nombre` con `localeCompare(…, 'es', { sensitivity: 'base' })`
  antes de armar `filas` (R4); llamar `useListaPaginada(filas, { clave, modo })` con
  `clave = [texto, categoria, estado.join(','), lugarActivoId].join('|')` y
  `modo = disposicion === 'desktop' ? 'paginas' : 'ver-mas'`; en la rama de tarjetas, renderizar
  `visibles` y `<VerMas>` debajo del `<ul>`, con `tabIndex={-1}` y foco en el `<li>` de
  `indicePrimerNuevo` tras "Ver más" (R6). Mover `useLugarStore((s) => s.lugarActivoId)` arriba,
  junto a los demás hooks, para usarlo en la clave.
- [X] T012 [US1] En el mismo `InventarioView.tsx`, mostrar el detalle en
  `<BottomSheet titulo="Detalle del insumo" onClose={() => setInsumoSeleccionadoId(null)}>` con
  `InsumoDetalle` adentro (R5), en lugar del `InsumoDetalle` suelto al final. El resto de overlays,
  el alta ("Abrir existente" abre la hoja aunque el insumo no esté en la página) y los mensajes de
  vacío quedan iguales. T008 y T009 en verde.

**Checkpoint**: MVP — Inventario en teléfono y tablet ya no es una página interminable.

---

## Phase 4: User Story 2 - Que búsqueda, filtros y alertas sigan viendo todo el inventario (Priority: P1)

**Goal**: búsqueda, filtros, resumen de alertas y cambio de lugar operan sobre todo el inventario y
vuelven al comienzo.

**Independent Test**: QS §3 — con 3 grupos cargados, buscar el último insumo alfabético lo muestra
primero; el resumen de alertas cuenta insumos de todas las páginas.

### Tests for User Story 2

- [X] T013 [US2] Ampliar `tests/integration/inventario-paginacion.test.tsx` (parte US2): con 60
  insumos y 50 visibles, escribir el nombre del último alfabético → aparece y la lista vuelve a 25
  como máximo (FR-008, FR-009); elegir una categoría y un estado → vuelve al comienzo; con 30 insumos
  bajo mínimo (varios fuera de los primeros 25) el resumen de alertas cuenta los 30 y tocar su acceso
  deja 25 + "Ver más (quedan 5)"; un filtro sin resultados muestra "Ningún insumo coincide…" sin
  "Ver más"; cambiar `lugarActivoId` en el store de lugar vuelve al comienzo; en "Todos" (con
  `lugarFalso`) se pagina igual y cada tarjeta mantiene su desglose.

### Implementation for User Story 2

- [X] T014 [US2] Verificar en `src/features/insumos/components/InventarioView.tsx` que
  `totalCaducidad`, `totalStockBajo`, `estadosInsumo` y `resultados` se calculan antes de
  `useListaPaginada` y nunca sobre `visibles` (FR-008); que los accesos del resumen y `limpiarFiltros`
  cambian la clave; ajustar lo que haga falta hasta tener T013 en verde.

---

## Phase 5: User Story 3 - Ir por páginas en la tabla de desktop (Priority: P2)

**Goal**: la tabla de desktop muestra páginas numeradas de 25 con rango, desplazamiento al comienzo y
anuncio para lectores.

**Independent Test**: QS §4 — 200 insumos a 1280 px: "1–25 de 200", 8 páginas; ir a la 5 muestra
101–125 y la página se conserva al cerrar el detalle.

### Tests for User Story 3

- [X] T015 [US3] Ampliar `tests/integration/inventario-tabla.test.tsx` con `simularAncho(1280)` y 60
  insumos: 25 filas y el `nav` "Páginas del inventario" con "1–25 de 60"; "Siguiente" → filas 26–50 y
  "26–50 de 60"; ir a la página 3 → 10 filas y "Siguiente" deshabilitado; el `<caption>` dice
  "Insumos 51–60 de 60" y recibe el foco; abrir y cerrar el detalle de una fila sigue en la página 3;
  dar de baja insumos hasta que la página 3 quede vacía muestra la 2 (FR-011); con 25 insumos no hay
  paginador. En `inventario-paginacion.test.tsx`, cambiar de `simularAncho(1280)` a `simularAncho(800)`
  en la página 3 deja 75 tarjetas visibles (FR-012).

### Implementation for User Story 3

- [X] T016 [US3] En `src/features/insumos/components/InventarioTabla.tsx`: prop opcional
  `titulo?: string` renderizada como `<caption className="sr-only" tabIndex={-1}>`, y `ref` reenviada
  al contenedor (React 19: `ref` como prop) para desplazar y enfocar (UI `InventarioTabla`, R6).
- [X] T017 [US3] En `src/features/insumos/components/InventarioView.tsx`, rama desktop: pasar
  `visibles` a `InventarioTabla` con `titulo` = "Insumos {desde}–{hasta} de {total}" y renderizar
  `<Paginador etiqueta="Páginas del inventario">` debajo; al elegir página, llamar `irAPagina` y, tras
  el render, `scrollIntoView({ block: 'start' })` del contenedor y foco en el `<caption>` (sin mover
  el foco en el render inicial). T015 en verde.

---

## Phase 6: User Story 4 - Listas de Ajustes por partes, igual que Inventario (Priority: P3)

**Goal**: Categorías, Insumos dados de baja y el editor de mínimos usan el mismo "Ver más".

**Independent Test**: QS §5 — con 40 categorías y 30 insumos dados de baja: 25 + "Ver más" en cada
sección; el editor de mínimos sin cambios de comportamiento.

### Tests for User Story 4

- [X] T018 [P] [US4] Ampliar `tests/integration/ajustes.test.tsx`: con 40 categorías, la sección
  Categorías muestra 25 y "Ver más (quedan 15)"; tras "Ver más", renombrar una del segundo grupo
  mantiene las 40 visibles; con 30 insumos dados de baja (nombres desordenados) se ven 25 en orden
  alfabético y "Ver más (quedan 5)"; restaurar uno con todos visibles deja 29 y sin "Ver más"; volver
  al índice y entrar otra vez muestra 25 (FR-016); con 25 o menos no hay "Ver más".
- [X] T019 [P] [US4] Revisar `tests/integration/ajustes-minimos.test.tsx`: los casos de "Ver más"
  siguen pasando con el texto común ("Ver más (quedan N)"); agregar uno que confirme que cambiar la
  búsqueda vuelve a 25.

### Implementation for User Story 4

- [X] T020 [US4] En `src/features/ajustes/components/MinimosPorInsumoSection.tsx`, reemplazar el
  estado `visibles` y el botón propio por `useListaPaginada(filas, { clave: `${busqueda}|${seleccion}`,
  modo: 'ver-mas' })` y `<VerMas>`; mantener el reinicio de `errores` con la misma clave. En
  `src/features/ajustes/lib/minimosEditor.ts`, quitar `TAMANO_PAGINA_MINIMOS` y actualizar sus usos
  (incluidos tests de `tests/unit/ajustes/`).
- [X] T021 [P] [US4] En `src/features/ajustes/components/CategoriasSection.tsx`, paginar `catalogo`
  con `useListaPaginada(catalogo, { clave: '', modo: 'ver-mas' })` y `<VerMas>` debajo de la
  `Card`; el diálogo de crear/renombrar y los errores sin cambios.
- [X] T022 [P] [US4] En `src/features/ajustes/components/InsumosBajaSection.tsx`, ordenar
  `insumosDadosDeBaja` por nombre (como T011) y paginar con `useListaPaginada` + `<VerMas>`; el
  mensaje "Ningún insumo está dado de baja." sin cambios. T018 y T019 en verde.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T023 *(Hecho: todos los controles son `TouchButton` (48 px); el paginador muestra como máximo 7 números más anterior/siguiente y cabe a 1280 px con 8 páginas.)* [P] Revisar con el DS los tamaños táctiles y el foco visible (Constitución III): "Ver más",
  números, "Anterior"/"Siguiente" con `touch-target`; el paginador no desborda a 1200 px con 40
  páginas.
- [X] T024 [P] Confirmar que `tests/unit/lecturas-movimientos.test.ts` y
  `tests/unit/sin-input-number-suelto.test.ts` siguen pasando sin agregar permitidos.
- [X] T025 [P] Confirmar con `git diff --stat develop` que no hay cambios en `src/lib/sync`,
  `src/lib/db` ni `supabase/` (SC-006).
- [X] T026 *(Hecho en parte: sin Supabase local en este equipo, los 200 insumos se sembraron en IndexedDB con el driver de `run-indentory` (`seed-insumo`/`seed-lote`), no con `seed-volumen.mjs`. Recorrido QS §2 y §4 en Chromium headless: 25 tarjetas y "Ver más (quedan 175)", detalle en hoja que al cerrarse deja la lista en su lugar, paginador "1–25 de 200" con `1 2 … 8`, página 8 con 176–200. No se midió SC-001 con CPU limitada ni se comparó el alto de la página (SC-002).)* Sembrar Supabase local con `node scripts/seed-volumen.mjs --insumos 200` y hacer el
  recorrido manual QS §2–§5 con `run-indentory`; medir que la primera página de Inventario aparece en
  menos de 1 s con la CPU limitada 4× en DevTools (SC-001) y comparar el alto de la página con y sin
  paginación (SC-002).
- [X] T027 *(Hecho: capturas `020-*` en `.claude/skills/run-indentory/screenshots/` (móvil 360, tablet 768, desktop 1280, detalle en hoja). Categorías e Insumos dados de baja con más de 25 no se capturaron: el driver no siembra categorías ni bajas; lo cubren las pruebas de `ajustes.test.tsx`.)* Capturas QS §6 con `run-indentory`: Inventario (primera página y tras "Ver más") en 360,
  768 y 1280 px; detalle en hoja en los tres; Categorías e Insumos dados de baja en móvil.
- [X] T028 *(Hecho en parte: el foco tras "Ver más", el foco en el `<caption>` con el rango, `aria-current`, `aria-live` y "…" fuera del árbol de accesibilidad están cubiertos por pruebas; no se probó con un lector de pantalla real.)* Probar con teclado y lector de pantalla (Orca o el árbol de accesibilidad de DevTools):
  "Ver más" anuncia lo visible y deja el foco en el primer agregado; cambiar de página enfoca el
  título de la tabla con el rango.
- [X] T029 *(Hecho en `../1stDocs`, sin commit: roadmap con estado, decisiones y la corrección de "tabla (tablet y desktop)"; backlog con "Paginación de insumos" tachada.)* [P] En `../1stDocs`, actualizar `005-roadmap/002-DentdeLion.md` (020 hecha, con las
  decisiones de Clarifications —"Ver más" en tarjetas y Ajustes, páginas en la tabla; no se recuerda
  al salir; detalle en hoja— y el orden alfabético agregado en el plan; corregir "tabla (tablet y
  desktop)" por "tabla en desktop") y `002-backlog/002-DentdeLion.md` ("Paginación de insumos"
  tachada con la referencia a la spec).
- [X] T030 *(Hecho: desvíos anotados al comienzo de este archivo; spec, plan y contratos ya reflejaban el orden alfabético y el detalle en hoja.)* Revisar que `specs/020-paginacion-de-listas/` refleja lo implementado (desvíos anotados
  al comienzo de este archivo, como en la 019).
- [X] T031 *(Hecho: lint sin avisos, build, 896 pruebas en 118 archivos; línea base 850 en 113.)* Correr `npm run lint && npm run build && npm test`, todo verde, con más pruebas que en
  T001.
- [X] T032 *(Hecho: PR #16.)* Descripción del PR a `develop`: paginación común (R1–R3), Inventario con "Ver más" y
  páginas, detalle en hoja (R5), orden alfabético (R4) y por qué, Ajustes con el mismo control,
  resultado de T026 y T028 y capturas de T027. Sin migración: se despliega solo el front.

---

## Dependencies & Execution Order

- **Setup** (T001–T002) → todo lo demás; T002 solo hace falta antes de T026.
- **Foundational** (T003–T007): T003 + T004 → T005; T006 → T007; T007 depende de T005
  (`textoQuedan`, `rangoPagina`). Bloquea todas las historias.
- **US1** (T008–T012): T008 y T009 en paralelo (fallan hasta T012); T010 → T012; T011 → T012. MVP.
- **US2** (T013–T014): depende de T011 (clave en `InventarioView`).
- **US3** (T015–T017): depende de T011 y T012 (mismo archivo); T016 → T017.
- **US4** (T018–T022): depende solo de Foundational; independiente de US1–US3. T020, T021 y T022 en
  archivos distintos.
- **Polish** (T023–T032): al final; T029–T032 después de T031 salvo T029, que puede ir en paralelo.

```text
Setup ─► Foundational ─┬─► US1 (MVP) ─┬─► US2 ──┐
                       │              └─► US3 ──┼─► Polish
                       └─► US4 ─────────────────┘
```

## Parallel Examples

- **Inicio**: T002, T003, T004 y T006 en paralelo.
- **US1**: T008 y T009 en paralelo con T010.
- **Entre historias**: US4 completa en paralelo con US1–US3 (archivos de Ajustes vs. Inventario).
- **US4**: T018 y T019 en paralelo; luego T020, T021 y T022 en paralelo.
- **Polish**: T023, T024, T025 y T029 en paralelo.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: Inventario en teléfono y tablet por partes, con detalle en
   hoja. Es donde más se nota el pedido de la clienta.
2. **+ US2**: garantiza que nada queda oculto a la búsqueda ni a las alertas (en la práctica viene casi
   gratis con US1, pero sus pruebas son la red de seguridad; no publicar sin ellas).
3. **+ US3**: tabla de desktop con páginas numeradas.
4. **+ US4**: Ajustes con el mismo control (puede ir en paralelo desde Foundational).
5. **Polish**: recorrido con 200 insumos, accesibilidad, capturas, 1stDocs y PR.
