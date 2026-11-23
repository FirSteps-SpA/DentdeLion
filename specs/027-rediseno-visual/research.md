# Research: Rediseño visual de la app

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-11-23

## R1 — Estrategia: componentes compartidos, no estilos por vista

- **Decision**: el rediseño entra por **componentes compartidos** que hoy ya usan las vistas o que se
  crean y se adoptan en todas: `Sidebar`, `TopBar`, `AppHeader`, `BottomNav`, `SyncIndicator`,
  `SelectorLugar`, `KpiCard`, `Card`, `Badge`, `TarjetaGrafico`, `RenglonAlerta`, más cuatro nuevos:
  `EncabezadoVista`, `EncabezadoSeccion`, `EstadoVacio` y `decoracion/*` (ilustraciones y fondo).
- **Rationale**: FR-016 (sin cambios de comportamiento) y SC-002 (ninguna vista con el estilo
  anterior) se cumplen mejor cambiando pocas piezas reutilizadas que retocando 37 archivos con clases
  sueltas. Las pruebas existentes consultan por rol y texto, así que sobreviven a cambios de clases.
- **Alternatives considered**: retocar cada vista por separado (inconsistente y caro de mantener).

## R2 — Tokens nuevos

- **Decision**: agregar a `@theme` en `src/styles/index.css`:
  - `--color-nav-activo` = `--color-primary` (#067F7A, blanco encima 4,86:1) para el ítem activo;
  - tintes de íconos por tono: `--color-tinte-primario` (#D8F3EF), `--color-tinte-peligro`
    (#FDEEEE), `--color-tinte-aviso` (#FFF1DC), `--color-tinte-info` (#EDF7FD), cada uno con su
    ícono existente (≥ 3:1);
  - degradado de "Valor de inventario": de `#E7F7F5` a `#BFEBE6`, con texto `--color-text`;
  - ondas: `--color-onda-1` (#DDF3F0) y `--color-onda-2` (#C4ECE7), solo decorativas;
  - sombra `--shadow-tarjeta` algo más difusa que `shadow-card` (la referencia flota más).
- Todos los pares texto/fondo nuevos se agregan a `tests/unit/contraste.test.ts` (FR-018).
- **Rationale**: los valores salen de la imagen ajustados a AA, como en la spec 013.

## R3 — Ilustraciones y fondo

- **Decision**: SVG propios en `src/components/decoracion/`:
  - `DienteLinea` (diente en trazo con destellos opcionales), basado en el ícono `Tooth` existente;
  - `OndasFondo` (dos ondas suaves, `position: absolute`, `pointer-events: none`) para `AppShell` y
    pantallas de acceso;
  - `OndaSidebar` (onda al pie de la barra lateral);
  - `MiniBarras` (barras decorativas de "Valor de inventario");
  - `IconoFondo` (un ícono de `lucide-react` grande, `opacity` baja, en una esquina).
  Todos con `aria-hidden="true"`, `focusable="false"`, sin texto, `print:hidden`.
- **Rationale**: FR-017 (propios, livianos, sin conexión: van en el bundle, sin pedidos de red) y
  "no copiar la imagen". `lucide-react` ya está.
- **Movimiento**: sin animaciones decorativas; las transiciones de hover existentes quedan bajo
  `motion-safe` (FR-020).

## R4 — Barras

- **Sidebar**: activo `bg-primary text-white` con el ícono blanco; inactivo `text-text-muted
  hover:bg-bg-secondary`; burbuja de Alertas igual. Pie: `OndaSidebar` + `DienteLinea` solo
  expandida, con `mt-auto`, y el botón de contraer encima (tablet).
- **TopBar**: `SelectorLugar` como pastilla (`Building` + nombre + `ChevronDown`, fondo
  `bg-secondary-bg`, borde suave); `SyncIndicator` como pastilla con fondo por estado
  (sincronizado `success-bg`, pendientes `primary-soft`, sin conexión `bg-secondary`, error
  `warning-30-bg` con texto `warning-30-text` como en la imagen; alerta de pendientes antiguos igual
  que hoy); avatar igual.
- **Teléfono**: `AppHeader` con las mismas pastillas; `BottomNav` con el activo en una pastilla
  `primary-soft` detrás del ícono (texto `primary-text`), sin cambiar su altura.

## R5 — Encabezado de vista

- **Decision**: `EncabezadoVista({ titulo, subtitulo?, accion?, Icono })` con `h1` (`text-h1` en
  desktop, `text-h2` en teléfono), subtítulo opcional y la acción a la derecha; detrás, `IconoFondo`
  de la sección a la derecha (en Inicio, `DienteLinea` con destellos). Se usa en Inicio (saludo),
  Inventario, Tratamientos, Compras, Reportes, Alertas y Ajustes (índice y cada sección).
- Inventario y Alertas no tienen `h1` hoy: lo ganan ("Inventario", "Alertas"). Es texto nuevo, pero
  de estructura (el título de la sección ya está en la navegación); las pruebas que buscan "Inventario"
  por texto se ajustan a `getByRole` donde choquen.
- Las vistas que ya tienen título lo conservan con el mismo texto.

## R6 — Tarjetas

- **`KpiCard`** gana `tono` para el ícono (además del valor), `IconoFondo` del mismo ícono, la pastilla
  "Ver detalle →" si navega (dentro del botón, `aria-hidden`, el `aria-label` ya dice "Ver …"), y
  `variante: 'destacada'` (degradado + `MiniBarras`) para "Valor de inventario". En Reportes (sin
  `onClick`) no hay pastilla.
- **`EncabezadoSeccion({ Icono, titulo, tono?, accion? })`**: cuadrado de 36 px con el ícono + `h2`/
  `h3` + acción ("Ver todas →"). Lo usan Inicio, Alertas (Stock bajo, Próximos a caducar, Lotes en
  revisión), `TarjetaGrafico` (con el ícono de cada gráfico), las secciones de Ajustes, Compras y el
  historial de Tratamientos.
- **Línea de tiempo** (Inicio, "Próximos vencimientos"): `ol` con puntos de color por urgencia unidos
  por una línea vertical; cada fila sigue siendo el botón de `RenglonAlerta`.
- **`Badge`**: misma paleta AA, pastilla más alta (`py-1`, `px-3`) como en la imagen.

## R7 — Estados vacíos

- **Decision**: `EstadoVacio({ Icono, texto, accion? })`: ícono grande desvaído centrado + texto +
  acción opcional. Reemplaza los `<p>` de vacío en Inicio, Alertas, Inventario (sin resultados),
  Tratamientos, Historial, Compras, `TarjetaGrafico` y Ajustes (catálogos), con **el mismo texto**.

## R8 — Inicio

- Quita "¿Qué necesitas comprar?" (FR-010) y conserva todo lo demás. Grilla: teléfono 2 columnas con
  "Valor de inventario" a lo ancho (ya es así); desktop 5 columnas (ya es así).

## R9 — Pantallas de acceso

- `LoginForm`, `AceptarInvitacion`, `AccesoDesactivado` y el arranque de `App.tsx`: fondo
  `OndasFondo` a pantalla completa y `DienteLinea` en vez del ícono plano, misma tarjeta.

## R10 — Verificación visual

- Capturas con `run-indentory` de cada vista en 375 px y 1280/1440 px, antes y después, más Inicio a
  1280×800 junto a la referencia (SC-001). Prueba automática nueva: `sin-desborde.test` no es viable
  en jsdom (sin layout); el desborde horizontal se comprueba en el recorrido con
  `document.documentElement.scrollWidth <= innerWidth` desde el driver (SC-005).
