---

description: "Task list for 017-reportes-y-kpis"
---

# Tasks: Reportes y KPIs

**Input**: Design documents from `/specs/017-reportes-y-kpis/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ, las que define plan.md (Testing) con el patrón del proyecto: Vitest + RTL,
`tests/helpers/memoryDb.ts`, `clienteFalso.ts`, `tablasMemoria.ts`, `authFalso.ts`,
`lugarFalso.ts`. Verificación visual con `run-indentory`.

**Organization**: por historia de spec.md. `R#` = research.md, "lib" = `contracts/reportes-lib.md`,
"UI" = `contracts/ui-contracts.md`, "DM" = data-model.md. Sin cambios de esquema (no hay migración
ni `test:rls` nuevos).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US4 de spec.md

---

## Phase 1: Setup

- [X] T001 Crear las carpetas `src/features/reportes/{lib,components/charts}` y
  `tests/unit/reportes/`, y agregar `ChartColumn` y `Wallet` a las exportaciones de
  `src/components/icons/index.tsx` (mismo patrón `deLucide` que los otros íconos).

---

## Phase 2: Foundational (pulls paginados, períodos, gasto valorizado, base de UI)

**Purpose**: historia completa en el dispositivo y cálculos base listos; ninguna pantalla nueva
todavía. Las pruebas existentes siguen en verde.

### Sync: pulls paginados (R9) — puede publicarse solo como arreglo

- [X] T002 Extender `tests/helpers/clienteFalso.ts`: `select('*')` devuelve un objeto awaitable que
  además acepta `.order(columna)`, `.gt(columna, valor)` y `.limit(n)`; agregar `estado.maxRows` (por defecto
  1000) que trunca cualquier `select` (como PostgREST) y `estado.errorEnPagina: Record<string,
  number>` para simular el fallo de una página. Las pruebas existentes no deben cambiar.
- [X] T003 Escribir `tests/unit/sync-paginacion.test.ts` (debe fallar antes de T004–T005): con 2.500
  movimientos remotos, tras `sincronizar` hay 2.500 en Dexie; con exactamente 2.000 también (página
  final vacía); con error en la página 2, la tabla no se aplica parcialmente y el ciclo registra la
  etapa con error; lo mismo para `lotes` y `tratamientos_realizados`.
- [X] T004 Implementar `seleccionarTodo(client, tabla, tamañoPagina = 1000)` en
  `src/lib/sync/paginar.ts` según lib § Sync: paginación **por cursor**
  (`order('id')`, `limit`, `gt('id', últimoId)` desde la segunda página), corta con página
  incompleta, `{ data: null, error }` ante cualquier error.
- [X] T005 Usar `seleccionarTodo` en `pullMovimientos`, `pullLotes`, `pullTratamientosRealizados` y
  los pulls de `cambios_lote`, `cambios_insumo` y `cambios_tratamiento` de `src/lib/sync/index.ts`,
  conservando el mapeo y el registro en `ciclo`; T003 y todas las `tests/unit/sync-*.test.ts` en
  verde.

### Cálculo base (lib, puro)

- [X] T006 [P] Escribir `tests/unit/reportes/periodos.test.ts`: `inicioVentana`, `rangoPeriodo` para
  los 5 tipos (tabla R4: "Este mes" contra mes anterior **completo**, "Últimos 3 meses", "Este año"
  con `anterior = null` desde febrero y no nulo en enero, mes elegido contra el que lo precede, cruce
  de año dic→ene), `mesesSeleccionables` (12 meses, más reciente primero), `enRango` con borde
  `[desde, hasta)`, todo en hora local con `ahora` inyectado.
- [X] T007 Implementar `src/features/reportes/lib/periodos.ts` (tipos `Periodo`, `RangoPeriodo` de
  DM; etiquetas "Este mes", "Mes anterior", "Últimos 3 meses", "Este año", "Marzo 2026"), hasta que
  T006 pase.
- [X] T008 [P] Escribir `tests/unit/reportes/gasto.test.ts`: `indiceCostos` usa `costoLote` con
  precio corregido (`cambiosLote`) y factores de unidad convertida; `consumosValorizados` valoriza
  `consumo` × costo del lote, netea el `ajuste` con `movimientoOrigenId` **en la fecha y el lugar
  del consumo** aunque el ajuste sea de otro mes, ignora ingresos y traslados, deja `monto = null`
  en lotes sin precio, filtra por lugar o `'todos'`, y da el mismo resultado con la entrada
  desordenada.
- [X] T009 Implementar `src/features/reportes/lib/gasto.ts` (`indiceCostos`,
  `consumosValorizados`, tipo `ConsumoValorizado`) reutilizando `costoLote` y `precioVigenteLote`
  (`src/features/insumos/lib/precio.ts`) y `factoresDeUnidad` (`stock.ts`), hasta que T008 pase.

### Base de UI

- [X] T010 [P] En `src/components/ui/Card.tsx`, `KpiCard` acepta `onClick` opcional (sin él se
  renderiza como `<div>` no interactivo), `valor` como `ReactNode`, y props opcionales
  `variacion?: { texto: string; tono: 'success' | 'danger' | 'muted'; direccion: 'sube' | 'baja' |
  null }` y `nota?: ReactNode` bajo el valor (UI §2). Las tarjetas actuales de Inicio no cambian;
  sus pruebas siguen en verde.
- [X] T011 [P] Crear la base de gráficos en `src/features/reportes/components/charts/`:
  `colores.ts` (paleta DS §35 en orden, gris para "Otras", rojo para negativos, como variables CSS
  del tema claro/oscuro), `TablaAlternativa.tsx` (tabla `sr-only` + botón "Ver como tabla" ≥ 48 px
  que la muestra) y `TarjetaGrafico.tsx` (`<figure>` con `<figcaption>`, estado "Sin datos en este
  período"). Seguir la skill `dataviz` para marcas y contraste.

**Checkpoint**: sync completo verificado; `periodos` y `gasto` probados; `KpiCard` extendida.

---

## Phase 3: User Story 1 - Ver producción, gasto y ganancia del período (Priority: P1) 🎯 MVP

**Goal**: sección Reportes con las 3 tarjetas, variación y selector de período, en el lugar
activo.

**Independent Test**: quickstart §2 — 3 tratamientos este mes ($45.000, $45.000, $30.000) dan
Producción $120.000; gasto y ganancia correctos; el consumo deshecho no suma; cambiar de período
recalcula.

### Tests for User Story 1

- [X] T012 [P] [US1] Escribir `tests/unit/reportes/kpis.test.ts` (parte KPIs): `variacion` (R5:
  porcentaje con signo, `nuevo` con base 0, `sin-datos` con `anterior = null`, ambos 0 → `null`);
  `resumenReportes` con producción = Σ precio de vigentes, ganancia = Σ `gananciaEstimada`,
  anulados excluidos, sin precio contados aparte (`incompleto.tratamientosSinPrecio`), con precio
  y sin % (suman a producción, `tratamientosSinPorcentaje`), consumos sin precio en
  `gasto.incompleto.materialesSinPrecio` (insumos distintos), gasto = Σ `consumosValorizados` del rango, `mejora` del
  gasto invertida, `vacio` sin datos, y mes elegido contra el anterior.
- [X] T013 [P] [US1] Escribir `tests/integration/reportes.test.tsx` (parte US1) con
  `memoryDb`/`authFalso`/`lugarFalso`: escenario de quickstart §2; textos de comparación de FR-005
  ("vs. mes anterior completo" en "Este mes"); selector de período (Mes anterior, Este año con "Sin datos del período anterior", "Elegir mes…" con 12 meses); "N
  tratamientos sin precio"; gasto "desde $X · N materiales sin precio"; ganancia negativa con "−" y
  color de error; estado vacío con accesos a Tratamientos e Inventario; aviso "Puede faltar
  información…" con `syncStore.ultimaExitosaEn = null`; ningún texto "utilidad" salvo "No es
  utilidad contable".
- [X] T014 [P] [US1] Escribir `tests/integration/navegacion-reportes.test.tsx`: Reportes en la
  sidebar (tablet/desktop) entre Compras y Alertas, ausente de la barra inferior móvil, presente en
  "Más" y que abre la vista; actualizar los conteos o el orden de ítems en las pruebas de
  navegación existentes si cambian.

### Implementation for User Story 1

- [X] T015 [US1] Implementar `variacion` y `resumenReportes` (KPIs y `vacio`; los campos de
  gráficos se agregan en US2/US3 con valores vacíos por ahora) en
  `src/features/reportes/lib/kpis.ts`, filtrando el lugar activo, hasta que T012 pase.
- [X] T016 [US1] Implementar `useReportes(periodo)` en `src/features/reportes/useReportes.ts`: lee
  `inventoryStore` (insumos + dados de baja, lotes, `cambiosLote`, `cambiosInsumo`, movimientos
  normalizados), `tratamientosStore.realizados` y `lugarStore.lugarActivoId`; memoriza
  `indiceCostos` y `consumosValorizados` por identidad de los arrays y `resumenReportes` por
  `(periodo, filtro)`; `ahora` se toma una vez por render. No lee `db.movimientos`.
- [X] T017 [P] [US1] Crear `src/features/reportes/components/SelectorPeriodo.tsx`: botón "Este mes
  ▾" que abre `BottomSheet` en móvil y menú en tablet/desktop (`useDisposicion`), con los 4
  períodos fijos y "Elegir mes…" con `mesesSeleccionables` (UI §2).
- [X] T018 [P] [US1] Crear `src/features/reportes/components/TarjetaKpiReporte.tsx` sobre `KpiCard`:
  `formatearCLP` con la utilidad `text-num` (FR-019, DS §5), "desde $X" si incompleto, notas "N tratamientos sin precio" / "N materiales sin
  precio" / "N sin % profesional", texto de variación ("↑ 8 % vs. mes anterior completo", "vs.
  período anterior", "Nuevo", "Sin datos del período anterior") con tono por `mejora`, signo "−" y
  `text-danger` en negativos; la de ganancia usa `ETIQUETA_GANANCIA` y `NOTA_GANANCIA`
  (`src/features/tratamientos/lib/montos.ts`); la de gasto incluye una ayuda que explica que valoriza
  al costo del lote (riesgo del plan).
- [X] T019 [P] [US1] Crear `src/features/reportes/components/EstadoVacioReportes.tsx` con el texto
  de FR-017 y botones a Tratamientos e Inventario (≥ 48 px).
- [X] T020 [US1] Crear `src/features/reportes/components/ReportesView.tsx`: título, nombre del lugar
  activo, `SelectorPeriodo`, aviso R10 (`syncStore.ultimaExitosaEn === null` o `fase ===
  'sincronizando'` al montar), las 3 tarjetas en orden Producción, Gasto, Ganancia (1 columna en
  móvil, 3 en desktop; padding 32 px y gap 24 px en desktop) y el estado vacío; período elegido en
  estado local (por defecto "Este mes").
- [X] T021 [US1] Agregar la vista `'reportes'` en `src/app/navegacion.ts` (`ChartColumn`,
  `soloLateral: true`, entre Compras y Alertas), su render en `src/app/App.tsx` y el acceso
  "Reportes" debajo de Compras en `src/features/ajustes/components/AjustesView.tsx` (UI §1), hasta
  que T013 y T014 pasen.

**Checkpoint**: Reportes muestra los 3 KPIs con variación y períodos en el lugar activo — MVP.

---

## Phase 4: User Story 2 - Filtrar por lugar de trabajo y ver "Todos" (Priority: P1)

**Goal**: los KPIs respetan el selector de lugar; en "Todos" suman los lugares y aparece Ganancia
por lugar.

**Independent Test**: quickstart §3 — con datos en dos lugares, "Todos" = suma de ambos y el
gráfico tiene 2 barras ordenadas; en un lugar, no hay gráfico.

### Tests for User Story 2

- [X] T022 [P] [US2] Agregar a `tests/unit/reportes/kpis.test.ts`: invariante Σ por lugar =
  `'todos'` para producción, gasto y ganancia (SC-003, lib invariante 1); `gananciaPorLugar` de
  mayor a menor, con negativos, `null` en un lugar o en "Todos" con un solo lugar con datos **en el
  período** (aunque el tenant tenga más lugares), e incluye un lugar desactivado con datos del
  período (FR-012).
- [X] T023 [P] [US2] Agregar a `tests/integration/reportes.test.tsx`: cambiar el lugar en el
  selector recalcula; "Todos" muestra la suma y el gráfico Ganancia por lugar con 2 barras y su
  tabla alternativa; en un lugar el gráfico no aparece.

### Implementation for User Story 2

- [X] T024 [US2] Completar el filtro `'todos'` y `gananciaPorLugar` en
  `src/features/reportes/lib/kpis.ts` (nombres desde `lugares`, incluidos desactivados), hasta que
  T022 pase.
- [X] T025 [P] [US2] Crear `src/features/reportes/components/charts/BarChart.tsx`: barras
  verticales en SVG con línea de cero, negativas hacia abajo en rojo; la **etiqueta de cada lugar es
  un botón ≥ 48 × 48 px** que resalta su barra y muestra el monto exacto (tocar la barra es solo un
  complemento; hover solo en desktop), foco por teclado, `TarjetaGrafico` y `TablaAlternativa` (UI §3).
- [X] T026 [US2] En `ReportesView.tsx`, usar "Todos" del selector de lugar (el título dice "Todos
  los lugares") y mostrar `BarChart` con `gananciaPorLugar` cuando no sea `null`, hasta que T023
  pase.

**Checkpoint**: US1 + US2 funcionan por lugar y en "Todos".

---

## Phase 5: User Story 3 - Ver en qué se gastan los materiales (Priority: P2)

**Goal**: donut por categoría, línea de gastos mensuales y barras de materiales más utilizados.

**Independent Test**: con consumos valorizados de varias categorías en los últimos meses, se ven
los 3 gráficos con montos correctos y su alternativa en tabla.

### Tests for User Story 3

- [X] T027 [P] [US3] Agregar a `tests/unit/reportes/kpis.test.ts`: `porCategoria` (agrupa por
  `claveCategoria`, "Sin categoría", ≤ 4 (3 mayores + "Otras", R7), porcentajes, Σ = `gasto.valor`);
  `gastosMensuales` (6 puntos o 12 en "Este año", recortado a la ventana, reversión imputada al mes
  del consumo, meses sin consumo en 0); `masUtilizados` (top 10 por monto, cantidad neta en la
  unidad actual tras una conversión, `dadoDeBaja`), y que los lotes sin precio no entran pero se
  cuentan.
- [X] T028 [P] [US3] Agregar a `tests/integration/reportes.test.tsx`: los 3 gráficos se muestran con
  sus títulos; tocar la entrada de la leyenda o la etiqueta de un elemento
  resalta el elemento y muestra el monto exacto, y cada uno de esos objetivos mide ≥ 48 × 48 px
  (Constitución III); "Ver como tabla" muestra las
  filas; un gráfico sin datos dice "Sin datos en este período"; aviso "Incluye N materiales sin
  precio, no valorizados".

### Implementation for User Story 3

- [X] T029 [US3] Implementar `porCategoria`, `gastosMensuales` y `masUtilizados` en
  `src/features/reportes/lib/kpis.ts` desde `consumosValorizados` (un solo recorrido, R12), hasta
  que T027 pase.
- [X] T030 [P] [US3] Crear `src/features/reportes/components/charts/DonutChart.tsx`: sectores SVG
  (arcos) con la paleta en orden, total al centro; la **leyenda en filas-botón ≥ 48 px** con monto y % resalta su sector y muestra
  el monto exacto; foco por teclado (UI §3).
- [X] T031 [P] [US3] Crear `src/features/reportes/components/charts/LineChart.tsx`: línea con puntos
  marcados, eje X con meses abreviados ("may"), eje Y en pesos compactos ("$120 mil"), y una **fila
  de meses bajo el eje como botones ≥ 48 px** que resaltan el punto y muestran el monto exacto.
- [X] T032 [P] [US3] Crear `src/features/reportes/components/charts/HorizontalBarChart.tsx`: hasta
  10 filas; **cada fila (etiqueta "nombre · cantidad + unidad", barra y monto) es un botón ≥ 48 px**
  que la resalta; chip "Dado de baja".
- [X] T033 [US3] Integrar los 3 gráficos en `ReportesView.tsx` debajo de los KPIs (1 columna en
  móvil, 2 en desktop; orden DS §34: categoría, mensuales, materiales, lugar) y el aviso de
  materiales sin precio, hasta que T028 pase.

**Checkpoint**: Reportes completo según DS §34.

---

## Phase 6: User Story 4 - Valor de inventario en Inicio (Priority: P3)

**Goal**: primera tarjeta de Inicio con el valor del inventario y su variación frente al cierre
del mes anterior.

**Independent Test**: quickstart §6 — con lotes con precio, Inicio muestra "Valor de inventario
$X · ↑/↓ N % vs. mes anterior" y al tocarla abre Reportes.

### Tests for User Story 4

- [X] T034 [P] [US4] Escribir `tests/unit/reportes/valorInventario.test.ts`: Σ stock × costo de lotes
  no caducados con stock > 0; excluye caducados a la fecha; `lotesSinPrecio`; reconstrucción al fin
  del mes anterior (ignora movimientos posteriores, considera la caducidad a esa fecha); traslado
  baja en el origen y sube en el destino sin cambiar `'todos'`; unidad convertida.
- [X] T035 [P] [US4] Escribir `tests/integration/inicio-valor-inventario.test.tsx`: la tarjeta es la
  primera, muestra monto y variación en tono neutro, "desde $X · N lotes sin precio", "Sin precios"
  sin lotes con precio, `aria-label` de UI §4, y al tocarla navega a Reportes; en "Todos" suma los
  lugares.

### Implementation for User Story 4

- [X] T036 [US4] Implementar `valorInventario` y `valorInventarioConVariacion` en
  `src/features/reportes/lib/valorInventario.ts` (reutiliza `indiceCostos` y la suma por tipo de
  `computeStockLote`), hasta que T034 pase.
- [X] T037 [US4] Agregar `useValorInventario()` a `src/features/reportes/useReportes.ts`
  (memorizado como `useReportes`).
- [X] T038 [US4] En `src/features/inicio/components/InicioView.tsx`, agregar la tarjeta Valor de
  inventario (`Wallet`) primera, `col-span-2` en móvil y grid `desk:grid-cols-5`, con el monto en `text-num`, la variación en
  `text-muted` y navegación a `'reportes'` (UI §4); ajustar las pruebas de Inicio existentes que
  cuenten tarjetas, hasta que T035 pase.

**Checkpoint**: las 4 historias funcionan de forma independiente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] Escribir `tests/unit/reportes/rendimiento.test.ts`: datos sintéticos de 20.000
  movimientos, 3.000 tratamientos, 300 lotes y 3 lugares; `consumosValorizados` + `resumenReportes`
  + `valorInventarioConVariacion` en < 300 ms (R12, SC-004).
- [X] T040 [P] Agregar a `tests/unit/contraste.test.ts` los pares de la paleta de gráficos (textos
  de leyenda/ejes sobre superficie y etiquetas sobre barras) en tema claro y oscuro, con WCAG AA para
  texto y 3:1 para marcas.
- [X] T041 Confirmar que `tests/unit/lecturas-movimientos.test.ts` pasa sin agregar
  `src/features/reportes/` a los permitidos.
- [X] T042 *(Hecho 2026-10-22: ver R9.)* Crear `scripts/seed-volumen.mjs` (Supabase local, tenant de prueba: > 2.500 movimientos y
  algunos cientos de tratamientos realizados repartidos en 13 meses) y hacer el ensayo de quickstart
  §5 en un perfil limpio de Chromium: conteo de IndexedDB = Postgres; anotar duración y tamaño del
  ciclo completo en research.md R9.
- [X] T043 *(Hecho 2026-10-22: capturas en 375, 768 y 1440 px de Inicio y Reportes, con el lugar y en "Todos", y el selector abierto; la app no tiene tema oscuro, así que solo claro. SC-004: 330–415 ms con CPU 4× más lenta, ver R12. Ajustes que salieron de las capturas: tarjeta de Inicio a 2 columnas en móvil, montos alineados en las tarjetas informativas y cierre del menú de período al tocar fuera o con Escape.)* Verificación visual con `run-indentory` en 375, 768 y 1440 px, tema claro y oscuro:
  Reportes (KPIs, 4 gráficos, selector, vacío, aviso) e Inicio con la tarjeta nueva; comparar con DS
  §20 y §34–35. Con la semilla de T042, medir en Chromium con CPU 4× más lenta (DevTools) el tiempo
  desde abrir Reportes hasta ver los KPIs y los 4 gráficos: debe ser < 2 s (SC-004); anotarlo en
  research.md R12. Agregar al driver un comando de semilla de reportes si hace falta.
- [X] T044 *(Hecho 2026-10-22, automatizado: §2 y §4 en `tests/integration/reportes.test.tsx` (base, sin precio, vacío, aviso de sync, período fuera de la ventana) y `tests/unit/reportes/kpis.test.ts` (anulado, deshacer); §3 en `reportes.test.tsx` "Todos"; §5 en el ensayo de T042; §6 en `inicio-valor-inventario.test.tsx` y las capturas de T043. Modo avión: todo se calcula desde los stores locales, sin red.)* Recorrer los escenarios de `quickstart.md` §2–§6 (automatizados o en el navegador).
- [X] T045 *(Hecho 2026-10-22: lint sin avisos, build, 750 pruebas en verde en dos corridas seguidas y `test:rls` "Todos los controles OK". La prueba de rendimiento fallaba a veces con la suite en paralelo (337 ms); se optimizó `resumenReportes` (fechas parseadas una vez, serie mensual en una pasada) y se mide el mejor de 3.)* Correr `npm run lint && npm run build && npm test && npm run test:rls`, todo verde.
- [X] T046 [P] *(Hecho: roadmap y backlog de 1stDocs en `1fa1789`, con las decisiones de la spec y los pendientes del release.)* En `../1stDocs`, actualizar roadmap (017 en curso/hecha) y backlog, incluido el
  hallazgo de los pulls truncados en 1.000 filas (R9) y la decisión de 13 meses (Clarifications Q5).
- [X] T047 *(Hecho: PR #13.)* Descripción del PR: qué calcula cada KPI (Clarifications Q1–Q2), pulls paginados (R9) con
  las mediciones de T042, decisión de gráficos sin dependencias (R7), capturas de T043.

---

## Dependencies & Execution Order

- **Setup** (T001) → **Foundational** (T002–T011). T002 → T003 → T004 → T005 (sync, en serie).
  T006 → T007; T008 → T009; T010 y T011 independientes.
- **US1** (T012–T021) depende de T007, T009 y T010. MVP.
- **US2** (T022–T026) depende de US1 (`kpis.ts`, `ReportesView`) y de T011.
- **US3** (T027–T033) depende de US1 y de T011; independiente de US2 salvo el orden de gráficos en
  `ReportesView` (T033 después de T026 si ambas avanzan juntas).
- **US4** (T034–T038) depende solo de Foundational (T009, T010); puede hacerse en paralelo con
  US1–US3. T038 necesita la vista `'reportes'` de T021 para navegar.
- **Polish** al final; T042 puede adelantarse apenas termine T005.

```text
Setup ─► Foundational ─┬─► US1 ─┬─► US2 ──┐
  (sync T002–T005) ─┐  │        └─► US3 ──┼─► Polish
                    │  └─► US4 ───────────┘
                    └─► (opcional) release del arreglo de sync
```

## Parallel Examples

- **Foundational**: la cadena de sync (T002–T005) en paralelo con T006/T008 (pruebas de lib), T010 y
  T011.
- **US1**: T012, T013 y T014 en paralelo; luego T015 → T016; T017, T018 y T019 en paralelo; luego
  T020 → T021.
- **US2**: T022, T023 y T025 en paralelo; luego T024 → T026.
- **US3**: T027 y T028 en paralelo; T030, T031 y T032 en paralelo con T029; luego T033.
- **US4**: T034 y T035 en paralelo; luego T036 → T037 → T038.
- **Polish**: T039, T040 y T046 en paralelo; T043 después de T042 (usa su semilla).

## Implementation Strategy

1. **Arreglo de sync primero (T002–T005)**: corrige un truncamiento que ya afecta al inventario
   pasadas las 1.000 filas. Si producción se acerca a ese volumen, publicarlo como release propio
   antes del resto.
2. **MVP = Setup + Foundational + US1**: Reportes con Producción, Gasto y Ganancia estimada, con
   variación y períodos, en el lugar activo.
3. **+ US2**: "Todos" y Ganancia por lugar (multi-lugar, DS §28).
4. **+ US3**: los 3 gráficos de gasto.
5. **+ US4**: Valor de inventario en Inicio.
6. **Polish**: rendimiento, contraste, ensayo de volumen, capturas, documentación y PR.
