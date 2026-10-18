# Research: Design System v1.0 y Navegación Desktop

**Feature**: 013-design-system-v1-y-navegacion-desktop | **Date**: 2026-10-18

Hallazgos sobre el código actual y las decisiones que resuelven cada punto del plan. "DS §N" remite a
`ref/2026-10-17-design-system/000-design-system.md`.

## R1 · Tokens: mismos nombres, valores del DS

**Hallazgo**: los colores viven en el `@theme` de Tailwind v4 (`src/styles/index.css`, spec 005) y se
usan con nombres semánticos (`bg-primary`, `text-text-muted`, `border-border`, `bg-danger-bg`,
`text-warning-30-text`…) en unos 40 componentes.

**Decisión**: se conservan los nombres semánticos existentes y se cambian sus valores a los del DS.
Se agregan los tokens del DS que faltan: `brand`, `brand-dark`, `brand-light`, `teal-dark`,
`bg-secondary`, info, sombras, radios y la escala tipográfica. Así la mayoría de los componentes
cambia de aspecto sin tocar sus clases, y el diff se concentra en lo que de verdad cambia de forma
(navegación, encabezado, tabla, modales, Inicio). La tabla completa de tokens y su contraste está en
[data-model.md](./data-model.md).

**Alternativas descartadas**:
- Renombrar todo a los nombres del DS (`--brand-primary`, `--text-secondary`…): obliga a tocar cada
  componente solo por el nombre y no aporta nada al usuario.
- Mantener dos sets en paralelo: deja colores viejos sueltos.

## R2 · Contraste AA dentro de la familia del DS (aclaración 1)

**Hallazgo** (contraste WCAG calculado): varios pares del DS no alcanzan AA:

| Par del DS | Contraste | Mínimo |
|---|---|---|
| Blanco sobre `#12B8AE` (botón primario) | 2,47:1 | 4,5 |
| Blanco sobre `#07958F` (hover) | 3,68:1 | 4,5 |
| `#668087` (texto secundario) sobre blanco | 4,20:1 | 4,5 |
| `#8CA0A5` (terciario, nav inactiva) sobre blanco | 2,73:1 | 4,5 |
| `#B57B16` sobre `#FFF6E3` (badge stock bajo) | 3,36:1 | 4,5 |
| `#21875A` sobre `#E8F8F0` (badge stock OK) | 4,09:1 | 4,5 |
| `#087D78` sobre `#D8F3EF` (sidebar activo) | 4,27:1 | 4,5 |
| `#12B8AE` (ícono activo) sobre blanco | 2,47:1 | 3 (ícono) |

**Decisión**:
- Fondo con texto blanco (botón primario, chip activo): `#067F7A` (el "active" del DS, 4,86:1).
  Hover `#056C68` (6,27:1) y activo `#04605C`.
- Texto secundario: `#5A7177`. Pasa 4,5:1 sobre blanco, `#F8FCFC` y `#EFFAF8`.
- El terciario `#8CA0A5` queda solo para elementos deshabilitados, exentos por WCAG. Los
  placeholders y la navegación inactiva usan el secundario.
- Badges: stock OK `#1F7E54` sobre `#E8F8F0` (4,58), stock bajo `#986712` sobre `#FFF6E3` (4,56) y
  crítico `#B84040` sobre `#FDEEEE` (4,85, ya del DS).
- Sidebar activo y botón secundario: texto `#06706C` (5,08 sobre `#D8F3EF`).
- Íconos informativos (≥ 3:1): activo `#07958F` (3,68), success `#2B9A65`, warning `#A87A22`,
  error `#B84040`, info `#3F8BC2`.
- Se usan tal cual, sin texto encima: `#12B8AE` en el ícono del logo (un logotipo está exento), en
  bordes de foco, rellenos de barras y el anillo de foco; `#D8F3EF`, `#EFFAF8`, los fondos y los
  bordes.

La verificación es automática: una prueba unitaria lee los tokens de `index.css` y comprueba cada
par declarado en [contracts/design-tokens.md](./contracts/design-tokens.md). Si alguien cambia un
color, la prueba falla.

## R3 · Íconos: Lucide detrás del módulo de íconos existente

**Hallazgo**: 27 archivos importan íconos de `src/components/icons/index.tsx`, que hoy son SVG
dibujados a mano con trazo de 1,75 px.

**Decisión**: agregar `lucide-react` (1.59, MIT, compatible con React 19). `src/components/icons`
pasa a **re-exportar** íconos Lucide con los nombres que ya usan los componentes, según la tabla del
DS §7. Algunos ejemplos:

| Nombre actual | Ícono Lucide |
|---|---|
| `Package` | `Package` |
| `ShoppingCart` | `ShoppingCart` |
| `Bell` | `Bell` |
| `Settings` | `Settings` |
| `Pencil` | `Pencil` |
| `Trash` | `Trash2` |
| `Share` | `Share2` |
| `Scan` | `ScanLine` |
| `MoreVertical` | `Ellipsis` (DS) |
| `AlertTriangle` | `TriangleAlert` |
| `Building` | `Building2` |
| `User` | `CircleUserRound` |
| `Clock` | `Clock3` |
| `ArrowsSync` | `RefreshCw` |
| `CloudOff` | `CloudOff` |

Se agregan `House` (Inicio), `Boxes` (Inventario, DS §7), `CircleCheck`, `CircleAlert`, `Menu`,
`PanelLeftClose`/`PanelLeftOpen` y `ArrowLeft`. Las funciones sin ícono en el DS usan el más cercano
de Lucide (`Undo2`, `Copy`, `X`, `Tag`, `Hash`, `Calendar`, `Truck`, `Mail`, `Lock`, `Minus`,
`Plus`, `Search`).

- Las props `size`/`className` se mantienen; el trazo por defecto es de 2 px (DS §6) y los íconos
  llevan `aria-hidden` porque son decorativos.
- Los componentes no cambian sus imports. Es una sola tabla de correspondencia y se puede revisar de
  un vistazo.
- `Tooth` es el único SVG propio: el diente de marca outline y geométrico, de trazo 2 px y esquinas
  redondeadas (DS §7, "Icono DentDelion"). Reemplaza al diente relleno actual.
- **Offline (Constitución I, FR-020)**: Lucide se empaqueta en el build (tree-shaking por ícono
  importado) y no se carga de ningún CDN.

**Alternativas descartadas**: redibujar a mano cada ícono como outline de 2 px (lento y propenso a
inconsistencias), o usar un sprite o un CDN de Lucide (rompe offline).

## R4 · Tipografía: agregar Manrope 600

**Hallazgo**: `index.css` importa `@fontsource/manrope` 400, 500, 700 y 800 (self-hosted, offline).
El DS usa además el 600 (ítems de sidebar, títulos de KPI, botón outline).

**Decisión**: importar también `latin-600.css` y definir la escala del DS §5 como utilidades (`text-display`,
`text-h1`, `text-h2`, `text-h3`, `text-body-lg`, `text-body`, `text-body-sm`, `text-caption`, `text-num`)
con su tamaño, interlineado, peso y tracking. Son unos 15 KB más en el precache.

## R5 · Breakpoints y detección de disposición

**Hallazgo**: el armazón actual es `max-w-md` centrado con `BottomNav` fija. Tailwind v4 trae `md`
(768 px) y `xl` (1280 px), pero el DS §38 pone desktop desde **1200 px**.

**Decisión**:
- Se agrega el breakpoint `--breakpoint-desk: 75rem` (1200 px) al `@theme`, y `md` (768 px) marca el
  paso de móvil a tablet. Rangos: móvil < 768, tablet 768–1199 y desktop ≥ 1200 (FR-011).
- Lo que solo cambia de **estilo** por ancho (márgenes, columnas, modal centrado) usa variantes CSS
  `md:`/`desk:`.
- Lo que cambia de **estructura** (barra inferior o lateral, tarjetas o tabla) usa el hook
  `useDisposicion(): 'movil' | 'tablet' | 'desktop'`. Se implementa con `matchMedia` y
  `useSyncExternalStore`, y renderiza **un solo** árbol. Así no se duplican controles en el DOM, ni
  para lectores de pantalla ni para las pruebas, y al cambiar de ancho el contenido de la sección no
  se desmonta (FR-015).
- Sin `matchMedia` (jsdom en las pruebas existentes), el hook devuelve `'movil'`. Las 382 pruebas
  actuales siguen viendo la barra inferior sin cambios.

**Alternativa descartada**: renderizar ambas navegaciones y ocultar una con CSS. Duplica botones
accesibles y rompe las consultas `getByRole` de las pruebas existentes.

## R6 · Sidebar contraída en tablet y su preferencia (FR-013)

**Decisión**: `layoutStore` (Zustand) con `sidebarExpandida: boolean`, `false` por defecto, que se
persiste en `localStorage` (clave `dentdelion.sidebar`) con try/catch. Es una preferencia de
interfaz local del dispositivo, no un dato de inventario, así que no va a IndexedDB ni se sincroniza.
En desktop la sidebar siempre está expandida y la preferencia no aplica.

## R7 · Modales: el `BottomSheet` se centra desde tablet (FR-016)

**Hallazgo**: 12 componentes usan `BottomSheet`, el único overlay de la app (spec 007).

**Decisión**: `BottomSheet` gana estilos responsivos. En móvil sigue subiendo desde abajo. Desde `md`
se muestra centrado, con un ancho máximo de 560 px (dentro del rango 480–600 del DS), padding de
24 px, radio de 20 px, sombra de modal y título de 20/700 (DS §36). No hay cambios de API ni en los
12 llamadores.

## R8 · Armazón (`AppShell`)

**Decisión**: `App.tsx` delega la disposición a un componente nuevo, `src/app/AppShell.tsx`:
- **móvil**: el `AppHeader` actual restilado, el contenido en una columna con 16 px de margen y la
  `BottomNav` del DS §29 (80 px con área segura, íconos de 24, etiquetas de 11/600, activo
  `#07958F` e inactivo secundario).
- **tablet y desktop**: `Sidebar` a la izquierda (contraída de 72 px en tablet, o 240 px), y a la
  derecha `TopBar` y el contenido. La `TopBar` muestra el nombre de la clínica, el `SyncIndicator`
  de la spec 012 y el avatar. El margen del contenido es de 24 px en tablet y 32 px en desktop, con
  24 px entre bloques.

Las 5 vistas (`inicio`, `inventario`, `compras`, `alertas`, `mas`) se montan en el mismo punto del
árbol en todas las disposiciones. Cambiar de ancho cambia la envoltura, no la vista, y el estado
local de la vista (filtros, formularios, paneles) se conserva. Una prueba lo verifica (FR-015).
`Vista` gana `'inicio'`, que es la vista inicial.

## R9 · Inicio (US3)

**Decisión**: carpeta nueva `src/features/inicio/` con `InicioView.tsx` y una función pura
`lib/resumenInicio.ts`. La función **reutiliza** los cálculos existentes, sin redefinir reglas
(misma política que spec 009 R5):
- **Productos bajo mínimo**: `computeInsumosStockBajo(...).length`, el mismo número que la sección
  "Stock bajo" de Alertas y que el banner de Inventario.
- **Próximos a vencer**: `computeAlertasCaducidad(...nivelesAvisoDias).length`, en lotes, igual que
  `ResumenAlertasBanner` y la sección de Alertas.
- **Para comprar**: `computeItemsSugeridos(...).length` más los `itemsCompra` en estado
  `'pendiente'`, los mismos dos bloques que muestra Compras.
- **Alertas**: `contarAlertasPendientes(...)`, el mismo número que la burbuja de la navegación, que
  respeta las preferencias de notificaciones del dispositivo (spec 010).
- **Lista "Alertas"**: hasta 5 alertas. Primero las caducadas, después la caducidad por días que
  faltan y al final el stock bajo, cada una con su estado por color e ícono.
- **"Próximos vencimientos"**: hasta 5 lotes con fecha y stock disponible, de insumos activos,
  ordenados por fecha. Incluye los que todavía no entran en un nivel de aviso, como en la lámina.

Las tarjetas y los enlaces llaman a `onNavegar(vista)`. Inicio no agrega acciones ni datos
persistidos.

**Ajuste a la spec**: FR-023 decía que bajo mínimo y por vencer respetaban las preferencias de
notificaciones. Pero la vista Alertas no las aplica: solo la burbuja lo hace. Para que los números de
Inicio coincidan con lo que el usuario ve en Alertas, las preferencias se aplican solo a la tarjeta
"Alertas", igual que la burbuja. La spec se actualiza con esto.

## R10 · Inventario en tabla (US5)

**Decisión**: `InventarioTabla.tsx` recibe los mismos `EstadoInsumo[]` filtrados y los mismos
callbacks que la lista de `InsumoCard` (abrir el detalle, consumir 1, abrir el menú, posible
duplicado), así que filtros, permisos y paneles no cambian. `InventarioView` elige tabla o tarjetas
con `useDisposicion() === 'desktop'`.
- Columnas: Producto (nombre y unidad), Categoría, Stock, Stock mínimo, Vencimiento (del lote más
  próximo), Estado (badge del DS §21) y Acciones ("Consumir 1" y "⋮").
- Filas de 64 px, encabezado 12/700 en secundario, contenido 14/500 y hover `#F8FCFC`.
- Es un `<table>` semántico con `<th scope="col">`.

## R11 · Nombre "Dentdelion" e ícono de la app (aclaración 2)

**Decisión**:
- `APP_NAME = 'Dentdelion'` (`src/lib/branding.ts`). También se cambian el `<title>` de
  `index.html` y `name`/`short_name` del manifest en `vite.config.ts`, y se actualiza
  `tests/unit/App.test.tsx`.
- Los íconos de la app instalada (`public/icons/icon-192.png`, `icon-512.png`) se regeneran a partir
  del SVG del diente nuevo, en turquesa sobre `#F8FCFC`, rasterizándolo con Playwright (ya es
  devDependency) mediante `scripts/generar-iconos.mjs`, que se commitea para poder repetirlo. El SVG fuente se guarda en `public/icons/icon.svg` y el favicon pasa a ser ese
  mismo SVG.
- `theme_color` pasa a `#0D5360` y `background_color` a `#F8FCFC`.

## R12 · Sin modo oscuro

**Hallazgo**: `:root { color-scheme: light dark }` hace que, con el sistema en modo oscuro, los
controles nativos (scrollbars, date pickers) se pinten oscuros sobre la interfaz clara.

**Decisión**: `color-scheme: light`. El DS no define modo oscuro.

## R13 · Avisos (toast) del DS §37

**Decisión**: `AvisosConsumo` se restila con fondo `#17363D`, texto blanco (12,87:1), ícono de éxito
`#35B779` (decorativo, acompaña al texto) y radio de 10 px. Se mantienen el contenido, la duración,
el botón "Deshacer" y el comportamiento de la spec 007 (FR-009).

## R14 · Pruebas y verificación visual

- **Unitarias**:
  - `contraste.test.ts`: lee `index.css` y verifica cada par del contrato de tokens (FR-005, SC-003).
  - `resumenInicio.test.ts`: contadores y listas, con casos que coinciden con Alertas y Compras.
  - `useDisposicion.test.ts`: los rangos de 767, 768, 1199 y 1200 px, y el caso sin `matchMedia`.
- **Integración**:
  - `navegacion-responsiva.test.tsx`, con `matchMedia` simulado: barra inferior en móvil; sidebar
    contraída que se expande y recuerda la preferencia en tablet; sidebar completa sin barra
    inferior en desktop; la burbuja de alertas en ambas; cambiar de ancho conserva un formulario a
    medio llenar.
  - `inicio.test.tsx`: tarjetas, listas, navegación y estado vacío.
  - `inventario-tabla.test.tsx`: las acciones de cada fila y los filtros.
  - Se ajustan las pruebas existentes que dependen del nombre "DENTDELION" o de `MoreVertical`.
- **Visual** (skill `run-indentory`): capturas de las 5 secciones en 375, 768, 1024 y 1440 px, y del
  login, para compararlas con la lámina (SC-001). Además, una medición automática de que no hay
  desplazamiento horizontal (`scrollWidth <= innerWidth`) y de que los objetivos interactivos miden
  al menos 48 px (SC-002, SC-006).
