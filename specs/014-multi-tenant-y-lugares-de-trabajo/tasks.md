---

description: "Task list for 014-multi-tenant-y-lugares-de-trabajo"
---

# Tasks: Multi-tenant y Lugares de Trabajo

**Input**: Design documents from `/specs/014-multi-tenant-y-lugares-de-trabajo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ, las que define research.md R11:
- `test:rls` con dos tenants;
- unitarias de funciones por lugar, traslado, sync de pares, Dexie v10 y filtro por tenant;
- integración de selector, "Todos", lugares, equipo e invitación.

Se usa el patrón del proyecto: Vitest + RTL, `tests/helpers/memoryDb.ts`, `clienteFalso.ts` y
`tablasMemoria.ts`. La verificación visual se hace con el skill `run-indentory`.

**Organization**: por historia de usuario de spec.md. `R#` remite a research.md, "esquema" a
`contracts/supabase-schema.md` y "UI" a `contracts/ui-contracts.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US6 de spec.md

---

## Phase 1: Setup

- [X] T001 Crear `supabase/migrations/20261020000000_multi_tenant.sql` con `begin;` / `commit;` y un
  comentario por cada uno de los 7 bloques del orden de la migración (esquema). Crear también las
  constantes `TENANT_1 = '00000000-0000-4000-8000-000000000001'` y
  `LUGAR_1 = '00000000-0000-4000-8000-000000000011'` en `src/lib/db/index.ts` (exportadas) y como
  constantes de módulo en `scripts/test-rls.mjs`.
- [X] T002 [P] En `supabase/config.toml`, agregar `[functions.aceptar-invitacion]` con
  `verify_jwt = false`. Crear `supabase/functions/aceptar-invitacion/index.ts` con un `Deno.serve`
  que responda `501` (se completa en US5).
- [X] T003 [P] En el job `rls` de `.github/workflows/*.yml`, sacar `edge-runtime` de la lista `-x`
  de `supabase start`, para que `test:rls` pueda llamar a la Edge Function (R11).

---

## Phase 2: Foundational (esquema, Dexie v10, sync con tenant y lugar, lugar activo)

**Purpose**: el modelo multi-tenant completo con un solo lugar. Al terminar esta fase, la app hace
exactamente lo mismo que la 2.2.0 para la clienta actual (US1-5, US2-5), pero sobre el esquema
nuevo.

**⚠️ CRITICAL**: completar antes de las historias. Las pruebas existentes deben seguir en verde con
un solo lugar (plan, Riesgos).

### Servidor (todo en `supabase/migrations/20261020000000_multi_tenant.sql`, en serie)

- [X] T004 Bloque 1:
  - crear `tenants(id uuid pk default gen_random_uuid(), nombre text not null check (char_length(trim(nombre)) between 1 and 80), creado_en timestamptz default now())`;
  - crear `lugares(id, tenant_id → tenants, nombre, desactivado_en timestamptz null, creado_en)`
    con `unique (id, tenant_id)` y el índice único `(tenant_id, lower(trim(nombre)))`;
  - crear `minimos_lugar(tenant_id, insumo_id → insumos, lugar_id, stock_minimo numeric not null check (stock_minimo >= 0))`
    con PK `(insumo_id, lugar_id)` y la FK compuesta `(lugar_id, tenant_id) → lugares(id, tenant_id)`;
  - sembrar `TENANT_1` y `LUGAR_1` con `coalesce((select nombre from configuracion_clinica limit 1), 'Clínica')`.
- [X] T005 Bloque 2 (data-model.md, "Columnas nuevas"):
  - agregar `tenant_id uuid null` a `insumos`, `categorias`, `cambios_insumo`, `lotes`,
    `movimientos`, `items_compra`, `configuracion_alertas` y `configuracion_clinica`;
  - agregar `lugar_id uuid null` a `lotes`, `movimientos` e `items_compra`;
  - hacer el backfill con `TENANT_1` / `LUGAR_1` y luego `set not null`, más la FK a `tenants`, la
    FK compuesta `(lugar_id, tenant_id) → lugares(id, tenant_id)` y los índices `(tenant_id)` y
    `(lugar_id)` en `lotes`, `movimientos` e `items_compra`.

  Agregar `unique (id, tenant_id)` en `insumos` y `lotes`, y reemplazar las FK simples por FK
  compuestas para que ninguna referencia cruce tenants:
  - `(insumo_id, tenant_id) → insumos` en `lotes`, `cambios_insumo`, `items_compra` y
    `minimos_lugar`;
  - `(lote_id, tenant_id) → lotes` en `movimientos`.

  El esquema actual no tiene otras restricciones `unique` que migrar (data-model.md).
- [X] T006 Bloque 3: agregar `perfiles.tenant_id` (backfill `TENANT_1`, `not null`, FK) y
  `perfiles.desactivado_en timestamptz null`.
- [X] T007 Bloque 4: en `configuracion_alertas`, quitar la PK y el check singleton de `id = 'global'`
  y dejar como PK `tenant_id`. Mantener la columna `id` con default `'global'` para los clientes
  2.2.0 (R7).
- [X] T008 Bloque 5: ampliar el check de `movimientos.tipo` con `traslado_salida` y
  `traslado_entrada`; agregar `traslado_id uuid null` con su índice. Ajustar los triggers actuales de
  `movimientos` que validen el tipo o el signo, para que acepten los dos tipos nuevos.
- [X] T009 Bloque 6, funciones (data-model.md, "Funciones y triggers"), todas `security definer`,
  `stable` cuando corresponda y con `set search_path = public`, siguiendo el estilo de
  `20261018000000_endurecer_funciones.sql`:
  - `tenant_actual()`;
  - `es_administrador(uid)` redefinida para exigir `desactivado_en is null`;
  - el trigger `lugar_por_defecto()` (`before insert` en `lotes`, `movimientos` e `items_compra`);
  - `proteger_ultimo_lugar()` (`before update` en `lugares`);
  - `proteger_ultimo_admin()` (`before update` en `perfiles`);
  - `tenant_del_perfil()`, que devuelve el tenant aunque el perfil esté desactivado, junto con
    `desactivado_en`.

  Poner `default tenant_actual()` en todas las columnas `tenant_id` de T005.
- [X] T010 Bloque 6, traslado: crear `verificar_traslado()` como `constraint trigger ... deferrable
  initially deferred` `after insert` en `movimientos` `for each row when (new.traslado_id is not null)`.
  Para cada `traslado_id`, debe existir exactamente una `traslado_salida` y una `traslado_entrada`
  con el mismo `lote_id`, la misma `cantidad` absoluta, `lugar_id` distintos y el mismo `tenant_id`.
  Si no, `raise exception`.
- [X] T011 Bloque 6, invitaciones: crear la tabla
  `invitaciones(id, tenant_id, correo citext o text en minúsculas, rol, token_hash text unique, invitado_por, vence_en default now() + interval '7 days', estado check in ('pendiente','aceptada','revocada') default 'pendiente', aceptada_por, creado_en)`.
  Crear las RPC `security definer`, que solo puede usar `es_administrador(auth.uid())`:
  - `crear_invitacion(correo, rol)`: genera el token con `gen_random_bytes(32)` codificado en
    base64url, guarda `encode(digest(token,'sha256'),'hex')` y devuelve `{id, token, vence_en}`;
  - `revocar_invitacion(id)`.

  Crear también:
  - `consumir_invitacion(token_hash, uid, nombre)`, ejecutable solo por service role, que en una
    transacción marca la invitación como aceptada y crea o reactiva el perfil;
  - `ver_invitacion(token)`, la única función con `grant execute` a `anon`, que devuelve
    `{correo, tenant}` solo para una invitación pendiente y vigente, y nada en cualquier otro caso;
  - la vista `equipo_tenant` (`security definer`, o función equivalente):
    `id, nombre, correo (auth.users.email), rol, desactivado_en` de los perfiles del tenant, con
    filas solo si `es_administrador(auth.uid())`.
- [X] T012 Bloque 7, RLS: eliminar todas las políticas `using (true)` / `with check (true)` y crear
  las de la tabla de políticas del esquema, conservando las reglas actuales de autor = `auth.uid()`
  y solo administrador. Además:
  - `perfiles`: el `select` del propio perfil es `id = auth.uid()`, sin depender de
    `tenant_actual()`, para que un usuario desactivado lea su `desactivado_en` (T018, T056);
  - `lotes` y `movimientos`: una política extra de `insert` para pendientes previos a la
    desactivación (`usuario_id = auth.uid()`, `tenant_id = tenant_del_perfil()` y
    `creado_en < desactivado_en`, FR-021). Hacer `revoke` de `execute` a `anon` en las funciones nuevas que no sean
  públicas.
- [X] T013 Correr `supabase db reset` en local y comprobar que la migración aplica sin errores sobre
  la baseline y las dos migraciones anteriores. Correr `npm run test:rls` y ver que los casos
  existentes siguen en verde con los usuarios de prueba en `TENANT_1`; ajustar en
  `scripts/test-rls.mjs` la creación de perfiles para que lleven `tenant_id`.

### Dispositivo

- [X] T014 En `src/lib/db/index.ts`:
  - agregar `tenantId: string` a `Insumo`, `Categoria`, `CambioInsumo`, `Lote`, `Movimiento`,
    `ItemCompra`, `ConfiguracionAlertas` y `UsuarioActual`;
  - agregar `lugarId: string` a `Lote`, `Movimiento` e `ItemCompra`, y `trasladoId?: string` a
    `Movimiento`;
  - ampliar `Movimiento['tipo']` con `'traslado_salida' | 'traslado_entrada'`;
  - crear las interfaces `Lugar { id, tenantId, nombre, desactivadoEn: string | null, sincronizado }`,
    `MinimoLugar { insumoId, lugarId, tenantId, stockMinimo, sincronizado }` y
    `LugarActivo { id: 'local', lugarId: string | 'todos' }`, con sus tablas en el tipo de `db`.
- [X] T015 En `src/lib/db/index.ts`, agregar `db.version(10)`:
  - índices `tenantId` en las tablas sincronizadas y `lugarId` en `lotes`, `movimientos` e
    `itemsCompra`;
  - tablas nuevas `lugares: 'id, tenantId'`, `minimosLugar: '[insumoId+lugarId], tenantId, lugarId'`
    y `lugarActivo: 'id'`;
  - un `.upgrade()` que asigne `tenantId = TENANT_1` a todas las filas y `lugarId = LUGAR_1` a
    lotes, movimientos e ítems de compra, sin tocar `sincronizado`;
  - que cree la fila de `lugares` de `LUGAR_1` con el nombre de `configuracionClinica` (o
    "Clínica") y `sincronizado: true` (R8).
- [X] T016 [P] Escribir `tests/unit/dexie-v10.test.ts`: abrir una base en v9 con datos (insumo, lote,
  movimiento pendiente, ítem de compra y configuración), abrir en v10 y comprobar `tenantId`,
  `lugarId`, `sincronizado` intacto y la fila de `LUGAR_1`.
  - Agregar `fake-indexeddb` como devDependency (`npm install -D fake-indexeddb`, plan, Primary
    Dependencies) y usar `import 'fake-indexeddb/auto'` solo en este archivo, porque `memoryDb` no
    ejecuta los upgrades de Dexie.
  - Para la base v9, declarar en el test una instancia `Dexie('inDENToryDB')` con el esquema
    `version(1..9)` de `src/lib/db/index.ts`, cerrarla y luego importar `db`.
- [X] T017 Actualizar `tests/helpers/memoryDb.ts` y `tests/helpers/tablasMemoria.ts` con las tablas
  `lugares`, `minimosLugar` y `lugarActivo`. Crear helpers para construir filas con
  `tenantId: TENANT_1` y `lugarId: LUGAR_1` por defecto, y actualizar las fábricas de datos de prueba
  existentes para que los incluyan. Correr `npm test` y corregir los tipos rotos.
- [X] T018 En `src/lib/supabase/perfiles.ts`, `fetchPerfilPropio` también lee `tenant_id` y
  `desactivado_en`. En `src/stores/authStore.ts` y `src/features/auth/useLogin.ts`, guardar
  `tenantId` en `usuarioActual` (y en `usuariosConocidos`, si aplica) y exponer `getTenantActualId()`
  junto a `getUsuarioActualId()`. Si el perfil viene con `desactivado_en`, el login lo trata como
  acceso desactivado (la pantalla se hace en US5; por ahora basta con un estado
  `accesoDesactivado: true` en el store).
- [X] T019 En `src/lib/sync/index.ts`:
  - mapear `tenant_id` ↔ `tenantId` y `lugar_id` ↔ `lugarId` en todos los `to*Row` / `from*Row`, y
    `traslado_id` ↔ `trasladoId` en movimientos;
  - agregar `pushLugares`, `pullLugares`, `pushMinimosLugar` y `pullMinimosLugar` (los push solo si
    `esAdministradorActual()`, como `pushConfiguracionAlertas`) e incluirlos en `ejecutarCiclo`
    antes de lotes y movimientos;
  - `configuracion_alertas`: upsert con `onConflict: 'tenant_id'` y pull de la fila del tenant,
    guardada localmente con `id: 'global'`.
- [X] T020 En `src/lib/sync/index.ts`, todos los push filtran las filas pendientes por
  `tenantId === getTenantActualId()`. Las de otro tenant no se suben, quedan pendientes. Los pull
  guardan con el `tenantId` que venga del servidor. Agregar pruebas en
  `tests/unit/sync-tenant.test.ts`: los pendientes de otro tenant no se suben y los mapeos llevan
  `tenant_id` y `lugar_id`.
- [X] T021 [P] Crear `src/stores/lugarStore.ts` (Zustand):
  - estado `{ lugares: Lugar[], lugarActivoId: string | 'todos' | null }`;
  - `hydrate()` lee `db.lugares` del tenant actual (solo los activos para el selector) y
    `db.lugarActivo`;
  - `setLugarActivo(id)` persiste en `db.lugarActivo`;
  - selectores `lugaresActivos()`, `hayVariosLugares()` y `lugarParaEscribir()`, que devuelve el id
    del lugar activo o, con un solo lugar, ese; con `'todos'` devuelve `null`.

  Si el lugar guardado ya no existe o está desactivado, vuelve al lugar activo más antiguo (R10).
  Pruebas en `tests/unit/lugarStore.test.ts`.
- [X] T022 Cargar `useLugarStore.getState().hydrate()` donde hoy se hidratan los demás stores al
  iniciar sesión y al terminar cada ciclo de sync (`src/app/App.tsx` y el espejo de
  `src/lib/sync/index.ts`).
- [X] T023 Todas las escrituras locales que crean filas de negocio completan `tenantId` (del usuario
  con sesión) y, donde corresponde, `lugarId = lugarParaEscribir()`. Si es `null` (estado "Todos"),
  lanzan un error; la interfaz de US3 evita llegar ahí. Afecta a:
  - `crearMovimiento` en `src/features/insumos/lib/movements.ts`;
  - `consumirUno` y `deshacerConsumo` en `src/features/insumos/lib/consumoRapido.ts`, donde el
    deshacer usa el `lugarId` del movimiento original;
  - `darDeAltaMaterial` en `src/features/insumos/lib/alta.ts`, con el lote nuevo en el lugar activo;
  - `recibirEnInsumo` en `src/features/compras/lib/recepcion.ts`;
  - `agregarItemManual` en `src/features/compras/lib/itemsManuales.ts`;
  - las altas de categoría en `src/features/ajustes/lib/categoriasAdmin.ts`;
  - la edición de insumo y `cambiosInsumo`.
- [X] T024 Correr `npm run lint && npm run build && npm test`, todo verde, sin cambios visibles para
  un tenant con un solo lugar.

**Checkpoint**: la base de datos y el dispositivo son multi-tenant; la clienta actual no nota nada.

---

## Phase 3: User Story 1 - Aislamiento total entre clientes (P1) 🎯 MVP

**Goal**: ningún usuario ve ni modifica datos de otro tenant, ni desde la app ni contra el servidor.

**Independent Test**: `npm run test:rls` con dos tenants en verde, y quickstart #2 y #15.

- [X] T025 [US1] En `scripts/test-rls.mjs`, crear con service role el tenant B, dos lugares en A
  (`LUGAR_1` y otro) y un lugar en B, más un administrador y un personal por tenant. Agregar los
  casos de la tabla "test:rls: casos nuevos" del esquema, salvo los de traslado e invitación (van en
  US6 y US5):
  - lectura cruzada con 0 filas en cada tabla;
  - inserción y actualización con `tenant_id` ajeno rechazadas;
  - FK compuesta con `lugar_id` de B rechazada, y lote de A con `insumo_id` de B o movimiento de A
    con `lote_id` de B, también rechazados;
  - personal de A que crea un lugar, rechazado;
  - último lugar y última administradora protegidos;
  - usuario desactivado con 0 filas salvo su propio perfil;
  - usuario desactivado que sube un movimiento con `creado_en` anterior a `desactivado_en`
    (aceptado) y otro posterior (rechazado);
  - `equipo_tenant` con filas para el administrador y 0 para el personal;
  - inserción "forma 2.2.0" sin `tenant_id` ni `lugar_id`, que cae en su tenant y lugar principal.
- [X] T026 [US1] Correr `npm run test:rls` y corregir la migración hasta que todos los casos pasen
  (SC-001).
- [X] T027 [P] [US1] Crear `src/lib/tenancy.ts` con `aislarDatosLocales(tenantId)`: en una
  transacción Dexie, borrar de todas las tablas sincronizadas las filas con `tenantId !== tenantId`
  y `sincronizado === true`, y conservar las pendientes (R8, FR-004). Llamarla en `useLogin` después
  de guardar `usuarioActual` y antes de hidratar los stores.
- [X] T028 [US1] Todas las lecturas de los stores filtran por el tenant actual:
  - `src/stores/inventoryStore.ts`, `alertasStore.ts`, `clinicaStore.ts`, `pendientesStore.ts` y
    los `useLiveQuery` / lecturas directas de `db` en `src/features/**`;
  - la regla es "solo filas con `tenantId === getTenantActualId()`", así los pendientes ocultos de
    otro tenant nunca se muestran ni se cuentan en el indicador de sync;
  - centralizarlo en un helper `delTenant(tabla)` en `src/lib/tenancy.ts`.
- [X] T029 [P] [US1] Escribir `tests/unit/tenancyLocal.test.ts`:
  - con filas de `TENANT_1` (sincronizadas y pendientes) y un login del tenant B, quedan solo los
    pendientes de `TENANT_1`, y ningún store ni el contador de pendientes los muestra;
  - al volver a entrar el usuario de `TENANT_1`, sus pendientes reaparecen y se suben.
- [X] T030 [US1] Revisar `tests/unit/auth/offline-continuity.test.tsx` y
  `tests/unit/auth/usuariosConocidos.test.ts` con usuarios de dos tenants en el mismo dispositivo y
  ajustarlos si hace falta (Edge Case "dispositivo compartido").

**Checkpoint**: US1 verificable (quickstart #2, #3, #15).

---

## Phase 4: User Story 2 - Varios lugares con inventario propio (P1)

**Goal**: el usuario elige el lugar y todo (stock, alertas, compras, Inicio) es de ese lugar.

**Independent Test**: quickstart #4 y #5 (con un segundo lugar creado por SQL hasta US4) y SC-003.

- [X] T031 [P] [US2] En `src/features/insumos/lib/stock.ts`, agregar `stockLoteEnLugar(movimientos,
  loteId, lugarId)` y `lotesEnLugar(lotes, movimientos, lugarId)`, que devuelve los lotes con
  `lote.lugarId === lugarId` más los que tienen stock distinto de 0 en el lugar (data-model.md).
  `computeStockLote` suma `traslado_entrada` y resta `traslado_salida`. Pruebas en
  `tests/unit/stockPorLugar.test.ts`.
- [X] T032 [P] [US2] Crear `src/features/insumos/lib/minimos.ts` con `minimoEfectivo(insumo, lugarId,
  minimosLugar)` (FR-007) y `guardarMinimoLugar(insumoId, lugarId, valor | null)`, donde `null`
  borra la fila y vuelve al mínimo del catálogo. Pruebas en el mismo archivo de T031 o en
  `tests/unit/insumos/minimos.test.ts`.
- [X] T033 [US2] *(Implementado como vista del lugar: `datosDeLugar` y `useInventarioDeLugar`, en
  `src/features/insumos/lib/vistaLugar.ts`. Las funciones puras reciben solo los movimientos y lotes
  del lugar, e insumos con su mínimo efectivo, en vez de un parámetro `lugarId` cada una. `consumirUno`,
  `ConsumoForm` y `reconcileOverdraft` filtran por lugar al leer Dexie.)* Agregar el parámetro `lugarId`
  y filtrar por él en cada función:
  - `computeEstadoInsumo`, `estadoVisual`, `lotesConStockDeInsumo`, `selectLoteConsumoRapido`,
    `selectFefoLot`, `proyeccion` y `proximoLote` (`src/features/insumos/lib/*`), usando
    `lotesEnLugar` y `stockLoteEnLugar`;
  - `computeInsumosStockBajo` (con `minimoEfectivo`), `computeAlertasCaducidad` y
    `contarAlertasPendientes` (`src/features/alertas/lib/*`);
  - `computeItemsSugeridos` y la lista de ítems manuales filtrada por `lugarId`
    (`src/features/compras/lib/*`);
  - `resumenInicio` (`src/features/inicio/lib/resumenInicio.ts`).

  Actualizar las pruebas unitarias existentes de esas funciones para pasar `LUGAR_1`, y agregar un
  caso de dos lugares en cada una: lo del lugar 2 no afecta al lugar 1 (SC-003).
- [X] T034 [US2] Los componentes leen `lugarActivoId` de `useLugarStore` y lo pasan a las funciones
  de T033:
  - `InventarioView.tsx`, `InventarioTabla.tsx`, `InsumoCard.tsx`, `InsumoDetalle.tsx`,
    `ConsumoForm.tsx` y `ResumenAlertasBanner.tsx`;
  - `AlertasView.tsx`, `ComprasView.tsx`, `InicioView.tsx` y `src/app/AvisosConsumo.tsx`.

  Al cambiar de lugar se recalcula sin recargar (SC-004).
- [X] T035 [P] [US2] Crear `src/app/SelectorLugar.tsx` según UI, "SelectorLugar":
  - con un solo lugar, chip con el nombre y sin menú;
  - con 2 o más, un botón de 48 px con `ChevronDown` que abre `ElegirLugarSheet` en móvil o un
    dropdown con `shadow-dropdown` en tablet y desktop (`useDisposicion`);
  - lista los lugares activos con `CircleCheck` en el activo. "Todos los lugares" se agrega en US3.
- [X] T036 [P] [US2] Crear `src/app/ElegirLugarSheet.tsx`: `BottomSheet` reutilizable con la lista de
  lugares activos y `onElegir(lugarId)`. Lo usan el selector en móvil y el "¿En qué lugar?" de US3.
- [X] T037 [US2] En `src/app/TopBar.tsx` y `src/app/AppHeader.tsx`, reemplazar el chip con el nombre
  de la clínica (`useClinicaStore`) por `SelectorLugar`.
- [X] T038 [US2] En `EditarInsumoForm.tsx` (solo administrador), con 2 o más lugares, mostrar "Stock
  mínimo en {lugar activo}". Vacío significa "usar el del catálogo ({n})" y guarda con
  `guardarMinimoLugar`. Con un solo lugar se edita el mínimo del catálogo, como hoy.
- [X] T039 [P] [US2] Escribir `tests/integration/lugares.test.tsx` con dos lugares:
  - el selector visible y el cambio de lugar actualizan Inventario, Alertas, Compras e Inicio;
  - un consumo en el lugar 1 no cambia el lugar 2;
  - un consumo registrado y luego un cambio de lugar dejan el movimiento con `lugarId` del lugar 1
    (Edge Case de pendientes, SC-005);
  - el lugar se recuerda al recargar (US2-6);
  - con un solo lugar no hay selector (US2-5).

**Checkpoint**: US2 verificable con un lugar extra insertado por SQL.

---

## Phase 5: User Story 3 - Vista "Todos" consolidada (P2)

**Goal**: ver todos los lugares juntos, con el lugar de cada fila; para escribir hay que elegir un
lugar.

**Independent Test**: quickstart #9.

- [X] T040 [US3] En las funciones de T033, admitir `lugarId = 'todos'`: aplicar la función por cada
  lugar activo y concatenar, agregando `lugarId` a cada fila. `resumenInicio` suma los KPIs. Para
  Inventario, agregar `stockPorLugar(insumo)` → `[{lugarId, stock, estado}]` y el estado del peor
  lugar. Pruebas en `tests/unit/stockPorLugar.test.ts` y `tests/unit/resumenInicio.test.ts`.
- [X] T041 [US3] En `SelectorLugar.tsx`, agregar "Todos los lugares" con un separador (UI). En
  `lugarStore`, `setLugarActivo('todos')`.
- [X] T042 [P] [US3] Crear `src/app/ChipLugar.tsx` (nombre del lugar, `rounded-full`, tokens del DS)
  y mostrarlo en las filas de Inicio, Alertas y Compras, y en `InsumoCard` / `InventarioTabla` con
  "Providencia 4 · Las Condes 2" cuando `lugarActivoId === 'todos'`.
- [X] T043 [US3] En "Todos", las acciones que modifican stock abren primero `ElegirLugarSheet`
  ("¿En qué lugar?") y siguen el flujo en el lugar elegido sin cambiar el lugar activo (FR-014):
  "Consumir 1" (`InsumoCard` / `consumoRapido`), "+ Material" (`AltaMaterialView`), `ConsumoForm`,
  `RecibirItemForm`, `AgregarItemManualForm` y "Trasladar" (US6). Para eso, las funciones de
  escritura de T023 aceptan un `lugarId` explícito opcional.
- [X] T044 [P] [US3] Escribir `tests/integration/vista-todos.test.tsx`:
  - KPIs sumados;
  - chips de lugar en las filas;
  - "Consumir 1" pide el lugar y registra en el elegido;
  - el lugar activo sigue en "Todos".

**Checkpoint**: US3 verificable.

---

## Phase 6: User Story 4 - Gestionar lugares de trabajo (P2)

**Goal**: la administradora crea, renombra, desactiva y reactiva lugares desde Ajustes.

**Independent Test**: quickstart #4 y #14, y SC-006.

- [X] T045 [P] [US4] Crear `src/features/ajustes/lib/lugares.ts` con `validarNombreLugar` (1–60
  caracteres y único sin distinguir mayúsculas entre los lugares del tenant), `crearLugar`,
  `renombrarLugar`, `desactivarLugar` (rechaza el último activo) y `reactivarLugar`. Escriben en
  `db.lugares` con `sincronizado: false`. Agregar `guardarNombreTenant(nombre)`, que actualiza
  `tenants.nombre` directo en el servidor (requiere conexión, como hoy el nombre de la clínica).
  Pruebas en `tests/unit/ajustes/lugares.test.ts`.
- [X] T046 [US4] Crear `src/features/ajustes/components/LugaresSection.tsx` según UI, "Lugares de
  trabajo":
  - nombre del tenant;
  - lista con edición en línea, "Desactivar" / "Reactivar" y el contador de insumos con stock;
  - "+ Nuevo lugar";
  - confirmación al desactivar un lugar con stock.

  En `AjustesView.tsx`, reemplazar `ClinicaSection` por `LugaresSection` (solo administrador, US4-4).
- [X] T047 [US4] Eliminar `ClinicaSection.tsx`, `src/features/ajustes/lib/clinica.ts`,
  `src/stores/clinicaStore.ts`, `pushConfiguracionClinica` y `pullConfiguracionClinica`, sus usos
  en `App.tsx` y sus pruebas (`tests/unit/ajustes/clinica.test.ts` y
  `tests/unit/sync-configuracion-clinica.test.ts`). La tabla Dexie `configuracionClinica` se queda
  en el esquema (R7). Revisar que ningún import quede roto.
- [X] T048 [US4] En `tests/integration/ajustes.test.tsx`:
  - crear "Box Las Condes": aparece en el selector, vacío;
  - renombrar;
  - desactivar con confirmación;
  - el último activo no se puede desactivar;
  - el personal no ve la sección.

**Checkpoint**: US4 verificable; US2 ya no necesita SQL para tener dos lugares.

---

## Phase 7: User Story 5 - Invitar al equipo (P3)

**Goal**: la administradora invita por enlace, gestiona el equipo y First Steps da de alta tenants.

**Independent Test**: quickstart #1, #10–#13, y SC-007.

- [X] T049 [US5] Implementar `supabase/functions/aceptar-invitacion/index.ts` (esquema, "Edge
  Function"):
  - `POST {token, nombre, password}` con CORS para el origen de la app;
  - con `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, calcular el SHA-256 del token y
    buscar la invitación: `invitacion_invalida` si no existe o fue revocada, `invitacion_vencida`
    si venció;
  - buscar el usuario de Auth por correo: si tiene perfil en otro tenant, `correo_en_otro_tenant`;
    si no existe, `admin.createUser({ email, password, email_confirm: true })`; si existe sin perfil
    o con perfil en el mismo tenant, `admin.updateUserById` con la contraseña;
  - mapear el rechazo de contraseña de Auth a `password_debil`;
  - llamar al RPC `consumir_invitacion` y responder `200 { correo }`.
- [X] T050 [US5] En `scripts/test-rls.mjs`, con la función servida (`supabase functions serve`, o el
  edge-runtime de `supabase start`), agregar los casos de invitación:
  - personal no puede crear ni revocar;
  - administrador crea y recibe el token una sola vez (la tabla solo guarda el hash);
  - aceptar vigente / vencida (actualizar `vence_en` con service role) / revocada / correo de otro
    tenant;
  - el usuario aceptado lee su tenant y no el otro.
- [X] T051 [P] [US5] Crear `scripts/alta-tenant.mjs` (esquema, "Script"):
  - argumentos `--nombre`, `--lugar` y `--admin`;
  - service role de `supabase status -o json` en local, o de las variables `SUPABASE_URL` y
    `SUPABASE_SERVICE_ROLE_KEY`;
  - confirmación interactiva si la URL no es local;
  - crea el tenant, el lugar y la invitación de administrador (insert directo con el hash del
    token) e imprime el enlace `${APP_URL}/?invitacion=<token>`.

  Agregar `"alta-tenant": "node scripts/alta-tenant.mjs"` en `package.json`.
- [X] T052 [P] [US5] Crear `src/features/ajustes/lib/invitaciones.ts` con:
  - `crearInvitacion(correo, rol)` (RPC) → `{ token, enlace, venceEn }`;
  - `revocarInvitacion(id)`, `reenviarInvitacion(id)` (revoca y crea otra) y
    `listarInvitacionesPendientes()`;
  - `enlacesCompartir(enlace, tenant)` → `{ mailto, whatsapp }` con asunto y texto en español.

  Todo requiere conexión y no se guarda en Dexie. Pruebas en
  `tests/unit/ajustes/invitaciones.test.ts` con `clienteFalso`.
- [X] T053 [P] [US5] Crear `src/features/ajustes/lib/equipo.ts` con `listarEquipo()` (perfiles del
  tenant con correo), `cambiarRol(uid, rol)`, `desactivarUsuario(uid)` y `reactivarUsuario(uid)`,
  traduciendo el error de `proteger_ultimo_admin` a "Debe quedar al menos una administradora".
  `listarEquipo()` lee la vista `equipo_tenant` (T011), que también da el correo de los usuarios que
  nunca recibieron invitación. Pruebas en `tests/unit/ajustes/equipo.test.ts`.
- [X] T054 [US5] Crear `src/features/ajustes/components/EquipoSection.tsx` según UI, "Equipo":
  - lista de personas, "Cambiar rol" y "Desactivar" / "Reactivar";
  - "+ Invitar" con correo y rol, que al crear muestra el enlace con "Enviar por correo",
    "WhatsApp" y "Copiar enlace" (`navigator.clipboard`, de al menos 48 px) y el aviso de 7 días;
  - "Invitaciones pendientes" con "Revocar" y "Reenviar";
  - sin conexión, un aviso de que la gestión del equipo necesita conexión.

  Incluirla en `AjustesView.tsx` solo para administradores (US5-7).
- [X] T055 [US5] Crear `src/features/auth/AceptarInvitacion.tsx` según UI, "Pantalla de
  invitación":
  - el correo y el nombre del tenant salen del RPC público `ver_invitacion(token)` (T011). Si no
    devuelve nada, se muestra "Esta invitación ya no es válida";
  - formulario y validación de contraseña con la regla visible;
  - "Unirme" llama a la Edge Function con `supabase.functions.invoke` y, si sale bien, a `useLogin`
    con el correo y la contraseña;
  - errores en línea por código.

  En `src/app/App.tsx`, si `?invitacion=` está en la URL y no hay sesión, mostrar esta pantalla y
  limpiar el parámetro al terminar.
- [X] T056 [US5] Crear la pantalla "Tu acceso a Dentdelion está desactivado…" con "Cerrar sesión"
  (UI, "Usuario sin acceso") en `src/features/auth/AccesoDesactivado.tsx`. Mostrarla desde `App.tsx`
  si `accesoDesactivado` (T018) es verdadero o si `lugarStore` no tiene lugares activos. En sync,
  si `fetchPerfilPropio` devuelve `desactivado_en` durante `validarSesion`:
  - marcar el estado;
  - hacer un último push solo de `lotes` y `movimientos` propios con `creado_en < desactivado_en`;
  - detener el ciclo sin borrar los pendientes restantes;
  - mostrar en la pantalla de acceso desactivado "{n} registros no se pudieron subir" si quedan
    (FR-021, Edge Case "usuario desactivado con pendientes").

  Pruebas en `tests/unit/sync-desactivado.test.ts`.
- [X] T057 [P] [US5] Escribir `tests/integration/equipo-invitacion.test.tsx`:
  - la administradora invita y ve los tres botones con el enlace correcto;
  - revocar quita la invitación de pendientes;
  - la pantalla de invitación muestra cada error por código (Edge Function simulada en
    `clienteFalso`) y, si sale bien, inicia sesión;
  - el usuario desactivado ve la pantalla de acceso desactivado;
  - el personal no ve "Equipo".

**Checkpoint**: US5 verificable (quickstart #1, #10–#13).

---

## Phase 8: User Story 6 - Trasladar insumos entre lugares (P3)

**Goal**: mover stock de un lote entre lugares en una operación atómica y trazable.

**Independent Test**: quickstart #6–#8 y SC-008.

- [X] T058 [P] [US6] Crear `src/features/insumos/lib/traslado.ts`:
  - `validarTraslado({loteId, origenId, destinoId, cantidad})` (data-model.md, "Traslado", con la
    misma validación de decimales que el consumo de `quantity.ts`);
  - `trasladar(...)`, que en una transacción `db.transaction('rw', db.movimientos, ...)` crea la
    `traslado_salida` (origen, cantidad negativa según la convención de signos actual de consumo) y
    la `traslado_entrada` (destino) con el mismo `trasladoId = crypto.randomUUID()`, y devuelve el
    par;
  - `deshacerTraslado(par)`, que crea el par inverso con un `trasladoId` nuevo y
    `movimientoOrigenId` = la salida original (R4).
- [X] T059 [P] [US6] Escribir `tests/unit/traslado.test.ts`:
  - validaciones (mismo lugar, destino desactivado, más que el stock, decimales);
  - el par atómico: si falla la segunda escritura, no queda ninguna;
  - la suma de origen y destino no cambia (SC-008);
  - deshacer devuelve el stock original;
  - un lote caducado se puede trasladar (Edge Case).
- [X] T060 [US6] En `pushMovimientos` (`src/lib/sync/index.ts`), ordenar y agrupar los pendientes
  para que los dos movimientos de cada `trasladoId` vayan en el mismo `upsert`. En el reintento
  fila por fila (spec 012), reintentar cada par como un solo `upsert` de dos filas. Si un pendiente
  tiene `trasladoId` sin su pareja local, no se sube y se reporta a Sentry (`reportar.ts`). Pruebas
  en `tests/unit/sync-traslado.test.ts`, siguiendo `sync-movimientos-fallo.test.ts`.
- [X] T061 [US6] En `scripts/test-rls.mjs`, agregar los casos de traslado:
  - `traslado_salida` sola, rechazada al confirmar;
  - par completo entre los dos lugares de A, aceptado, con el stock por lugar correcto;
  - par con lugares de tenants distintos, rechazado.
- [X] T062 [US6] Crear `src/features/insumos/components/TrasladoForm.tsx` según UI, "Traslado":
  - `BottomSheet` con lote (FEFO por defecto, solo lotes con stock en el origen), destino (otros
    lugares activos) y `Stepper` con máximo = stock;
  - al confirmar, muestra el aviso "Trasladado {n} {unidad} a {destino}" con "Deshacer" (mismo
    mecanismo que el de consumo, `avisosStore`).

  Agregar "Trasladar" en `InsumoAccionesMenu.tsx` solo si `hayVariosLugares()` (US6-5). En "Todos",
  primero `ElegirLugarSheet` para el origen (T043).
- [X] T063 [US6] En el historial del lote (`InsumoDetalle.tsx` y donde se rotulen los tipos de
  movimiento), mostrar "Traslado → {destino}" o "Traslado ← {origen}" con autor y fecha (US6-3).
  Ver que `estadoIconos.ts` y los textos de tipo cubran los dos tipos nuevos.
- [X] T064 [P] [US6] Escribir `tests/integration/traslado.test.tsx`:
  - trasladar 4 de 10 deja 6 y 4 con el mismo lote;
  - aparece en el historial de ambos lugares;
  - deshacer;
  - rechazo por exceso;
  - sin "Trasladar" con un solo lugar.

**Checkpoint**: US6 verificable.

---

## Phase 9: Polish & Cross-Cutting

- [X] T065 Ensayo de la migración sobre una restauración del respaldo de producción (quickstart,
  "Migración" 1):
  - con `~/1STEPS/1stDocs/004-operacion/respaldo/respaldo.sh`, restaurar en Supabase local y aplicar
    la migración;
  - comparar los conteos de cada tabla antes y después, y comprobar que todo queda en
    `TENANT_1` / `LUGAR_1` y los perfiles en `TENANT_1`;
  - crear un tenant 2 con `alta-tenant` y comprobar que no ve nada (SC-002).
- [X] T066 Verificación de Dexie v10 en Chromium real con `run-indentory` (quickstart, "Migración" 2):
  build del tag `2.2.0` con un consumo sin conexión, luego el build de la rama; el consumo sube con
  `lugar_id = LUGAR_1` y los datos quedan intactos (FR-018).
- [X] T067 Verificación visual con `run-indentory` en 375, 768 y 1440 px:
  - selector con uno y dos lugares;
  - menú del selector;
  - "Todos";
  - Ajustes → Lugares y Equipo;
  - el panel de invitación con los tres botones;
  - la pantalla de invitación;
  - el traslado;
  - el acceso desactivado.

  Medir que los controles nuevos midan al menos 48 × 48 px y que no haya scroll horizontal. Medir el
  cambio de lugar con `performance.now()`: menos de 1 s (SC-004).
- [X] T068 *(Hecho así: recorrido en Chromium contra Supabase local para #1, #3, #4, #6, #9, #10 y
  #13, con capturas; el resto lo cubren pruebas automáticas: #2, #11 y #12 en `test:rls`; #5 en
  `lugares` y `stockPorLugar`; #7 en `sync-tenant`; #8 en `traslado`; #14 en `ajustes`; #15 en
  `tenancyLocal`.)* Recorrer los 15 escenarios manuales de `quickstart.md` contra Supabase local con la
  función servida y anotar los resultados en la descripción del PR.
- [X] T069 [P] Documentar el procedimiento de alta de tenant (FR-003) en
  `../1stDocs/004-operacion/`:
  - variables de entorno y comando `npm run alta-tenant`;
  - cómo enviar el enlace a la administradora;
  - cómo verificar.

  Documentar también el orden de despliegue: respaldo, `supabase db push`,
  `supabase functions deploy aceptar-invitacion`, configurar `APP_URL` si hace falta y recién
  después el front. Agregar el paso "antes de crear el segundo lugar o el primer traslado de un
  tenant, confirmar que todos sus dispositivos están en la versión nueva", porque un cliente 2.2.0
  sumaría el stock de todos los lugares (plan, Riesgos).
- [X] T070 [P] Agregar a `README.md` la Edge Function (`supabase functions serve
  aceptar-invitacion` para desarrollo local) y el script `alta-tenant`.
- [X] T071 Correr `npm run lint && npm run build && npm test && npm run test:rls`, todo verde.
- [ ] T072 [P] *(Backlog actualizado; falta el estado del roadmap, que se cambia al abrir el PR.)* En `../1stDocs/005-roadmap/002-DentdeLion.md`, actualizar el estado de la 014 cuando
  el PR esté abierto. En el backlog, anotar:
  - el envío automático de invitaciones con SMTP propio (R5);
  - el acceso por lugar (`accesos_lugar`, aclaración 1);
  - eliminar `configuracion_clinica` en la spec siguiente (R7);
  - los pendientes ajenos visibles con las herramientas del navegador (plan, Riesgos).
- [ ] T073 Descripción del PR:
  - el cambio de RLS (tabla de políticas) y la Edge Function con service role, para revisión de
    seguridad;
  - el orden de despliegue y el riesgo de los clientes 2.2.0 con varios lugares;
  - que la gestión de equipo e invitaciones requiere conexión, una excepción aceptada al Principio
    I porque no es flujo clínico;
  - el cambio de FR-019;
  - los resultados de T065–T068.

---

## Dependencies & Execution Order

- **Setup** (T001–T003) antes que todo.
- **Foundational** (T004–T024) bloquea todas las historias. T004–T013 van en serie sobre el mismo
  archivo de migración. T014 → T015 → T016/T017. T018–T023 dependen de T014. T024 cierra la fase.
- **US1** (T025–T030) solo depende de Foundational. Es el MVP: sin aislamiento no hay segundo
  cliente.
- **US2** (T031–T039) depende de Foundational. Se puede hacer en paralelo con US1 (otros
  archivos), salvo T028, que toca los mismos stores que T034; coordinar o hacerlos en serie.
- **US3** (T040–T044) depende de US2 (funciones por lugar y selector).
- **US4** (T045–T048) depende de US2 (selector). Es independiente de US3.
- **US5** (T049–T057) depende de Foundational (T011, invitaciones en la migración) y de US1 (T025,
  usuarios de prueba en `test-rls.mjs`). Es independiente de US2–US4.
- **US6** (T058–T064) depende de US2 (stock por lugar). T043 de US3 cubre el caso "Todos" del
  traslado; si US3 todavía no está, "Trasladar" queda deshabilitado en "Todos".
- **Polish** al final.

```text
Setup ─► Foundational ─┬─► US1 (MVP) ───────────────┬─► US5 ─┐
                       └─► US2 ─┬─► US3 ─────────────┼────────┼─► Polish
                                ├─► US4 ─────────────┤        │
                                └─► US6 ─────────────┘────────┘
```

## Parallel Examples

- **Setup**: T002 y T003 a la vez.
- **Foundational**: T016, T021 en paralelo con T018–T020 (archivos distintos). T004–T013 en serie.
- **US1**: T027 y T029 en paralelo; T025 → T026.
- **US2**: T031, T032, T035, T036 y T039 en paralelo; luego T033 → T034 → T037 → T038.
- **US5**: T051, T052 y T053 en paralelo con T049; luego T054 → T055 → T056; T050 y T057 al final.
- **US6**: T058 y T059 en paralelo; luego T060 → T062 → T063; T061 y T064 al final.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: esquema multi-tenant con RLS por tenant, Dexie v10 y
   aislamiento local. Con esto ya se puede publicar sin que la clienta actual note cambios, y se
   puede dar de alta un segundo cliente por SQL.
2. **+ US2**: varios lugares por tenant (lo que motivó la spec).
3. **+ US4**: la administradora crea sus lugares sin SQL.
4. **+ US3 + US6**: vista "Todos" y traslados.
5. **+ US5**: invitaciones y equipo, con lo que el alta de un cliente nuevo queda completa con
   `alta-tenant`.
6. **Polish**: ensayo de migración, Dexie en Chromium, capturas, documentación de operación y PR.
