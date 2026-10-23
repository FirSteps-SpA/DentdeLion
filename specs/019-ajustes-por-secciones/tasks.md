---

description: "Task list for 019-ajustes-por-secciones"
---

# Tasks: Ajustes por secciones

**Input**: Design documents from `/specs/019-ajustes-por-secciones/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ. plan.md (Testing) y research.md R8 las definen; SC-007 exige que los casos actuales de
`tests/integration/ajustes.test.tsx` sigan pasando. Patrón del proyecto: Vitest + RTL con `fireEvent`
(no hay `user-event`), helpers de `tests/helpers/` (`memoryDb.ts`, `lugarFalso.ts`, `tenancy.ts`,
`clienteFalso.ts`, `consultaFalsa.ts`, `tablasMemoria.ts`). Verificación visual con `run-indentory`.

**Organization**: por historia de spec.md. `R#` = research.md, "UI §n" = `contracts/ui-contracts.md`,
"QS §n" = quickstart.md, "DM" = data-model.md. Sin esquema, migración, versión de Dexie ni `test:rls`
nuevos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US4 de spec.md

---

## Phase 1: Setup

- [ ] T001 Confirmar la línea base en la rama `019-ajustes-por-secciones`: `npm run lint && npm test`
  en verde antes de tocar código, y anotar el número de pruebas y archivos para comparar en T036.

---

## Phase 2: Foundational

**Purpose**: el registro de secciones y el manejo de la URL que usan US1 y US2 (R1, R2). US3 y US4 no
dependen de esta fase.

- [ ] T002 [P] Escribir `tests/unit/ajustes/secciones.test.ts` (parte de visibilidad): el orden de
  `SECCIONES_AJUSTES` es `perfil, lugares, avisos, categorias, baja`; `seccionesVisibles('administrador')`
  devuelve las cinco en ese orden; `seccionesVisibles('personal')` devuelve solo `perfil` y `avisos`;
  `titulo(true)`/`titulo(false)` da "Perfil y equipo"/"Perfil" y "Notificaciones y avisos"/
  "Notificaciones", y el mismo título en ambos roles para el resto (tabla de UI §2); `esIdSeccion`
  acepta los cinco ids y rechaza `'proveedores'`, `''` y `'x'`.
- [ ] T003 [P] Escribir `tests/unit/ajustes/seccionUrl.test.ts` (UI §4) con `window.history` y
  `location` de jsdom, restaurando la URL en `afterEach`: `leerSeccionDeUrl('#ajustes/categorias')` →
  `'categorias'`; `'#ajustes/nada'`, `'#otra'` y `''` → `null`; `abrirSeccion('lugares')` deja
  `location.hash === '#ajustes/lugares'` y `history.state` con `{ ajustes: 'lugares' }` y suma una
  entrada; `cerrarSeccion()` tras `abrirSeccion` llama `history.back()` (espiado); `cerrarSeccion()`
  sin `history.state.ajustes` (llegada por recarga) usa `replaceState` y deja la URL sin hash
  conservando `pathname` y `search`; `cerrarSeccion({ reemplazar: true })` siempre usa `replaceState`;
  `limpiarSeccionDeUrl()` no toca una URL sin `#ajustes/`; `useSeccionAjustes` (con `renderHook`)
  devuelve la sección inicial del hash y se actualiza al disparar `popstate`/`hashchange`.
- [ ] T004 Implementar `src/features/ajustes/lib/secciones.ts` (R2, DM): tipo `IdSeccion`, interfaz
  `SeccionAjustes` (`id`, `titulo(esAdmin)`, `Icon`, `soloAdministracion`), constante
  `SECCIONES_AJUSTES` con íconos de `src/components/icons` (agregar ahí con `deLucide` los que falten:
  `CircleUserRound` o `User` para perfil, `MapPin` para lugares, `Bell` para avisos, `Tags` para
  categorías, `Archive` para dados de baja, `ChevronRight` para la tarjeta), `seccionesVisibles(rol)` y
  `esIdSeccion(valor)`. Comentario que deje dicho que la spec 021 agrega `'proveedores'` entre
  `categorias` y `baja`. T002 en verde.
- [ ] T005 Implementar `src/features/ajustes/lib/seccionUrl.ts` (R1, UI §4): `leerSeccionDeUrl`,
  `abrirSeccion`, `cerrarSeccion`, `limpiarSeccionDeUrl` y el hook `useSeccionAjustes`, validando con
  `esIdSeccion`. Comentario breve: la app no tiene rutas; el hash solo guarda la sección de Ajustes
  para conservarla al recargar y que el "atrás" vuelva al índice, y no choca con `?invitacion=`
  (`features/auth/invitacion.ts`). T003 en verde.

**Checkpoint**: registro y URL listos y probados; ninguna pantalla cambió todavía.

---

## Phase 3: User Story 1 - Abrir Ajustes en un índice y entrar solo a la sección que necesito (Priority: P1) 🎯 MVP

**Goal**: Ajustes abre en un índice de tarjetas con resumen; cada tarjeta abre su sección con "Volver";
la sección se conserva al recargar y el "atrás" vuelve al índice; todo lo de la página actual sigue en
alguna sección con el mismo comportamiento (FR-001 a FR-010).

**Independent Test**: QS §2. Como administradora, abrir "Más": cinco tarjetas con resumen; tocar
"Categorías": sola, con "Volver" y `#ajustes/categorias`; recargar: sigue en Categorías; "atrás":
índice.

### Tests for User Story 1

- [ ] T006 [P] [US1] Ampliar `tests/unit/ajustes/secciones.test.ts` con `resumenSeccion(id, datos)`
  (tabla de R3): perfil → `"Admin Uno · Administradora"` / `"Personal Uno · Personal"`; lugares → `"1
  lugar"`, `"3 lugares"` (solo activos); avisos personal → `"Stock bajo y caducidad"`, `"Solo stock
  bajo"`, `"Solo caducidad"`, `"Desactivadas"`; avisos admin → lo mismo + `" · Avisos a 30, 15 y 7 días"`
  (y `" · Aviso a 30 días"` con un solo nivel); categorías → `"1 categoría"`, `"12 categorías"`, `"Sin
  categorías"` (sin contar desactivadas); baja → `"1 insumo dado de baja"`, `"3 insumos dados de baja"`,
  `"Sin insumos dados de baja"`; `null` si los datos de esa sección no están listos.
- [ ] T007 [US1] Reorganizar `tests/integration/ajustes.test.tsx` para entrar por el índice (SC-007):
  helper local `abrirSeccionAjustes(titulo)` que hace `fireEvent.click` en
  `screen.getByRole('button', { name: titulo })`; cada `describe` existente (Configuración de Alertas,
  Perfil, Categorías, Lugares, Insumos dados de baja, Notificaciones, rueda del mouse) abre su sección
  primero y conserva **todas** sus aserciones; los casos "hides … for a non-administrador" pasan a
  comprobar que la tarjeta no existe en el índice (el detalle de personal va en T019). Limpiar la URL
  (`history.replaceState(null, '', '/')`) en `beforeEach`. El caso del mínimo por insumo y su prueba de
  rueda se mueven a T021 si cambian de comportamiento; aquí quedan los de niveles y horas.
- [ ] T008 [US1] Agregar a `tests/integration/ajustes.test.tsx` un `describe('Índice de Ajustes (spec
  019 US1)')`: (1) sin hash, se ve el `<h1>` "Ajustes" y las cinco tarjetas en orden (consultar
  `within(lista).getAllByRole('button')`) con sus resúmenes; (2) tocar "Categorías" muestra el `<h1>`
  "Categorías", el botón "Volver a Ajustes", el contenido de categorías, `location.hash ===
  '#ajustes/categorias'`, y ya no muestra las otras tarjetas ni los accesos a Compras/Reportes; (3)
  "Volver" regresa al índice y el foco queda en la tarjeta "Categorías"; (4) `history.back()` +
  `popstate` también regresa; (5) montar con `#ajustes/lugares` ya en la URL abre directo "Lugares de
  trabajo" y "Volver" deja la URL sin hash; (6) renombrar una categoría, volver, y el resumen de la
  tarjeta sigue correcto (FR-008); (7) con `onNavegar`, Compras y Reportes están arriba del índice y
  `onNavegar('compras')` se llama al tocarlo; (8) "Perfil y equipo" contiene "Cerrar sesión" y la
  sección de Equipo (mock de `listarEquipo` como en `equipo-invitacion.test.tsx`).
- [ ] T009 [P] [US1] Ampliar `tests/integration/navegacion-responsiva.test.tsx` (o `tests/unit/App.test.tsx`
  si ahí se monta `App`): con `#ajustes/avisos` en la URL al montar, la vista inicial es Ajustes con
  "Notificaciones y avisos" abierta; con una sección abierta, cambiar a "Inventario" desde la barra
  deja la URL sin `#ajustes/` y volver a "Más"/"Ajustes" muestra el índice (FR-006).

### Implementation for User Story 1

- [ ] T010 [US1] Implementar `resumenSeccion(id, datos)` en `src/features/ajustes/lib/secciones.ts`
  (R3) como función pura: recibe `{ usuario, lugares, lugaresListos, categorias, insumosDadosDeBaja,
  inventarioListo, preferenciaStockBajo, preferenciaCaducidad, nivelesAvisoDias, esAdministrador }`,
  con singular/plural y textos de cero de la tabla; niveles ordenados de mayor a menor y unidos con
  ", " e " y ". Exportar un hook `useResumenesAjustes()` que lee esos datos de `authStore`,
  `lugarStore` (`lugaresActivos`), `inventoryStore` y `alertasStore`. T006 en verde.
- [ ] T011 [P] [US1] Crear `src/features/ajustes/components/TarjetaSeccion.tsx` (UI §2): `<button
  type="button">` dentro de una `Card`, alto mínimo 72 px, ícono `aria-hidden`, título `text-h3`,
  resumen `text-sm text-text-muted truncate` con `id` propio y `aria-describedby`, `ChevronRight` a la
  derecha, foco visible del DS; acepta `ref` (para devolverle el foco al volver).
- [ ] T012 [US1] Crear `src/features/ajustes/components/AjustesIndice.tsx` (UI §2, R6): `<h1>`
  "Ajustes"; accesos a Compras y Reportes movidos tal cual desde `AjustesView.tsx` (`md:hidden`, solo con
  `onNavegar`, mismos comentarios de spec 016/017); `<ul>` en `grid grid-cols-1 gap-3 md:grid-cols-2
  xl:grid-cols-3` dentro de `max-w-5xl`, una `TarjetaSeccion` por `seccionesVisibles(rol)` con su
  resumen de `useResumenesAjustes()`. Props: `onAbrir(id)`, `enfocar?: IdSeccion` (tarjeta que recibe el
  foco al montar), `onNavegar?`.
- [ ] T013 [US1] Dividir `src/features/ajustes/components/ConfiguracionAlertasSection.tsx` (R2):
  renombrar a `AvisosSection.tsx` con solo "niveles de aviso de caducidad" y "aviso de cambios sin
  subir" (mismo código, handlers y mensajes), y mover el editor de mínimos **sin cambiar su
  comportamiento** a `src/features/ajustes/components/MinimosPorInsumoSection.tsx` (US3 lo reescribe).
  Actualizar imports y el comentario de spec 010.
- [ ] T014 [P] [US1] Agregar la prop opcional `sinTitulo?: boolean` a `LugaresSection.tsx`,
  `CategoriasSection.tsx` e `InsumosBajaSection.tsx` en `src/features/ajustes/components/`: con `true`
  no se renderiza su `<h2>` (el título lo pone la subpantalla); sin la prop, igual que hoy.
- [ ] T015 [US1] Crear `src/features/ajustes/components/SeccionAjustesPantalla.tsx` (UI §3): fila con
  `TouchButton variant="ghost"` (`ArrowLeft`, texto "Volver", `aria-label="Volver a Ajustes"`) y `<h1
  tabIndex={-1}>` con el título por rol, que recibe el foco al montar; contenido dentro de `max-w-3xl`
  según la tabla de UI §3 (perfil: `PerfilSection` + `EquipoSection` si es admin; lugares, categorías y
  baja con `sinTitulo`; avisos: `NotificacionesSection` + si es admin `AvisosSection` y
  `MinimosPorInsumoSection`).
- [ ] T016 [US1] Reescribir `src/features/ajustes/components/AjustesView.tsx` (UI §1): usa
  `useSeccionAjustes()`; sin sección → `AjustesIndice`; con sección → `SeccionAjustesPantalla` con
  `onVolver={cerrar}`; al volver pasa `enfocar` con la sección cerrada y restaura el desplazamiento
  guardado al abrir (`window.scrollY` en un `useRef`). Actualizar el comentario de cabecera (spec 019,
  reemplaza el layout de spec 013 FR-011 de perfil y notificaciones en dos columnas). T007 y T008 en
  verde.
- [ ] T017 [US1] Integrar la URL en `src/app/App.tsx` (R1, UI §4): estado inicial `useState<Vista>(() =>
  leerSeccionDeUrl() ? 'mas' : 'inicio')`; envolver el `onCambiarVista` que recibe `AppShell` (y los
  `onNavegar` de Inicio/Reportes/Ajustes) en una función que llama `limpiarSeccionDeUrl()` antes de
  `setVista`. No tocar el manejo de `?invitacion=`. T009 en verde.

**Checkpoint**: Ajustes por secciones funcionando para administración, con los casos anteriores en
verde. Es el MVP.

---

## Phase 4: User Story 2 - Ver solo las secciones que me corresponden según mi rol (Priority: P1)

**Goal**: personal ve solo "Perfil" y "Notificaciones"; ninguna parte de administración aparece por
ningún camino, ni tras un cambio de rol (FR-011 a FR-013).

**Independent Test**: QS §3. Con una cuenta de personal: dos tarjetas; dentro, sin equipo ni avisos de
administración; `#ajustes/categorias` + recarga → índice.

### Tests for User Story 2

- [ ] T018 [US2] Agregar a `tests/integration/ajustes.test.tsx` un `describe('Permisos por rol (spec 019
  US2)')`: (1) personal ve exactamente dos tarjetas, "Perfil" y "Notificaciones", con resúmenes de
  personal (sin niveles de aviso); (2) en "Perfil" ve nombre, correo, rol y "Cerrar sesión", y no
  "Equipo" ni "Invitar"; (3) en "Notificaciones" ve los dos interruptores y no "niveles de aviso",
  "cambios sin subir" ni "Stock mínimo por insumo"; (4) montar como personal con `#ajustes/categorias`
  muestra el índice y deja la URL sin hash (con `replaceState`, sin sumar entrada); (5) como admin con
  "Lugares de trabajo" abierta, `useAuthStore.setState({ usuario: { ...admin, rol: 'personal' } })`
  dentro de `act` cierra la sección y muestra el índice de personal; (6) admin ve las cinco tarjetas y,
  en "Notificaciones y avisos", interruptores, niveles, horas y mínimos.

### Implementation for User Story 2

- [ ] T019 [US2] En `src/features/ajustes/components/AjustesView.tsx` (R7): si la sección abierta no
  está en `seccionesVisibles(usuario.rol)`, un `useEffect` llama `cerrarSeccion({ reemplazar: true })`
  y se renderiza el índice en ese mismo render (no mostrar la sección ni un instante). Confirmar que
  `SeccionAjustesPantalla` y `AjustesIndice` toman los títulos por rol del registro y que las partes de
  administración de `perfil` y `avisos` están detrás de `esAdministrador`. T018 en verde.

**Checkpoint**: US1 + US2 cubren el pedido de la clienta completo para los dos roles.

---

## Phase 5: User Story 3 - Encontrar y cambiar el mínimo de un insumo en el lugar donde trabajo (Priority: P2)

**Goal**: el editor de stock mínimo tiene buscador y "Ver más", y edita el mismo mínimo que la edición
del insumo: el del lugar activo con varios lugares (con "Propio"/"General"), solo lectura en "Todos", el
del catálogo con un solo lugar (FR-014 a FR-021).

**Independent Test**: QS §4. Con dos lugares, en A buscar "guantes", cambiar su mínimo: rige en las
alertas de A, no cambia B y la edición del insumo en A muestra el mismo valor.

### Tests for User Story 3

- [ ] T020 [P] [US3] Escribir `tests/unit/ajustes/minimosEditor.test.ts` para
  `filasMinimos(insumos, minimosLugar, seleccion, lugares, busqueda)` (R4, DM `FilaMinimo`): un lugar
  activo → `modo: 'catalogo'` con `minimo = insumo.stockMinimo`; dos lugares y uno elegido → `modo:
  'lugar'`, `origen: 'lugar'` con fila propia no nula, `origen: 'catalogo'` sin fila o con `stockMinimo:
  null`; `'todos'` → `modo: 'todos'` con `porLugar` de cada lugar **activo** (no los desactivados);
  orden por nombre con `localeCompare('es')`; búsqueda `"guantes"`, `"GUANTÉS"` y `"ánte"` encuentran
  "Guantes de nitrilo"; insumos con `dadoDeBajaEn` no aparecen; búsqueda vacía o solo espacios no filtra.
- [ ] T021 [US3] Crear `tests/integration/ajustes-minimos.test.tsx` (mismo arranque que
  `ajustes.test.tsx`: `memoryDb`, `reflejarStore`, `lugarFalso`), con 30 insumos y dos lugares: (1) se
  ven 25 filas y "Ver más (quedan 5)", que muestra las 30; (2) buscar reduce la lista, muestra "N
  insumos" y vuelve a 25 filas; sin coincidencias, "Ningún insumo coincide con “x”" y "Limpiar
  búsqueda"; (3) con el lugar A activo, cambiar un mínimo y hacer `blur` guarda una fila en
  `db.minimosLugar` para (insumo, A) con `sincronizado: false`, la insignia pasa a "Propio" y
  `db.insumos` no cambia; (4) borrar el valor guarda `stockMinimo: null` y vuelve a "General"; (5)
  cambiar al lugar B recarga los valores (el campo muestra el de B, no el de A); (6) con "Todos", no hay
  campos editables, cada insumo lista A y B, y se ve el aviso para elegir un lugar; (7) con un solo
  lugar, no hay insignias ni texto de lugar y el cambio va a `db.insumos.stockMinimo`; (8) un valor
  negativo o decimal en un insumo de unidades enteras muestra el error de `validarStockMinimo` con
  `role="alert"` y no guarda; (9) coherencia (SC-004): tras el cambio en A, `EditarInsumoForm` montado
  con el lugar A activo muestra el mismo valor en "mínimo en este lugar"; (10) la rueda del mouse no
  cambia el campo (helper `esperarQueLaRuedaNoCambie`, spec 018).

### Implementation for User Story 3

- [ ] T022 [US3] Implementar `src/features/ajustes/lib/minimosEditor.ts` (R4): `filasMinimos` usando
  `minimoEfectivo` de `src/features/insumos/lib/minimos.ts`, `lugaresActivos`/`hayVariosLugares` de
  `src/stores/lugarStore.ts` y `plegar` de `src/features/insumos/lib/categorias.ts`; más
  `TAMANO_PAGINA_MINIMOS = 25`. T020 en verde.
- [ ] T023 [US3] Reescribir `src/features/ajustes/components/MinimosPorInsumoSection.tsx` según UI §5:
  `<h2>` "Stock mínimo por insumo"; texto de contexto por modo con el nombre del lugar activo
  (`useLugarStore`); buscador `IconField` con `Search` y `type="search"`; contador o mensaje sin
  coincidencias con "Limpiar búsqueda"; filas con `Badge` "Propio"/"General" en modo lugar y
  `NumeroInput` (`key` = `insumo.id + lugarId`, placeholders de UI §5, guardado en `onBlur`); en modo
  lugar guarda con `guardarMinimoLugar(insumo, lugarId, valor)`, en modo catálogo con
  `actualizarStockMinimo` (`src/features/alertas/lib/configuracion.ts`); valida antes con
  `validarStockMinimo(valor, insumo.unidadMedida)` y muestra el error bajo la fila con `role="alert"`;
  modo todos en solo lectura con `"<lugar>: <n> (propio|general)"`; "Ver más (quedan N)" que suma 25 y
  se reinicia al cambiar búsqueda o lugar. Usar los insumos del catálogo de `useInventoryStore` (no los
  de la vista de lugar, que ya traen el mínimo efectivo) y `minimosLugar` del mismo store. T021 en
  verde.
- [ ] T024 [US3] Verificar que `src/features/insumos/components/EditarInsumoForm.tsx` no necesita
  cambios (la regla ya coincide, DM) y que el caso del mínimo por insumo movido desde
  `tests/integration/ajustes.test.tsx` (T007) quedó cubierto por T021; si algún texto del editor cambió,
  ajustar solo esas aserciones.

**Checkpoint**: un mínimo cambiado desde Ajustes se ve igual en la edición del insumo y en las alertas
del lugar.

---

## Phase 6: User Story 4 - Que lleguen todos los mínimos por lugar a cada dispositivo (Priority: P3)

**Goal**: la descarga de `minimos_lugar` trae todas las filas aunque superen `max_rows`, por cursor de
clave compuesta, sin aplicar nada si una página falla y sin pisar cambios locales (FR-022, FR-023).

**Independent Test**: QS §5. `tests/unit/sync-minimos-lugar-paginacion.test.ts` con 2.500 filas remotas:
llegan todas.

### Tests for User Story 4

- [ ] T025 [US4] Extender los helpers de pruebas para tablas sin `id` (R5): en
  `tests/helpers/consultaFalsa.ts`, `order(columna)` acumula columnas y `resolver` ordena por ellas (por
  defecto `id`, como hoy); `or(filtro)` interpreta el patrón `a.gt.X,and(a.eq.X,b.gt.Y)` y filtra por
  tupla; `Fila` deja de exigir `id`. En `tests/helpers/clienteFalso.ts`, `upsert` usa como clave
  `fila.id ?? \`${fila.insumo_id}|${fila.lugar_id}\``. Confirmar que `tests/unit/sync-paginacion.test.ts`
  sigue en verde sin cambios.
- [ ] T026 [US4] Escribir `tests/unit/sync-minimos-lugar-paginacion.test.ts` con el patrón de
  `sync-paginacion.test.ts` (`memoryDb`, `clienteFalso`, `estado.maxRows = 1000`): (1) 2.500 filas
  remotas con 50 insumos × 50 lugares (ids que comparten `insumo_id` entre páginas) → `runSyncBatch`
  deja 2.500 en `db.minimosLugar` sin duplicados y pide 3 páginas; (2) `estado.errorEnPagina
  .minimos_lugar = 2` → no se aplica ninguna fila nueva y el ciclo registra el error `pull
  minimos_lugar`; (3) una fila local con `sincronizado: false` (como administradora) no se pisa con el
  valor remoto; (4) el siguiente ciclo tras el error completa todas.

### Implementation for User Story 4

- [ ] T027 [US4] Generalizar `seleccionarTodo` en `src/lib/sync/paginar.ts` (UI §6, R5): tercer
  parámetro `opciones?: { clave?: string[]; tamanoPagina?: number } | number` (un número sigue
  significando `tamanoPagina`, para no romper llamados ni pruebas actuales); con `clave` de una columna,
  igual que hoy sobre esa columna; con dos, `order(a).order(b).limit(n)` y desde la segunda página
  `.or(\`${a}.gt.${va},and(${a}.eq.${va},${b}.gt.${vb})\`)`. Tipar `T` sin exigir `id` cuando se pasa
  `clave`. Actualizar el comentario de spec 017 mencionando la clave compuesta (spec 019).
- [ ] T028 [US4] En `src/lib/sync/index.ts`, `pullMinimosLugar` usa `seleccionarTodo(client,
  'minimos_lugar', { clave: ['insumo_id', 'lugar_id'] })`, manteniendo `ciclo.registrar`, el `return`
  ante error y el filtro `conservarCambioLocal`. T026 en verde.

**Checkpoint**: deuda de la tanda cerrada; el editor de US3 siempre ve los mínimos completos.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Revisar con el DS los tamaños táctiles (Constitución III): tarjetas ≥ 72 px, "Volver",
  "Ver más", "Limpiar búsqueda" y los `NumeroInput` del editor con `touch-target`; foco visible en
  tarjetas y "Volver" navegando con Tab.
- [ ] T030 [P] Confirmar que `tests/unit/lecturas-movimientos.test.ts` y
  `tests/unit/sin-input-number-suelto.test.ts` siguen pasando sin agregar permitidos.
- [ ] T031 Recorrido manual QS §2–§4 con `run-indentory` en Chromium: recarga con sección abierta,
  "atrás" del navegador, cambiar de vista y volver, personal con `#ajustes/categorias`, editor de
  mínimos con dos lugares y con "Todos", un cambio sin conexión que se sube al reconectar.
- [ ] T032 Capturas QS §6 con `run-indentory`: índice y "Notificaciones y avisos" en 360, 768 y 1280 px,
  como administradora y como personal (12 capturas); revisar que cada control de la página anterior
  aparece en alguna sección (SC-007) y que el índice cabe en una pantalla de 360 × 640 (SC-002).
- [ ] T033 Revisar `src/app/AppHeader.tsx` y el selector de lugar: cambiar de lugar con el editor de
  mínimos abierto mantiene la sección abierta y recarga los valores (edge case "lugar activo
  desactivado" incluido).
- [ ] T034 Correr `npm run lint && npm run build && npm test`, todo verde, con más pruebas que en T001.
- [ ] T035 [P] En `../1stDocs`, actualizar `005-roadmap/002-DentdeLion.md` (019 hecha, con las
  decisiones de Clarifications: sección en la URL, mínimo por lugar activo, misma navegación en
  desktop; resumen de Perfil sin conteo de equipo; deuda `minimos_lugar` cerrada) y
  `002-backlog/002-DentdeLion.md` (sección "AJUSTES" tachada con la referencia a la spec).
- [ ] T036 Descripción del PR a `develop`: índice y secciones, sección en el hash (R1), permisos, el
  cambio de qué mínimo edita Ajustes (R4, DM) y por qué, descarga paginada de `minimos_lugar` (R5),
  notas para 020/021 (plan.md), resultado de T031 y capturas de T032. Sin migración: se despliega solo
  el front.

---

## Dependencies & Execution Order

- **Setup** (T001) → todo lo demás.
- **Foundational** (T002–T005): T002 → T004; T003 → T005; T005 depende de T004 (`esIdSeccion`).
  Bloquea US1 y US2.
- **US1** (T006–T017): depende de Foundational. T006 → T010; T010 → T012; T011, T013 y T014 en
  paralelo; T012 + T013 + T014 + T015 → T016 → T017. T007/T008 se escriben antes de T016 (fallan hasta
  entonces); T009 antes de T017. MVP.
- **US2** (T018–T019): depende de US1 (T016).
- **US3** (T020–T024): T020 → T022; T013 (archivo movido) → T023; T021 → T023 en verde. Independiente
  de US2 y US4; la parte visual necesita US1 para llegar al editor, pero T020/T022 pueden hacerse
  desde el inicio.
- **US4** (T025–T028): independiente de todo salvo T001. T025 → T026 → T027 → T028.
- **Polish** (T029–T036): al final; T035 y T036 después de T034.

```text
Setup ─┬─► Foundational ─► US1 (MVP) ─┬─► US2 ──┐
       │                              └─► US3 ──┼─► Polish
       ├─► (T020, T022 de US3) ─────────────────┤
       └─► US4 ─────────────────────────────────┘
```

## Parallel Examples

- **Inicio**: T002, T003, T020 y T025 en paralelo (archivos distintos).
- **US1**: T011, T013 y T014 en paralelo; T006 y T009 en paralelo con ellos.
- **US3**: T020 y T021 en paralelo; luego T022 → T023.
- **Entre historias**: US4 completa en paralelo con Foundational + US1.
- **Polish**: T029 y T030 en paralelo; T035 en paralelo con T036.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: Ajustes por secciones para administración, con todo lo actual
   en verde. Ya cumple el pedido visible de la clienta.
2. **+ US2**: permisos por rol en la nueva estructura (necesario antes de publicar: sin US2, personal
   vería tarjetas de administración).
3. **+ US3**: editor de mínimos con buscador y la regla por lugar.
4. **+ US4**: descarga completa de mínimos (puede ir antes o en paralelo; no tiene UI).
5. **Polish**: recorrido manual, capturas, 1stDocs y PR. No se publica US1 sin US2.
