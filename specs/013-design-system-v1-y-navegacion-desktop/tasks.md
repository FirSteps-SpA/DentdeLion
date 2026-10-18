---

description: "Task list for 013-design-system-v1-y-navegacion-desktop"
---

# Tasks: Design System v1.0 y Navegación Desktop

**Input**: Design documents from `/specs/013-design-system-v1-y-navegacion-desktop/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: SÍ, las que define research.md R14: contraste, resumen de Inicio, disposición e integración
de navegación, Inicio y tabla. Se usa el patrón del proyecto: Vitest + RTL, `memoryDb` o stores con
`setState`. La verificación visual se hace con el skill `run-indentory`.

**Organization**: por historia de usuario de spec.md. "DS §N" remite a
`ref/2026-10-17-design-system/000-design-system.md`; `R#` a research.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias pendientes)
- **[Story]**: US1–US5 de spec.md

---

## Phase 1: Setup

- [ ] T001 Agregar la dependencia `lucide-react@^1.59` con `npm install lucide-react` (actualiza
  `package.json` y `package-lock.json`). Comprobar que `npm run build` sigue en verde.
- [ ] T002 [P] En `src/styles/index.css`, agregar `@import '@fontsource/manrope/latin-600.css';` junto
  a los demás pesos y cambiar `:root { color-scheme: light dark; }` por `color-scheme: light` (R4,
  R12).

---

## Phase 2: Foundational (tokens, íconos, componentes base, disposición)

**Purpose**: base que todas las historias usan.

**⚠️ CRITICAL**: completar antes de las historias.

- [ ] T003 En el `@theme` de `src/styles/index.css`, reemplazar los valores y agregar los tokens nuevos
  según la tabla de data-model.md:
  - **Color**: `bg`, `bg-secondary`, `surface`, `border`, `border-input`, `text`, `text-muted`,
    `text-faint`, `primary`, `primary-dark`, `primary-active`, `primary-soft`, `primary-text`,
    `brand`, `brand-icon` y `teal-dark`.
  - **Estados**: success, warning-30, urgent-7, urgent-1, danger e info, con sus variantes
    `-bg`/`-text`/`-icon`/`-dot`.
  - **Formas y breakpoint**: `--radius-sm|md|lg|xl|pill`, `--shadow-card|modal|dropdown` (DS §11) y
    `--breakpoint-desk: 75rem`.

  Mantener los nombres existentes para que las clases actuales sigan resolviendo. Actualizar el
  comentario de cabecera para que referencie la spec 013 y el contrato de tokens.
- [ ] T004 [P] Crear `tests/unit/contraste.test.ts`:
  - leer `src/styles/index.css` con `fs`;
  - extraer los `--color-*` del bloque `@theme` con una expresión regular;
  - implementar la luminancia relativa y el contraste WCAG 2.1;
  - verificar **cada fila** de la tabla "Pares verificados" de `contracts/design-tokens.md`, con un
    `it.each` y el mínimo de cada fila (4,5 o 3);
  - verificar que los cuatro niveles de caducidad (`warning-30`, `urgent-7`, `urgent-1` y `danger`)
    tengan fondos distintos entre sí y que, dentro de cada familia (ámbar: `warning-30`/`urgent-7`;
    rojo: `urgent-1`/`danger`), la luminancia relativa de los fondos difiera al menos 0,05
    (data-model.md).

  Debe fallar antes de T003 y pasar después.
- [ ] T005 En `src/styles/index.css`, agregar las utilidades de la escala tipográfica del DS §5, una
  `@utility` por nivel: `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body-lg`, `text-body`,
  `text-body-sm`, `text-caption` y `text-num`, con tamaño, interlineado, peso y tracking según
  `contracts/design-tokens.md`.
- [ ] T006 Reescribir `src/components/icons/index.tsx` como adaptador de Lucide (R3):
  - mantener la exportación de `IconProps` (`size`, `className`);
  - re-exportar **todos** los nombres actuales (`Search Scan Calendar Hash Truck Bell Package
    PackageMinus Check AlertTriangle ChevronDown ChevronRight Plus Minus Mail X Lock ShoppingCart
    Settings MoreVertical Undo Pencil Share Copy Trash User Building Tag ArrowsSync CloudOff Clock`),
    cada uno envolviendo el ícono Lucide de la tabla de R3 con `strokeWidth={2}`, `aria-hidden` y
    `size` por defecto 20;
  - agregar `House`, `Boxes`, `CircleCheck`, `CircleAlert`, `Menu`, `PanelLeftClose`,
    `PanelLeftOpen` y `ArrowLeft`.

  Importar ícono por ícono desde `lucide-react` (nunca `import *`) para que el bundle quede
  tree-shaken. Correr `npx tsc -b` para confirmar que ningún import de los 27 archivos se rompe.
- [ ] T007 En `src/components/icons/index.tsx`, reemplazar `Tooth` (hoy relleno) por un SVG propio
  outline y geométrico: `viewBox` 24, `stroke="currentColor"`, `strokeWidth` 2 y uniones redondeadas
  (DS §7, "Icono DentDelion"). Guardar el mismo dibujo como `public/icons/icon.svg`, en turquesa
  `#12B8AE` sobre `#F8FCFC` con margen de seguridad para íconos *maskable*.
- [ ] T008 [P] Crear `tests/helpers/matchMedia.ts` con `simularAncho(px)`, que define
  `window.matchMedia` evaluando consultas `(min-width: Npx)`, notifica a los listeners registrados al
  cambiar de ancho y ofrece `restaurarMatchMedia()`.
- [ ] T009 Crear `src/app/useDisposicion.ts` (R5): `useDisposicion(): 'movil' | 'tablet' | 'desktop'`
  con `useSyncExternalStore`, sobre `matchMedia('(min-width: 768px)')` y
  `matchMedia('(min-width: 1200px)')`. Si `window.matchMedia` no existe devuelve `'movil'`, y el
  valor del servidor también es `'movil'`.
- [ ] T010 [P] Crear `tests/unit/useDisposicion.test.ts` con `simularAncho`: 767 da `movil`, 768 da
  `tablet`, 1199 da `tablet`, 1200 da `desktop`; sin `matchMedia` da `movil`; cambiar de ancho con el
  hook montado re-renderiza con el valor nuevo.
- [ ] T011 Crear `src/app/navegacion.ts`:
  - mover aquí `type Vista` desde `src/app/BottomNav.tsx`, por ahora `'inventario' | 'compras' |
    'alertas' | 'mas'` (`'inicio'` se agrega en US3);
  - exportar `SECCIONES: { vista, etiquetaMovil, etiquetaLateral, Icon }[]` según la tabla de
    data-model.md, con los íconos del DS desde ya (Inventario `Boxes`, Compras `ShoppingCart`,
    Alertas `Bell`, Ajustes `Settings`; `mas`: "Más" en móvil y "Ajustes" en la sidebar).

  `BottomNav.tsx` re-exporta `Vista` para no romper imports.
- [ ] T012 [P] Crear `src/stores/layoutStore.ts` (Zustand, R6):
  - `sidebarExpandida` se inicializa desde `localStorage['dentdelion.sidebar'] === '1'` dentro de
    `try/catch`, con `false` por defecto;
  - `alternarSidebar()` invierte el valor y lo persiste en `try/catch`.
- [ ] T013 [P] Restilar `src/components/ui/TouchButton.tsx` según `contracts/design-tokens.md`:
  - `primary`: `bg-primary`, `hover:bg-primary-dark`, `active:bg-primary-active` y el deshabilitado
    del DS;
  - `secondary`: fondo `#E7F7F5` (token nuevo `--color-secondary-bg`) con texto `primary-text`;
  - `ghost`: estilo outline, con texto `teal-dark` y borde `border-input`.

  Todos con radio `md`, padding horizontal de 18 px, 14 px con peso 700 (600 en outline) y anillo de
  foco visible. Se mantiene `touch-target` (48 px).
- [ ] T014 [P] Restilar `src/components/ui/IconField.tsx`:
  - altura mínima de 48 px;
  - borde `border-input`, radio `md` y padding de 14 px;
  - en foco (`focus-within`), borde de 2 px en `brand` con anillo `0 0 0 3px rgb(18 184 174 / .10)`;
  - placeholder en `text-muted`; ícono en `text-muted`, que pasa a `brand-icon` en foco;
  - etiqueta 13/600.
- [ ] T015 [P] Restilar `src/components/ui/Card.tsx` (radio `lg`, borde `border`, `shadow-card`) y
  agregar en el mismo archivo `KpiCard`: un `<button>` con `titulo`, `valor`, `icono`, `tono?` y
  `onClick`. Mínimo 132 px de alto, padding de 20 px, título 13/600 `text-muted` y valor `text-num`.
- [ ] T016 [P] Restilar `src/components/ui/Badge.tsx` con los colores AA de las variantes y agregar la
  prop opcional `icono` (con `CircleCheck`, `TriangleAlert` y `CircleAlert` para los estados del DS
  §21), con radio `pill`. En `src/features/insumos/lib/estado.ts`, agregar la función pura
  `estadoVisual(estadoInsumo)`, que devuelve `{ etiqueta, icono, tono }` según la tabla de
  data-model.md, con "Stock crítico" cuando `stockTotal === 0` y el estado no es de caducidad. No se
  toca `computeEstadoInsumo`. Crear `tests/unit/insumos/estadoVisual.test.ts` con los 5 casos de la
  tabla, más uno que confirme que un insumo con stock 0 y sin stock mínimo **no** aparece en
  `computeInsumosStockBajo` (no hay alerta nueva).
- [ ] T017 [P] Restilar `src/components/ui/Switch.tsx` y `src/components/ui/Stepper.tsx` con los tokens
  nuevos (activo en `primary`, foco con anillo `brand`), sin tocar las áreas táctiles.
- [ ] T018 Hacer responsivo `src/components/ui/BottomSheet.tsx` (R7):
  - en móvil queda igual, con radio superior de 20 px;
  - desde `md`: contenedor `items-center`, panel `md:max-w-[560px] md:rounded-[20px] md:p-6`,
    `shadow-modal` y título 20/700;
  - fondo en `rgb(23 54 61 / .4)`;
  - transición de entrada con `motion-safe:` (FR-021).

  La API no cambia. Correr `npm test` para confirmar que los 12 llamadores siguen en verde.

**Checkpoint**: tokens, íconos, componentes base y disposición listos. `npm test` en verde (con
T004).

---

## Phase 3: User Story 1 - La app se ve como el DS (P1) 🎯 MVP

**Goal**: todas las pantallas actuales con la identidad del DS en el teléfono, sin cambios de flujo.

**Independent Test**: recorrer las 4 secciones en 375 px, comparar con la lámina y completar las
tareas habituales (quickstart #3, #11 y #12; regresión funcional).

- [ ] T019 [US1] Nombre "Dentdelion" (R11):
  - `src/lib/branding.ts`: `APP_NAME = 'Dentdelion'`, y actualizar el comentario para que diga que
    reemplaza el valor de la spec 011;
  - `index.html`: `<title>Dentdelion</title>` y `<link rel="icon" type="image/svg+xml"
    href="/icons/icon.svg">`;
  - `vite.config.ts`: manifest `name`/`short_name` en `'Dentdelion'`, `theme_color: '#0D5360'` y
    `background_color: '#F8FCFC'`;
  - `tests/unit/App.test.tsx`: esperar `'Dentdelion'`.
- [ ] T020 [P] [US1] Crear `scripts/generar-iconos.mjs`, que rasteriza `public/icons/icon.svg` con
  Playwright (`page.setContent` + `screenshot` a 192 y 512 px) y escribe `public/icons/icon-192.png`
  e `icon-512.png`. Correrlo una vez, verificar los PNG a la vista y commitear el script junto con
  los íconos (research R11).
- [ ] T021 [US1] Restilar `src/app/AppHeader.tsx` (móvil):
  - logo con `Tooth` de 32 px en `text-brand` y "Dentdelion" 22/800 `text-teal-dark`;
  - chip de la clínica en `primary-soft`/`primary-text`;
  - `SyncIndicator` y avatar sin cambios de comportamiento;
  - tarjeta con radio `lg` y `shadow-card`.
- [ ] T022 [US1] Restilar `src/app/BottomNav.tsx` según DS §29 y `contracts/ui-contracts.md`:
  - usar `SECCIONES` de `navegacion.ts`;
  - altura de 80 px incluida el área segura, con fondo `surface` y borde superior `border`;
  - íconos de 24 px y etiquetas de 11/600;
  - activo con ícono `brand-icon`, texto `primary-text` y `aria-current="page"`, conservando
    `aria-pressed`; inactivo en `text-muted`;
  - la burbuja no cambia.
- [ ] T023 [P] [US1] Restilar `src/app/AvisosConsumo.tsx` como el toast del DS §37: fondo `bg-text`,
  texto blanco, ícono `CircleCheck` en `#35B779` y radio `md`. Contenido, duración y "Deshacer" sin
  cambios.
- [ ] T024 [P] [US1] Restilar `src/features/insumos/components/InsumoCard.tsx`,
  `InsumoFiltros.tsx`, `ResumenAlertasBanner.tsx` y `SearchPicker.tsx`:
  - nombre de 15/700, secundario `text-muted`;
  - badge de estado desde `estadoVisual` (suficiente / bajo / crítico con stock 0 / caducidad), con
    el ícono del DS §21 (FR-007), en reemplazo de `BADGE_POR_ESTADO`;
  - chips de filtro en radio pill, con el activo en `primary-soft`/`primary-text`;
  - acción "Consumir 1" como `TouchButton` secundario.

  Sin cambios de props ni de comportamiento.
- [ ] T025 [P] [US1] Restilar `src/features/insumos/components/InsumoDetalle.tsx`,
  `AltaMaterialView.tsx`, `ConsumoForm.tsx`, `EditarInsumoForm.tsx`, `InsumoAccionesMenu.tsx`,
  `ConfirmarBajaDialog.tsx` y `ConfirmarLoteCaducadoDialog.tsx`: títulos `text-h2`/`text-h3`,
  secciones con `Card` y botones con las variantes nuevas.
- [ ] T026 [P] [US1] Restilar `src/features/compras/components/*.tsx` (`ComprasView`,
  `ItemSugeridoCard`, `ItemManualCard`, `AgregarItemManualForm`, `RecibirItemForm`,
  `VincularOCrearDialog`): el título "Lista de compras" en `text-h2` y los botones "Compartir" y
  "Agregar" con las variantes del DS §33.
- [ ] T027 [P] [US1] Restilar `src/features/alertas/components/AlertasView.tsx`:
  - cada alerta en `Card` blanca, no en `bg-danger-bg`, con el ícono y el badge de su estado;
  - stock bajo con `TriangleAlert` en `warning-icon`;
  - caducidad por nivel con `Clock` y el badge del nivel;
  - caducado con `CircleAlert` en `danger`;
  - en revisión con `AlertTriangle` en `danger`.

  Los 4 niveles deben seguir distinguibles (FR-007).
- [ ] T028 [P] [US1] Restilar `src/features/ajustes/components/*.tsx`: títulos de sección en
  `text-h3` con su ícono en `text-muted`, filas en `Card` con divisores en `border` y botones con las
  variantes nuevas.
- [ ] T029 [P] [US1] Restilar `src/features/auth/LoginForm.tsx` y la pantalla de carga de
  `src/app/App.tsx`:
  - logo grande con `Tooth` de 48 px en `brand` y "Dentdelion" en `text-h1` `teal-dark`;
  - frase "Tu inventario. Tu tiempo. Tu ganancia." en `text-body` `text-muted` (DS §43);
  - campos `IconField` y botón primario de ancho completo.
- [ ] T030 [P] [US1] Ajustar los colores de `src/app/SyncIndicator.tsx` y `src/app/SyncSheet.tsx` a los
  tokens nuevos: estados con `success-icon`, `primary-text`, `text-muted` y `danger`, y alerta con
  `warning-30-bg`/`warning-30-text`. Lógica sin cambios.
- [ ] T031 [US1] Correr `npm test`. Corregir solo las pruebas que fallen por **marca o nombres de
  ícono** (p. ej., las que buscan `DENTDELION`), sin cambiar lo que verifican. Si alguna falla por
  comportamiento, es un bug del restilado: arreglar el componente, no la prueba.
- [ ] T032 [US1] Capturas de 375 px con `run-indentory` (seed de usuario, insumos y lotes según
  quickstart): login, Inventario, detalle, Compras, Alertas, Ajustes y un panel abierto. Comparar con
  `ref/2026-10-17-design-system/001-app-design.jpeg` y corregir las diferencias de color, tipografía,
  íconos o componentes.

**Checkpoint**: MVP visual. La app luce el DS en el teléfono con todo el comportamiento intacto.

---

## Phase 4: User Story 2 - Navegación lateral en desktop (P1)

**Goal**: en 1200 px o más, sidebar de 240 px y barra superior, sin barra inferior, con el contenido a
ancho completo.

**Independent Test**: quickstart #6 y #8. La prueba de integración en desktop pasa.

- [ ] T033 [P] [US2] Crear `tests/integration/navegacion-responsiva.test.tsx` (desktop), con
  `simularAncho(1440)` y montando `App` con un usuario y los stores con `setState` (patrón de
  `tests/integration/bottom-nav.test.tsx`). Debe cubrir:
  - hay un `<nav aria-label="Secciones">` con los ítems de la sidebar y no hay barra inferior;
  - el ítem activo tiene `aria-current="page"`;
  - hacer clic en "Compras" muestra la vista Compras;
  - la burbuja de alertas aparece en el ítem Alertas;
  - la barra superior muestra el nombre de la clínica y el botón del indicador de sincronización.
- [ ] T034 [P] [US2] Crear `src/app/Sidebar.tsx` según `contracts/ui-contracts.md`:
  - props `vista`, `onCambiarVista`, `alertasBadge` y `contraida`;
  - logo arriba;
  - ítems de `SECCIONES` con `etiquetaLateral`, de 48 px de alto, padding 0 12, radio 10, gap 10 y
    14/600;
  - activo en `primary-soft` / `primary-text` / `brand-icon`;
  - burbuja de alertas;
  - ancho de 240 px, borde derecho `border` y fondo `surface`, con `position: sticky; top: 0;
    height: 100dvh`.
- [ ] T035 [P] [US2] Crear `src/app/TopBar.tsx`: chip de la clínica, `SyncIndicator` y su
  `SyncSheet` (reutilizando `useIndicadorSync` y la lógica de panel de `AppHeader`, extraída a un
  hook compartido `src/app/usePanelSync.ts` para no duplicarla), y el avatar con iniciales. Mide
  64 px de alto, con borde inferior `border`.
- [ ] T036 [US2] Crear `src/app/AppShell.tsx` (R8):
  - props `vista`, `onCambiarVista`, `alertasBadge` y `children`;
  - con `useDisposicion()`: en `movil`, `AppHeader`, el contenido y la `BottomNav` (lo que hoy
    renderiza `App.tsx`); en `tablet`/`desktop`, la grilla `Sidebar | (TopBar + main)`;
  - `children` siempre como hijo del mismo `<main>`, con la misma `key`, para no desmontarlo;
  - márgenes del contenido: 16 px y máximo 480 px en móvil, 24 px en tablet, 32 px con gap 24 y
    máximo 1440 px en desktop.
- [ ] T037 [US2] En `src/app/App.tsx`, reemplazar el bloque autenticado (`AppHeader`, vistas,
  `AvisosConsumo`, `BottomNav`) por `<AppShell …>{vista activa}</AppShell>` más `AvisosConsumo`. El
  padding inferior reservado para la barra inferior pasa a ser solo de `movil` y lo aplica
  `AppShell`.
- [ ] T038 [US2] Correr las pruebas de T033 y toda la suite. Las pruebas existentes (sin
  `matchMedia`) deben seguir viendo la disposición móvil sin cambios.

**Checkpoint**: desktop con sidebar funcionando.

---

## Phase 5: User Story 3 - Inicio (P2)

**Goal**: sección Inicio, la que se abre al entrar, con 4 KPIs y 2 listas calculadas de datos
existentes, que llevan a las secciones.

**Independent Test**: quickstart #1 y #2. Las pruebas de `resumenInicio` e `inicio` pasan.

- [ ] T039 [P] [US3] Crear `tests/unit/resumenInicio.test.ts` con insumos, lotes, movimientos e
  `itemsCompra` de prueba:
  - `bajoMinimo` igual a `computeInsumosStockBajo(...).length`;
  - `porVencer` igual a `computeAlertasCaducidad(...).length`;
  - `paraComprar` igual a sugeridos más manuales pendientes, sin contar los comprados ni los
    eliminados;
  - `alertas` igual a `contarAlertasPendientes` con las preferencias, y con `stockBajo:false` baja;
  - `listaAlertas` ordenada (caducado, después caducidad por días, después stock bajo) y truncada a 5;
  - `proximosVencimientos` ordenada por fecha, sin lotes sin stock ni sin fecha, truncada a 5;
  - con datos vacíos todo da 0 o listas vacías.
- [ ] T040 [US3] Crear `src/features/inicio/lib/resumenInicio.ts` según data-model.md: `function
  resumenInicio({ insumos, lotes, movimientos, itemsCompra, nivelesAvisoDias, preferencias, hoy }):
  ResumenInicio`. Reutiliza `computeInsumosStockBajo`, `computeAlertasCaducidad`,
  `computeItemsSugeridos`, `contarAlertasPendientes` y `computeStockLote`, sin redefinir reglas.
- [ ] T041 [US3] Crear `src/features/inicio/components/InicioView.tsx` según
  `contracts/ui-contracts.md` § InicioView:
  - prop `onNavegar(vista)`;
  - saludo "¡Hola, {primer nombre}!" y fecha con `Intl.DateTimeFormat('es-CL', { weekday:'long',
    day:'numeric', month:'long' })`;
  - 4 `KpiCard` con los destinos y el `aria-label` del contrato;
  - listas "Alertas" y "Próximos vencimientos" con enlaces "Ver todas" / "Ver todos", y sus estados
    vacíos;
  - tarjeta "¿Qué necesitas comprar?" solo si `paraComprar > 0`.

  Grilla: 1 columna en móvil, KPIs en 2 × 2 desde `md`, KPIs en 4 columnas y listas en 2 columnas
  desde `desk`. Lee de `useInventoryStore`, `useAlertasStore` y `useAuthStore`.
- [ ] T042 [US3] En `src/app/navegacion.ts`, agregar `'inicio'` al tipo `Vista` y como primer
  elemento de `SECCIONES` (ícono `House`, etiqueta "Inicio"). En `src/app/App.tsx`, cambiar `useState<Vista>('inventario')` por `'inicio'` y renderizar
  `<InicioView onNavegar={setVista} />` cuando `vista === 'inicio'`.
- [ ] T043 [US3] Ajustar las pruebas que asumían Inventario como vista inicial: buscar con
  `grep -rn "render(<App" tests` y las aserciones de `tests/integration/bottom-nav.test.tsx` sobre el
  ítem activo inicial o la cantidad de ítems (ahora 5). La prueba navega primero a Inventario donde
  haga falta, sin cambiar lo que verifica.
- [ ] T044 [P] [US3] Crear `tests/integration/inicio.test.tsx`:
  - con datos de prueba en los stores, la app abre en Inicio con el saludo, y las 4 tarjetas
    muestran los mismos números que `resumenInicio`;
  - tocar "Productos bajo mínimo" muestra Alertas y "Para comprar" muestra Compras;
  - las listas muestran a lo sumo 5 ítems y "Ver todas" lleva a Alertas;
  - sin datos se ven ceros y "Todo en orden";
  - sin `paraComprar` no hay tarjeta de compra.

**Checkpoint**: Inicio funcionando en todas las disposiciones.

---

## Phase 6: User Story 4 - Disposición por ancho (P2)

**Goal**: tablet con sidebar contraíble y preferencia recordada; modales centrados; ningún ancho con
desplazamiento horizontal; el estado se conserva al cambiar de ancho.

**Independent Test**: quickstart #3, #4, #5, #9, #10 y #14.

- [ ] T045 [P] [US4] Extender `tests/integration/navegacion-responsiva.test.tsx`:
  - (a) en 375 px hay barra inferior y no sidebar;
  - (b) en 900 px, sidebar contraída con solo íconos (los ítems con `aria-label`); "Expandir menú"
    muestra las etiquetas y deja `localStorage['dentdelion.sidebar'] === '1'`; un montaje nuevo
    arranca expandida;
  - (c) con Inventario y texto escrito en "Buscar insumo" en 375 px, `simularAncho(1440)` cambia a la
    sidebar y la búsqueda conserva el texto (FR-015);
  - (d) en 1440 px no hay botón de contraer.
- [ ] T046 [US4] En `src/app/Sidebar.tsx` y `src/app/AppShell.tsx`:
  - modo contraído en `tablet` según `useLayoutStore().sidebarExpandida`, de 72 px y solo íconos,
    con `aria-label` y `title` por ítem;
  - botón "Expandir menú" / "Contraer menú" (`PanelLeftOpen`/`PanelLeftClose`, 48 px) que llama a
    `alternarSidebar()`;
  - burbuja sobre el ícono en modo contraído;
  - transición de ancho con `motion-safe:transition-[width]` (FR-021).

  En `desktop` siempre está expandida y no hay botón.
- [ ] T047 [P] [US4] Grillas de tablet en las vistas con bloques en paralelo (FR-011):
  - en `src/features/ajustes/components/AjustesView.tsx`, secciones en 2 columnas desde `md` (la
    configuración de alertas a ancho completo);
  - en `src/features/compras/components/ComprasView.tsx`, sugeridos y manuales en 2 columnas desde
    `desk`;
  - en `src/features/alertas/components/AlertasView.tsx`, stock bajo y caducidad en 2 columnas desde
    `desk` y revisión a ancho completo.
- [ ] T048 [US4] Revisar el desplazamiento horizontal y los recortes (FR-017): textos largos de
  clínica, insumo y categoría con `truncate` y `min-w-0` en la sidebar, la barra superior, las
  tarjetas y las filas; las tablas y las listas de chips con `overflow-x-auto` interno y no de
  página.

**Checkpoint**: las 3 disposiciones completas.

---

## Phase 7: User Story 5 - Inventario en tabla (P3)

**Goal**: en desktop, inventario en tabla con las mismas acciones y filtros que las tarjetas.

**Independent Test**: quickstart #7. La prueba de la tabla pasa.

- [ ] T049 [P] [US5] Crear `tests/integration/inventario-tabla.test.tsx`, con `simularAncho(1440)`,
  insumos en los stores y el `memoryDb` para el consumo:
  - hay un `<table>` con los encabezados Producto, Categoría, Stock, Stock mínimo, Vencimiento,
    Estado y Acciones, y una fila por insumo;
  - escribir en "Buscar insumo" filtra las filas;
  - "Consumir 1" de una fila registra el consumo (igual que la tarjeta) y queda deshabilitado sin
    stock;
  - "Más opciones" abre el menú;
  - el nombre abre el detalle;
  - en 900 px se ven tarjetas y no la tabla.
- [ ] T050 [US5] Crear `src/features/insumos/components/InventarioTabla.tsx` según
  `contracts/ui-contracts.md` § InventarioTabla:
  - `<table>` semántico con `<th scope="col">`;
  - filas de 64 px de alto mínimo, encabezado 12/700 `text-muted`, contenido 14/500 y hover `bg`;
  - el estado con el mismo `estadoVisual` que la tarjeta (T016/T024);
  - "Consumir 1" con la misma regla de habilitación y el mismo motivo (`disponibilidad`) que la
    tarjeta, y "Más opciones" (`MoreVertical` → `Ellipsis`) de 48 px.
- [ ] T051 [US5] En `src/features/insumos/components/InventarioView.tsx`, con `useDisposicion() ===
  'desktop'`, renderizar `InventarioTabla` en lugar de la lista de `InsumoCard`, pasándole los mismos
  `resultados`, `duplicados` y callbacks. El resto de la vista (banner, filtros, overlays, alta) no
  cambia.

**Checkpoint**: las 5 historias funcionan.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T052 Verificación visual con `run-indentory`: capturas de Login, Inicio, Inventario, Compras,
  Alertas y Ajustes en **375, 768, 1024 y 1440 px**, más un modal abierto en 1440 px; medir también
  1920 px (sin captura). Con `page.emulateMedia({ reducedMotion: 'reduce' })`, comprobar que la
  sidebar y el modal no tienen `transition-duration` mayor que 0 (FR-021). En cada ancho,
  medir con `page.evaluate` que `document.documentElement.scrollWidth <= innerWidth` y que todo
  `button, a, input, select, [role=button]` visible mida al menos 48 × 48 px (o que su contenedor
  `IconField` lo cumpla). Corregir lo que falle (SC-002, SC-006, quickstart #10).
- [ ] T053 Verificación offline: build de producción con `vite preview`, cargar una vez, pasar a
  *offline* y recargar; Manrope 600/800 y los íconos se ven igual (FR-020, SC-007). Comprobar que
  `dist/sw.js` precachea los `.woff2` de Manrope.
- [ ] T054 [P] Medir el tamaño del bundle: `npm run build` antes y después y comparar el gzip de
  `dist/assets/index-*.js`. Debe crecer menos de 40 KB (plan, Performance Goals). Anotar el número
  en la descripción del PR.
- [ ] T055 Correr `npm run lint && npm run build && npm test`, todo verde.
- [ ] T056 [P] En `../1stDocs/005-roadmap/002-DentdeLion.md`, actualizar el estado de la 013 cuando el
  PR esté abierto. En el commit aparte de `1stDocs`, anotar en el backlog que el escáner y el botón
  flotante del DS siguen pendientes.
- [ ] T057 Descripción del PR:
  - la dependencia nueva `lucide-react` y su justificación (Complexity Tracking);
  - los ajustes AA frente a la lámina, con capturas lado a lado;
  - el cambio de nombre a "Dentdelion" y el ícono nuevo;
  - Inicio como vista inicial;
  - el resultado de T052–T054.

---

## Dependencies & Execution Order

- **Setup** (T001–T002) → **Foundational** (T003–T018). T004 va antes de T003 (para que falle
  primero). T008 va antes de T010. T006 antes de T007. T011 y T012 son independientes.
- **US1** (T019–T032) depende de Foundational y es el MVP visual.
- **US2** (T033–T038) depende de Foundational (T009, T011, T012 para el armazón) y de T021/T022
  (`AppHeader` y `BottomNav` restilados, que `AppShell` reutiliza en móvil).
- **US3** (T039–T044) depende de Foundational y de T015 (`KpiCard`). Puede ir en paralelo con US2,
  salvo T042, que toca `App.tsx` y `navegacion.ts` (hay que coordinarlo con T037).
- **US4** (T045–T048) depende de US2 (Sidebar y AppShell).
- **US5** (T049–T051) depende de Foundational (T009) y de T016/T024 (`estadoVisual` e `InsumoCard`
  restilada).
- **Polish** al final.

```text
Setup ─► Foundational ─┬─► US1 (MVP) ─► US2 ─► US4 ─┐
                       ├─► US3 ─────────────────────┼─► Polish
                       └─► US5 ─────────────────────┘
```

## Parallel Examples

- **Foundational**: T004, T008, T010, T012 y T013–T017 a la vez (archivos distintos). T003, T005 y
  T018 en serie sobre `index.css` / `BottomSheet`.
- **US1**: T023–T030 en paralelo (cada uno toca una carpeta de feature distinta). T019, T021, T022 y
  T031 en serie.
- **US2**: T033, T034 y T035 en paralelo; luego T036 → T037 → T038.
- **US3**: T039 y T044 (pruebas) en paralelo con T040/T041. T042 y T043 después.
- **US5**: T049 y T050 en paralelo; luego T051.

## Implementation Strategy

1. **MVP = Setup + Foundational + US1**: la app luce el DS en el teléfono, que es lo que usa el
   personal a diario, sin cambiar ningún flujo. Se puede revisar con la clienta en ese punto.
2. **+ US2**: desktop con sidebar (el otro pedido del roadmap).
3. **+ US3**: Inicio como vista inicial.
4. **+ US4 + US5**: tablet, modales centrados y tabla de inventario.
5. **Polish**: capturas en los 4 anchos, offline, bundle, documentación y PR.
