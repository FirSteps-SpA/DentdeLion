---

description: "Task list for 015-unidades-y-costo-unitario"
---

# Tasks: Unidades y Costo Unitario

**Input**: Design documents from `/specs/015-unidades-y-costo-unitario/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ, las que define research.md R11:
- unitarias de catálogo, factores de unidad, ingreso, precio, costo, sugeridas, equivalentes,
  Dexie v11, sync de `cambiosLote` y lecturas de `db.movimientos`;
- integración de presentación, ingreso con precio, tabla, corrección de precio, compras y
  conversión;
- `test:rls` con los casos del esquema §8.

Se usa el patrón del proyecto: Vitest + RTL, `tests/helpers/memoryDb.ts`, `clienteFalso.ts`,
`tablasMemoria.ts`, `authFalso.ts` y `lugarFalso.ts`. La verificación visual se hace con el skill
`run-indentory`.

**Organization**: por historia de usuario de spec.md. `R#` remite a research.md, "esquema" a
`contracts/supabase-schema.md`, "UI" a `contracts/ui-contracts.md` y "DM" a data-model.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

- [ ] T001 Crear `supabase/migrations/20261021000000_unidades_y_costo.sql` con `begin;` / `commit;`
  y un comentario por bloque, en este orden (esquema §1–§6): 1 catálogo y `pieza`, 2 insumos,
  3 `cambios_insumo`, 4 lotes, 5 movimientos, 6 `cambios_lote`, 7 checks de unidades válidas
  (después de todos los backfill).
- [ ] T002 [P] Crear `src/lib/unidades.ts` (R1, DM "Unidad"):
  - `UNIDADES`: arreglo `as const` de `{ clave, singular, plural, decimales }` con las 15 claves del
    DS §25 en ese orden (`caja` "Caja"/"cajas", `frasco`, `botella`, `jeringa`, `cartucho`,
    `paquete`, `kit`, `unidad` "Unidad"/"unidades", `rollo`, `mL`, `L`, `g`, `mg`, `m`, `cm`; las
    métricas con singular = plural y `decimales: true`);
  - tipo `Unidad`, `esUnidad(valor)`, `normalizarUnidad(valor)` (`'pieza'` → `'unidad'`, el resto
    igual), `etiquetaUnidad(clave, cantidad?)` (singular si `cantidad === 1`, si no plural; sin
    cantidad, singular con mayúscula);
  - `formatearCantidad(n, unidad)` con `Intl.NumberFormat('es-CL')` ("1.250 mL", "2 cajas").
- [ ] T003 [P] Test `tests/unit/unidades.test.ts`: 15 claves en el orden del DS, decimales solo en
  las 6 métricas, `normalizarUnidad('pieza') === 'unidad'`, plurales y formato es-CL.

---

## Phase 2: Foundational (esquema, Dexie v11, sync, unidad en movimientos y normalización de stock)

**Purpose**: el modelo nuevo con contenido 1 y sin precios. Al terminar esta fase la app hace
exactamente lo mismo que la 2.3.0 (SC-001), salvo que "Pieza" se ve como "Unidad".

**⚠️ CRITICAL**: completar antes de las historias. Todas las pruebas existentes deben seguir en
verde.

### Servidor (todo en `supabase/migrations/20261021000000_unidades_y_costo.sql`, en serie)

- [ ] T004 Bloque 1 (esquema §1): `update insumos set unidad_medida = 'unidad' where unidad_medida =
  'pieza'`; mismo reemplazo en `cambios_insumo.valor_anterior`/`valor_nuevo` (`'"pieza"'::jsonb` →
  `'"unidad"'::jsonb`) solo con `campo = 'unidadMedida'`.
- [ ] T005 Bloque 2 (esquema §2): agregar `insumos.unidad_compra text` (backfill `= unidad_medida`,
  luego `not null`) y `insumos.contenido numeric not null default 1 check (contenido > 0)`. Crear
  la función `normalizar_unidad()` (`security definer`, `search_path = public`) y su trigger
  `before insert or update on insumos`: `pieza` → `unidad` en `unidad_medida` y `unidad_compra`, y
  `unidad_compra := coalesce(new.unidad_compra, new.unidad_medida)` en insert. Reemplazar
  `proteger_catalogo_insumo()` agregando `new.unidad_compra := old.unidad_compra` y
  `new.contenido := old.contenido` para no administradores (conservar `set search_path = public`
  de `20261018000000_endurecer_funciones.sql`).
- [ ] T006 Bloque 3 (esquema §3): `cambios_insumo.factor numeric check (factor is null or factor >
  0)`, constraint `cambios_insumo_factor_campo` (`factor is null or campo = 'unidadMedida'`), y
  reemplazar `cambios_insumo_campo_check` agregando `'unidadCompra'` y `'contenido'`.
- [ ] T007 Bloque 4 (esquema §4): columnas de lote `cantidad_ingresada`, `unidad_ingresada`,
  `contenido` (default 1), `unidad_consumo` (backfill desde el insumo, luego `not null`) y
  `precio_compra` con sus checks. Crear `proteger_lote()` (`before insert or update on lotes`): en
  insert completa `unidad_consumo` desde el insumo si viene `null`; en update conserva `old` en
  `cantidad_ingresada`, `unidad_ingresada`, `contenido`, `unidad_consumo`, `precio_compra`,
  `insumo_id` y `tenant_id`, y mantiene la regla de `proteger_resolucion_lote` (`revision → activo`
  solo si `es_administrador(auth.uid())`). Eliminar el trigger viejo y su función.
- [ ] T008 Bloque 5 (esquema §5): `movimientos.unidad text`, backfill desde `lotes → insumos`, luego
  `not null`. Función y trigger `completar_unidad_movimiento` (`before insert`). Reemplazar
  `verificar_traslado()` agregando `and s.unidad = e.unidad` a la condición `consistente`
  (conservar todo lo demás de la 014).
- [ ] T009 Bloque 6 (esquema §6): tabla `cambios_lote` con FK compuesta `(lote_id, tenant_id) →
  lotes(id, tenant_id)` (ya existe `lotes_id_tenant_key`), índices, check de `valor_nuevo`
  (`valor_nuevo is null or (jsonb_typeof(valor_nuevo) = 'number' and (valor_nuevo)::numeric >= 0)`),
  RLS y las tres políticas del esquema. Sin update ni delete.
- [ ] T010 Bloque 7: checks de unidad válida (lista de R1) en `insumos.unidad_medida`,
  `insumos.unidad_compra`, `lotes.unidad_ingresada`, `lotes.unidad_consumo` y
  `movimientos.unidad`.
- [ ] T011 Aplicar con `supabase db reset` y comprobar que `npm run test:rls` existente sigue en
  verde.

### Dispositivo

- [ ] T012 En `src/lib/db/index.ts` (DM): ampliar `Insumo` (`unidadCompra`, `contenido`),
  `CampoEditableInsumo` (`'unidadCompra' | 'contenido'`), `CambioInsumo` (`factor: number | null`),
  `Lote` (`cantidadIngresada`, `unidadIngresada`, `contenido`, `unidadConsumo`, `precioCompra`) y
  `Movimiento` (`unidad`), con comentarios "Spec 015 …". Crear `CambioLote` (DM) y la tabla
  `cambiosLote: EntityTable<CambioLote, 'id'>`.
- [ ] T013 En `src/lib/db/index.ts`, `db.version(11)` con `cambiosLote: 'id, loteId, creadoEn,
  sincronizado, tenantId'` y el `upgrade` de DM "Dexie v11" (insumos, cambiosInsumo, lotes,
  movimientos; la unidad de lotes y movimientos sale de un `Map` insumoId → unidad normalizada
  leído al inicio del upgrade; `sincronizado` no se toca).
- [ ] T014 [P] Test `tests/unit/dexie-v11.test.ts` con `fake-indexeddb`, siguiendo
  `tests/unit/dexie-v10.test.ts`: abrir una base v10 con un insumo `pieza`, un cambio
  `unidadMedida`, un lote y movimientos (uno sin sincronizar); tras abrir v11, todo normalizado,
  contenido 1, `unidad` en los movimientos, `sincronizado` intacto, tabla `cambiosLote` vacía.
- [ ] T015 Reemplazar `UNIDADES_MEDIDA`, `UnidadMedida` y `ETIQUETAS_UNIDAD` de
  `src/features/insumos/lib/catalogo.ts` por los de `src/lib/unidades.ts` en todos sus usos (buscar
  con `grep -rn "UNIDADES_MEDIDA\|ETIQUETAS_UNIDAD\|UnidadMedida" src tests`). `permiteDecimales` de
  `src/features/insumos/lib/quantity.ts` pasa a leer `decimales` del catálogo (`L`, `mg`, `m`,
  `cm` ahora admiten decimales; `pieza` normalizada).
- [ ] T016 En `src/features/insumos/lib/proyeccion.ts`, aplicar `normalizarUnidad` a `unidadMedida` y
  `unidadCompra` de la fila proyectada y en `filaParaSubir`; `deshacerCambios` ya cubre los campos
  nuevos (son campos simples).
- [ ] T017 En `src/lib/sync/index.ts`: columnas nuevas en `InsumoRow`/`toInsumoRow`/`fromInsumoRow`
  (`unidad_compra`, `contenido`), `CambioInsumoRow` (`factor`), `LoteRow` (5 columnas) y
  `MovimientoRow` (`unidad`), con `normalizarUnidad` al bajar. Valores ausentes en filas del
  servidor (no debería pasar tras la migración) toman los defaults de DM.
- [ ] T018 [P] Actualizar los tests de sync existentes (`tests/unit/sync-*.test.ts`) y los helpers
  `tests/helpers/tablasMemoria.ts` / `clienteFalso.ts` para las columnas nuevas.

### Factores de unidad y normalización de stock (R3, R4)

- [ ] T019 En `src/features/insumos/lib/stock.ts`, agregar:
  - `factoresDeUnidad(insumo, cambios): Map<Unidad, number>`: el plegado de R3 sobre los cambios
    `unidadMedida` del insumo no rechazados, en orden `(creadoEn, id)` (reutilizar el comparador de
    `proyeccion.ts`, exportándolo); `factor null` vale 1. Para unidades que no aparecen en la cadena
    vigente, intentar resolverlas con los cambios rechazados (inversa del factor); si no, 1 y
    `reportarErrorSync` (o el reporte a Sentry que usa el proyecto) una vez por insumo y unidad.
  - `cantidadEnUnidadActual(movimiento, factores)`: `movimiento.cantidad × (factores.get(unidad) ?? 1)`.
  - `normalizarMovimientos(movimientos, lotes, insumos, cambios)`: copia de cada movimiento con
    `cantidad` en la unidad actual, `cantidadOriginal` y `unidad` originales (tipo
    `MovimientoNormalizado extends Movimiento`).
- [ ] T020 [P] Test `tests/unit/factoresUnidad.test.ts`: sin cambios (todo 1); cambio legado sin
  factor (1); caja → unidad ×100; cadena caja → unidad ×100 → paquete ×0,1; dos conversiones
  concurrentes desde caja (orden `(creadoEn, id)`, mismo resultado en cualquier orden de entrada);
  conversión rechazada con un movimiento en su unidad; unidad desconocida (1 + reporte).
- [ ] T021 En `src/stores/inventoryStore.ts`: suscribir también `cambiosInsumo` y `cambiosLote` (por
  tenant, como el resto) y exponer `movimientos` ya normalizados con `normalizarMovimientos`
  (recalcular cuando cambie cualquiera de las fuentes). Mantener la forma del estado para que las
  funciones puras existentes no cambien.
- [ ] T022 Crear en `src/features/insumos/lib/stock.ts` `movimientosNormalizadosDeLote(loteId)`
  (lee lote, insumo, cambios y movimientos de Dexie; usable dentro de transacciones que incluyan
  esas tablas) y usarlo en las lecturas directas de stock: `consumoRapido.ts` (líneas ~85 y ~128),
  `ConsumoForm.tsx` (~64), `traslado.ts` (~81 y ~103) y `src/lib/sync/reconcileOverdraft.ts`.
  Agregar `db.insumos`, `db.lotes` y `db.cambiosInsumo` a las transacciones que lo necesiten.
- [ ] T023 [P] Test de arquitectura `tests/unit/lecturas-movimientos.test.ts`: recorre `src/` con
  `fs` y falla si `db.movimientos` aparece en un archivo fuera de la lista permitida
  (`lib/db`, `lib/sync/index.ts`, `lib/tenancy`, `stock.ts`, `movements.ts`, y las escrituras de
  `alta.ts`/`recepcion.ts`/`traslado.ts`/`consumoRapido.ts` que no leen stock), con un mensaje que
  explique usar `movimientosNormalizadosDeLote`.
- [ ] T024 En `src/features/insumos/lib/movements.ts`, `crearMovimiento` pone `unidad` = unidad de
  consumo actual del insumo del lote (input opcional `unidad`; si no viene, leer `lote → insumo`).
  En `traslado.ts`, ambas mitades con la misma `unidad`. Ajustar `tests/unit/movements.test.ts` y
  `tests/unit/traslado.test.ts`.
- [ ] T025 Correr `npm test && npm run lint && npm run build`: todo verde sin cambios de
  comportamiento (cierre de la fase).

**Checkpoint**: modelo nuevo funcionando con contenido 1; la clienta no nota cambios.

---

## Phase 3: User Story 1 - Definir la presentación de compra de un insumo (Priority: P1) 🎯 MVP

**Goal**: la administradora define unidad de compra, contenido y unidad de consumo al dar de alta o
editar un insumo, y se ve "Caja × 50 cartuchos".

**Independent Test**: dar de alta Articaína con Caja × 50 cartuchos; tabla y detalle muestran la
presentación; stock y mínimo en cartuchos (quickstart 2, 3, 9).

### Tests for User Story 1

- [ ] T026 [P] [US1] Test `tests/unit/insumos/presentacion.test.ts` para `validarPresentacion` y
  `formatearPresentacion` (T027): contenido ≤ 0, decimal en unidad sin decimales, igualdad de
  unidades fuerza contenido 1, "Caja × 50 cartuchos", "Kit" cuando son iguales,
  "Frasco × 500 mL".
- [ ] T027 [P] [US1] Test de integración `tests/integration/presentacion.test.tsx`: alta con
  presentación como administradora; alta de un Kit sin contenido; edición de contenido que no
  cambia el stock y deja un `CambioInsumo` `contenido`; personal no ve controles de edición.

### Implementation for User Story 1

- [ ] T028 [P] [US1] Crear `src/features/insumos/lib/presentacion.ts`: `validarPresentacion({
  unidadMedida, unidadCompra, contenido })` → errores por campo (FR-003, FR-004, DM) y
  `formatearPresentacion(insumo)` con `etiquetaUnidad` de `src/lib/unidades.ts`.
- [ ] T029 [US1] En `src/features/insumos/lib/alta.ts`: `AltaMaterialInput` con `unidadCompra` y
  `contenido` (default: igual a la de consumo y 1), validados con `validarPresentacion`; el insumo
  creado los guarda. El stock inicial sigue en unidad de consumo en esta historia (US2 agrega la
  unidad de compra).
- [ ] T030 [US1] En `src/features/insumos/lib/catalogo.ts`: agregar `'unidadCompra'` y
  `'contenido'` a `CAMPOS_EDITABLES` y a `validarEdicionInsumo` (con `validarPresentacion`). Si la
  edición cambia `unidadMedida` de un insumo **con movimientos**, `editarInsumo` lanza
  "Para cambiar la unidad de consumo usa Convertir unidad" (la conversión llega en la Phase 8); sin
  movimientos se permite como hoy (factor `null`).
- [ ] T031 [P] [US1] Crear `src/features/insumos/components/PresentacionFields.tsx` (UI §1):
  selector de unidad de consumo, "Se compra por" (opción "Igual que la de consumo"), `Stepper` de
  contenido con sufijo plural, vista previa; controles ≥ 48 px; props controladas + errores.
- [ ] T032 [US1] Usar `PresentacionFields` en `AltaMaterialView.tsx` (sección "Unidades", y en el
  borrador de `useBorradorAlta.ts`) y en `EditarInsumoForm.tsx` (solo administración; personal ve
  texto).
- [ ] T033 [US1] Mostrar la presentación: columna **Presentación** en `InventarioTabla.tsx` (orden
  DS §22, UI §3), línea secundaria en `InsumoCard.tsx` y cabecera de `InsumoDetalle.tsx`
  (`formatearPresentacion`). Ajustar `tests/integration/inventario-tabla.test.tsx`.

**Checkpoint**: US1 funcional (sin conversión de unidad con historial, que va en la Phase 8).

---

## Phase 4: User Story 2 - Ingresar stock en la unidad de compra (Priority: P1)

**Goal**: registrar "2 cajas" y sumar 100 cartuchos, en el alta con stock inicial y en la recepción
de compras.

**Independent Test**: con Caja × 50, recibir 2 cajas → stock +100 y el historial muestra "2 cajas
(100 cartuchos)"; recibir 30 cartuchos sueltos → +30; sin red igual (quickstart 4, 5, 7).

### Tests for User Story 2

- [ ] T034 [P] [US2] Test `tests/unit/insumos/ingreso.test.ts` para `convertirIngreso` (T036):
  2 cajas × 50 = 100; en unidad de consumo sin conversión; 0,5 caja de 25 en unidad sin decimales
  → error; contenido decimal en mL.
- [ ] T035 [P] [US2] Ampliar `tests/unit/compras/recepcion.test.ts`, `tests/unit/insumos/alta.test.ts`
  y `tests/integration/alta-material.test.tsx`: el lote guarda el snapshot
  (`cantidadIngresada`, `unidadIngresada`, `contenido`, `unidadConsumo`) y el movimiento `ingreso`
  la cantidad convertida con `unidad`; sin red, el ingreso queda pendiente y sube igual.

### Implementation for User Story 2

- [ ] T036 [P] [US2] Crear `src/features/insumos/lib/ingreso.ts`: `convertirIngreso(insumo, {
  cantidad, unidad })` → `{ cantidadConsumo, presentaciones, error? }` (FR-009, R5) y
  `snapshotIngreso(insumo, cantidad, unidad)` → campos del lote.
- [ ] T037 [US2] En `src/features/compras/lib/recepcion.ts`: `RecepcionInput` con
  `unidadIngreso` (default `insumo.unidadCompra`); validar con `convertirIngreso`; el lote guarda
  el snapshot y `crearMovimiento` recibe `cantidadConsumo` y `unidad = insumo.unidadMedida`.
- [ ] T038 [US2] Mismo cambio en el stock inicial de `src/features/insumos/lib/alta.ts`.
- [ ] T039 [P] [US2] Crear `src/features/insumos/components/CantidadIngresoField.tsx` (UI §2):
  cantidad + segmentado `[Cajas | Cartuchos]` solo si `unidadCompra ≠ unidadMedida`, equivalencia
  en vivo "2 cajas = 100 cartuchos", error de conversión; ≥ 48 px.
- [ ] T040 [US2] Usar `CantidadIngresoField` en `RecibirItemForm.tsx` y en el stock inicial de
  `AltaMaterialView.tsx`.
- [ ] T041 [US2] En el historial de `InsumoDetalle.tsx`, mostrar el ingreso como "2 cajas (100
  cartuchos)" desde el snapshot del lote (FR-010); lotes previos a 015 (`cantidadIngresada null`)
  como hoy.

**Checkpoint**: US1 + US2 entregan el valor diario (conversión de cajas a unidades).

---

## Phase 5: User Story 3 - Registrar el precio de compra y ver el costo unitario (Priority: P2)

**Goal**: precio opcional al ingresar y costo unitario en tabla y detalle (último ingreso con
precio).

**Independent Test**: recibir 2 cajas a $32.500 → $650 por cartucho en la columna "Costo unitario";
después 30 cartuchos con total $21.000 → $700; un lote sin precio no lo cambia (quickstart 4–6).

### Tests for User Story 3

- [ ] T042 [P] [US3] Test `tests/unit/insumos/precio.test.ts` para `src/features/insumos/lib/precio.ts`:
  `precioDesdeTotal` (por presentaciones, con ingreso en unidad de consumo), `costoLote` (con
  factor tras conversión), `precioVigenteLote` (sin cambios, con cambios, orden `(creadoEn, id)`),
  `costoUnitarioInsumo` (último ingreso con precio en todo el tenant; ingreso sin precio no
  reemplaza; `0` sí cuenta; `null` → "Sin precio"), `formatearCLP`.
- [ ] T043 [P] [US3] Test de integración `tests/integration/ingreso-precio.test.tsx`: recepción con
  precio por caja y con total (vistas previas), columna Costo unitario y "Sin precio", todo con
  personal (Q3).

### Implementation for User Story 3

- [ ] T044 [P] [US3] Crear `src/features/insumos/lib/precio.ts` (R6, R7): `precioDesdeTotal`,
  `precioVigenteLote(lote, cambiosLote)`, `costoLote(lote, cambiosLote, factores)` =
  `precio / (contenido × f[unidadConsumo])`, `costoUnitarioInsumo(insumo, lotes, cambiosLote,
  factores)` → `{ costo, loteId, fecha } | null`, `formatearCLP(n)` (`es-CL`, CLP, 0 decimales).
- [ ] T045 [US3] En `recepcion.ts` y `alta.ts`: input opcional `precio: { modo: 'unidad' | 'total',
  valor } | null`; guardar `lote.precioCompra` (por unidad de compra, sin redondear; `null` sin
  precio, `0` permitido).
- [ ] T046 [P] [US3] Crear `src/features/insumos/components/PrecioIngresoField.tsx` (UI §2):
  segmentado `[Por caja | Total]`, input de pesos, vista previa "2 × $32.500 = $65.000 · $650 por
  cartucho"; ≥ 48 px.
- [ ] T047 [US3] Usar `PrecioIngresoField` en `RecibirItemForm.tsx` y en el stock inicial de
  `AltaMaterialView.tsx`.
- [ ] T048 [US3] En `src/stores/inventoryStore.ts`, derivar `costosUnitarios: Map<insumoId, …>` con
  `costoUnitarioInsumo` (todo el tenant, no filtrado por lugar, R7).
- [ ] T049 [US3] Columna **Costo unitario** en `InventarioTabla.tsx` (orden DS §22), costo en
  `InsumoCard.tsx` y en la cabecera de `InsumoDetalle.tsx` con la nota "según la última compra con
  precio (fecha)"; "Sin precio" en tono secundario (UI §3, §4). Cada lote del detalle muestra su
  precio por unidad de compra o "Sin precio".

**Checkpoint**: costo unitario disponible para 016–017.

---

## Phase 6: User Story 4 - Ver el stock en ambas unidades (Priority: P3)

**Goal**: "120 cartuchos ≈ 2 cajas + 20" y presentaciones sugeridas en Compras.

**Independent Test**: con 120 cartuchos de Caja × 50, tabla y detalle muestran el equivalente;
Compras sugiere "Pedir N cajas (… cartuchos)" (quickstart 7, 13).

### Tests for User Story 4

- [ ] T050 [P] [US4] Test `tests/unit/sugeridasPresentacion.test.ts`: `formatearEquivalente`
  (resto, resto 0, decimales, unidades iguales → sin equivalente) y `presentacionesSugeridas`
  (`max(1, ceil((mínimo efectivo − stock) / contenido))`, `null` si solo caducado, mínimo por
  lugar de la 014).
- [ ] T051 [P] [US4] Ampliar `tests/integration/compras.test.tsx`: tarjeta sugerida con "Pedir 2
  cajas (100 cartuchos)", recepción con la cantidad propuesta en cajas, texto compartido.

### Implementation for User Story 4

- [ ] T052 [P] [US4] Agregar `formatearEquivalente(stock, insumo)` a `src/lib/unidades.ts` (R9).
- [ ] T053 [US4] Mostrar el equivalente en la columna Stock de `InventarioTabla.tsx`, en
  `InsumoCard.tsx` y en `InsumoDetalle.tsx` (FR-021).
- [ ] T054 [US4] En `src/features/compras/lib/sugeridos.ts`, agregar `presentacionesSugeridas` a
  `ItemSugerido` (R8; usar el stock y el mínimo efectivo del lugar que ya calcula
  `computeInsumosStockBajo`, exponiendo `stockActual` y el mínimo si hace falta).
- [ ] T055 [US4] `ItemSugeridoCard.tsx` muestra "Pedir N {unidadCompra} (M {unidadMedida})";
  `RecibirItemForm.tsx` propone esa cantidad en unidad de compra; `compartir.ts` la incluye en el
  texto (UI §6).

---

## Phase 7: User Story 5 - Corregir el precio de un lote (Priority: P3)

**Goal**: cualquier persona del equipo agrega o corrige el precio de un lote, con historial y sin
perder valores concurrentes.

**Independent Test**: editar el precio de un lote sin precio → el costo se actualiza y el historial
muestra autor, fecha, anterior y nuevo; dos correcciones offline convergen (quickstart 8).

### Tests for User Story 5

- [ ] T056 [P] [US5] Test `tests/unit/sync-cambios-lote.test.ts` (patrón
  `sync-cambios-insumo.test.ts`): push solo de los pendientes del usuario actual, `sincronizado`
  solo si el servidor aceptó, error de fila = error de ciclo, pull con `bulkPut`, orden lotes antes
  que `cambios_lote`.
- [ ] T057 [P] [US5] Test de integración en `tests/integration/ingreso-precio.test.tsx`: "Editar
  precio" como personal, historial del lote, dos correcciones con `creadoEn` distinto → gana la
  última en cualquier orden de llegada.

### Implementation for User Story 5

- [ ] T058 [US5] En `src/features/insumos/lib/precio.ts`, `corregirPrecioLote(loteId, nuevo: number
  | null)`: valida `≥ 0`, escribe un `CambioLote` (`campo 'precioCompra'`, `valorAnterior` =
  precio vigente, `usuarioId`, `tenantId`, `sincronizado: false`) en Dexie; no-op si no cambia.
  Sin restricción de rol (Q3).
- [ ] T059 [US5] En `src/lib/sync/index.ts`, `pushCambiosLote` y `pullCambiosLote` (esquema §7),
  con `CambioLoteRow`/`toCambioLoteRow`/`fromCambioLoteRow`, integrados en `ejecutarCiclo` después
  de lotes; incluir `cambiosLote` en el conteo de pendientes del indicador de la spec 012 y en
  `subirPendientesPrevios` (usuario desactivado, política del esquema §6), y en el borrado por
  tenant de `src/lib/tenancy/index.ts`.
- [ ] T060 [P] [US5] Crear `src/features/insumos/components/EditarPrecioDialog.tsx` (UI §4):
  segmentado `[Por caja | Total]` (reutiliza `PrecioIngresoField`), opción "Sin precio",
  historial del lote; ≥ 48 px.
- [ ] T061 [US5] Botón **Editar precio** en cada lote de `InsumoDetalle.tsx` que abre el diálogo.

---

## Phase 8: User Story 1 (cont.) - Conversión de la unidad de consumo (Priority: P1, separable)

**Goal**: la administradora cambia la unidad de consumo de un insumo con historial (Q1, FR-007a,
US1-4).

**Independent Test**: "Guantes" con 3 cajas → Unidad (1 caja = 100): stock 300, mínimo
convertido, historial previo en cajas; un consumo offline en cajas cuenta como 100 al sincronizar;
cartucho → caja con 120 se rechaza (quickstart 10–12).

### Tests

- [ ] T062 [P] [US1] Test `tests/unit/insumos/conversion.test.ts` para `validarConversion` y
  `convertirUnidadConsumo`: stock por lote y lugar no entero → error con conteo; mínimo y
  `minimosLugar` convertidos; cambios escritos (`unidadMedida` con `factor`, `stockMinimo`,
  opcionales `unidadCompra`/`contenido`); solo administración.
- [ ] T063 [P] [US1] Test de integración `tests/integration/conversion-unidad.test.tsx`: diálogo
  completo, vista previa, rechazo por múltiplo, consumo rápido y traslado después de convertir
  (stock correcto), y un movimiento en la unidad anterior insertado como si llegara por sync.

### Implementation

- [ ] T064 [US1] Crear `src/features/insumos/lib/conversion.ts`:
  - `validarConversion(insumo, hasta, factor, stockPorLoteYLugar, minimos)` (R3);
  - `convertirUnidadConsumo(insumoId, { hasta, factor, actualizarPresentacion })`: exige
    administración (`exigirAdministrador`), una transacción Dexie sobre `insumos`, `cambiosInsumo`,
    `lotes`, `movimientos`, `minimosLugar`; escribe los cambios de DM "CambioInsumo" con
    `nuevoCambio` (ampliado para aceptar `factor`), actualiza `minimosLugar` (`sincronizado:
    false`) y reproyecta.
- [ ] T065 [US1] En `catalogo.ts`, `nuevoCambio` acepta `factor` opcional; en `src/lib/sync/index.ts`
  se sube con el cambio (ya cubierto por T017).
- [ ] T066 [P] [US1] Crear `src/features/insumos/components/ConvertirUnidadDialog.tsx` (UI §5): De /
  A, "1 {anterior} = [N] {nueva}" con opción de invertir la dirección, vista previa de stock total
  y mínimo, casilla "Comprar por {anterior} × N", mensajes de error; ≥ 48 px.
- [ ] T067 [US1] En `EditarInsumoForm.tsx`, cuando el insumo tiene movimientos, el selector de
  unidad de consumo abre `ConvertirUnidadDialog` en lugar de editar directo (reemplaza el error de
  T030).
- [ ] T068 [US1] En el historial de `InsumoDetalle.tsx`, mostrar cada movimiento en su unidad
  original y, si difiere de la actual, el equivalente ("3 cajas = 300 unidades"), y la conversión
  como evento ("Unidad cambiada de Caja a Unidad, 1 = 100", autor, fecha).

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T069 Agregar a `scripts/test-rls.mjs` los 8 casos del esquema §8 (dos tenants, personal y
  administración ya existen en el script de la 014).
- [ ] T070 [P] Prueba de rendimiento en `tests/integration/inventario-tabla.test.tsx`: 300 insumos
  con 3.000 movimientos y conversiones; el cálculo de movimientos normalizados y costos tarda
  menos de 100 ms (plan, Performance Goals).
- [ ] T071 Ensayo de migración sobre la restauración del respaldo de producción (quickstart
  "Migración" 1): stock por lote y lugar y mínimos idénticos antes y después; sin `pieza`; todos
  los movimientos con `unidad`. Anotar el resultado en la descripción del PR.
- [ ] T072 Dexie v11 en Chromium real (quickstart "Migración" 2) con el build 2.3.0 y un consumo
  sin conexión.
- [ ] T073 [P] Verificación visual con el skill `run-indentory` en móvil, tablet y desktop: tabla
  con Presentación y Costo unitario, formularios de ingreso, diálogos de precio y conversión,
  Compras; tamaños táctiles ≥ 48 px (Constitución III).
- [ ] T074 [P] Documentar en `README.md` (sección de despliegue) el orden: respaldo, `supabase db
  push`, front; y el paso "antes de la primera conversión de unidad de un tenant, confirmar que
  todos sus dispositivos están en la versión nueva" (R10, riesgo aceptado).
- [ ] T075 Recorrer los 15 escenarios de `quickstart.md`.
- [ ] T076 Correr `npm run lint && npm run build && npm test && npm run test:rls`, todo verde.
- [ ] T077 [P] En `../1stDocs/005-roadmap/002-DentdeLion.md`, actualizar el estado de la 015 al
  abrir el PR; en el backlog, anotar "stock ideal" del DS §24 (para sugerir más que el mínimo, R8)
  y el gap aceptado del mínimo editado sin red durante una conversión.
- [ ] T078 Descripción del PR: cambios de esquema y triggers (`proteger_lote`,
  `completar_unidad_movimiento`, `normalizar_unidad`), `cambios_lote` abierto a todo el tenant
  (Q3), orden de despliegue y riesgo de clientes 2.3.0 con conversiones, resultados de T071–T075.

---

## Dependencies & Execution Order

- **Setup** (T001–T003) antes que todo. T002 y T003 en paralelo con T001.
- **Foundational** (T004–T025) bloquea todas las historias. T004–T011 en serie sobre la migración.
  T012 → T013 → T014. T015 → T016. T017 → T018. T019 → T021 → T022 → T024; T020 y T023 en paralelo.
  T025 cierra la fase.
- **US1** (T026–T033) depende de Foundational. MVP.
- **US2** (T034–T041) depende de US1 (presentación en el insumo).
- **US3** (T042–T049) depende de US2 (snapshot del lote y formularios de ingreso).
- **US4** (T050–T055) depende de US1; independiente de US2/US3 (salvo T055, que toca
  `RecibirItemForm.tsx` como T040/T047: hacerlos en serie).
- **US5** (T056–T061) depende de US3 (precio y costo).
- **US1 cont. / conversión** (T062–T068) depende de Foundational (factores) y US1; conviene después
  de US2 para probar consumos sobre insumos con presentación. Separable si hay que recortar.
- **Polish** al final.

```text
Setup ─► Foundational ─► US1 ─┬─► US2 ─► US3 ─► US5 ─┐
                              ├─► US4 ───────────────┼─► Polish
                              └─► US1 cont. (conversión) ┘
```

## Parallel Examples

- **Setup**: T002 y T003 mientras se escribe T001.
- **Foundational**: T014, T018, T020 y T023 en paralelo una vez listos T013, T017 y T019.
- **US1**: T026, T027, T028 y T031 en paralelo; luego T029 → T030 → T032 → T033.
- **US2**: T034, T035, T036 y T039 en paralelo; luego T037 → T038 → T040 → T041.
- **US3**: T042, T043, T044 y T046 en paralelo; luego T045 → T047 → T048 → T049.
- **US4**: T050, T051 y T052 en paralelo; luego T053 → T054 → T055.
- **US5**: T056, T057 y T060 en paralelo; luego T058 → T059 → T061.
- **Conversión**: T062, T063 y T066 en paralelo; luego T064 → T065 → T067 → T068.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: esquema y Dexie v11 sin cambios visibles, más la
   presentación de los insumos. Publicable: la clienta puede empezar a cargar presentaciones.
2. **+ US2**: ingreso en cajas, el valor diario que motivó la spec.
3. **+ US3**: precio y costo unitario (base de 016–017).
4. **+ US4 + US5**: equivalentes, sugeridas en Compras y corrección de precios.
5. **+ Conversión** (Phase 8): cierra Q1. Antes de usarla en producción, todos los dispositivos del
   tenant en la versión nueva (R10).
6. **Polish**: RLS, rendimiento, ensayo de migración, Chromium, capturas, documentación y PR.
