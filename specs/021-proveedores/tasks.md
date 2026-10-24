---

description: "Task list for 021-proveedores"
---

# Tasks: Proveedores

**Input**: Design documents from `/specs/021-proveedores/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. plan.md (Testing), `contracts/ui-contracts.md` (tabla "Pruebas") y
`contracts/supabase-schema.md` §7 (`test:rls`) las definen. Patrón del proyecto: Vitest + RTL con
`fireEvent` (no hay `user-event`), helpers de `tests/helpers/` (`memoryDb.ts`, `tablasMemoria.ts`,
`lugarFalso.ts`, `tenancy.ts`, `clienteFalso.ts`, `authFalso.ts`). Verificación visual con
`run-indentory`.

**Desvíos al implementar**:

- `proveedores.creado_por` admite `null` (migración sin autor conocido, o lote subido por la service
  role). La protección de `proteger_lote` sobre `proveedor_id`/`proveedor` aplica solo cuando escribe
  un usuario (`auth.uid()`), para que `proveedores.mjs fusionar` pueda mover lotes.
- `resolver_proveedor_lote` ignora los lotes cuyo id ya existe: un upsert dispara los `before insert`
  aunque termine en UPDATE, y una 2.4.0 que resube sus lotes con el texto viejo tras un renombrado
  creaba un proveedor (R4, ajuste).
- Un `23505` de un proveedor que el servidor ya tiene (renombrado que choca con otro) no se remapea: se
  descarta y avisa con el tipo nuevo `proveedor-repetido` (R6, ajuste; lo encontró `sync-proveedores`).
- Los formularios usan "lo elegido, o si no el predeterminado" (`usePredeterminado`) en vez de
  `proveedorTocado`: el campo sigue al lugar y a los cambios que llegan por sincronización, y el
  borrador no congela el predeterminado.
- `BottomSheet`: con una hoja encima de otra (selector dentro de "Recibir"), Escape cierra solo la de
  arriba.
- `memoryDb` de pruebas: `count()` y `modify()` en `where`/`filter`/`toCollection`.
- `scripts/proveedores.mjs` trae `listar` y `fusionar` desde T002; ensayo local con
  `scripts/sql/ensayo-proveedores.sql` (quickstart, "Ensayo local de la migración").
- El detalle conserva el formato de fecha actual (`vence 2027-03-01`); solo se agregó el proveedor.

**Organization**: por historia de spec.md. `R#` = research.md, "SS §n" = `contracts/supabase-schema.md`,
"UI" = `contracts/ui-contracts.md`, "DM" = data-model.md, "QS" = quickstart.md. Toda la migración va
en un solo archivo, `supabase/migrations/20261023000000_proveedores.sql`; las tareas que lo tocan
son secuenciales (sin [P]).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

- [X] T001 *(Hecho: lint sin avisos, 896 pruebas en 118 archivos; `test:rls` OK.)* Confirmar la línea base en la rama `021-proveedores`: `npm run lint && npm test` en verde y
  `supabase db reset && npm run test:rls` en verde antes de tocar código; anotar el número de pruebas y
  archivos para comparar en T048.
- [X] T002 [P] Crear `scripts/proveedores.mjs` con el subcomando `listar` (R5), con el mismo patrón de
  conexión de servicio que `scripts/alta-tenant.mjs` (URL y service role por variables de entorno,
  `parseArgs`). Debe imprimir por tenant cada texto distinto de `lotes.proveedor`, su clave (misma regla que
  `claveCategoria`: trim, sin tildes, minúsculas, espacios colapsados) y cuántos lotes lo usan,
  agrupados por clave para que se vean las variantes juntas. Salida legible y `--json` opcional.
  Funciona **antes** de la migración, porque solo lee `lotes`.

---

## Phase 2: Foundational

**Purpose**: esquema del servidor, Dexie v13, sincronización y lógica común que usan todas las
historias. Bloquea todo lo demás.

### Servidor

- [X] T003 Crear `supabase/migrations/20261023000000_proveedores.sql` (`begin; … commit;`) con
  `public.clave_nombre(texto text) returns text language sql immutable parallel safe` (SS §1:
  `regexp_replace(lower(translate(trim(texto), 'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÂÊÎÔÛâêîôûÄËÏÖäëïöÇç',
  'AEIOUUNaeiouunAEIOUaeiouAEIOUaeiouAEIOaeioCc'), '\s+', ' ', 'g')`; verificar que ambas cadenas
  tengan el mismo largo). Agregar la tabla `public.proveedores` con columnas, checks, `clave`
  generada, `unique (id, tenant_id)` e índice único parcial `proveedores_clave_por_tenant` (SS §2,
  DM "Proveedor"), y `enable row level security`.
- [X] T004 En la misma migración: políticas RLS de `proveedores` (SS §2, tabla "Políticas"), con
  SELECT del tenant, INSERT como uno mismo, INSERT pendiente previo a la desactivación y UPDATE solo
  administración, sin DELETE. Agregar el trigger `before update` `proveedores_proteger` →
  `proteger_proveedor()` (`security definer`, `set search_path = public`): fija `tenant_id`,
  `creado_por` y `creado_en` de `old`; lanza `raise exception 'proveedor_con_lotes'` si se elimina con
  lotes; al desactivar o eliminar, pone `lugares.proveedor_predeterminado_id = null` donde apuntaba
  a él.
- [X] T005 En la misma migración: `lugares.proveedor_predeterminado_id` con FK compuesta `on delete set
  null (proveedor_predeterminado_id)` y trigger `before insert or update` que lo anula si el
  proveedor está desactivado o eliminado (SS §3). Agregar `lotes.proveedor_id` con FK compuesta e
  índice `lotes_proveedor_idx` (SS §4). Ampliar `public.proteger_lote()` (`create or replace`,
  copiando el cuerpo actual de `20261021000000_unidades_y_costo.sql`) para que en UPDATE haga
  `new.proveedor_id := coalesce(old.proveedor_id, new.proveedor_id)` y `new.proveedor :=
  old.proveedor` (R3).
- [X] T006 En la misma migración, retirar `configuracion_clinica` (R12):
  `drop table public.configuracion_clinica;`. Confirmar con `grep -rn configuracion_clinica supabase/
  src/` que ninguna función o vista la usa.
- [X] T007 Actualizar `scripts/test-rls.mjs`: quitar los casos de `configuracion_clinica` (hoy cerca
  de las líneas 95 y 253–257) y agregar los casos de SS §7 sobre proveedores, salvo los del trigger de
  la 2.4.0 (van en T041) y los de datos existentes (T030): crear como personal, editar solo
  administración, aislamiento entre tenants (lectura, `whatsapp`/`contacto`, insert con tenant ajeno,
  lote y predeterminado con un proveedor ajeno), duplicado por clave (`23505`), el mismo nombre en dos
  tenants, upsert de un lote existente con `proveedor_id: null` u otro texto sin cambios, eliminar
  con y sin lotes, desactivar limpia el predeterminado, y la paridad de `clave_nombre` (llamando a
  `select clave_nombre(...)` vía RPC o comparando la columna `clave` de filas creadas). Correr
  `supabase db reset && npm run test:rls`.

### Dexie y tipos

- [X] T008 En `src/lib/db/index.ts`: interfaz `Proveedor` (DM: `id`, `tenantId`, `nombre`,
  `whatsapp`, `contacto`, `creadoPor`, `creadoEn`, `desactivadoEn`, `eliminadoEn`, `sincronizado`);
  `Lote.proveedorId: string | null` con comentario (R3, R11); `Lugar.proveedorPredeterminadoId:
  string | null`. Agregar `proveedores: EntityTable<Proveedor, 'id'>`, quitar `configuracionClinica`
  y la interfaz `ConfiguracionClinica` del tipo de `db` (las versiones 7–10 la siguen declarando por
  nombre de tabla). En `db.version(13)` (DM "Dexie v13"): `proveedores: 'id, tenantId,
  sincronizado'`, `lotes` con el índice `proveedorId` agregado al string de la v10,
  `configuracionClinica: null`, y `upgrade` que pone `proveedorId ??= null` en lotes y
  `proveedorPredeterminadoId ??= null` en lugares. Las upgrades v9/v10 que leen
  `configuracionClinica` siguen usando `tx.table('configuracionClinica')` con un tipo local
  `{ nombre: string | null }`.
- [X] T009 [P] Escribir `tests/unit/dexie-v13.test.ts` siguiendo `tests/unit/dexie-v12.test.ts`:
  abrir una base v12 con lotes, lugares y una fila `configuracionClinica`, actualizar a v13 y
  comprobar `proveedorId === null`, `proveedorPredeterminadoId === null`, que la tabla
  `configuracionClinica` ya no existe, que `proveedores` está vacía e indexada por `tenantId`, y que
  `db.lotes.where('proveedorId')` funciona.
- [X] T010 Quitar `configuracionClinica` de `src/lib/tenancy/index.ts` (lista de tablas de la
  transacción, cerca de la línea 90, y el bucle de la línea 177) y agregar `db.proveedores` a la
  limpieza de filas ajenas ya sincronizadas (mismo criterio `sincronizadoAjeno` que `lugares`).
  Actualizar `tests/helpers/tablasMemoria.ts` y los mocks de `tests/unit/sync-*.test.ts`,
  `tests/unit/insumos/alta.test.ts` y `tests/unit/compras/recepcion.test.ts`: agregar `proveedores`
  y quitar `configuracionClinica`. No tocar `dexie-v10/11/12.test.ts`, que declaran el esquema
  viejo. Actualizar el comentario de `tests/unit/sync-configuracion-bandera.test.ts`.

### Lógica común

- [X] T011 [P] Crear `src/features/proveedores/lib/proveedores.ts` (UI "proveedores.ts"):
  `claveNombre` (reexporta `claveCategoria` de `src/features/insumos/lib/categorias.ts`),
  `ordenarProveedores` (por `plegar(nombre)`, desempate por `id`), `activos`, `buscarProveedores`,
  `coincidencia`, `predeterminadoDe` y `nombreDelLote`.
- [X] T012 [P] Escribir `tests/unit/proveedores/proveedores.test.ts`: paridad de claves de R1 ("Dental
  Sur", " dental  sur", "DENTAL SÚR" → `dental sur`; "Peña" y "Pena" → `pena`); orden alfabético
  sin distinguir tildes; `buscarProveedores` excluye desactivados y eliminados; `coincidencia` →
  activo, desactivado o ninguna (ignora eliminados); `predeterminadoDe` → `null` si el
  predeterminado está desactivado o no existe; `nombreDelLote` por id y, si no, el texto del lote.
- [X] T013 Agregar `proveedores: Proveedor[]` a `src/stores/inventoryStore.ts`: `liveQuery` de las
  filas del tenant sin `eliminadoEn`, con la misma suscripción, `unsubscribe` y estado inicial que
  `categorias`.

### Sincronización

- [X] T014 En `src/lib/sync/index.ts`: `ProveedorRow`, `toProveedorRow` (sin `clave`) y
  `fromProveedorRow`; `LoteRow.proveedor_id` (`toLoteRow` lo omite si es `null`; `fromLoteRow` →
  `proveedorId ?? null`); `LugarRow.proveedor_predeterminado_id` en `toLugarRow`/`fromLugarRow`.
- [X] T015 En `src/lib/sync/index.ts` (SS §8, R6): `pushProveedores` sube las filas del tenant con
  `sincronizado: false`, con `upsert` por fila para administración e `insert` para el resto. Si el
  error es `23505`, buscar en el servidor `proveedores` con `.eq('clave', claveNombre(nombre))` y
  `.is('eliminado_en', null)` y llamar a `remapearProveedor(localId, fila)`. Si es un rechazo de
  permisos (`esRechazoDePermisos`), la fila queda pendiente. Si el mensaje contiene
  `proveedor_con_lotes`, marcar `sincronizado: true` (el pull trae el estado real) y avisar con
  `proveedor-no-eliminado` (T037). Cualquier otro error va a `ciclo.registrar('push proveedores', …)`.
  Tras subir, marcar `sincronizado: true` solo si la fila local no cambió (`mismaFila`, como
  `pushLugares`). `remapearProveedor` corre en una transacción sobre `lotes`, `lugares`,
  `proveedores` y `borradores`: reemplaza el id local por el del servidor en `proveedorId`,
  `proveedorPredeterminadoId` y el borrador del alta, borra la fila local y guarda la del servidor.
  `pullProveedores` usa `seleccionarTodo(client, 'proveedores')` y respeta `conservarCambioLocal`.
  En `ejecutarCiclo`, llamar a `pushProveedores` y `pullProveedores` justo después de
  `validarSesion` y antes de `pushLugares`; actualizar el comentario del orden.
- [X] T016 [P] Escribir `tests/unit/sync-proveedores.test.ts` siguiendo
  `tests/unit/sync-categorias.test.ts` y `clienteFalso.ts`. Debe cubrir: el orden del ciclo
  (proveedores antes de lugares y de lotes); `insert` para personal y `upsert` para administración;
  que un `23505` remapea lotes, predeterminado y borrador al id del servidor y borra la fila local;
  que un rechazo de permisos deja la fila pendiente y el pull la pisa para personal; que un
  `proveedor_con_lotes` deja la fila sincronizada y agrega el aviso; que `toLoteRow` omite
  `proveedor_id: null` y que el pull trae `proveedor_id`; y que el pull no pisa un cambio local
  pendiente de administración.

**Checkpoint**: `npm test`, `npm run test:rls` y `npm run build` en verde; las historias pueden
empezar.

---

## Phase 3: User Story 1 - Elegir el proveedor de una lista al registrar (Priority: P1) 🎯 MVP

**Goal**: el alta de material y la recepción de compras eligen el proveedor de una lista con
buscador, con el predeterminado del lugar ya elegido.

**Independent Test**: con tres proveedores y uno predeterminado del lugar activo (sembrados en Dexie
en la prueba), el alta con stock inicial se guarda sin tocar Proveedor y el lote queda con
`proveedorId` y `proveedor` = nombre; elegir otro con el buscador también funciona (US1 escenarios
1–5).

- [X] T017 [US1] Crear `src/features/proveedores/components/SelectorProveedor.tsx` (UI
  "SelectorProveedor", R8), sin la opción "Agregar" (la suma T025). El campo es un botón de 48 px con
  `aria-haspopup="dialog"`, el nombre elegido o "Elige un proveedor", y acepta
  `invalido`/`describedBy`. Abre un `BottomSheet` "Proveedor" con `input type="search"` enfocado
  ("Buscar proveedor") y un `role="listbox"` de activos ordenados y filtrados con
  `buscarProveedores`, en opciones de 48 px con `aria-selected` y check. Teclado: flechas, Enter y
  Escape. Si el valor es un proveedor desactivado, lo sigue mostrando en el campo. Lee los
  proveedores de `inventoryStore`.
- [X] T018 [US1] En `src/features/insumos/lib/alta.ts` y `src/features/insumos/lib/useBorradorAlta.ts`:
  `lote.proveedor` → `lote.proveedorId: string | null`. La validación con stock inicial > 0 exige
  `proveedorId` (`errores.proveedor = 'Ingresa el proveedor.'`). `darDeAltaMaterial` guarda el lote
  con `proveedorId` y `proveedor` = nombre actual (leído de `db.proveedores` en la misma
  transacción; si no existe, error de validación). Al cargar un borrador viejo con `lote.proveedor`
  texto, resolverlo con `coincidencia` (activo → id; si no, `null`).
- [X] T019 [US1] En `src/features/insumos/components/AltaMaterialView.tsx`: reemplazar el input de
  texto por `SelectorProveedor` (mismo `id` `alta-lote-proveedor`, mismo `ErrorCampo`, y foco del
  primer error en el botón). El valor inicial es `predeterminadoDe(lugar del registro)`, y se
  recalcula al cambiar el lugar mientras la persona no haya elegido a mano (`proveedorTocado`).
- [X] T020 [US1] En `src/features/compras/lib/recepcion.ts` y
  `src/features/compras/components/RecibirItemForm.tsx`: `proveedor` → `proveedorId`, con el valor
  inicial `predeterminadoDe` del lugar del ítem, la misma validación y mensaje, y el lote guardado
  con `proveedorId` y el nombre.
- [X] T021 [P] [US1] Escribir `tests/integration/selector-proveedor.test.tsx` (parte de US1): el
  predeterminado viene elegido; abrir, filtrar "sur" (sin tildes ni mayúsculas) y elegir; los
  desactivados no aparecen; teclado (flechas, Enter, Escape no cambia); sin predeterminado el campo
  dice "Elige un proveedor".
- [X] T022 [US1] Ajustar `tests/unit/insumos/alta.test.ts`, `tests/unit/compras/recepcion.test.ts`,
  `tests/integration/alta-material.test.tsx` y `tests/integration/compras.test.tsx`: sembrar
  proveedores y, donde hoy se escribe en "Proveedor" (`compras.test.tsx` líneas ~251–406), elegir con
  el selector; esperar `proveedorId` y `proveedor` en el lote; "Ingresa el proveedor." cuando falta;
  el borrador viejo con texto se resuelve. Mantener los lotes de fixtures con `proveedor: 'P'` y
  agregarles `proveedorId: null` donde el tipo lo exija.
- [X] T023 [US1] En `src/features/insumos/components/InsumoDetalle.tsx` (R11, FR-014): cada lote dice
  `Lote {numeroLote} · {nombreDelLote(lote, mapa)} — vence …`, con el mapa por id armado desde
  `inventoryStore.proveedores`. Ajustar `tests/integration/alertas-detalle.test.tsx` (o el test del
  detalle que ya verifica el renglón del lote) para esperar el proveedor y el respaldo en el texto
  cuando `proveedorId` es `null`.

**Checkpoint**: registrar con el predeterminado sin escribir (SC-001); el detalle muestra el
proveedor.

---

## Phase 4: User Story 2 - Agregar un proveedor nuevo sin salir del registro (Priority: P1)

**Goal**: desde el selector, cualquier miembro agrega un proveedor y queda elegido, sin duplicados.

**Independent Test**: escribir un nombre nuevo → "Agregar proveedor «…»" → queda elegido, el
formulario conserva lo escrito, el lote se guarda y el proveedor aparece en el selector siguiente;
" dental  súr" elige "Dental Sur" existente (US2 escenarios 1–5).

- [X] T024 [US2] Crear `src/features/proveedores/lib/proveedoresAdmin.ts` con `crearProveedor(datos,
  { estricto? })` (UI): valida el nombre (1–60 caracteres tras `trim`: "Escribe el nombre del
  proveedor."). Con una coincidencia activa, devuelve la existente, o lanza "Ya existe un proveedor
  con ese nombre." si es `estricto`. Con una desactivada, lanza un error tipado `ProveedorDesactivado`
  con el proveedor. Si no, crea la fila con `tenantActualOFallar()`, `creadoPor` = usuario actual,
  `sincronizado: false` y `whatsapp`/`contacto` normalizados (T032 los agrega; mientras tanto,
  `null`). Funciona para personal.
- [X] T025 [US2] En `SelectorProveedor.tsx`: cuando `coincidencia(texto)` es `ninguna` y hay texto,
  mostrar la última opción "Agregar proveedor «texto»" → `crearProveedor`, elegir y cerrar. Si es
  `activo`, la lista ya la muestra (no se ofrece agregar). Si es `desactivado`, mostrar "«X» está
  desactivado." y, solo para administración, "Reactivar y usar" (`reactivarProveedor` de T034, y
  hasta entonces el botón queda oculto detrás de una prop). Con el catálogo y el buscador vacíos, el
  texto es "Todavía no hay proveedores. Escribe el nombre para agregar uno."
- [X] T026 [P] [US2] Escribir `tests/unit/proveedores/proveedoresAdmin.test.ts` (parte de crear):
  personal y administración crean; la coincidencia activa devuelve la existente; `estricto` lanza;
  el desactivado lanza `ProveedorDesactivado`; nombre vacío o de solo espacios lanza; `sincronizado`
  `false` y `creadoPor` correcto.
- [X] T027 [US2] Ampliar `tests/integration/selector-proveedor.test.tsx`: agregar desde el alta
  conserva los demás campos y deja el proveedor elegido; " dental  súr" no crea otro; el aviso de
  desactivado (sin "Reactivar y usar" para personal); catálogo vacío.

**Checkpoint**: US1 + US2 cubren el pedido central de la clienta, sin conexión incluido (sync en T015).

---

## Phase 5: User Story 4 - Los lotes ya registrados quedan con su proveedor (Priority: P1)

**Goal**: la actualización crea un proveedor por nombre distinto, asocia todos los lotes y permite
aplicar las fusiones que decida la clienta.

**Independent Test**: sobre una base con lotes de textos variados en dos tenants, `supabase db reset`
deja cada lote con su proveedor, las variantes unidas, la misma cantidad de lotes y nada cruzado
entre tenants; `fusionar` une los que diga la lista (US4 escenarios 1–4).

- [X] T028 [US4] En la migración (después de T005 y antes de T006), sección "Datos existentes" (SS §5,
  DM "Migración de datos"): `insert into proveedores` por `(tenant_id, clave_nombre(proveedor))`. El
  nombre es el texto recortado más frecuente (desempate: el lote más antiguo), o "Sin proveedor" si
  la clave es vacía. `creado_por` es el `usuario_id` del movimiento `ingreso` del lote más antiguo
  (si no hay, el administrador más antiguo del tenant) y `creado_en` es la fecha de ese lote. Luego
  `update lotes set proveedor_id …` y un bloque `do $$` que cuenta los lotes antes y después y lanza
  una excepción si hay alguno sin `proveedor_id`. Ojo: deshabilitar el trigger de resolución (T040)
  no hace falta, porque es `before insert`.
- [X] T029 [US4] Agregar a `scripts/proveedores.mjs` el subcomando `fusionar --tenant <id> --a
  "<nombre final>" --de "<nombre>" [--de …] [--ensayo]` (R5). Busca por `clave` en el tenant; si
  `--a` no existe, renombra el primer `--de`. Mueve `lotes.proveedor_id` y
  `lugares.proveedor_predeterminado_id` de cada `--de` al `--a`, y marca los `--de` con
  `eliminado_en`. Usa el service role, que pasa por alto RLS: los lotes ya movidos dejan que el
  trigger acepte la baja. Es idempotente; `--ensayo` imprime los cambios sin escribir.
- [X] T030 [US4] Agregar a `scripts/test-rls.mjs` una verificación de la migración de datos: los
  lotes sembrados antes con textos variantes ("Dental Sur", "dental sur ") quedan en un solo proveedor
  por tenant, y ningún lote queda sin `proveedor_id`. Si `test-rls.mjs` siembra después de las
  migraciones, agregar la siembra de lotes variantes a `supabase/seed.sql` (si existe) o a un
  `supabase/tests/` propio, y documentarlo en QS "Pruebas automáticas".
- [ ] T031 [US4] *(Parcial: ensayo local con `scripts/sql/ensayo-proveedores.sql` — 7 lotes, variantes unidas, `fusionar` idempotente; falta sobre la restauración del respaldo de producción.)* Ensayo local de QS "Publicación" pasos 1–2 con un volcado de prueba (o con la
  restauración del respaldo de producción, si está disponible): `listar` → migración → `fusionar
  --ensayo` → `fusionar`. Anotar en `quickstart.md` cualquier ajuste del procedimiento.

**Checkpoint**: la migración es segura de aplicar; la lista para la clienta está lista (FR-017).

---

## Phase 6: User Story 3 - Administrar proveedores en Ajustes (Priority: P2)

**Goal**: sección Proveedores, solo para administración, para crear, editar, fijar el predeterminado
por lugar, desactivar o reactivar y eliminar sin lotes.

**Independent Test**: como administración, crear con WhatsApp y contacto, marcar predeterminado,
renombrar, desactivar uno, reactivarlo y eliminar uno sin lotes; como personal, la sección no existe
ni por URL (US3 escenarios 1–8).

- [X] T032 [P] [US3] Crear `src/features/proveedores/lib/whatsapp.ts` (R10): `normalizarWhatsapp` y
  `formatearWhatsapp` (UI). Usarlos en `crearProveedor` (T024).
- [X] T033 [P] [US3] Escribir `tests/unit/proveedores/whatsapp.test.ts`: "9 1234 5678" →
  `56912345678`; "+56 9 1234-5678" → `56912345678`; "56912345678" se queda igual; "+54 11
  1234 5678" → `541112345678`; vacío → `null`; "123" → inválido; formato "+56 9 1234 5678" y
  "+541112345678".
- [X] T034 [US3] Completar `proveedoresAdmin.ts`: `editarProveedor`, `desactivarProveedor` (limpia
  `proveedorPredeterminadoId` de los lugares locales en la misma transacción y los marca
  `sincronizado: false`), `reactivarProveedor`, `eliminarProveedor` (lanza si
  `db.lotes.where('proveedorId').equals(id).count() > 0`; pone `eliminadoEn`) y
  `fijarPredeterminado(lugarId, proveedorId | null)`. Todos con `exigirAdministrador` y
  `sincronizado: false`; editar valida el nombre con `estricto` (excluyendo al mismo proveedor).
  Habilitar "Reactivar y usar" en `SelectorProveedor` (T025).
- [X] T035 [US3] Agregar `'proveedores'` a `IdSeccion` y a `SECCIONES_AJUSTES` en
  `src/features/ajustes/lib/secciones.ts`, entre `categorias` y `baja` (título "Proveedores", ícono
  `Truck`, `soloAdministracion: true`), y quitar el comentario "La spec 021 agrega…". Agregar el
  resumen en `src/features/ajustes/lib/useResumenesAjustes.ts` ("N proveedores", "1 proveedor",
  "Sin proveedores").
- [X] T036 [US3] Crear `src/features/ajustes/components/ProveedoresSection.tsx` (UI
  "ProveedoresSection", R9) y registrarla donde `SeccionAjustesPantalla.tsx` elige el componente de
  cada sección. Incluye "Agregar proveedor"; la lista de activos con `useListaPaginada` + `VerMas`;
  filas con el nombre, WhatsApp formateado, el contacto e insignias "Predeterminado" (con el nombre
  del lugar si hay más de un lugar activo); y una hoja de nuevo/editar con Nombre, WhatsApp
  (`inputmode="tel"`, ayuda "Con o sin +56"), Contacto y "Predeterminado en" con un `Switch` por
  lugar activo. La hoja tiene Guardar, Desactivar o Reactivar, y Eliminar con confirmación, este
  último solo sin lotes. Al final, "Desactivados (N)" plegable con "Reactivar". Errores de validación
  junto al campo; todo ≥ 48 px.
- [X] T037 [P] [US3] Agregar el tipo de aviso `proveedor-no-eliminado` a `src/stores/avisosStore.ts`
  y su texto "No se pudo eliminar «X»: tiene lotes registrados." donde se muestran los avisos (mismo
  lugar que `categoria-rechazada`).
- [X] T038 [P] [US3] Ampliar `tests/unit/proveedores/proveedoresAdmin.test.ts`: personal no puede
  editar, desactivar, eliminar ni fijar el predeterminado; desactivar limpia los predeterminados;
  eliminar con lotes lanza y sin lotes pone `eliminadoEn`; renombrar a un nombre existente lanza;
  fijar el predeterminado de un lugar reemplaza el anterior solo en ese lugar.
- [X] T039 [US3] Escribir `tests/integration/ajustes-proveedores.test.tsx` y ajustar
  `tests/integration/ajustes.test.tsx`. El índice muestra la tarjeta entre Categorías e Insumos dados
  de baja con su resumen. La prueba cubre crear con WhatsApp ("+56 9 1234 5678" visible), el
  duplicado con aviso, renombrar (el detalle de un insumo muestra el nombre nuevo, US3-4), el
  predeterminado con dos lugares, desactivar (sale del selector y del predeterminado) y reactivar,
  eliminar sin lotes, sin "Eliminar" con lotes, y "Ver más" con 30 proveedores. Personal no ve la
  sección, tampoco entrando por la URL de la sección.

**Checkpoint**: catálogo administrable; SC-001 depende de que haya un predeterminado.

---

## Phase 7: User Story 5 - Convivir con dispositivos que aún no se actualizan (Priority: P2)

**Goal**: los lotes que suben las 2.4.0 en caché (solo texto) quedan asociados al proveedor correcto.

**Independent Test**: con la migración aplicada, insertar por REST un lote sin `proveedor_id` con un
nombre conocido en otras mayúsculas, uno nuevo y uno de un desactivado: quedan con el existente, uno
nuevo y el desactivado sin reactivar (US5 escenarios 1–3).

- [X] T040 [US5] En la migración, antes de la sección de datos (T028): agregar `public.resolver_proveedor_lote()`
  (`security definer`, `set search_path = public`) y el trigger `before insert` en `lotes` (SS §4). Si
  `proveedor_id` es nulo, buscar por `clave_nombre` entre los no eliminados del tenant; si no hay,
  `insert … on conflict do nothing` y volver a buscar ("Sin proveedor" si el texto está vacío). Si
  viene `proveedor_id` con texto vacío, completar el texto. Confirmar que corre después de
  `lugar_por_defecto`, que tiene el `tenant_id` resuelto por el default y que no interfiere con
  `lotes_proteger`.
- [X] T041 [US5] Agregar a `scripts/test-rls.mjs` los casos de la 2.4.0 de SS §7: un texto conocido
  con otras mayúsculas usa el existente; un texto nuevo lo crea con `creado_por` = quien inserta;
  un desactivado se usa sin reactivarlo; y dos inserts simultáneos con el mismo texto nuevo dejan un
  solo proveedor. Correr `supabase db reset && npm run test:rls`.
- [ ] T042 [US5] *(Pendiente: los casos de la 2.4.0 están cubiertos por `test:rls` con la forma REST de esa versión; falta el recorrido manual con su front.)* Prueba manual de QS "Compatibilidad con la 2.4.0": servir el front de `main` contra
  el Supabase local migrado, registrar dos lotes, abrir el front nuevo y confirmar el proveedor de
  cada uno; la 2.4.0 sigue en "Sincronizado".

**Checkpoint**: publicación segura con dispositivos mixtos.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T043 [P] Verificar `run-indentory` en teléfono 360 × 640, tablet y desktop (QS "Recorrido
  manual" pasos 1–10). Capturas del selector (con teclado abierto en el teléfono), la sección, la
  hoja de edición y el detalle con el proveedor; nada desborda y los objetivos miden ≥ 48 px.
- [ ] T044 [P] *(Pendiente: cubierto por `sync-proveedores.test.ts`; falta el recorrido manual en dos navegadores.)* Recorrido sin conexión y duplicado en dos navegadores (QS pasos 11–12).
- [X] T045 [P] Agregar `npm run proveedores` (`node scripts/proveedores.mjs`) a `package.json`, con
  el uso documentado en el encabezado del script.
- [X] T046 Revisar la constitución (plan.md, "Constitution Check") contra lo implementado: la escritura
  local va primero en todos los cambios, la sincronización no bloquea y no hay cámara en los
  formularios.
- [X] T047 [P] Actualizar `1stDocs/005-roadmap/002-DentdeLion.md` (§ 021: estado, decisiones de
  Clarifications y plan, desvíos) y `1stDocs/002-backlog/002-DentdeLion.md` (Proveedores → spec 021;
  pendiente de retirar `lotes.proveedor` tras la 2.5.0; `configuracion_clinica` hecho).
- [X] T048 *(Hecho: lint sin avisos, 959 pruebas en 125 archivos, build OK, `test:rls` OK en base nueva y repetido.)* `npm run lint && npm test && npm run build` y `supabase db reset && npm run test:rls` en verde;
  comparar el número de pruebas con T001. Anotar en este archivo los desvíos al implementar.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T002 puede ir en paralelo con T001.
- **Foundational (Phase 2)**: depende de Setup y bloquea todas las historias.
  - Servidor T003 → T004 → T005 → T006 → T007 (mismo archivo de migración, luego `test:rls`).
  - Dexie T008 → T009, T010. Lógica T011 → T012, T013. Sync T014 → T015 → T016 (T015 necesita T008 y
    T011).
- **US1 (Phase 3)**: depende de Foundational. T017 → T019; T018 → T019; T020 tras T017; T021–T023 al
  final.
- **US2 (Phase 4)**: depende de US1 (T017). T024 → T025 → T027; T026 en paralelo con T025.
- **US4 (Phase 5)**: depende de Foundational (migración); es independiente de la UI. T028 → T029 →
  T030 → T031.
- **US3 (Phase 6)**: depende de Foundational y de T024 (US2). T032/T033/T037 en paralelo; T034 →
  T036 → T039; T035 antes de T036.
- **US5 (Phase 7)**: depende de Foundational. T040 se inserta en la migración **antes** de la sección
  de T028, así que si US4 ya está hecha, colocar el bloque arriba de esa sección. T040 → T041 → T042.
- **Polish (Phase 8)**: depende de todas las historias.

### User Story Dependencies

- **US1 (P1)**: solo Foundational. MVP.
- **US2 (P1)**: extiende el selector de US1.
- **US4 (P1)**: solo Foundational (servidor y script); puede hacerse en paralelo con US1/US2.
- **US3 (P2)**: usa `proveedoresAdmin.ts` de US2.
- **US5 (P2)**: solo Foundational (servidor); en paralelo con US1–US3.

### Parallel Opportunities

- Setup: T002 ∥ T001.
- Foundational: después de T008, T009 ∥ T010 ∥ T011; T012 ∥ T013 ∥ T014.
- Con Foundational listo: una persona en US1→US2→US3 (front) y otra en US4→US5 (migración, script,
  `test:rls`), con cuidado de no editar a la vez el archivo de migración.
- US3: T032 ∥ T033 ∥ T037 ∥ T038.
- Polish: T043 ∥ T044 ∥ T045 ∥ T047.

---

## Parallel Example: User Story 3

```bash
Task: "T032 [US3] whatsapp.ts en src/features/proveedores/lib/whatsapp.ts"
Task: "T033 [US3] tests/unit/proveedores/whatsapp.test.ts"
Task: "T037 [US3] aviso proveedor-no-eliminado en src/stores/avisosStore.ts"
```

## Parallel Example: Foundational

```bash
# Tras T008 (Dexie v13):
Task: "T009 tests/unit/dexie-v13.test.ts"
Task: "T010 tenancy + mocks sin configuracionClinica"
Task: "T011 src/features/proveedores/lib/proveedores.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2: servidor, Dexie v13, sync y lógica común.
2. Phase 3 (US1): selector con predeterminado en el alta y la recepción, proveedor en el detalle.
3. **Validar**: QS pasos 3, 5 y 7 con proveedores sembrados.

### Incremental Delivery

1. US1 → US2: el pedido de la clienta completo en el registro (agregar desde el selector).
2. US4: migración de datos y script de fusiones; enviar la lista `listar` a la clienta **en cuanto
   esté**, para tener su respuesta antes de publicar.
3. US3: Ajustes (predeterminado, WhatsApp para la 022).
4. US5: tolerancia a la 2.4.0 (obligatoria antes de publicar).
5. Polish y publicación según QS "Publicación" (servidor primero, luego el front 2.5.0).

### Nota de publicación

US4 y US5 son requisito para publicar aunque US1–US3 estén listas: sin ellas, la migración o los
dispositivos 2.4.0 dejarían lotes sin proveedor.
