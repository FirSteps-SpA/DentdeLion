# Feature Specification: Rediseño visual de la app

**Feature Branch**: `[027-rediseno-visual]`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "Rediseño visual según `ref/2026-11-23-redesign`. Basado en la imagen,
proponer un rediseño de las vistas de la app. Un punto a destacar es que se agregan íconos de fondo a
algunas tarjetas para evitar que haya tanto espacio vacío. La idea es que sea lo más similar a la
imagen en ref, al menos el navbar y colores."

**Origen**: ideas del 2026-11-23 (`~/1STEPS/notes.txt`), backlog `1stDocs/002-backlog/002-DentdeLion.md`
→ spec 027.

## Contexto

La referencia (`ref/2026-11-23-redesign/`) es una sola imagen: Inicio en desktop. Muestra:

- **Barra lateral** blanca con el logo, ítems con ícono y el activo como **pastilla turquesa llena con
  texto blanco**, la burbuja roja de Alertas y, abajo, una **ilustración de diente en línea** sobre una
  **onda turquesa**.
- **Barra superior** con el lugar de trabajo como **pastilla** (ícono de edificio, nombre y flecha),
  el estado de sincronización como **pastilla de color** ("Error de sincronización · 99+") y el
  avatar con iniciales.
- **Fondo** claro con **ondas** suaves turquesa y, junto al saludo, un **diente con destellos**.
- **Tarjetas KPI**: ícono en un **cuadrado de color suave** con el título al lado, el **número grande
  en el color del estado**, un **ícono grande y desvaído de fondo** abajo a la derecha y un botón
  pastilla **"Ver detalle →"**. "Valor de inventario" va con un **degradado turquesa** y un mini
  gráfico de barras decorativo.
- **Tarjetas de sección** ("Alertas", "Próximos vencimientos") con ícono en cuadrado suave, título y
  "Ver todas →"; alertas con ícono rojo y **pastilla** "Caducado"; vencimientos como **línea de
  tiempo** (puntos unidos por una línea).

La app ya usa la paleta turquesa y Manrope (spec 013), así que el rediseño es sobre todo de forma:
cómo se ven las barras, las tarjetas, los encabezados y los espacios vacíos. Como solo hay referencia
para Inicio, el resto de las vistas adopta el **mismo lenguaje visual** con los mismos componentes.

## Clarifications

### Session 2026-11-23

- Q: ¿Qué saludo usa Inicio? → A: el **primer nombre**, como hoy ("¡Hola, Paula!"), no "Dra.".
- Q: ¿Qué pasa con la tarjeta "¿Qué necesitas comprar?" de Inicio, que no está en la imagen? → A: **se
  quita**; "Para comprar" sigue como tarjeta KPI.
- Q: ¿Alcance? → A: **todas las vistas**, no solo el armazón e Inicio.
- La variación "vs. mes anterior" del valor de inventario ya existe (spec 017) y se mantiene, como en
  la imagen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Barras de navegación como en la referencia (Priority: P1)

Como persona del equipo, quiero que la barra lateral, la barra superior y la navegación del teléfono
se vean como en la referencia, para que la app tenga la identidad nueva en todas las pantallas.

**Why this priority**: es lo que la clienta pidió explícitamente ("al menos el navbar y colores") y se
ve en todas las pantallas.

**Independent Test**: abrir cualquier sección en desktop, tablet y teléfono y comparar las barras con
la imagen.

**Acceptance Scenarios**:

1. **Given** desktop, **When** estoy en cualquier sección, **Then** la barra lateral muestra el ítem
   activo como pastilla turquesa llena con texto e ícono blancos, los demás en gris con ícono, la
   burbuja roja con la cantidad de alertas y, abajo, la ilustración de diente sobre la onda turquesa.
2. **Given** tablet con la barra contraída, **When** la miro, **Then** se ven solo los íconos con el
   activo en pastilla turquesa y sin ilustración.
3. **Given** desktop o tablet, **When** miro la barra superior, **Then** el lugar de trabajo es una
   pastilla con ícono de edificio, nombre y flecha (que abre el selector como hoy), el estado de
   sincronización es una pastilla de color según el estado (gris/verde/ámbar/rojo, siempre con texto)
   y el avatar es un círculo con iniciales.
4. **Given** el teléfono, **When** miro el encabezado y la barra inferior, **Then** usan las mismas
   pastillas, y el ítem activo de la barra inferior se distingue con color y texto.
5. **Given** cualquier barra, **When** navego con teclado, **Then** el foco se ve y cada control mide al
   menos 48 px.

---

### User Story 2 - Inicio como en la referencia (Priority: P1)

Como persona del equipo, quiero que Inicio se vea como la imagen, para entender de un vistazo el
estado del inventario.

**Why this priority**: es la pantalla de la referencia y la primera que se ve al entrar.

**Independent Test**: abrir Inicio en desktop con datos parecidos a la imagen y compararla.

**Acceptance Scenarios**:

1. **Given** Inicio, **When** lo abro, **Then** veo "¡Hola, <primer nombre>!" con la fecha y, a la
   derecha, el diente con destellos, sobre el fondo con ondas.
2. **Given** las tarjetas KPI (Productos bajo mínimo, Próximos a vencer, Para comprar, Alertas),
   **When** las miro, **Then** cada una tiene su ícono en cuadrado de color suave, el título al lado,
   el número grande en el color del estado (rojo, ámbar o neutro), un ícono grande desvaído de fondo y
   la pastilla "Ver detalle →"; toda la tarjeta sigue llevando a su sección.
3. **Given** "Valor de inventario", **When** la miro, **Then** tiene el degradado turquesa, el monto
   ("desde $…" si faltan precios), la variación "vs. mes anterior" y los lotes sin precio, con el mini
   gráfico decorativo.
4. **Given** las tarjetas "Alertas" y "Próximos vencimientos", **When** las miro, **Then** tienen ícono
   en cuadrado suave y "Ver todas →"; las alertas llevan ícono y pastilla de estado, y los
   vencimientos se ven como línea de tiempo.
5. **Given** Inicio, **When** termino de bajar, **Then** ya no está la tarjeta "¿Qué necesitas
   comprar?".
6. **Given** el teléfono, **When** abro Inicio, **Then** "Valor de inventario" va a lo ancho, las otras
   cuatro en dos columnas y las listas una debajo de otra, sin desbordes.

---

### User Story 3 - El mismo lenguaje en el resto de las vistas (Priority: P2)

Como persona del equipo, quiero que Inventario, Tratamientos, Compras, Reportes, Alertas, Ajustes y
las pantallas de acceso compartan el estilo de Inicio, para que la app se sienta una sola.

**Why this priority**: la clienta pidió todas las vistas; depende de los componentes de US1 y US2.

**Independent Test**: recorrer cada vista en desktop y teléfono y comprobar encabezado, tarjetas,
pastillas y estados vacíos con el estilo nuevo, sin cambios de comportamiento.

**Acceptance Scenarios**:

1. **Given** cualquier sección (Inventario, Tratamientos, Compras, Reportes, Alertas, Ajustes),
   **When** la abro, **Then** tiene un encabezado con el título de la sección y, a la derecha, el
   ícono de la sección como ilustración decorativa desvaída, sobre el fondo con ondas.
2. **Given** las tarjetas de sección (p. ej. "Stock bajo" en Alertas, gráficos de Reportes, secciones
   de Ajustes, grupos de Compras), **When** las miro, **Then** usan el mismo encabezado con ícono en
   cuadrado suave que Inicio.
3. **Given** las tarjetas KPI de Reportes, **When** las miro, **Then** tienen el estilo de las de
   Inicio (sin "Ver detalle", porque no navegan).
4. **Given** cualquier estado vacío ("Todavía no hay…", "Sin datos en este período"), **When** lo veo,
   **Then** muestra un ícono grande desvaído de su tema y el texto, en vez de una tarjeta casi vacía.
5. **Given** las insignias de estado (Caducado, Por vencer, Bajo mínimo, Sin stock, etc.), **When** las
   veo en cualquier vista, **Then** son pastillas con el estilo de la imagen, siempre con texto.
6. **Given** la pantalla de ingreso, la de aceptar invitación y la de acceso desactivado, **When** las
   abro, **Then** usan el fondo con ondas y la ilustración del diente.
7. **Given** cualquier vista, **When** uso la app, **Then** todo funciona igual que antes: mismos
   textos, acciones, datos y orden; solo cambia la apariencia.

---

### Edge Cases

- **Textos largos** (nombres de lugar, de insumo o de tratamiento): se recortan con "…" en pastillas y
  barras, y se ven completos en el control al que llevan o en su `title`.
- **Números grandes** en KPI ("$12.345.678", "999+"): caben sin desbordar en la tarjeta más angosta
  (teléfono de 360 px).
- **"Todos" los lugares**: la pastilla del lugar dice "Todos los lugares", igual que hoy.
- **Sin conexión / sincronización con error**: la pastilla cambia de color y conserva el texto actual
  ("Sin conexión", "Error de sincronización · N").
- **Movimiento reducido**: las ondas y la ilustración son estáticas; si el sistema pide menos
  movimiento, no hay transiciones decorativas.
- **Zoom 200 % / texto grande**: la ilustración decorativa no tapa contenido; se oculta si no cabe.
- **Lectores de pantalla**: íconos de fondo, ondas e ilustraciones son decorativos y no se anuncian.
- **Impresión** de Reportes: los decorados no se imprimen.
- **Contraste**: todo texto nuevo cumple AA (4,5:1; 3:1 los íconos), también sobre el degradado.

## Requirements *(mandatory)*

### Functional Requirements

**Armazón (US1)**

- **FR-001**: El ítem activo de la barra lateral DEBE ser una pastilla turquesa llena con ícono y texto
  blancos; los inactivos, ícono y texto gris con fondo al pasar el cursor.
- **FR-002**: La barra lateral expandida DEBE mostrar al pie una ilustración de diente en línea sobre
  una onda turquesa, decorativa; contraída, no.
- **FR-003**: La barra superior DEBE mostrar el lugar de trabajo como pastilla (ícono de edificio,
  nombre, flecha) que conserva el comportamiento del selector actual.
- **FR-004**: El indicador de sincronización DEBE ser una pastilla con color de fondo según el estado
  (al día, sincronizando, pendientes, error/sin conexión), con el mismo texto y el mismo panel de hoy.
- **FR-005**: El encabezado del teléfono y la barra inferior DEBEN usar las mismas pastillas y colores.

**Inicio (US2)**

- **FR-006**: Inicio DEBE mostrar el saludo con el primer nombre, la fecha y una ilustración de diente
  con destellos, decorativa.
- **FR-007**: Las tarjetas KPI DEBEN tener ícono en cuadrado de color suave según el tono, el título
  al lado, el número grande en el color del estado, un ícono grande desvaído de fondo y, si navegan,
  la pastilla "Ver detalle →".
- **FR-008**: "Valor de inventario" DEBE tener fondo con degradado turquesa y un mini gráfico de
  barras decorativo, manteniendo monto, "desde", variación y lotes sin precio.
- **FR-009**: Las tarjetas "Alertas" y "Próximos vencimientos" DEBEN tener encabezado con ícono en
  cuadrado suave y "Ver todas →"; los vencimientos DEBEN verse como línea de tiempo.
- **FR-010**: Inicio NO DEBE mostrar la tarjeta "¿Qué necesitas comprar?".

**Resto de las vistas (US3)**

- **FR-011**: Cada sección DEBE tener un encabezado común (título, subtítulo o acción opcionales y el
  ícono de la sección como ilustración decorativa desvaída).
- **FR-012**: Todas las tarjetas con título de sección DEBEN usar el mismo encabezado de tarjeta (ícono
  en cuadrado suave + título + acción opcional).
- **FR-013**: Los estados vacíos DEBEN mostrar un ícono grande desvaído del tema y su texto.
- **FR-014**: Las insignias de estado DEBEN ser pastillas con el estilo de la referencia, con texto.
- **FR-015**: Las pantallas de acceso DEBEN usar el fondo con ondas y la ilustración del diente.
- **FR-016**: El rediseño NO DEBE cambiar textos, acciones, datos, orden ni comportamiento de ninguna
  vista, salvo FR-010.

**General**

- **FR-017**: Ondas, íconos de fondo e ilustraciones DEBEN ser decorativos (ocultos a lectores de
  pantalla, sin capturar toques), propios de la app (no imágenes de terceros) y livianos (SVG o CSS,
  disponibles sin conexión).
- **FR-018**: Todo par de color de texto/fondo nuevo DEBE cumplir AA y estar en la prueba de
  contraste; los controles DEBEN medir ≥ 48 px; el foco DEBE verse.
- **FR-019**: El diseño DEBE funcionar en teléfono (desde 360 px), tablet y desktop, sin
  desplazamiento horizontal.
- **FR-020**: Con "reducir movimiento" no DEBE haber animaciones decorativas; al imprimir, los
  decorados no se imprimen.

### Key Entities

Sin datos nuevos. Componentes visuales compartidos: barra lateral, barra superior, encabezado de
vista, tarjeta KPI, tarjeta de sección, estado vacío, pastilla de estado, fondo decorativo e
ilustraciones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Puesta al lado de la referencia, la captura de Inicio en desktop (1280×800) coincide en
  estructura, colores y elementos: barra lateral, barra superior, saludo con ilustración, 5 tarjetas
  KPI con íconos de fondo y 2 tarjetas de lista.
- **SC-002**: Las 7 secciones y las 3 pantallas de acceso usan el encabezado y los componentes
  comunes (ninguna conserva el estilo anterior), comprobado en capturas de teléfono y desktop.
- **SC-003**: 0 regresiones funcionales: toda la suite de pruebas existente pasa sin cambiar lo que
  verifica (solo selectores o textos de estructura donde corresponda).
- **SC-004**: 100 % de los pares de color nuevos pasan la prueba de contraste AA.
- **SC-005**: Ninguna vista tiene desplazamiento horizontal a 360 px.

## Assumptions

- La imagen es la única referencia; para las demás vistas se aplica su lenguaje con criterio propio,
  sin inventar contenido.
- Las ilustraciones (diente en línea, destellos, ondas, mini gráfico) se dibujan como SVG propios,
  inspirados en la imagen, no copiados de ella.
- La app no tiene modo oscuro; no se agrega.
- "Ver detalle →" en las KPI es parte visual de la tarjeta, que entera sigue siendo el botón.
- Solo cambia el front: sin migración ni cambios de datos.
