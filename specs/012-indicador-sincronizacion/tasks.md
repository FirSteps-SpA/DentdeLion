---

description: "Task list for 012-indicador-sincronizacion"
---

# Tasks: Indicador de Sincronización

**Input**: Design documents from `/specs/012-indicador-sincronizacion/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. El roadmap exige "tests de integración para cada estado" (spec, Assumptions) y
research.md R12 define las unitarias. Usan el `memoryDb` mockeado de `tests/helpers/memoryDb.ts`,
con el mismo patrón que `tests/unit/sync-movimientos-fallo.test.ts`: `vi.mock('../../src/lib/db')`
más un cliente Supabase falso con `from().upsert/select` y `auth.getSession`.

**Organization**: por historia de usuario. Las referencias `R#` apuntan a research.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo y sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

**Purpose**: esquema remoto e íconos que usan varias historias.

- [X] T001 [P] Crear `supabase/migrations/20261019000000_horas_aviso_pendientes.sql` con el SQL
  exacto de contracts/supabase-schema.md (columna `horas_aviso_pendientes integer not null default
  24` y check `between 1 and 168`, con nombre `configuracion_alertas_horas_aviso_pendientes_check`).
  Encabezado de comentario en el estilo de `20261018000000_endurecer_funciones.sql`. Verificar
  con `supabase db reset`.
- [X] T002 [P] En `src/components/icons/index.tsx`, agregar los íconos `Check`, `ArrowsSync` (dos
  flechas circulares), `CloudOff`, `AlertTriangle` y `Clock`. Mismo formato de props (`size`,
  `className`) y trazo que los íconos existentes.

---

## Phase 2: Foundational (ciclo que informa su resultado)

**Purpose**: sin esto ninguna historia puede mostrar un estado verdadero. Cubre research.md
R1–R5, R9 y R10.

**⚠️ CRITICAL**: completar antes de cualquier historia.

### Tests (escribir primero; deben fallar)

- [X] T003 [P] Crear `tests/unit/sync-resultado-ciclo.test.ts`. Debe cubrir:
  (a) todas las etapas sin error dan `estado: 'ok'` y escriben `estadoSync.ultimaExitosaEn`;
  (b) un `{ error: { message: 'Failed to fetch' } }` en `push lotes` da `sin-red` y no escribe
  `ultimaExitosaEn`;
  (c) un `{ error: { code: '23505' } }` en `push items_compra` da `error`, con
  `etapasConError` que contiene `'push items_compra'`;
  (d) un error de servidor y uno de red en el mismo ciclo dan `error`;
  (e) `auth.getSession()` sin sesión da `sesion`, y ningún `upsert` se llama;
  (f) una sesión de otro `user.id` da `sesion`;
  (g) `getSession` con error de red da `sin-red`, sin push;
  (h) dos llamadas seguidas a `sincronizarAhora()` devuelven la misma promesa y ejecutan un solo
  ciclo (contar las llamadas a `getSession`);
  (i) `runSyncBatch` nunca lanza aunque `upsert` lance;
  (j) un movimiento rechazado con 42501 en el reintento fila por fila da `error`, y la fila sigue
  `sincronizado: false` (los movimientos no tienen `rechazadoEn`, R1);
  (k) un error `{ code: 'PGRST301' }`, un `{ status: 401 }` o un mensaje "JWT expired" en
  cualquier etapa da `sesion`, aunque haya otros errores de servidor o de red en el mismo ciclo
  (R2/R3).
- [X] T004 [P] Crear `tests/unit/sync-autoria.test.ts`. Con `usuarioActual` = B, un `CambioInsumo`
  pendiente de A y otro de B, y una `Categoria` pendiente de A y otra de B, debe comprobar que:
  solo se suben los de B; los de A quedan `sincronizado: false` y `rechazadoEn: null` aunque el
  cliente falso rechace con 42501 cualquier fila cuyo autor ≠ B (R4).
- [X] T005 [P] Crear `tests/unit/sync-configuracion-bandera.test.ts`. Debe cubrir:
  (a) con rol `personal` y `configuracionAlertas.sincronizado: false`, no hay upsert;
  (b) como administrador, con `sincronizado: false`, se hace un upsert y queda `true`;
  (c) como administrador, con `sincronizado: true`, no hay upsert;
  (d) si el upsert falla con un error que no es de permisos (p. ej. 500), queda `false` y el ciclo
  es `error`;
  (e) como administrador, un pull no pisa una fila local con `sincronizado: false`;
  (f) con `horasAvisoPendientes` indefinido, la fila subida no tiene la clave
  `horas_aviso_pendientes`;
  (g) con rol `personal` y una fila local `sincronizado: false` (administrador degradado), el
  pull **sí** la pisa con la del servidor y queda `sincronizado: true`;
  (h) como administrador, un upsert rechazado con 42501 descarta el cambio local: la fila queda
  `sincronizado: true`, el siguiente pull trae el valor del servidor y el ciclo **no** es `error`;
  (i) los mismos casos (a)–(h) para `configuracionClinica` (R5, R6).

### Implementation

- [X] T006 En `src/lib/db/index.ts`, según data-model.md:
  - agregar las interfaces `UsuarioConocido` (`id`, `nombre`, `vistoEn`) y `EstadoSync`
    (`id: 'local'`, `ultimaExitosaEn: string | null`);
  - agregar `horasAvisoPendientes?: number` y `sincronizado: boolean` a `ConfiguracionAlertas`, y
    `sincronizado: boolean` a `ConfiguracionClinica`;
  - registrar las tablas en el tipo de `db`;
  - declarar `db.version(9).stores({ usuariosConocidos: 'id', estadoSync: 'id' })`, con un
    `.upgrade()` que haga `modify` de `configuracionAlertas` y `configuracionClinica` poniendo
    `sincronizado ??= true`, y un comentario en el estilo de las versiones 7 y 8.

  Agregar también las tablas a los `createMemoryDb({...})` de los tests de sync existentes que las
  necesiten.
- [X] T007 En `src/lib/sync/reportar.ts`, exportar `esFallaDeRed`, sin cambiar su lógica.
- [X] T008 Crear `src/stores/syncStore.ts` (Zustand) con:
  - el estado `fase: 'inactivo' | 'sincronizando'`, `ultimoResultado: ResultadoCiclo['estado'] |
    null` y `ultimaExitosaEn: string | null`;
  - los setters internos `iniciarCiclo()` y `terminarCiclo(resultado)`;
  - `marcarSinRed()` (para el evento `offline`, que no pisa un `error`/`sesion` vigente);
  - `subscribe()`, que hace `liveQuery` de `db.estadoSync.get('local')` para `ultimaExitosaEn`,
    con el patrón de `src/stores/clinicaStore.ts`.

  Exportar desde aquí `type ResultadoCiclo = { estado: 'ok' | 'sin-red' | 'error' | 'sesion';
  etapasConError: string[]; terminadoEn: string }`.
- [X] T009 En `src/lib/sync/index.ts`, agregar la clase o closure `CicloSync` (R1/R2):
  - `registrar(etapa, error)`, que ignora `null` y clasifica el error en una de tres clases:
    `sesion` si `code === 'PGRST301'`, `status === 401` o el mensaje coincide con `/jwt/i`; si
    no, `red` si `esFallaDeRed`; si no, `servidor`. Guarda la etapa y llama a
    `reportarErrorSync(etapa, error)`;
  - `resultado()`, con la prioridad sesion > error > sin-red > ok.

  Hacer que **todos** los `push*`/`pull*` reciban el ciclo y registren su `{ error }`, incluidos
  `pushInsumos`, `pushLotes`, `pushItemsCompra` y los dos `pushConfiguracion*`, que hoy lo
  descartan. En `pushCambiosInsumo` y `pushCategorias`, el lote con rechazo de permisos que se
  reintenta fila por fila registra solo los errores de fila que **no** son de permisos: los
  rechazos marcados `rechazadoEn` no son error (R1). En `pushMovimientos` **sí** se registran
  los rechazos de fila: los movimientos no tienen `rechazadoEn` y siguen pendientes, así que
  deben verse como error. Sustituir las llamadas directas a `reportarErrorSync` por
  `ciclo.registrar`.
- [X] T010 En `src/lib/sync/index.ts`, `runSyncBatch(): Promise<ResultadoCiclo>`:
  - Si `getSupabaseStatus()` da error, devolver `sin-red`.
  - Paso 0 de contracts/supabase-schema.md: `client.auth.getSession()`. Si es error de red
    (`esFallaDeRed`), devolver `sin-red`. Si no hay `session` o `session.user.id !==
    useAuthStore.getState().usuario?.id`, devolver `sesion` sin push ni pull (R3).
  - Si durante el ciclo `CicloSync` registra un error de clase `sesion` (token revocado o vencido
    en el servidor), cortar el ciclo ahí: no seguir con los push restantes, para que
    `pushCambiosInsumo` y `pushCategorias` no interpreten la falta de sesión como rechazo de
    permisos y marquen `rechazadoEn`. Devolver `sesion`.
  - Al final, si el resultado es `ok`, hacer `db.estadoSync.put({ id: 'local', ultimaExitosaEn:
    terminadoEn })`.
  - Envolver todo en `try/catch`: una excepción devuelve `error` con la etapa `'ciclo'` y va a
    Sentry, como hace hoy `startBackgroundSync`.
  - Actualizar el JSDoc del contrato.
- [X] T011 En `src/lib/sync/index.ts` (R4), filtrar `pushCambiosInsumo` por `cambio.usuarioId ===
  usuarioActual` y `pushCategorias` por `categoria.creadoPor === usuarioActual`, igual que
  `pushMovimientos`. Sin usuario, devolver `[]`. Documentar en el JSDoc por qué (RLS
  `usuario_id/creado_por = auth.uid()` en un dispositivo compartido).
- [X] T012 En `src/lib/sync/index.ts` (R5/R6):
  - `pushConfiguracionAlertas` y `pushConfiguracionClinica` suben solo si la fila local tiene
    `sincronizado === false` **y** `useAuthStore.getState().usuario?.rol === 'administrador'`. Si
    no hay error, `update(..., { sincronizado: true })`. Si el upsert se rechaza por permisos
    (`esRechazoDePermisos`), se descarta el cambio local: `update(..., { sincronizado: true })`,
    sin registrar error, y el pull del mismo ciclo trae el valor del servidor. Cualquier otro
    error deja `false` y se registra.
  - Los `pullConfiguracion*` saltan el `put` solo si la fila local tiene `sincronizado === false`
    **y** el usuario actual es administrador. En los demás casos escriben la fila del servidor con
    `sincronizado: true`, así un administrador degradado converge.
  - `toConfiguracionAlertasRow` incluye `horas_aviso_pendientes` solo si `horasAvisoPendientes
    !== undefined`, y `fromConfiguracionAlertasRow` lo mapea.
  - Agregar `horas_aviso_pendientes?: number` a `ConfiguracionAlertasRow`.
- [X] T013 En `src/features/alertas/lib/configuracion.ts` y en el guardado del nombre de clínica
  (`src/features/ajustes/lib/clinica.ts`), cada escritura de
  configuración global usa `sincronizado: false` y conserva los demás campos de la fila (leer y
  fusionar en vez de `put` con la fila nueva). `actualizarNivelesAviso` mantiene
  `horasAvisoPendientes`.
- [X] T014 En `src/lib/sync/index.ts` (R9):
  - Guardián de módulo `let cicloEnCurso: Promise<ResultadoCiclo> | null`.
  - `export function sincronizarAhora()`: devuelve `cicloEnCurso` si existe; si no, llama a
    `useSyncStore.getState().iniciarCiclo()`, ejecuta `runSyncBatch()`, y en `finally` llama a
    `terminarCiclo(resultado)` y limpia `cicloEnCurso`.
  - `startBackgroundSync`: el tick llama a `sincronizarAhora()`. Agregar
    `window.addEventListener('online', tick)` y `('offline', () =>
    useSyncStore.getState().marcarSinRed())`. La función de retorno quita los listeners y el
    intervalo.
- [X] T015 Ajustar las pruebas existentes al nuevo contrato:
  - `tests/unit/sync-configuracion-clinica.test.ts`, `tests/unit/sync-full-repush.test.ts` y el
    resto de `tests/unit/sync-*.test.ts`: clientes falsos con `auth.getSession` que devuelve la
    sesión del usuario mockeado, filas de configuración con `sincronizado`, y aserciones que
    esperaban el upsert incondicional de configuración.
  - Correr `npm test` hasta que todo esté verde junto con T003–T005.

**Checkpoint**: `runSyncBatch` informa `ok/sin-red/error/sesion`, hay un solo ciclo a la vez y
nada ajeno se sube ni se revierte.

---

## Phase 3: User Story 1 - Ver si hay cambios sin subir (P1) 🎯 MVP

**Goal**: el encabezado muestra Sincronizado / N pendientes / Sin conexión / Error, y se actualiza
de forma reactiva.

**Independent Test**: offline, 3 consumos dan "Sin conexión · 3"; al volver la red, pasa a
"Sincronizado" sin recargar (quickstart escenarios 1–4).

### Tests

- [X] T016 [P] [US1] Crear `tests/unit/indicador.test.ts` para `calcularIndicador()` (algoritmo
  de data-model.md). Debe cubrir:
  - prioridad `error` > `sin-conexion` > `pendientes` > `sincronizado`;
  - `sesion` da `error` con `motivoError: 'sesion'`;
  - `navigator.onLine` falso da `sin-conexion` aunque el último ciclo fuera `ok`;
  - suma de los 3 tipos en `propios`;
  - con 100 pendientes, la etiqueta es "99+";
  - las filas `rechazadoEn` no cuentan;
  - los pendientes ajenos no cambian `estado`.
- [X] T017 [P] [US1] Crear `tests/integration/indicador-sincronizacion.test.tsx`, montando `App`
  con un usuario y el `memoryDb` (patrón de `tests/integration/consumo.test.tsx`, con
  `onMemoryDbChange` para simular `liveQuery`). Escenarios de US1:
  - (1) sin pendientes y ciclo `ok`: "Sincronizado";
  - (2) offline (`navigator.onLine=false` + evento `offline`) y 3 consumos registrados por la
    interfaz: el `aria-label` contiene "Sin conexión" y 3;
  - (3) volver online + evento `online` con el cliente falso aceptando: llega a "Sincronizado" sin
    recargar;
  - (4) el cliente responde `{ error: { code: '500' } }`: "Error de sincronización" con el número
    de pendientes;
  - (5) error de red con `onLine=true`: "Sin conexión";
  - (6) el siguiente ciclo `ok` limpia el error.

### Implementation

- [X] T018 [US1] Crear `src/lib/sync/indicador.ts` con:
  - `agruparPendientes(movimientos, cambios, categorias): PendientesPorAutor[]` (filtros de
    data-model.md, `masAntiguoEn` = `creadoEn` mínimo);
  - `calcularIndicador({ usuarioId, pendientes, ultimoResultado, enLinea, horasAviso, ahora,
    usuariosConocidos })`, que devuelve `{ estado, propios, etiqueta, motivoError,
    desglosePropio, ajenos, antiguos, alerta }`.

  Es puro, sin Dexie ni React. En US1 la alerta y los ajenos pueden devolver valores vacíos: se
  completan en T034 y T038.
- [X] T019 [US1] Crear `src/stores/pendientesStore.ts` (Zustand):
  - `subscribe()` con un `liveQuery` que lee `movimientos`, `cambiosInsumo` y `categorias` y
    guarda `agruparPendientes(...)`;
  - un `liveQuery` de `usuariosConocidos`;
  - un `setInterval` de 60 s que actualiza `ahora` (R8);
  - la función de retorno limpia todo.

  Mismo estilo que `src/stores/alertasStore.ts`.
- [X] T020 [US1] Crear `src/app/SyncIndicator.tsx` según contracts/ui-contracts.md:
  - un `<button>` `touch-target` que lee `pendientesStore`, `syncStore`, `authStore` y
    `alertasStore` (para el umbral; hasta T031 usa 24), y `navigator.onLine` con listeners
    `online`/`offline` en un `useSyncExternalStore`;
  - llama a `calcularIndicador`;
  - texto, ícono y color por estado según la tabla del contrato;
  - `aria-label="Estado de sincronización: …"` con el texto completo;
  - ícono girando con `motion-safe:animate-spin` mientras `fase === 'sincronizando'`;
  - prop `onClick`.
- [X] T021 [US1] En `src/app/AppHeader.tsx`, reemplazar el bloque del punto con el texto
  "Sincronizado"/"Sin conexión" por `<SyncIndicator onClick={...} />`. Quitar la lectura de
  `useAppStore().isBackendConnected` y actualizar el JSDoc: el contador ya no está excluido, y hay
  que referenciar la spec 012.
- [X] T022 [US1] En `src/app/App.tsx`, dentro del `useEffect` con usuario, llamar a
  `useSyncStore.getState().subscribe()` y `usePendientesStore.getState().subscribe()` (o los
  selectores `subscribe`, como los demás stores) y limpiarlos en el retorno.
- [X] T023 [US1] Ajustar las pruebas existentes que buscan el texto "Sincronizado"/"Sin conexión"
  del encabezado viejo (`grep -rn "Sin conexión\|Sincronizado" tests/`) y correr `npm test`.

**Checkpoint**: MVP. El indicador es veraz y reactivo; se puede publicar solo.

---

## Phase 4: User Story 2 - Última sincronización exitosa (P2)

**Goal**: al tocar el indicador se abre un panel con el estado, la hora de la última
sincronización exitosa y el desglose por tipo.

**Independent Test**: tras un ciclo `ok` y cortes posteriores, el panel conserva la hora del
último éxito (quickstart escenarios 1 y 12).

### Tests

- [X] T024 [P] [US2] Agregar a `tests/integration/indicador-sincronizacion.test.tsx`:
  - (a) tocar el indicador abre un `role="dialog"` con el título "Sincronización";
  - (b) tras un ciclo `ok` muestra "Última sincronización: hoy HH:MM", y un ciclo `sin-red`
    posterior no la cambia;
  - (c) sin fila `estadoSync`: "Nunca sincronizado";
  - (d) el desglose muestra "Consumos e ingresos: 2" y "Cambios de insumo: 1";
  - (e) con el formulario de consumo abierto y una cantidad escrita, abrir y cerrar el panel
    conserva el valor (US2-4).

### Implementation

- [X] T025 [US2] Crear `src/app/SyncSheet.tsx` según contracts/ui-contracts.md, bloques 1–3:
  - `BottomSheet` con `titulo="Sincronización"`;
  - estado actual con el motivo de error (servidor o sesión, FR-015);
  - "Última sincronización", con un formateador local que dé "hoy HH:MM", "ayer HH:MM" o "d mmm
    HH:MM" (con `Intl.DateTimeFormat('es-CL')`) y "Nunca sincronizado";
  - desglose de los propios por tipo, sin líneas en 0.

  Recibe el resultado de `calcularIndicador` por props para no recalcular.
- [X] T026 [US2] En `src/app/AppHeader.tsx`, agregar el estado local `panelAbierto`:
  `SyncIndicator onClick` lo abre y `SyncSheet onClose` lo cierra. No cambiar `vista` ni montar
  nada fuera del header, para que el formulario de abajo conserve su estado.

**Checkpoint**: US1 y US2 funcionan.

---

## Phase 5: User Story 3 - Sincronizar ahora (P2)

**Goal**: el botón del panel lanza un ciclo inmediato, sin duplicarlo, y muestra el resultado.

**Independent Test**: con pendientes y red, pulsar baja a 0 antes de 10 s; pulsar dos veces
ejecuta un solo ciclo; offline muestra el mensaje y no bloquea (quickstart escenarios 6–7).

### Tests

- [X] T027 [P] [US3] Agregar a `tests/integration/indicador-sincronizacion.test.tsx`:
  - (a) pulsar "Sincronizar ahora" con el cliente aceptando: el botón dice "Sincronizando…" y está
    `disabled`; al terminar aparece "Listo" y el indicador muestra "Sincronizado";
  - (b) dos clics seguidos: `getSession` se llama una sola vez;
  - (c) offline: aparece "Sin conexión: se subirán al volver la red" y el panel se puede cerrar.

### Implementation

- [X] T028 [US3] En `src/app/SyncSheet.tsx`, bloque 6 de contracts/ui-contracts.md:
  - `TouchButton` primario de ancho completo "Sincronizar ahora", `disabled` y con el texto
    "Sincronizando…" mientras `syncStore.fase === 'sincronizando'`;
  - `onClick` hace `await sincronizarAhora()` y guarda el resultado en un estado local, que se
    muestra como mensaje en línea (`ok`: "Listo"; `sin-red`: "Sin conexión: se subirán al volver
    la red"; `error`/`sesion`: el motivo). No usar toast.

**Checkpoint**: US1–US3 funcionan.

---

## Phase 6: User Story 4 - Aviso de pendientes antiguos (P3)

**Goal**: los pendientes con más horas que el umbral muestran una alerta visual. El umbral es un
valor de la clínica que edita un administrador en Ajustes.

**Independent Test**: con un umbral de 1 h y un pendiente de hace 2 h aparece la alerta; al
sincronizar desaparece (quickstart escenarios 8–9).

### Tests

- [X] T029 [P] [US4] Extender `tests/unit/indicador.test.ts`:
  - un pendiente de hace 25 h con umbral 24 da `alerta` y 1 antiguo;
  - con 23 h, no hay alerta;
  - con `creadoEn` en el futuro (reloj atrasado), la antigüedad es 0, sin alerta ni valores
    negativos;
  - `masAntiguoEn` correcto.

  Agregar a `tests/integration/indicador-sincronizacion.test.tsx`:
  - (a) alerta visible en el `aria-label` o con un `data-alerta`, y en el panel "1 cambio lleva
    más de 24 h sin subir" con la fecha;
  - (b) como administrador en Ajustes, cambiar el umbral a 1 h actualiza la alerta sin recargar;
  - (c) un valor de 0 o 200 muestra "Ingresa un número de horas entre 1 y 168." y no guarda;
  - (d) con rol `personal`, el campo no está en Ajustes y el panel muestra "Aviso tras 24 h sin
    subir".
- [X] T030 [P] [US4] En `scripts/test-rls.mjs`, agregar los 4 casos de la tabla de
  contracts/supabase-schema.md (el administrador escribe 12; `personal` es rechazado con 42501;
  0 y 169 dan 23514; un upsert sin la columna conserva 12), con el mismo estilo de aserciones que
  los casos existentes. Correr `npm run test:rls`.

### Implementation

- [X] T031 [US4] Agregar a `src/stores/alertasStore.ts` el estado `horasAvisoPendientes` (desde
  `config?.horasAvisoPendientes ?? HORAS_AVISO_PENDIENTES_POR_DEFECTO`) y exportar la constante
  `HORAS_AVISO_PENDIENTES_POR_DEFECTO = 24`.
- [X] T032 [US4] En `src/features/alertas/lib/configuracion.ts`, agregar
  `actualizarHorasAvisoPendientes(horas: number)`. Valida que sea entero y esté entre 1 y 168; si
  no, lanza `Error('Ingresa un número de horas entre 1 y 168.')`. Lee la fila `global`, la fusiona
  (conservando `nivelesAvisoDias`, o `NIVELES_AVISO_POR_DEFECTO` si no hay fila) y escribe con
  `sincronizado: false`.
- [X] T033 [US4] En `src/features/ajustes/components/ConfiguracionAlertasSection.tsx`, agregar la
  sección "Aviso de cambios sin subir" según contracts/ui-contracts.md: `IconField`, `type=number`,
  `min=1`, `max=168`, `step=1`, `defaultValue` con el umbral vigente, `onBlur` que llama a
  `actualizarHorasAvisoPendientes`, y un error con `role="alert"` igual que `errorNiveles`.
- [X] T034 [US4] En `src/lib/sync/indicador.ts`, completar en `calcularIndicador` el cálculo de
  `antiguos` y `alerta` para propios **y** ajenos (aclaración 2), con `max(0, ahora − creadoEn) >
  horasAviso h`. En `src/app/SyncIndicator.tsx`, leer `horasAvisoPendientes` de `alertasStore` y
  aplicar el ícono `Clock` y los colores `warning-30-text`/`warning-30-bg` si hay `alerta`.
- [X] T035 [US4] En `src/app/SyncSheet.tsx`, bloque 4: "N cambios llevan más de H h sin subir (el
  más antiguo, del …)" y la línea "Aviso tras H h sin subir", siempre visible como lectura del
  umbral.

**Checkpoint**: US1–US4 funcionan.

---

## Phase 7: User Story 5 - Pendientes de otro usuario (P3)

**Goal**: en un dispositivo compartido, los pendientes ajenos se nombran, no cuentan como propios
y se suben cuando su autor inicia sesión.

**Independent Test**: A deja un consumo offline y sale; B entra con red y ve "Sincronizado", con
el aviso de A en el panel (quickstart escenarios 10–11).

### Tests

- [X] T036 [P] [US5] Extender `tests/unit/indicador.test.ts`: los pendientes de A con el usuario B
  dan `estado` "sincronizado" y `ajenos: [{ nombre: 'Ana', total: 1 }]`. Si A no está en
  `usuariosConocidos`, el nombre es "otro usuario". Un ajeno antiguo activa `alerta` (aclaración 2).
  Crear `tests/unit/auth/usuariosConocidos.test.ts`: `login` hace `put` en `usuariosConocidos` y
  `logout` no lo borra. Agregar a `tests/integration/indicador-sincronizacion.test.tsx` el
  escenario de US5-1/2/3: el texto "Hay 1 cambio de Ana que se subirá cuando esa persona inicie
  sesión en este dispositivo" y la línea "Pídele que inicie sesión pronto" cuando es antiguo.

### Implementation

- [X] T037 [US5] En `src/stores/authStore.ts`, en `login`, agregar `await
  db.usuariosConocidos.put({ id: usuario.id, nombre: usuario.nombre, vistoEn: new
  Date().toISOString() })`. `logout` no toca esa tabla; dejarlo en el JSDoc con referencia a R7.
- [X] T038 [US5] En `src/lib/sync/indicador.ts`, completar `ajenos` en `calcularIndicador`: un
  elemento por autor distinto del usuario actual, con `nombre` tomado de `usuariosConocidos`
  (o "otro usuario"), `total` y `antiguo` (boolean).
- [X] T039 [US5] En `src/app/SyncSheet.tsx`, bloque 5: por cada ajeno, "Hay N cambio(s) de
  {nombre} que se subirán cuando esa persona inicie sesión en este dispositivo.", con singular y
  plural, y "Pídele que inicie sesión pronto." si `antiguo`.

**Checkpoint**: las 5 historias funcionan.

---

## Phase 8: Polish & Cross-Cutting

- [X] T040 Verificar la migración Dexie v8→v9 en Chromium real con el skill `run-indentory`,
  siguiendo la sección "Migración Dexie v9" de quickstart.md (build `2.1.0` → build de la rama).
  Anotar el resultado en el PR.
- [X] T041 Recorrer los escenarios manuales 1–12 de quickstart.md contra Supabase local y tomar
  capturas del indicador en cada estado y del panel con `run-indentory`.
- [X] T042 [P] Comprobar que el indicador, el botón y el campo nuevo de Ajustes miden al menos
  48×48 px en móvil (Constitución III).
- [X] T043 [P] En `../1stDocs/002-backlog/002-DentdeLion.md`, en "Operación y seguridad", agregar:
  "`pushItemsCompra` falla el lote completo si hay ítems nuevos de otro usuario sin subir en un
  dispositivo compartido (spec 012 research R4)". Marcar como hecho el ítem "Indicador visible de
  cambios pendientes…". En `../1stDocs/005-roadmap/002-DentdeLion.md`, poner la 012 en 🟡 o ✅
  según el estado del PR.
- [X] T044 Correr `npm run lint && npm run build && npm test && npm run test:rls`, todo verde.
- [X] T045 Descripción del PR: orden de despliegue (migración antes que el front), los arreglos R4
  y R5, la posibilidad de eventos nuevos en Sentry (R1) y el resultado de T040.

---

## Dependencies & Execution Order

- **Phase 1** (T001, T002): sin dependencias y en paralelo.
- **Phase 2**: T003–T005 en paralelo, primero. Luego T006 → T007 → T008 → T009 → T010 → T011 →
  T012 → T013 → T014 → T015, todas en `src/lib/sync/index.ts` o dependientes de su tipo. T013 solo
  depende de T006.
- **US1** (Phase 3): depende de la Phase 2. Es el MVP.
- **US2**: depende de US1 (T020/T021). **US3** depende de US2 (el botón vive en el panel).
- **US4**: depende de US2 para el bloque del panel. T030–T033 pueden hacerse justo después de la
  Phase 2, en paralelo con US1.
- **US5**: depende de US2 para el bloque del panel. T037 puede hacerse justo después de T006.
- **Polish**: al final. T043 en cualquier momento.

```text
Setup ─► Foundational ─► US1 (MVP) ─► US2 ─┬─► US3
                                            ├─► US4
                                            └─► US5 ─► Polish
```

## Parallel Examples

- **Phase 2 tests**: T003, T004 y T005 a la vez (archivos distintos).
- **US1**: T016 y T017 a la vez; después, T018 y T019 en paralelo antes de T020.
- **Después de la Phase 2**, en paralelo con US1: T030 (test:rls), T031–T033 (umbral en Ajustes) y
  T037 (`usuariosConocidos`).
- **US4 y US5**: tras US2 se pueden repartir; ambos tocan `indicador.ts` y `SyncSheet.tsx`, así que
  hay que fusionar con cuidado o hacerlos en serie.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**. Ya resuelve el objetivo del roadmap ("ver si hay cambios
   sin subir") y arregla R4 y R5. Se puede publicar solo, con la migración aplicada antes.
2. **+ US2 + US3**: el panel con la última sincronización y "Sincronizar ahora".
3. **+ US4 + US5**: el umbral configurable y los avisos de otros usuarios.
4. **Polish**: la migración en Chromium real, el quickstart, la documentación en 1stDocs y el PR.
