---

description: "Task list for 023-marcas"
---

# Tasks: Marcas

**Input**: Design documents from `/specs/023-marcas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. Las definen plan.md (Testing), `contracts/ui-contracts.md` (tabla "Pruebas") y
`contracts/supabase-schema.md` §5 (`test:rls`). Patrón del proyecto: Vitest + RTL con `fireEvent` (no
hay `user-event`) y los helpers de `tests/helpers/` (`memoryDb.ts`, `tablasMemoria.ts`,
`lugarFalso.ts`, `tenancy.ts`, `clienteFalso.ts`, `authFalso.ts`, `proveedor.ts`). La verificación
visual se hace con `run-indentory`.

**Desvíos al implementar**:

- **Ícono**: Marcas usa `Factory` (nuevo en `components/icons`), no `Tag`, que ya es el de Categorías;
  también en el campo "Marca (opcional)" del alta y la edición.
- **Visualización**: un componente `NombreConMarca` y un hook `useNombreDeMarca`
  (`src/features/marcas/`) leen la marca del store, en vez de pasarla por props a cada tarjeta, fila y
  detalle. El nombre va en su propio `<span>` y el renglón parte línea en vez de usar `truncate`, para
  no cortar marcas largas en el teléfono (verificado con capturas a 360 px).
- **Mensaje de WhatsApp**: `construirMensajePedido` recibe un `marcasPorId` opcional y lee la marca de
  `item.insumo`, en vez de sumar `marca` a `ItemPedido`. Mismo resultado y menos cambios en los
  llamadores.
- **Alta con una marca eliminada en el ínterin**: se guarda sin marca y se avisa con un tipo de aviso
  nuevo, `marca-descartada`, además de `marca-no-eliminada` y `marca-repetida`.
- **`marcasAdmin.ts`** se escribió completo en T032 (incluye lo de T044).
- **`SelectorCatalogo`**: el texto parcial que no coincide exactamente con ninguna marca ofrece
  "Agregar «…»" además de los resultados, igual que proveedores.
- **Pruebas de la 021**: solo cambios mecánicos (tabla `marcas` en los mocks y `marcaId: null` en
  insumos de prueba). La única expectativa que cambió es el orden del índice de Ajustes en
  `ajustes-proveedores` (ahora sigue Marcas, no "Insumos dados de baja").
- **Dexie**: `dexie-v10..13.test.ts` esperan `verno` 14.
- **Línea base**: `enviar-pedido` tuvo un timeout intermitente con la máquina cargada; corrido solo
  pasa, y en la corrida final pasaron las 1087 pruebas.

**Organization**: por historia de spec.md. `R#` = research.md, "SS §n" =
`contracts/supabase-schema.md`, "UI" = `contracts/ui-contracts.md`, "DM" = data-model.md, "QS" =
quickstart.md. Toda la migración va en un solo archivo,
`supabase/migrations/20261025000000_marcas.sql`, así que las tareas que lo tocan son secuenciales (sin
[P]).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

- [X] T001 *(Hecho: lint sin avisos; 1020 pruebas en 131 archivos, 1 timeout intermitente en `enviar-pedido` que pasa solo; `test:rls` OK.)* Confirmar la línea base en la rama `023-marcas`: `npm run lint && npm test` en verde y
  `supabase db reset && npm run test:rls` en verde antes de tocar código. Anotar la cantidad de pruebas
  y archivos para comparar en T052.

---

## Phase 2: Foundational (bloquea todas las historias)

### Servidor (SS §1–§3, R1–R4, R6)

- [X] T002 Crear `supabase/migrations/20261025000000_marcas.sql` (`begin; … commit;`, encabezado
  como el de `20261023000000_proveedores.sql`) con la tabla `marcas` de SS §1: `nombre` 1–60 con
  `btrim`, `clave generated always as (public.clave_nombre(nombre)) stored`, `creado_por uuid` nullable,
  `unique (id, tenant_id)`, el índice único parcial `marcas_clave_por_tenant (tenant_id, clave) where
  eliminado_en is null` y `enable row level security`.
- [X] T003 En la misma migración, las cuatro políticas RLS de SS §1, copiadas de las de `proveedores`
  ("leer del tenant", "crear en el tenant, como sí mismo", "pendiente previo a la desactivación",
  "administrador actualiza"), y la función `proteger_marca()` (`security definer`, `set search_path =
  public`) con su trigger `marcas_proteger before update`. Identidad inmutable, un `eliminado_en` no se
  revierte y `raise exception 'marca_con_insumos' using errcode = 'P0001'` si se elimina con algún
  insumo (`exists (select 1 from insumos i where i.marca_id = old.id)`, sin filtrar dados de baja).
- [X] T004 En la misma migración, `insumos.marca_id` (SS §2): columna nullable, FK
  `insumos_marca_tenant_fkey (marca_id, tenant_id) references marcas (id, tenant_id)` e índice
  `insumos_marca_idx`. Hacer `create or replace function public.proteger_catalogo_insumo()` copiando
  **exactamente** el cuerpo de `20261021000000_unidades_y_costo.sql` (líneas ~71–90) y agregar, fuera
  del `if not es_administrador`, `if coalesce(current_setting('dentdelion.aplicando_marca', true), '')
  <> 'on' then new.marca_id := old.marca_id; end if;` (R3).
- [X] T005 En la misma migración, `cambios_insumo` (SS §3): `drop constraint cambios_insumo_campo_check`
  y recrearlo con la lista actual (`nombre`, `categoria`, `unidadMedida`, `unidadCompra`, `contenido`,
  `stockMinimo`, `codigoFabricante`, `caduca`, `baja`) más `'marcaId'`. Agregar la función
  `aplicar_marca_desde_cambio()` (`security definer`): `set_config('dentdelion.aplicando_marca', 'on',
  true)`; `update insumos set marca_id = (select nullif(c.valor_nuevo #>> '{}', '')::uuid from
  cambios_insumo c where c.insumo_id = new.insumo_id and c.campo = 'marcaId' order by c.creado_en desc,
  c.id desc limit 1) where id = new.insumo_id`; `set_config(…, '', true)`; `return null`. Trigger
  `cambios_insumo_aplicar_marca after insert … for each row when (new.campo = 'marcaId')`.
- [X] T006 Aplicar con `supabase db reset` y comprobar en `psql` que la migración entra sin errores y
  que `\d insumos` muestra `marca_id` con la FK.

### Dexie y tipos (DM, R13)

- [X] T007 En `src/lib/db/index.ts`: interfaz `Marca` (DM, con comentario "Spec 023 data-model.md",
  como `Proveedor`); `Insumo.marcaId: string | null` con comentario; `'marcaId'` en
  `CampoEditableInsumo`; `marcas: EntityTable<Marca, 'id'>` en el tipo de la base; `db.version(14)` con
  `marcas: 'id, tenantId, sincronizado'` e `insumos: 'id, nombre, categoria, codigoFabricante,
  tenantId, marcaId'`, y `upgrade` que hace `insumo.marcaId ??= null`.
- [X] T008 [P] Crear `tests/unit/dexie-v14.test.ts` siguiendo `tests/unit/dexie-v13.test.ts`: una base
  v13 con insumos sin `marcaId` pasa a v14 con `marcaId: null`, la tabla `marcas` existe y vacía, y no
  se pierde ningún insumo.
- [X] T009 [P] Sumar la tabla `marcas` a `tests/helpers/tablasMemoria.ts` y a los mocks de Dexie que
  enumeran tablas (buscar `proveedores` en `tests/` para encontrarlos), y `marcaId: null` a los
  insumos de prueba que lo necesiten para compilar.

### Lógica común (R7, UI "src/lib/catalogo.ts")

- [X] T010 Crear `src/lib/catalogo.ts` con `ItemCatalogo` y las funciones genéricas `ordenarCatalogo`,
  `activosDe`, `desactivadosDe`, `buscarEnCatalogo` y `coincidenciaEn`, moviendo la lógica de
  `src/features/proveedores/lib/proveedores.ts` (usa `plegar` y `claveCategoria` de
  `features/insumos/lib/categorias`).
- [X] T011 Reescribir `ordenarProveedores`, `activos`, `desactivados`, `buscarProveedores` y
  `coincidencia` de `src/features/proveedores/lib/proveedores.ts` como envoltorios de `src/lib/catalogo.ts`,
  sin cambiar firmas ni la forma `{ tipo, proveedor }`. `npx vitest run tests/unit/proveedores` debe
  pasar **sin tocar** las pruebas.
- [X] T012 [P] Crear `tests/unit/catalogo-generico.test.ts`: orden por nombre plegado con desempate por
  id, activos y desactivados excluyen eliminados, búsqueda sin mayúsculas ni tildes, y coincidencia
  activa, desactivada o ninguna por clave.
- [X] T013 Extraer `src/components/ui/SelectorCatalogo.tsx` desde
  `src/features/proveedores/components/SelectorProveedor.tsx` con las props de UI "SelectorCatalogo"
  (`items`, `textos`, `crear`, `reactivar?`, `permitirNinguno?`, `onCambio(id | null)`). Con
  `permitirNinguno`, la primera opción es `textos.ninguno` y elige `null`. Mantener `role="listbox"` y
  `option`, el foco, el teclado y los mensajes.
- [X] T014 Convertir `SelectorProveedor.tsx` en envoltorio de `SelectorCatalogo`, pasándole
  `proveedores`, los textos actuales, `crearProveedor` y `reactivarProveedor`, sin `permitirNinguno`.
  `npx vitest run tests/integration/selector-proveedor.test.tsx
  tests/integration/ajustes-proveedores.test.tsx tests/integration/alta-material.test.tsx
  tests/integration/compras.test.tsx` deben pasar **sin cambios**.

### Store, tenancy y sincronización (SS §4, R5)

- [X] T015 En `src/stores/inventoryStore.ts`: `marcas: Marca[]` (no eliminadas del tenant) por
  `liveQuery`, con la misma suscripción y limpieza que `proveedores`.
- [X] T016 [P] En `src/lib/tenancy/index.ts`: incluir `db.marcas` en la transacción de limpieza y
  borrar las marcas sincronizadas de otro tenant, como `proveedores`. Ampliar
  `tests/unit/tenancyLocal.test.ts` con ese caso.
- [X] T017 En `src/lib/sync/index.ts`: tipo `MarcaRow`, `toMarcaRow` y `fromMarcaRow`;
  `InsumoRow.marca_id?: string | null`, `toInsumoRow` con `marca_id: insumo.marcaId` y
  `fromInsumoRow` con `marcaId: row.marca_id ?? null`.
- [X] T018 En `src/lib/sync/index.ts`: `pushMarcas` (modelo `pushProveedores`: personal insert solo de
  lo suyo, administración upsert; `23505` → `resolverMarcaDuplicada`; `marca_con_insumos` → se da por
  subida y aviso `marca-no-eliminada`; sin permisos → pendiente), `marcarMarcaSubida`,
  `resolverMarcaDuplicada` (por id: renombrado que choca → aviso `marca-repetida`; si no, por clave →
  `remapearMarca`) y `pullMarcas` (`seleccionarTodo('marcas')` con `conservarCambioLocal`). Llamarlas en
  `ejecutarCiclo` justo después de `pullProveedores`, con un comentario "Spec 023: antes de insumos (FK
  de marca_id)".
- [X] T019 En `src/lib/sync/index.ts`: `export async function remapearMarca(localId, delServidor)` en
  una transacción `rw` sobre `insumos`, `cambiosInsumo`, `marcas` y `borradores`. Cambia
  `insumos.marcaId`, `valorNuevo` y `valorAnterior` de los cambios `marcaId` **no sincronizados** y el
  `marcaId` del borrador `alta-material`; borra la local y guarda la del servidor.
- [X] T020 En `pushCambiosInsumo` (`src/lib/sync/index.ts`): excluir de `pendientes` los cambios con
  `campo === 'marcaId'` cuyo `valorNuevo` es el id de una marca local con `sincronizado: false`
  (comentario R5).
- [X] T021 [P] En `src/stores/avisosStore.ts`: tipos `marca-no-eliminada` ("No se pudo eliminar «X»:
  la usan insumos.") y `marca-repetida` ("No se pudo renombrar a «X»: ya existe una marca con ese
  nombre."), con los textos donde se arman los de `proveedor-no-eliminado` y `proveedor-repetido`.
  Ampliar `tests/unit/avisosStore.test.ts`.
- [X] T022 Crear `tests/unit/sync-marcas.test.ts` siguiendo `tests/unit/sync-proveedores.test.ts`.
  Debe cubrir:
  - el orden (marcas antes de lugares e insumos);
  - insert del personal y upsert de administración;
  - `23505` con remapeo de insumo, cambio pendiente y borrador;
  - renombrado que choca, con su aviso;
  - `marca_con_insumos` con su aviso;
  - un cambio `marcaId` retenido mientras su marca no se sube, y que sale en el ciclo siguiente;
  - `marca_id` en `toInsumoRow` y `fromInsumoRow`, con `undefined` leído como `null`.

**Checkpoint**: la base está lista. Servidor, Dexie v14, sincronización y selector genérico, con las
pruebas de la 021 intactas.

---

## Phase 3: User Story 1 - Elegir la marca de un insumo de una lista (Priority: P1) 🎯 MVP

**Goal**: en el alta y en la edición, el campo Marca elige de la lista con buscador o "Sin marca".

**Independent Test**: con tres marcas sembradas en Dexie, dar de alta un material eligiendo "3M",
editar otro y ponerle otra marca, editar un tercero y dejarlo en "Sin marca". Los tres quedan así y
suben con su `marca_id` (QS pasos 3, 5 y 8).

### Tests

- [X] T023 [P] [US1] Crear `tests/unit/marcas/marcas.test.ts`: `nombreDeMarca` (sin marca, eliminada o
  ausente → `null`), `mapaMarcas`, `usosPorMarca` (cuenta los dados de baja) y `marcaParaInsumo`
  (eliminada o inexistente → `null`).
- [X] T024 [P] [US1] Crear `tests/integration/selector-marca.test.tsx`: "Sin marca" como valor inicial
  y primera opción, buscador sin mayúsculas ni tildes, elegir una marca, volver a "Sin marca", una
  desactivada no aparece pero el valor actual desactivado se muestra "«X» (desactivada)", y teclado
  (flechas, Enter, Escape).

### Implementation

- [X] T025 [P] [US1] Crear `src/features/marcas/lib/marcas.ts` (UI "marcas.ts"): `claveMarca`,
  `mapaMarcas`, `nombreDeMarca`, `usosPorMarca` y `marcaParaInsumo`.
- [X] T026 [US1] Crear `src/features/marcas/components/SelectorMarca.tsx`: envoltorio de
  `SelectorCatalogo` con los textos de UI "SelectorMarca", `permitirNinguno`, ítems de
  `useInventoryStore((s) => s.marcas)`, y "«X» (desactivada)" para el valor actual desactivado. Por
  ahora, `crear` llama a `crearMarca` (T032); si T032 todavía no existe, crearlo como stub que lanza
  error.
- [X] T027 [US1] Alta: en `src/features/insumos/lib/alta.ts`, `AltaMaterialInput.marcaId: string | null`.
  `darDeAltaMaterial` guarda `marcaId: await marcaParaInsumo(input.marcaId)` dentro de la transacción
  (sumar `db.marcas` a la transacción) y devuelve si la marca se descartó. En
  `src/features/insumos/lib/useBorradorAlta.ts`, el valor inicial es `marcaId: null` y un borrador sin
  el campo se lee como `null`.
- [X] T028 [US1] En `src/features/insumos/components/AltaMaterialView.tsx`: campo "Marca" (opcional)
  después de Categoría, con `SelectorMarca`, `<label htmlFor>` y ayuda "Opcional". Si la marca se
  descartó al guardar, avisar "La marca elegida ya no existe; el material se guardó sin marca."
- [X] T029 [US1] Edición: en `src/features/insumos/lib/catalogo.ts`, sumar `'marcaId'` a los campos
  editables y a `CambiosInsumoInput`, normalizando `''` → `null`. `editarInsumo` crea el cambio
  `marcaId` solo si difiere. En `src/features/insumos/components/EditarInsumoForm.tsx`, campo "Marca"
  con `SelectorMarca`, inicializado con `insumo.marcaId` y sumado a la detección de "hay cambios".
- [X] T030 [US1] Ajustar las pruebas: en `tests/unit/insumos/alta.test.ts` y
  `tests/integration/alta-material.test.tsx`, alta sin marca (mismos pasos) y con marca; en
  `tests/unit/insumos/catalogo.test.ts`, el cambio `marcaId` (crear, quitar a `null`, sin cambio no
  genera fila); en `tests/integration/acciones-rapidas.test.tsx` (edición), cambiar la marca;
  `tests/unit/insumos/useBorradorAlta.test.tsx`, borrador viejo sin `marcaId`.

**Checkpoint**: US1 funciona sola si las marcas ya están en la base (sembradas en pruebas o creadas por
SQL).

---

## Phase 4: User Story 2 - Agregar una marca nueva sin salir del formulario (Priority: P1)

**Goal**: "Agregar marca «…»" crea la marca, la deja elegida y no duplica por mayúsculas, tildes ni
espacios.

**Independent Test**: en el alta, escribir "Ivoclar" y tocar "Agregar marca «Ivoclar»": queda
elegida, el formulario conserva lo escrito y la marca aparece en el selector y en Dexie con
`sincronizado: false` (QS pasos 4, 13 y 14).

### Tests

- [X] T031 [P] [US2] Crear `tests/unit/marcas/marcasAdmin.test.ts` (parte de creación): `crearMarca`
  de personal y de administración, nombre vacío o solo espacios → `MENSAJE_NOMBRE_VACIO`, `"3m "` frente
  a `"3M"` → devuelve la existente, coincidencia con una desactivada → `MarcaDesactivada`.

### Implementation

- [X] T032 [US2] Crear `src/features/marcas/lib/marcasAdmin.ts` (modelo `proveedoresAdmin.ts`):
  `MENSAJE_NOMBRE_VACIO`, `MENSAJE_NOMBRE_REPETIDO`, `MarcaDesactivada` y `crearMarca({ nombre })`.
  Escribe en Dexie en una transacción, con `id` de `crypto.randomUUID()`, `tenantId` actual,
  `creadoPor` del usuario, `sincronizado: false` y el nombre recortado con los espacios colapsados.
  Agregar `reactivarMarca(id)` (administración, `exigirAdministrador`).
- [X] T033 [US2] Conectar `SelectorMarca.tsx` con `crearMarca` y `reactivarMarca` (quitar el stub de
  T026). Ampliar `tests/integration/selector-marca.test.tsx`: aparece "Agregar marca «texto»" sin
  coincidencia, al agregar queda elegida, `" 3m "` no duplica, coincidencia desactivada muestra el aviso
  con "Reactivar y usar" solo para administración, y el personal también puede agregar.
- [X] T034 [US2] En `tests/integration/alta-material.test.tsx`: agregar una marca desde el alta
  conserva el resto del formulario y el insumo se guarda con esa marca; sin conexión, la marca y el
  insumo quedan pendientes, y `sync-marcas` (T022) cubre que suben en orden.

**Checkpoint**: US1 + US2 cubren el pedido de la clienta en el registro (MVP).

---

## Phase 5: User Story 3 - Ver la marca donde se reconoce el material (Priority: P2)

**Goal**: marca en el detalle, `Nombre · Marca` en Inventario y Compras, búsqueda por marca y renglón
del mensaje de WhatsApp.

**Independent Test**: con "Composite Z350" de 3M: el detalle muestra "Marca: 3M", Inventario y Compras
muestran "Composite Z350 · 3M", buscar "3m" lo encuentra y el mensaje sale con "- Composite Z350 · 3M —
…" (QS pasos 6, 7 y 9).

### Tests

- [X] T035 [P] [US3] Ampliar `tests/unit/compras/pedido.test.ts`: renglón con marca (`- Nombre · Marca
  — cantidad (lugar)`), sin marca igual que hoy, y manual vinculado con marca.
- [X] T036 [P] [US3] Ampliar las pruebas de `searchInsumosPorTexto` (buscar dónde se prueban hoy con
  `grep -rn searchInsumosPorTexto tests`; si no hay, en `tests/integration/inventario.test.tsx`): "3m" y
  "ivoclár" encuentran por marca, y sin mapa se comporta como hoy.

### Implementation

- [X] T037 [US3] En `src/stores/inventoryStore.ts`: `searchInsumosPorTexto(insumos, texto,
  marcasPorId?)` también acepta el insumo si `plegar(nombre de su marca)` contiene `plegar(q)`. El
  nombre del insumo se sigue comparando como hoy. Pasar `mapaMarcas(marcas)` desde
  `src/features/insumos/components/InventarioView.tsx` y `SearchPicker.tsx`.
- [X] T038 [P] [US3] En `src/features/insumos/components/InsumoDetalle.tsx`: fila "Marca" con
  `nombreDeMarca`, solo si no es `null`, junto a los datos del catálogo. Ampliar
  `tests/integration/alertas-detalle.test.tsx` (con marca y sin marca).
- [X] T039 [P] [US3] En `src/features/insumos/components/InsumoCard.tsx` y `InventarioTabla.tsx`: tras
  el nombre, `<span className="text-text-muted"> · {marca}</span>` en el mismo renglón con `truncate`
  (sin cambiar los `aria-label` existentes). Ampliar `tests/integration/inventario.test.tsx` e
  `inventario-tabla.test.tsx`.
- [X] T040 [P] [US3] En `src/features/compras/components/ItemSugeridoCard.tsx` e `ItemManualCard.tsx`
  (solo si está vinculado a un insumo con marca), el mismo `· Marca`. Ampliar
  `tests/integration/compras.test.tsx`.
- [X] T041 [US3] En `src/features/compras/lib/pedido.ts`: `ItemPedido.marca: string | null`, que
  `itemsDelPedido` llena con un `marcasPorId` nuevo como parámetro, y `construirMensajePedido` con
  `${item.nombre}${item.marca ? ` · ${item.marca}` : ''}`. Actualizar los llamadores
  (`EnviarPedidoSheet.tsx`, `ComprasView.tsx` o donde se llame a `itemsDelPedido`) y
  `tests/integration/enviar-pedido.test.tsx`.

**Checkpoint**: la marca se ve y se busca en toda la app.

---

## Phase 6: User Story 4 - Administrar marcas en Ajustes (Priority: P2)

**Goal**: sección Marcas solo para administración: crear, renombrar, desactivar, reactivar y eliminar
sin insumos, con "Ver más".

**Independent Test**: como administración, en Ajustes → Marcas, crear "GC", renombrar "3m" a "3M",
desactivar una y eliminar otra sin insumos. Como personal, la sección no aparece ni por URL (QS pasos
1, 2, 10–12).

### Tests

- [X] T042 [P] [US4] Completar `tests/unit/marcas/marcasAdmin.test.ts`: renombrar (repetido →
  `MENSAJE_NOMBRE_REPETIDO`), desactivar y reactivar, eliminar con insumos (también dados de baja) →
  error y sin insumos → `eliminadoEn`, y personal → `exigirAdministrador` en todas.
- [X] T043 [P] [US4] Crear `tests/integration/ajustes-marcas.test.tsx` siguiendo
  `ajustes-proveedores.test.tsx`: tarjeta y resumen en el índice, lista con "N insumos", crear y
  renombrar en la hoja, desactivar y reactivar desde "Desactivadas (N)", Eliminar solo sin insumos y
  con confirmación, "Ver más" con 26 marcas, y personal sin la tarjeta ni acceso por URL.

### Implementation

- [X] T044 [US4] En `src/features/marcas/lib/marcasAdmin.ts`: `renombrarMarca`, `desactivarMarca` y
  `eliminarMarca` (UI "marcasAdmin.ts"). Todas con `exigirAdministrador` y `sincronizado: false`.
  `eliminarMarca` rechaza si `usosPorMarca > 0` con "No se puede eliminar: la usan N insumos."
- [X] T045 [US4] En `src/features/ajustes/lib/secciones.ts`: `'marcas'` en `IdSeccion` y en la lista,
  entre `proveedores` y `baja`, con título "Marcas", ícono `Tag` de `components/icons` y
  `soloAdministracion: true`; `marcasActivas` en el tipo de resúmenes y su texto ("N marcas" / "1
  marca" / "Sin marcas"). En `src/features/ajustes/lib/useResumenesAjustes.ts`, `marcasActivas:
  inventarioListo ? activosDe(marcas).length : null`.
- [X] T046 [US4] Crear `src/features/ajustes/components/MarcasSection.tsx` (UI "Ajustes", modelo
  `ProveedoresSection.tsx` sin WhatsApp, contacto ni predeterminado), con `useListaPaginada` + `VerMas`
  de a 25, y registrarla en `SeccionAjustesPantalla.tsx` (`{id === 'marcas' && <MarcasSection />}`).
- [X] T047 [US4] Ajustar `tests/integration/ajustes.test.tsx` (orden de tarjetas con Marcas) y las
  pruebas de `secciones` y resúmenes en `tests/unit/ajustes/` si enumeran las secciones.

**Checkpoint**: el catálogo se administra desde Ajustes.

---

## Phase 7: User Story 5 - Convivir con dispositivos que aún no se actualizan (Priority: P2)

**Goal**: ni la 2.5.0 en caché ni un dispositivo recién actualizado borran la marca. Solo el historial
de administración la cambia en un insumo existente (R3).

**Independent Test**: los casos 6–10 de SS §5 en `test:rls`, y QS "Compatibilidad con la 2.5.0".

- [X] T048 [US5] En `scripts/test-rls.mjs`, sección "Spec 023 — marcas" después de la de proveedores,
  casos 1–5 de SS §5: aislamiento entre tenants, permisos de personal, clave repetida, `marca_con_insumos`
  y FK de otro tenant.
- [X] T049 [US5] En `scripts/test-rls.mjs`, casos 6–10 de SS §5. Un upsert del insumo **sin** la clave
  `marca_id` y otro con `marca_id: null` por administración conservan la marca. Un cambio `marcaId` de
  administración la aplica, con dos cambios desordenados gana el de mayor `(creado_en, id)` y uno a
  `null` la quita. Un cambio `marcaId` de personal se rechaza y deja la marca intacta. El alta de
  personal con marca se acepta.
- [X] T050 [US5] Correr `supabase db reset && npm run test:rls` en verde. Si algún caso falla,
  corregir la migración (T004/T005) y anotarlo en "Desvíos al implementar" arriba en este archivo.
- [ ] T051 [US5] *(Pendiente: no se levantó el front 2.5.0 en paralelo. Sus equivalentes automáticos pasan: `test:rls` casos 6–7 (2.5.0 sin `marca_id` y fila desfasada con `null`) y `sync-marcas` ("una fila desfasada con marca_id null no borra la marca").)* Recorrido QS "Compatibilidad con la 2.5.0" (pasos 1–4) con el front de `main` en un
  puerto y el de la rama en otro, contra el Supabase local. Anotar el resultado en este archivo.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T052 *(Hecho: lint sin avisos, 1087 pruebas en 139 archivos, build OK.)* `npm run lint && npm test && npm run build` en verde. Comparar con la línea base de T001:
  las pruebas de la 021 deben pasar sin modificaciones.
- [X] T053 [P] *(Hecho, como administración: Ajustes → Marcas, selector en el alta y la edición, Inventario en tarjeta y tabla, búsqueda por marca y detalle, a 360 × 640, 768 × 1024 y 1440 × 900. Compras y personal quedan cubiertos por pruebas de integración.)* Recorrido manual QS (pasos 1–14) con el skill `run-indentory`, con capturas en teléfono
  360 × 640, tablet y desktop de: selector de marca, alta, Inventario con `· Marca`, detalle, Compras y
  Ajustes → Marcas (SC-008). Controles ≥ 48 px (Constitución III).
- [X] T054 [P] Documentación: en `../1stDocs/005-roadmap/002-DentdeLion.md`, estado de la 023 a "en
  revisión" con las decisiones de Clarifications; nota de despliegue "servidor antes que el front" en
  el lugar donde están las de 018–022.
- [X] T055 Revisar `specs/023-marcas/` contra lo implementado y completar "Desvíos al implementar"
  en este archivo.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001. T002–T006 son secuenciales (un solo archivo). T007
  antes de T008, T009 y T015–T020. T010 → T011 → T013 → T014. T017 → T018 → T019 → T020 → T022.
- **US1 (Phase 3)**: depende de toda la Phase 2.
- **US2 (Phase 4)**: depende de US1 (T026 usa `crearMarca`; T033 reemplaza el stub).
- **US3 (Phase 5)**: depende de Phase 2 y de T025 (`marcas.ts`). Puede ir en paralelo con US2 y US4.
- **US4 (Phase 6)**: depende de Phase 2, T025 y T032. Puede ir en paralelo con US3.
- **US5 (Phase 7)**: depende de T002–T006 (servidor). T051 depende además de US1 (para poner marcas
  desde el front nuevo).
- **Polish (Phase 8)**: al final.

### User Story Dependencies

- US1 → US2 (el selector se completa con "Agregar").
- US3, US4 y US5 son independientes entre sí una vez lista la base.

### Parallel Opportunities

- Phase 2: T008, T009, T012, T016 y T021 en paralelo después de T007 y T010.
- US1: T023, T024 y T025 en paralelo.
- US3: T035, T036, T038, T039 y T040 en paralelo (archivos distintos).
- US4: T042 y T043 en paralelo; T045 en paralelo con T044.
- US5 (servidor) puede avanzar en paralelo con US1–US4 (front).

---

## Parallel Example: User Story 3

```text
T038 InsumoDetalle.tsx + alertas-detalle.test.tsx
T039 InsumoCard.tsx, InventarioTabla.tsx + inventario*.test.tsx
T040 ItemSugeridoCard.tsx, ItemManualCard.tsx + compras.test.tsx
T035 pedido.test.ts           (luego T041 pedido.ts)
T036 búsqueda por marca       (luego T037 inventoryStore.ts)
```

## Parallel Example: Foundational

```text
Tras T007 (Dexie) y T010 (catalogo.ts):
T008 dexie-v14.test.ts
T009 tablasMemoria y mocks
T012 catalogo-generico.test.ts
T016 tenancy + tenancyLocal.test.ts
T021 avisosStore + avisosStore.test.ts
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 y Phase 2 (servidor, Dexie, sincronización y selector genérico con la 021 intacta).
2. US1 (elegir) y US2 (agregar): el pedido de la clienta en el registro.
3. **Validar**: QS pasos 3–5, 13 y 14, y `test:rls` casos 1–5.

### Incremental Delivery

1. Base + US1 + US2 → MVP (la marca se elige y se crea).
2. US5 → condición para publicar (convivencia con la 2.5.0, R3).
3. US3 → la marca se ve, se busca y sale en el pedido.
4. US4 → la clienta ordena el catálogo en Ajustes.
5. Polish → capturas, documentación y release 2.6.0.

### Nota de publicación

La migración se despliega **antes** que el front (FR-022, R14). T049–T051 en verde son condición para
mergear. Si el front falla en producción, se revierte solo el front: la 2.5.0 convive con el servidor
nuevo.
