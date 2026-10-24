---

description: "Task list for 022-compras-seleccion-subtotal-y-whatsapp"
---

# Tasks: Compras · selección, subtotal y pedido por WhatsApp

**Input**: Design documents from `/specs/022-compras-seleccion-subtotal-y-whatsapp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. plan.md (Testing), `contracts/ui-contracts.md` (tabla "Pruebas") y
`contracts/supabase-schema.md` (`test:rls` y pruebas de sync) las definen. Patrón del proyecto: Vitest +
RTL con `fireEvent` (no hay `user-event`), helpers de `tests/helpers/` (`memoryDb.ts`,
`tablasMemoria.ts`, `lugarFalso.ts`, `proveedor.ts`, `tenancy.ts`, `clienteFalso.ts`, `authFalso.ts`).
Verificación visual con `run-indentory`.

**Desvíos al implementar**:

- **R6 rehecho** (lo encontró `test:rls`): Postgres aplica el check de INSERT a **todas** las filas de
  un upsert, también a las que terminan en UPDATE, así que la premisa de la spec 012 R4 era falsa y, en
  cuanto un dispositivo tiene un ítem ajeno (el pull los trae todos), la subida de `items_compra` falla
  entera en cada ciclo. En vez de "dos tandas y uno por uno", los ajenos suben solo si se cambiaron en
  este dispositivo (marca local `ItemCompra.cambioLocal`, sin versión de Dexie), por UPDATE; si aún no
  están en el servidor, actualizan 0 filas y esperan sin error. El pull no pisa un cambio local sin
  subir. `test:rls` documenta ambos comportamientos de Postgres.
- `actualizarHorasAvisoPendientes` reescribía la fila de configuración sin conservar el resto; ahora la
  conserva, para no borrar el saludo.
- En "Todos", el proveedor preelegido es el predeterminado del lugar cuando todo lo marcado es de un
  mismo lugar (no se guarda "el último lugar activo"); si es de varios, ninguno.
- La hoja de envío suma la opción "Otro contacto" (elegir en WhatsApp) al final de la lista.
- En el teléfono, "Copiar" y "Compartir" son botones de ícono (con `aria-label`) en la fila de "Enviar
  por WhatsApp", para que la barra fija no ocupe un tercio de la pantalla.
- `clienteFalso` de pruebas: `update().eq()` se puede esperar directo o seguir con `.select()`; los
  mocks a mano de `db` en `bottom-nav`, `inicio` y `navegacion-responsiva` suman `borradores`.
- Driver de `run-indentory`: comandos `seed-precio` y `seed-proveedor`.

**Organization**: por historia de spec.md. `R#` = research.md, "SS" = `contracts/supabase-schema.md`,
"UI" = `contracts/ui-contracts.md`, "DM" = data-model.md, "QS" = quickstart.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

- [X] T001 *(Hecho: lint limpio, 959 pruebas en 125 archivos; `test:rls` OK.)* Confirmar la línea base en la rama `022-compras-seleccion-subtotal-y-whatsapp`:
  `npm run lint && npm test` en verde y `supabase db reset && npm run test:rls` en verde antes de tocar
  código; anotar pruebas y archivos para comparar en T036.

---

## Phase 2: Foundational (bloquea US1–US3)

**Purpose**: la lógica pura del pedido (R2, R3, R5) y la persistencia de la selección, que usan la
selección, el envío y copiar/compartir.

- [X] T002 [P] Pruebas de `pedido.ts` en `tests/unit/compras/pedido.test.ts` (UI, "Pruebas"):
  `claveSugerido`/`claveManual`; `itemsDelPedido` (orden sugeridos → manuales; manual vinculado a un
  insumo activo trae `insumo`, `unidadCompra` y `cantidad`; vinculado a un insumo dado de baja o sin
  vínculo queda con `insumo: null`); `valorItem` (sugerido por stock bajo = cajas × costo × contenido;
  sugerido solo caducado → `sin-cantidad`; manual sin vínculo → `sin-precio`; manual vinculado sin
  cantidad → `sin-cantidad`; sin precio y sin cantidad → `sin-precio`; precio 0 → `monto: 0`; costo de
  un lote con presentación vieja se multiplica por el contenido **actual**); `resumirSeleccion`
  (cuenta solo claves seleccionadas, suma sin redondear, separa sin precio / sin cantidad);
  `saludoEfectivo` (sin config, `undefined`, `null`, solo espacios → saludo de la clienta).
  Deben fallar antes de T004.
- [X] T003 [P] Pruebas de `useSeleccionCompras` en `tests/unit/compras/useSeleccionCompras.test.tsx` con
  `memoryDb` (`renderHook`): arranca vacía; `alternar` persiste en `borradores` como
  `{ id: 'seleccion-compras', datos: { tenantId, claves } }`; al volver a montar recupera la selección;
  poda las claves que no están en `clavesPendientes` (y la fila guardada queda podada); una clave nueva
  en `clavesPendientes` no aparece marcada; fila de otro tenant se ignora; `marcarTodos(claves)` marca
  todas y, si ya estaban todas, las desmarca. Deben fallar antes de T005.
- [X] T004 Crear `src/features/compras/lib/pedido.ts` con `SALUDO_PEDIDO_POR_DEFECTO`,
  `LARGO_MAXIMO_SALUDO` (500), `LARGO_MAXIMO_ENLACE` (4000), `saludoEfectivo`, `claveSugerido`,
  `claveManual`, `itemsDelPedido`, `valorItem`, `resumirSeleccion` (firmas en UI, "Lógica pura"; tipos
  `ItemPedido`, `ValorItem`, `ResumenSeleccion` de DM, "Vistas calculadas"). Precio por unidad de
  compra = `costos.get(insumoId).costo × insumo.contenido` (R3); la cantidad de un sugerido es
  `presentacionesSugeridas`. `construirMensajePedido` y `enlaceWhatsApp` se agregan en US2 (T013).
- [X] T005 Ampliar `Borrador` en `src/lib/db/index.ts` a la unión `BorradorAlta | BorradorSeleccionCompras`
  (DM, "Selección de compras"), sin tocar las versiones de Dexie; ajustar los usos tipados de
  `db.borradores` (`useBorradorAlta.ts`, el remapeo de la 021 en `src/lib/sync/index.ts`) para que
  sigan compilando (filtrar por `id === 'alta-material'` donde lean `datos`). Crear
  `src/features/compras/lib/useSeleccionCompras.ts` (UI, "useSeleccionCompras"): lee la fila al montar,
  estado en memoria con escritura optimista a Dexie, poda contra `clavesPendientes` y guarda la poda,
  usa `getTenantActualId()`.

**Checkpoint**: T002 y T003 en verde.

---

## Phase 3: User Story 1 - Seleccionar y ver cuánto suma (Priority: P1) 🎯 MVP

**Goal**: casillas, "Seleccionar todo", monto por ítem y barra con el subtotal estimado.

**Independent Test**: 3 sugeridos con precio + 1 manual sin precio: marcar los 3 da la suma a mano;
marcar el manual no cambia el subtotal y dice "1 sin precio" (spec US1).

### Tests for User Story 1

- [X] T006 [P] [US1] Pruebas de integración en `tests/integration/compras-seleccion.test.tsx` (UI,
  "Pruebas"): cada tarjeta tiene una casilla "Seleccionar <nombre>"; nada marcado al abrir; la barra
  dice "Selecciona lo que vas a pedir" y los botones están deshabilitados; marcar 2 sugeridos con
  precio muestra "2 seleccionados" y el subtotal formateado (`$…`), y cada tarjeta su monto; un manual
  sin vínculo marcado dice "Sin precio" y suma "1 sin precio"; "Seleccionar todo" marca todo y, de
  nuevo, desmarca todo (estado `mixed` con algunos); desmontar y volver a montar conserva la selección;
  recibir un ítem marcado lo saca del subtotal. Deben fallar antes de T008–T010.

### Implementation for User Story 1

- [X] T007 [P] [US1] Casilla y valor en las tarjetas: `src/features/compras/components/ItemSugeridoCard.tsx`
  y `ItemManualCard.tsx` reciben `seleccionado: boolean`, `onAlternar: () => void`,
  `etiquetaSeleccion: string` y `valor: ValorItem | null`. Casilla a la izquierda dentro de un `label`
  de 48 × 48 px (`touch-target`) con `aria-label`; tarjeta seleccionada con borde `primary`; el monto
  (`formatearCLP`) o "Sin precio"/"Sin cantidad" en `text-muted` bajo el texto de pedido (UI, "Casilla
  en las tarjetas"). El ✓ y el menú del manual no cambian.
- [X] T008 [P] [US1] Crear `src/features/compras/components/ResumenSeleccion.tsx` (UI, "ResumenSeleccion";
  R8): props `resumen: ResumenSeleccion`, `onEnviarWhatsApp`, `onCopiar`, `onCompartir`,
  `puedeCompartir`. Línea de totales con `aria-live="polite"`: "N seleccionados", "Subtotal estimado"
  con el monto, y "N sin precio · N sin cantidad" si hay; rótulo completo "Subtotal estimado (precios
  de la última compra)" en `aria-label` y visible desde tablet. Sin selección: "Selecciona lo que vas a
  pedir" y los tres botones `disabled`. "Enviar por WhatsApp" primario; "Copiar" y "Compartir"
  secundarios ("Compartir" solo si `puedeCompartir`). Fija sobre la barra inferior en teléfono y
  `sticky bottom-0` en tablet/desktop.
- [X] T009 [US1] Integrar en `src/features/compras/components/ComprasView.tsx`: armar los `ItemPedido`
  de cada vista (`itemsDelPedido`, con el `lugarId` de la fila) y el conjunto de claves pendientes de
  **todos** los lugares para `useSeleccionCompras` (R2, poda); costos con `costosUnitariosPorInsumo`
  desde `inventoryStore` (`insumos`, `lotes`, `cambiosLote`, `cambiosInsumo`) en un `useMemo`; casilla
  "Seleccionar todo" (`role="checkbox"`, `aria-checked` true/false/`mixed`, ≥ 48 px) sobre los ítems
  visibles; pasar `seleccionado`/`valor` a las tarjetas; `ResumenSeleccion` al pie con `padding-bottom`
  en la lista para no tapar la última tarjeta. Quitar el botón "Compartir Lista" de la cabecera (sus
  acciones pasan a la barra en US3; mientras tanto, la barra llama a los handlers existentes).
- [X] T010 [US1] Ajustar `tests/integration/compras.test.tsx` a la nueva cabecera y barra (sin "Compartir
  Lista"; casillas presentes) sin perder los casos existentes de sugeridos, manuales, recibir y
  "Todos".

**Checkpoint**: T006 en verde; US1 usable sola (MVP).

---

## Phase 4: User Story 2 - Enviar el pedido por WhatsApp (Priority: P1)

**Goal**: hoja "Enviar pedido" con proveedor preelegido y enlace `wa.me` con el mensaje sin precios.

**Independent Test**: proveedor con WhatsApp y 2 ítems marcados → el enlace es
`https://wa.me/<número>?text=<saludo + 2 renglones>` (spec US2).

### Tests for User Story 2

- [X] T011 [P] [US2] Pruebas de mensaje y enlace en `tests/unit/compras/pedido.test.ts` (UI, "Pruebas";
  R5): `construirMensajePedido` empieza con el saludo, una línea en blanco y "- Nombre — 2 cajas" por
  ítem en orden; manual sin vínculo "- Eyectores — 3"; sin cantidad solo el nombre; nunca `$`,
  "Sugerido" ni "Manual" ni la nota; con `nombresLugar`, " (Lugar)" al final. `enlaceWhatsApp`: con
  número `https://wa.me/56912345678?text=…`, sin número `https://wa.me/?text=…`; "ñ", "&", "#", "?" y
  saltos de línea codificados con `encodeURIComponent`.
- [X] T012 [P] [US2] Pruebas de integración en `tests/integration/enviar-pedido.test.tsx` (UI,
  "Pruebas"), con proveedores de `tests/helpers/proveedor.ts`: con 2 ítems marcados, "Enviar por
  WhatsApp" abre "Enviar pedido" con el predeterminado del lugar marcado; el enlace "Abrir WhatsApp"
  tiene `href` con el número y el mensaje, `target="_blank"` y `rel` con `noopener`; elegir uno sin
  WhatsApp muestra "<Nombre> no tiene WhatsApp: elige el contacto en WhatsApp." y `href`
  `https://wa.me/?text=…`; sin proveedores en el catálogo, solo el aviso y el enlace; con un mensaje que
  pasa de 4.000 caracteres, aviso "La lista es muy larga para WhatsApp…" y "Copiar" en vez del enlace;
  en "Todos", el mensaje de la vista previa lleva "(Lugar)"; tras tocar el enlace la hoja se cierra y la
  selección sigue igual.

### Implementation for User Story 2

- [X] T013 [US2] Agregar `construirMensajePedido` y `enlaceWhatsApp` a
  `src/features/compras/lib/pedido.ts` (R4, R5). Cantidad con `formatearCantidad(n, unidadCompra)` de
  `src/lib/unidades`, sin equivalencia; manual sin unidad, el número tal cual.
- [X] T014 [US2] Exponer `saludoPedido: string` (= `saludoEfectivo(config)`) en
  `src/stores/alertasStore.ts`, desde la misma `liveQuery` que lee `configuracionAlertas`; agregar
  `saludoPedido?: string | null` a `ConfiguracionAlertas` en `src/lib/db/index.ts` (DM, "Saludo del
  pedido"; sin versión nueva de Dexie). Ajustar los mocks de `alertasStore` que fallen.
- [X] T015 [US2] Crear `src/features/compras/components/EnviarPedidoSheet.tsx` (UI,
  "EnviarPedidoSheet"; R7): `BottomSheet` "Enviar pedido" con `radiogroup` de proveedores activos
  (`activos`, `ordenarProveedores`, `buscarProveedores` de `src/features/proveedores/lib/proveedores.ts`;
  buscador si son más de 8; opciones ≥ 48 px; "Sin WhatsApp" en los que no tienen número), preelegido
  con `usePredeterminado(lugarId)` (en "Todos", el último lugar activo de `lugarStore`); vista previa
  `<pre class="whitespace-pre-wrap">` de hasta 8 líneas; avisos de sin WhatsApp / sin catálogo / enlace
  largo; acción `<a target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` con estilo de botón
  primario que cierra la hoja al tocarla; si el enlace es largo, "Copiar" en su lugar.
- [X] T016 [US2] Conectar en `ComprasView.tsx`: overlay `{ tipo: 'enviarWhatsApp' }` abierto desde la
  barra; el mensaje se arma con `saludoPedido`, los `ItemPedido` seleccionados de la vista y, en "Todos",
  el mapa de nombres de lugar.

**Checkpoint**: T011 y T012 en verde.

---

## Phase 5: User Story 3 - Copiar o compartir lo seleccionado (Priority: P2)

**Goal**: "Copiar" y "Compartir" usan el mismo mensaje y solo lo seleccionado.

**Independent Test**: 2 de 5 marcados → "Copiar" deja en el portapapeles el mensaje con solo esos 2.

- [X] T017 [P] [US3] Ajustar `tests/unit/compras/compartir.test.ts`: quitar los casos de
  `construirTextoCompartir` (cubiertos por T011) y conservar `puedeCompartir`/`copiarAlPortapapeles`.
- [X] T018 [US3] Ampliar `tests/integration/compras-seleccion.test.tsx`: con 2 de 5 marcados, "Copiar"
  llama a `navigator.clipboard.writeText` con el mensaje de esos 2 y muestra "Lista copiada";
  "Compartir" llama a `navigator.share({ text })` con el mismo mensaje; sin `navigator.share` no aparece
  "Compartir"; falla del portapapeles muestra el mensaje existente.
- [X] T019 [US3] Eliminar `construirTextoCompartir` de `src/features/compras/lib/compartir.ts` y hacer que
  `handleCompartir`/`handleCopiar` de `ComprasView.tsx` usen `construirMensajePedido` con la selección y
  el saludo (FR-012, FR-018, FR-019).

**Checkpoint**: T017 y T018 en verde.

---

## Phase 6: User Story 4 - Ítems de compra ajenos no frenan la subida (Priority: P2)

**Goal**: un ítem ajeno rechazado no impide subir el resto ni deja el indicador en "Error" (R6).

**Independent Test**: ítem ajeno nuevo rechazado + uno propio → el propio sube, el ciclo sin error.

- [X] T020 [P] [US4] Pruebas en `tests/unit/sync-items-compra.test.ts` (SS, "Pruebas"), con
  `clienteFalso`: propios y ajenos en dos upserts; si el de ajenos falla con `42501`, reintenta uno por
  uno y solo el rechazado queda fuera; el ciclo no registra error y `reportarErrorSync` se llama una vez;
  un error de red en el upsert de propios sí queda en el ciclo; sin usuario actual no sube nada.
  Deben fallar antes de T021.
- [X] T021 [US4] Reescribir `pushItemsCompra` en `src/lib/sync/index.ts` (SS, "pushItemsCompra"): separar
  por `creadoPor === usuario actual`; upsert de propios; upsert de ajenos con reintento fila por fila
  ante `esRechazoDePermisos`, `reportarErrorSync('push items_compra ajeno', …)` por rechazo y
  `ciclo.registrar` solo para otros errores; comentario con la referencia a spec 012 R4 y a esta R6.
- [X] T022 [US4] Casos de `items_compra` en `scripts/test-rls.mjs`, sección "spec 022" (SS, `test:rls`):
  upsert de un ítem existente creado por otra persona del tenant → OK; upsert de un ítem nuevo con
  `creado_por` de otra persona → rechazado.

**Checkpoint**: T020 en verde; `test:rls` en verde.

---

## Phase 7: User Story 5 - Ajustar el saludo del pedido (Priority: P3)

**Goal**: administración cambia o restablece el saludo en Ajustes → Proveedores; se sincroniza por
tenant (R1, R9).

**Independent Test**: cambiar el saludo en Ajustes → el siguiente "Copiar" empieza con él; otro
dispositivo del tenant lo recibe tras sincronizar (spec US5).

### Tests for User Story 5

- [X] T023 [P] [US5] Pruebas en `tests/unit/ajustes/saludoAdmin.test.ts` (UI, "Pruebas"): guardar texto
  (recortado) deja `saludoPedido` y `sincronizado: false`; vacío o solo espacios → `null`; más de 500
  caracteres lanza "El saludo puede tener hasta 500 caracteres."; `restablecerSaludoPedido` → `null`;
  sin fila `'global'` la crea con los niveles por defecto y el tenant actual.
- [X] T024 [P] [US5] Pruebas en `tests/unit/sync-configuracion-saludo.test.ts` (SS, "Pruebas"):
  `saludoPedido` `undefined` no viaja en el upsert; `null` y texto sí; el pull guarda `null` cuando el
  servidor devuelve `null` y no define el campo si la columna no viene; `personal` con un saludo local
  no sube (regla existente).
- [X] T025 [P] [US5] Ampliar `tests/integration/ajustes-proveedores.test.tsx`: la tarjeta "Mensaje del
  pedido" muestra el saludo de la clienta y el contador "N/500"; "Guardar" deshabilitado sin cambios;
  editar y guardar muestra "Saludo guardado." y persiste; "Restablecer" vuelve al original y queda
  deshabilitado; `personal` no ve la sección.

### Implementation for User Story 5

- [X] T026 [US5] Crear `supabase/migrations/20261024000000_saludo_pedido.sql` (SS, "Migración"): columna
  `configuracion_alertas.saludo_pedido text` con el check de 1–500 caracteres o `null`; comentario de
  cabecera con la referencia a R1 y el orden de despliegue (servidor antes que front).
- [X] T027 [US5] Casos del saludo en `scripts/test-rls.mjs`, sección "spec 022" (SS, tabla `test:rls`):
  administración escribe y `personal` lee; `personal` no cambia; otro tenant no lee ni cambia; 501
  caracteres o solo espacios → `23514`; `null` OK; upsert de administración sin la columna conserva el
  saludo. Correr `supabase db reset && npm run test:rls`.
- [X] T028 [US5] Sync del saludo en `src/lib/sync/index.ts` (SS, "ConfiguracionAlertasRow"):
  `saludo_pedido?: string | null` en la fila; `toConfiguracionAlertasRow` lo incluye solo si
  `saludoPedido !== undefined`; `fromConfiguracionAlertasRow` lo mapea si la clave viene en la fila.
- [X] T029 [US5] Crear `src/features/ajustes/lib/saludoAdmin.ts` con `guardarSaludoPedido` y
  `restablecerSaludoPedido` (UI, "saludoAdmin.ts"), siguiendo cómo `AvisosSection` crea o actualiza la
  fila `'global'` con `sincronizado: false`.
- [X] T030 [US5] Tarjeta "Mensaje del pedido" al comienzo de
  `src/features/ajustes/components/ProveedoresSection.tsx` (UI, "Ajustes → Proveedores"; R9): `textarea`
  de 4 filas con `maxLength` 500 y contador, texto de ayuda, "Guardar" y "Restablecer" con sus estados
  deshabilitados, confirmación "Saludo guardado.", error de largo bajo el campo.

**Checkpoint**: T023–T025 en verde; `test:rls` en verde.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T031 [P] *(Hecho en Chromium a 360 × 640, 820 × 1180 y 1440 × 900: Compras con selección y barra, "Enviar pedido" y "Mensaje del pedido". El "Error de sincronización" del encabezado es del entorno: el usuario sembrado no tiene sesión en Supabase.)* Recorrido manual del quickstart (QS, "Recorrido manual", pasos 1–10) con `run-indentory`
  en teléfono 360 × 640, tablet y desktop; capturas de Compras con selección y barra, "Enviar pedido" y
  la tarjeta del saludo (SC-006). Revisar que la barra no tape la última tarjeta ni la barra inferior.
- [X] T032 [P] Revisión de accesibilidad: casillas y "Seleccionar todo" operables con teclado
  (Espacio), `aria-checked` correcto, radios del proveedor con flechas, `aria-live` del subtotal; foco
  vuelve al botón "Enviar por WhatsApp" al cerrar la hoja.
- [ ] T033 *(Pendiente para antes de publicar.)* Prueba en dispositivos reales (QS, "Prueba en dispositivos reales"; SC-003): Android (Chrome
  y PWA instalada) y desktop con un número de prueba; anotar el resultado en "Desvíos al implementar"
  de este archivo. *(Puede quedar pendiente para antes de publicar.)*
- [X] T034 [P] Revisar que no queden referencias a `construirTextoCompartir` ni al texto "Compartir
  Lista" (`grep` en `src/` y `tests/`), y que los comentarios nuevos citen la spec 022 y la R
  correspondiente, como el resto del código.
- [X] T035 Formatear con Prettier solo los archivos nuevos (el repo base no está limpio, como en la 021).
- [X] T036 *(Hecho: lint limpio, 1020 pruebas en 131 archivos, build OK, `test:rls` 147 OK en base nueva y repetido.)* Verificación final: `npm run lint`, `npm test` (comparar con T001), `npm run build`,
  `supabase db reset && npm run test:rls`; anotar los números aquí y en el PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002–T005)** → US1 → US2 → US3.
- **US4 (T020–T022)** solo depende de Setup: no toca la UI; puede ir en paralelo con cualquier fase.
- **US5 (T023–T030)** depende de T014 (campo `saludoPedido` y `alertasStore`); lo demás es
  independiente de US1–US3. La migración (T026) va antes de T027.
- **Polish** al final.

### User Story Dependencies

- **US1 (P1)**: Foundational. Es el MVP.
- **US2 (P1)**: US1 (barra y selección).
- **US3 (P2)**: US1 y T013 (mensaje).
- **US4 (P2)**: ninguna.
- **US5 (P3)**: T014. Sin US5, el mensaje usa el saludo de la clienta (`saludoEfectivo` con `undefined`).

### Within Each User Story

- Pruebas primero (deben fallar), luego lógica, componentes e integración.
- `ComprasView.tsx` se toca en T009, T016 y T019: secuenciales.
- `src/lib/sync/index.ts` se toca en T005 (tipos de borrador), T021 y T028: secuenciales.
- `scripts/test-rls.mjs` se toca en T022 y T027: secuenciales.
- `tests/unit/compras/pedido.test.ts` se crea en T002 y se amplía en T011.

### Parallel Opportunities

- T002 ‖ T003 (archivos de prueba distintos).
- T006 ‖ T007 ‖ T008 (prueba, tarjetas, barra).
- T011 ‖ T012.
- US4 completa ‖ US1–US3.
- T023 ‖ T024 ‖ T025.
- T031 ‖ T032 ‖ T034.

---

## Parallel Example: User Story 1

```bash
Task: "T006 Pruebas de integración en tests/integration/compras-seleccion.test.tsx"
Task: "T007 Casilla y valor en ItemSugeridoCard.tsx e ItemManualCard.tsx"
Task: "T008 ResumenSeleccion.tsx"
# Luego, secuencial: T009 (ComprasView) y T010 (compras.test.tsx)
```

## Parallel Example: User Story 5

```bash
Task: "T023 tests/unit/ajustes/saludoAdmin.test.ts"
Task: "T024 tests/unit/sync-configuracion-saludo.test.ts"
Task: "T025 tests/integration/ajustes-proveedores.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 → T002–T005 → T006–T010.
2. **Validar**: marcar ítems y ver el subtotal correcto; la selección sobrevive a recargar.
3. Se podría publicar solo (sin migración): la barra con el subtotal y los botones existentes.

### Incremental Delivery

1. US1 → selección y subtotal (front solo).
2. US2 → envío por WhatsApp con el saludo de la clienta (front solo).
3. US3 → copiar/compartir con la selección.
4. US4 → deuda de sync (independiente).
5. US5 → saludo editable: **trae la migración**; desde aquí se despliega el servidor antes que el front.

### Notes

- Sin versión nueva de Dexie: la selección es una fila de `borradores` y el saludo un campo opcional.
- El lado de WhatsApp no se automatiza: T033 cierra SC-003 a mano.
- Commit al final de cada fase o grupo lógico, con el formato `<slug> <emoji> <type>: <description>`.
