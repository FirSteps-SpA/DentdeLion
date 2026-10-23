---

description: "Task list for 018-detalles-alertas-y-formularios"
---

# Tasks: Detalles de alertas y formularios

**Input**: Design documents from `/specs/018-detalles-alertas-y-formularios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. La spec las exige para la rueda (FR-005, SC-001) y plan.md (Testing) define el resto.
Patrón del proyecto: Vitest + RTL con `fireEvent` (no hay `user-event`), helpers de `tests/helpers/`
(`memoryDb.ts`, `authFalso.ts`, `lugarFalso.ts`, `tablasMemoria.ts`). Verificación visual y manual con
`run-indentory` y navegadores reales.

**Organization**: por historia de spec.md. `R#` = research.md, "UI §n" = `contracts/ui-contracts.md`,
"QS §n" = quickstart.md. Sin esquema, migración, Dexie ni `test:rls` nuevos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US4 de spec.md

---

## Phase 1: Setup

- [X] T001 Confirmar la línea base en la rama: `npm run lint && npm test` en verde antes de tocar
  código, y anotar el número de pruebas para comparar en T034.

---

## Phase 2: Foundational

**Purpose**: los helpers de texto que comparten Alertas e Inicio (US2 y US3). US1 y US4 no dependen
de esta fase.

- [X] T002 [P] Escribir `tests/unit/alertas/textoCaducidad.test.ts` con todos los casos de UI §2:
  `textoTiempoCaducidad` para 0, 1, 12, 59, 60, 89, 90, 170, −1, −5, −59 y −60; y
  `formatearFechaCaducidad('2026-11-03') === '3 nov 2026'` con `process.env.TZ` en
  `America/Santiago` (o fijando la zona en el test), más `''` para fecha vacía o inválida.
- [X] T003 [P] Escribir `tests/unit/alertas/etiquetaStock.test.ts` con la tabla de UI §3: −2, 0 →
  "Sin stock"/`danger`/`CircleAlert`; 0,5 y 2 → "Bajo mínimo"/`warning-30`/`AlertTriangle`.
- [X] T004 Implementar `src/features/alertas/lib/textoCaducidad.ts` (R3, R4): `textoTiempoCaducidad`
  con umbral 60 y meses = `Math.floor(Math.abs(dias) / 30)`, singular "1 día"; y
  `formatearFechaCaducidad` que separa `AAAA-MM-DD`, construye `new Date(año, mes - 1, día)` y formatea
  con un `Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })` a nivel
  de módulo (`dateStyle: 'medium'` da "03-11-2026" en `es-CL`). Comentario breve
  sobre por qué no se usa `new Date(fecha)` (UTC). T002 en verde.
- [X] T005 Implementar `src/features/alertas/lib/etiquetaStock.ts` (R6) con el tipo `EtiquetaStock`
  de data-model.md, usando `BadgeVariant` de `src/components/ui/Badge` y los íconos de
  `src/components/icons`. T003 en verde.

**Checkpoint**: helpers listos y probados; ninguna pantalla cambió todavía.

---

## Phase 3: User Story 1 - Cargar cantidades sin que la rueda las cambie (Priority: P1) 🎯 MVP

**Goal**: ningún campo numérico de la app cambia con la rueda del mouse o el trackpad; la página se
desplaza; escritura, + y − siguen funcionando (FR-001 a FR-005).

**Independent Test**: QS §2. En el alta, escribir 200 en "Stock inicial", girar la rueda sobre el campo:
sigue en 200 y la página se desplaza.

### Tests for User Story 1

- [X] T006 [P] [US1] Escribir `tests/unit/NumeroInput.test.tsx` con las invariantes 1–3 de UI §1: con
  foco y valor 200, `fireEvent.wheel` deja el valor en 200 y `document.activeElement` distinto del
  input; sin foco, `wheel` no cambia nada ni lanza; `fireEvent.change` con "35" llama `onChange`; el
  `onWheel` recibido por props también se llama; `ref` llega al `<input>`; nunca se llama
  `preventDefault` (el evento no queda `defaultPrevented`).
- [X] T007 [P] [US1] Escribir `tests/unit/sin-input-number-suelto.test.ts` (R2) con el patrón de
  `tests/unit/lecturas-movimientos.test.ts`: recorre `src/` (`.ts`/`.tsx`) y falla si algún archivo
  distinto de `src/components/ui/NumeroInput.tsx` contiene `type="number"` o `type={'number'}`; incluir
  un caso que pruebe que la regla detecta ambas formas. Falla hasta T016.

### Implementation for User Story 1

- [X] T008 [US1] Crear `src/components/ui/NumeroInput.tsx` (R1, UI §1): props =
  `Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>` + `ref` (React 19, `ref` como prop);
  renderiza `<input type="number" {...props}>` y en `onWheel` hace `blur()` si es
  `document.activeElement`, luego llama al `onWheel` recibido. Comentario JSDoc con el motivo (bug de la
  clienta, spec 018) y por qué no `preventDefault`. T006 en verde.
- [X] T009 [US1] Usar `NumeroInput` en `src/components/ui/Stepper.tsx` (campo central), sin cambiar sus
  props ni comportamiento. Cubre alta, cantidad de ingreso, presentación, traslado, compras manuales,
  registrar tratamiento y cantidades de materiales.
- [X] T010 [P] [US1] Usar `NumeroInput` en `src/features/insumos/components/ConsumoForm.tsx`.
- [X] T011 [P] [US1] Usar `NumeroInput` en los 2 campos de
  `src/features/insumos/components/EditarInsumoForm.tsx` (`editar-stock-minimo` y
  `editar-minimo-lugar`).
- [X] T012 [P] [US1] Usar `NumeroInput` en `src/features/insumos/components/ConvertirUnidadDialog.tsx`
  y en `src/features/insumos/components/PrecioIngresoField.tsx`.
- [X] T013 [P] [US1] Usar `NumeroInput` en los 2 campos de
  `src/features/ajustes/components/ConfiguracionAlertasSection.tsx` (mínimo por insumo con `onBlur` y
  `horas-aviso-pendientes`).
- [X] T014 [P] [US1] Usar `NumeroInput` en `src/features/ajustes/components/LugaresSection.tsx`
  (% profesional).
- [X] T015 [P] [US1] Usar `NumeroInput` en `src/features/tratamientos/components/TratamientoForm.tsx`
  (precio en cada lugar).
- [X] T016 [US1] Correr T007: debe pasar (ningún `type="number"` suelto). Si aparece uno que no estaba
  en la lista de UI §1, migrarlo también y agregarlo a la tabla de UI §1.
- [X] T017 [US1] *(Hecho: en vez de un archivo nuevo, una prueba "rueda del mouse (spec 018 FR-005)"
  en el archivo de integración que ya monta cada formulario, con el helper
  `tests/helpers/rueda.ts`: `alta-material` (stock inicial y mínimo), `consumo`, `conversion-unidad`
  (mínimo del catálogo, mínimo del lugar y factor), `ingreso-precio` (cantidad y precio de la
  recepción), `ajustes` (mínimo por insumo, que además guarda lo escrito al soltar el foco, y horas de
  aviso), `porcentaje-lugar` y `tratamientos` (precio por lugar y cantidad de material). Verificación de
  mutación: sin el `blur()` de `NumeroInput` fallan las 9.)* Escribir las pruebas de rueda por
  formulario (FR-005, R8): escribir un valor, enfocar, `fireEvent.wheel` y comprobar valor intacto y
  foco perdido.

**Checkpoint**: US1 completa. Publicable sola como 2.4.1 si hace falta (spec, Contexto).

---

## Phase 4: User Story 2 - Leer de un vistazo cuánto le queda a cada material (Priority: P2)

**Goal**: alertas de caducidad y próximos vencimientos con nombre, fecha legible y tiempo restante, sin
lote; al tocarlas se abre el detalle del insumo y al cerrarlo se vuelve (FR-006 a FR-010).

**Independent Test**: QS §3.

### Tests for User Story 2

- [X] T018 [P] [US2] Escribir `tests/integration/alertas-detalle.test.tsx` (caducidad): con lotes a
  12 y 75 días, hoy y −5 días (reloj fijo), `AlertasView` muestra "vence en 12 días", "vence en 2
  meses", "vence hoy" y "caducado hace 5 días" con su fecha legible; ningún renglón de "Próximos a
  caducar" contiene "lote", "nivel" ni `AAAA-MM-DD`; el badge de caducado sigue en `danger`; tocar el
  renglón (`getByRole('button', { name: /Ver detalle de Lidocaína/ })`) abre el detalle con los números
  de lote; cerrarlo deja `AlertasView` visible. Caso "Todos" con `lugarFalso.ts`: el detalle muestra
  los lotes del lugar del renglón. "Lotes en revisión" sigue mostrando el número de lote.
- [X] T019 [P] [US2] Actualizar `tests/integration/inicio.test.tsx`: el resumen de alertas y "Próximos
  vencimientos" usan el texto nuevo (reemplazar la aserción `/venció hace 2 días/` por
  `/caducado hace 2 días/`), no muestran "Lote", y tocar un vencimiento abre el detalle y cerrarlo
  vuelve a Inicio.

### Implementation for User Story 2

- [X] T020 [US2] Crear el renglón de alerta reutilizable en
  `src/features/alertas/components/RenglonAlerta.tsx` (UI §4): `<button type="button">` de ancho
  completo, `min-h-12` (≥ 48 px), `aria-label="Ver detalle de {nombre}"`, con ranuras para ícono, título,
  segunda línea, chip y badge, y `onClick`. Mantener el aspecto de tarjeta actual (`Card`) en Alertas y
  el de lista con divisores en Inicio (prop de variante o `className`).
- [X] T021 [US2] *(Hecho con un cambio: `InsumoDetalle` es una `Card` en línea, no un overlay; `DetalleDesdeAlerta` lo envuelve en `BottomSheet` "Detalle del insumo" y le pasa `enHoja` para ocultar su X — research.md R5.)* Crear el hook o componente que abre el detalle en
  `src/features/alertas/components/DetalleDesdeAlerta.tsx` (R5, data-model `DetalleAbierto`): recibe
  `{ insumoId, lugarId }` y las `vistas` de `useVistasDeLugar()`, busca la vista del lugar (o la única
  vista), y renderiza `InsumoDetalle` con `lotes` del insumo y `movimientos` de esa vista; si el insumo
  ya no existe, llama `onClose`.
- [X] T022 [US2] En `src/features/alertas/components/AlertasView.tsx`, sección "Próximos a caducar":
  usar `RenglonAlerta` con título = nombre y segunda línea
  `Vence {formatearFechaCaducidad} · {textoTiempoCaducidad}` (o `Venció …` si `nivel === 'caducado'`),
  sin lote ni "nivel N días"; badge y chip sin cambios; estado `detalleAbierto` + `DetalleDesdeAlerta`.
  "Lotes en revisión" no cambia.
- [X] T023 [US2] En `src/features/inicio/components/InicioView.tsx`: `FilaAlerta` de caducidad y la
  lista "Próximos vencimientos" usan `RenglonAlerta` con el mismo texto (sin "Lote …"), conservando el
  punto de color de vencimientos; eliminar `textoDias` local; estado `detalleAbierto` +
  `DetalleDesdeAlerta`. T018 y T019 en verde.

**Checkpoint**: US2 completa e independiente de US1.

---

## Phase 5: User Story 3 - Distinguir "Sin stock" de "Bajo mínimo" (Priority: P2)

**Goal**: con stock ≤ 0 la alerta dice "Sin stock"; si queda algo, "Bajo mínimo", en Alertas e Inicio
(FR-011, FR-012).

**Independent Test**: QS §4.

### Tests for User Story 3

- [X] T024 [P] [US3] Agregar a `tests/integration/alertas-detalle.test.tsx` un `describe` de stock bajo:
  insumo en 0 → badge "Sin stock" (`danger`), insumo en 2 con mínimo 5 → "Bajo mínimo"; en "Todos" con
  el mismo insumo en 0 en un lugar y 2 en otro, cada renglón con su etiqueta y su chip; tocar el renglón
  abre el detalle (R5).
- [X] T025 [P] [US3] Agregar a `tests/integration/inicio.test.tsx` que un insumo con stock 0 en el
  resumen de alertas muestra "Sin stock" y ninguno "Stock crítico".

### Implementation for User Story 3

- [X] T026 [US3] *(Hecho junto con T022: mismo archivo.)* En `src/features/alertas/components/AlertasView.tsx`, sección "Stock bajo": badge,
  variante e ícono desde `etiquetaStockBajo(stockActual)`; renglón con `RenglonAlerta` (abre el
  detalle, R5). Si se trabaja antes que US2, crear `RenglonAlerta` y `DetalleDesdeAlerta` aquí (T020,
  T021).
- [X] T027 [US3] En `src/features/inicio/components/InicioView.tsx`, `FilaAlerta` de stock bajo usa
  `etiquetaStockBajo` (desaparece "Stock crítico") y `RenglonAlerta`. T024 y T025 en verde.

**Checkpoint**: US3 completa. No tocar la etiqueta "Stock crítico" de Inventario
(`src/features/insumos/lib/estadoVisual.ts` y sus pruebas), que queda fuera de alcance.

---

## Phase 6: User Story 4 - Decidir si el material caduca antes de poner la fecha (Priority: P3)

**Goal**: el interruptor "¿Caduca?" queda dentro de la tarjeta del lote, justo antes de la fecha
(FR-013, FR-014).

**Independent Test**: QS §5.

### Tests for User Story 4

- [X] T028 [US4] Actualizar `tests/integration/alta-material.test.tsx`: reemplazar `/Sujeto a
  caducidad/` por `/¿Caduca\?/` en los `getByRole('switch', …)` (líneas ~388, ~395 y ~795) y agregar
  una prueba de orden: en el DOM, el campo "Proveedor" precede al switch y el switch precede al campo
  "Fecha de vencimiento" (`compareDocumentPosition`); con el switch apagado la fecha no está y el
  guardado da "No caduca" (las pruebas existentes de esto deben seguir pasando).

### Implementation for User Story 4

- [X] T029 [US4] *(Hecho con un ajuste: sin stock inicial no hay tarjeta del lote ni fecha, y el interruptor queda solo debajo del código de barras, porque "¿Caduca?" es un dato del insumo; con prueba.)* En `src/features/insumos/components/AltaMaterialView.tsx` (R7, UI §5): mover el bloque
  del `role="switch"` dentro de la tarjeta del lote, entre "Proveedor" y el bloque condicional de
  "Fecha de vencimiento"; cambiar el texto "Sujeto a caducidad" por "¿Caduca?"; sin cambios en
  `toggleCaduca`, `ORDEN_CAMPOS` ni validaciones. T028 en verde.

**Checkpoint**: las 4 historias completas.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T030 *(Hecho 2026-10-22: Chromium con la rueda real — ver research.md R8 — y prueba manual en un navegador de escritorio: la rueda no cambia los campos numéricos.)* Recorrer QS §2 en Chrome (o Edge) y Firefox de escritorio reales: rueda y trackpad sobre cada
  campo de la lista, desplazamiento de la página, flechas ↑/↓ con el foco; en móvil (o emulación),
  teclado numérico y + / −. Anotar el resultado y los navegadores con versión en research.md R8.
- [X] T031 *(Hecho: Alertas, detalle, Inicio y alta en 390 y 1280 px con un lugar; renglones con `touch-target`; la segunda línea se parte bien en 390 px. Ajuste que salió de las capturas: la insignia del nivel decía "1 días" → "1 día", con prueba.)* Verificación visual con `run-indentory` (QS §6): Alertas e Inicio en 390 y 1280 px, con un
  lugar y en "Todos", y el alta de material en móvil. Confirmar objetivos ≥ 48 px en los renglones
  (Constitución III) y que el texto de la segunda línea no se corta mal en 390 px.
- [X] T032 *(Hecho, automatizado: §3 en `alertas-detalle.test.tsx` e `inicio.test.tsx`, §4 en los mismos, §5 en `alta-material.test.tsx`; todo sale de los stores locales, sin red.)* Recorrer QS §3–§5 (automatizado o en el navegador) y confirmar que funciona en modo avión.
- [X] T033 [P] Confirmar que `tests/unit/lecturas-movimientos.test.ts` sigue pasando sin agregar
  permitidos (`DetalleDesdeAlerta` usa los movimientos de la vista, no `db.movimientos`).
- [X] T034 *(Hecho: lint sin avisos, build, 795 pruebas en 108 archivos; línea base 750 en 103.)* Correr `npm run lint && npm run build && npm test`, todo verde, con más pruebas que en T001.
- [X] T035 [P] *(Hecho en `../1stDocs`, sin commit: roadmap con estado y decisiones, backlog con "Detalles" y "bug" tachados y la entrada de la spec.)* En `../1stDocs`, actualizar `005-roadmap/002-DentdeLion.md` (018 hecha, con las
  decisiones de Clarifications) y `002-backlog/002-DentdeLion.md` (sección "Detalles" y "Corregir
  'bug'" hechas).
- [X] T036 *(Hecho: PR #14.)* Descripción del PR a `develop`: los 4 pedidos, la decisión de bloquear solo la rueda (R1,
  Clarifications), el umbral de 60 días, el detalle desde la alerta (incluido stock bajo, R5), resultado
  de T030 y capturas de T031.

---

## Dependencies & Execution Order

- **Setup** (T001) → todo lo demás.
- **Foundational** (T002–T005): T002 → T004; T003 → T005. Solo bloquea US2 y US3.
- **US1** (T006–T017): independiente de Foundational. T006 → T008 → T009–T015 (en paralelo entre sí)
  → T016 → T017. T007 en cualquier momento antes de T016. MVP.
- **US2** (T018–T023): depende de T004. T020 y T021 antes de T022 y T023.
- **US3** (T024–T027): depende de T005 y de T020/T021 (o los crea, ver T026). T026 y T023 tocan
  `InicioView.tsx`/`AlertasView.tsx`: hacerlas en serie si se trabaja en paralelo.
- **US4** (T028–T029): independiente de todo salvo T001.
- **Polish** (T030–T036): al final; T030 puede adelantarse apenas termine US1.

```text
Setup ─┬─► US1 (MVP) ───────────────────────┐
       ├─► Foundational ─┬─► US2 ─► US3 ────┼─► Polish
       │                 └──────────────────┤
       └─► US4 ─────────────────────────────┘
```

## Parallel Examples

- **Inicio**: T002, T003, T006, T007 y T028 en paralelo (archivos de prueba distintos).
- **US1**: después de T009, T010–T015 en paralelo (un archivo cada una).
- **US2**: T018 y T019 en paralelo; T020 y T021 en paralelo; luego T022 → T023.
- **US3**: T024 y T025 en paralelo; luego T026 → T027.
- **Entre historias**: US1 y US4 en paralelo con Foundational → US2.

## Implementation Strategy

1. **MVP = Setup + US1**: corrige el único pedido que deja datos incorrectos (la rueda). Si la clienta
   lo necesita antes, publicar como 2.4.1 (spec, Contexto).
2. **+ Foundational + US2**: alertas de caducidad legibles y detalle a un toque.
3. **+ US3**: "Sin stock".
4. **+ US4**: interruptor antes de la fecha.
5. **Polish**: prueba en navegadores reales, capturas, 1stDocs y PR.
