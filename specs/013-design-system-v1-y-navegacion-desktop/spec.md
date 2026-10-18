# Feature Specification: Design System v1.0 y Navegación Desktop

**Feature Branch**: `[013-design-system-v1-y-navegacion-desktop]`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "013 design-system-v1-y-navegacion-desktop según roadmap, trabajado en rama de feature dedicada"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 013 · `design-system-v1-y-navegacion-desktop` (M).
Referencia visual entregada por la clienta: `ref/2026-10-17-design-system/000-design-system.md`
("DentDelion — Design System v1.0", en adelante **DS**) y su lámina `001-app-design.jpeg`.

## Contexto

La clienta entregó un Design System propio (paleta Mint / Turquoise / Deep Teal, tipografía Manrope,
íconos outline, componentes y reglas de navegación por tamaño de pantalla). Hoy la app tiene la
identidad visual de la spec 005 (azul petróleo `#0E5C73`, íconos dibujados a mano) y una sola
disposición pensada para móvil: en un computador se ve como una columna angosta centrada con la
barra de navegación abajo.

Esta spec adopta el DS en las **4 secciones que ya existen** (Inventario, Compras, Alertas y Más /
Ajustes), agrega una sección **Inicio** con el resumen del DS calculado con datos que ya existen, y
agrega la **navegación lateral en desktop**. Va antes que la spec 014 porque el selector de lugar de
trabajo (DS §28) vivirá en el encabezado o la barra lateral nuevos.

**Fuera de alcance** (según el roadmap): las pantallas nuevas del DS que necesitan datos o
funciones que aún no existen (costos, tratamientos, reportes y gráficos, proveedores, escáner,
multi-clínica). Van en las specs 014–017.

## Clarifications

### Session 2026-10-18

- Q: ¿Se exige contraste WCAG AA aunque obligue a oscurecer algunos colores del DS? → A: Sí. AA en texto e íconos informativos: se mantienen los tonos del DS y solo se oscurecen, dentro de la misma familia de color, los pares que no lo alcanzan (p. ej., el botón primario usa el tono "active" del DS `#067F7A`).
- Q: ¿Cómo se escribe el nombre visible de la app? → A: "Dentdelion" (solo la primera letra en mayúscula), en todos los puntos de contacto visibles; reemplaza el "DENTDELION" de la spec 011.
- Q: ¿La spec incluye una sección "Inicio" nueva o se limita a re-vestir las 4 secciones actuales? → A: Incluye "Inicio", con KPIs calculados de datos existentes (bajo mínimo, por vencer, para comprar, alertas) y las listas de alertas y próximos vencimientos.
- Q: ¿Qué es "Stock crítico" (DS §21), si la app hoy solo distingue stock suficiente y bajo? → A: Un insumo activo con stock total 0 (agotado). Es solo un estado visual derivado: no crea una alerta nueva ni cambia los contadores, filtros o sugeridos existentes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - La app se ve como el Design System de la clienta (Priority: P1)

Como integrante del personal clínico, al usar la app en el teléfono veo la identidad del DS: los
colores, la tipografía, los íconos, los botones, los campos, las tarjetas y los estados de stock
coinciden con lo que la clienta aprobó. Todas las funciones siguen en el mismo lugar y se usan igual.

**Why this priority**: Es el pedido explícito de la clienta y la base visual que reutilizan las
specs siguientes. Sin los nuevos elementos visuales no se puede armar la navegación desktop de forma
coherente.

**Independent Test**: Recorrer las 4 secciones existentes en un teléfono y comparar cada pantalla con la lámina
del DS. Colores, tipografía, íconos y componentes coinciden, y las tareas habituales (consumir,
registrar material, ver alertas, gestionar compras, cambiar ajustes) se completan igual que antes.

**Acceptance Scenarios**:

1. **Given** cualquier pantalla autenticada, **When** el usuario la mira, **Then** el fondo, las superficies, los textos y los bordes usan la paleta del DS (§2) y la proporción de color del DS (§3: mayormente blanco y fondo claro, turquesa solo en acciones principales, selección e indicadores).
2. **Given** cualquier texto de la app, **When** se muestra, **Then** usa Manrope con la escala tipográfica del DS (§5: Display, H1, H2, H3, Body Large, Body, Body Small, Caption, números destacados).
3. **Given** cualquier ícono de la app, **When** se muestra, **Then** es outline, del estilo y con el ícono indicado por el DS para esa función (§6–8), con los colores de estado normal, activo y oscuro.
4. **Given** botones primarios, secundarios y outline, campos de texto, tarjetas, chips de estado, modales y avisos, **When** se muestran, **Then** siguen las especificaciones del DS (§10–16, §21, §36–37) en radios, bordes, sombras y estados (hover, activo, foco, deshabilitado), con las excepciones de FR-004 y FR-005.
5. **Given** un insumo con stock suficiente, bajo o crítico (stock 0), **When** aparece en el inventario, **Then** su estado se muestra con el ícono, el color y el badge del DS (§21), nunca solo con texto. Si además tiene un lote caducado o próximo a caducar, se muestra el estado de caducidad (que tiene prioridad, spec 006).
6. **Given** el logo en el encabezado y en la pantalla de inicio de sesión, **When** se muestra, **Then** sigue el DS (§1: ícono de diente outline geométrico en turquesa y nombre en Deep Teal, Manrope 800).
7. **Given** cualquier flujo existente (consumo rápido, alta de material, edición, compras, ajustes, indicador de sincronización), **When** el usuario lo recorre, **Then** los pasos, los controles visibles por rol y los resultados son los mismos que antes del cambio.

---

### User Story 2 - Navegación lateral en desktop (Priority: P1)

Como administradora que revisa el inventario y las compras desde un computador, quiero una barra
lateral fija a la izquierda con las secciones de la app y el contenido aprovechando el ancho de la
pantalla, en vez de una columna de teléfono centrada con la navegación abajo.

**Why this priority**: Es el segundo pedido del roadmap ("navegación desktop con sidebar"). La
gestión y el análisis se hacen en pantalla grande (DS §41.6), y el selector de lugar de trabajo de
la spec 014 necesita este espacio.

**Independent Test**: Abrir la app en una pantalla de 1280 px o más. Aparece una barra lateral de
240 px con el logo y las 5 secciones, no aparece la barra inferior y el contenido ocupa el resto del
ancho con los márgenes del DS. Cambiar de sección desde la barra lateral funciona igual que desde la
barra inferior.

**Acceptance Scenarios**:

1. **Given** una pantalla de 1200 px o más de ancho, **When** el usuario está autenticado, **Then** ve una barra lateral fija de 240 px a la izquierda (fondo blanco, borde derecho del DS, logo arriba) con Inicio, Inventario, Compras, Alertas y Ajustes, y no ve la barra de navegación inferior.
2. **Given** la barra lateral, **When** una sección está activa, **Then** su ítem usa el estilo activo del DS (§19: fondo menta, texto y el ícono en turquesa oscuro, sin fondo turquesa intenso).
3. **Given** la barra lateral, **When** hay alertas pendientes, **Then** el ítem Alertas muestra la misma burbuja con el número que hoy muestra la barra inferior.
4. **Given** el escritorio, **When** el usuario está en cualquier sección, **Then** el contenido ocupa el ancho disponible a la derecha de la barra lateral, con 32 px de margen y 24 px entre bloques (DS §17), sin quedar como una columna de teléfono centrada.
5. **Given** el escritorio, **When** el usuario mira la parte superior, **Then** ve el nombre de la clínica, el indicador de sincronización (spec 012) y su avatar en una barra superior del área de contenido, con el mismo comportamiento que hoy en el encabezado.
6. **Given** el escritorio, **When** el usuario cambia de sección desde la barra lateral, **Then** el resultado es el mismo que cambiarla desde la barra inferior (misma vista, mismo estado).

---

### User Story 3 - Inicio: el resumen del día (Priority: P2)

Como integrante del personal o administradora, al abrir la app veo una sección **Inicio** con un
saludo y lo más importante del inventario, según el DS (§17, §20, §41.3): cuántos insumos están bajo
el mínimo, cuántos están por vencer, cuántos hay que comprar y cuántas alertas tengo, más la lista de
alertas y la de próximos vencimientos. Desde cada tarjeta o ítem llego a la sección donde resuelvo
el tema.

**Why this priority**: Responde de un vistazo "¿qué está bajo?, ¿qué está por vencer?, ¿qué tengo que
comprar?" (DS §41.3) y acerca la app a la lámina de la clienta. Las secciones existentes ya permiten
hacer todo; Inicio las resume y lleva a ellas.

**Independent Test**: Con un inventario de prueba con insumos bajo mínimo, lotes por vencer e ítems
en la lista de compras, abrir la app: Inicio muestra los cuatro contadores con los mismos números que
hoy se ven en Alertas y Compras, y tocar cada tarjeta lleva a la sección correspondiente.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado, **When** abre la app, **Then** llega a Inicio, con el saludo "¡Hola, {nombre}!" y la fecha de hoy.
2. **Given** Inicio, **When** se muestra, **Then** tiene cuatro tarjetas KPI con el estilo del DS (§20): "Productos bajo mínimo", "Próximos a vencer", "Para comprar" y "Alertas", cada una con su número.
3. **Given** los datos locales, **When** se calculan las tarjetas, **Then** "Productos bajo mínimo" y "Próximos a vencer" coinciden con lo que muestra Alertas, "Para comprar" coincide con lo pendiente en Compras y "Alertas" con la burbuja de alertas (que respeta las preferencias de notificaciones del dispositivo).
4. **Given** una tarjeta KPI, **When** el usuario la toca, **Then** llega a la sección correspondiente: bajo mínimo y por vencer a Alertas, para comprar a Compras, alertas a Alertas.
5. **Given** Inicio, **When** hay alertas de stock bajo o caducidad, **Then** se muestra la lista "Alertas" con hasta 5 ítems (nombre, stock o fecha y el estado con su color), y "Ver todas" lleva a Alertas.
6. **Given** Inicio, **When** hay lotes con fecha de caducidad, **Then** se muestra la lista "Próximos vencimientos" con hasta 5 lotes ordenados por fecha (insumo, lote y días que faltan), y "Ver todos" lleva a Alertas.
7. **Given** Inicio, **When** hay insumos para comprar, **Then** se muestra la tarjeta "¿Qué necesitas comprar?" con el número de insumos y un botón que lleva a Compras.
8. **Given** un inventario vacío o sin alertas, **When** se muestra Inicio, **Then** las tarjetas muestran 0 y las listas un mensaje vacío ("Todo en orden"), sin errores.
9. **Given** Inicio sin conexión, **When** se muestra, **Then** todos los números y listas se calculan con los datos del dispositivo (Constitución I y IV).
10. **Given** desktop, **When** se muestra Inicio, **Then** las tarjetas KPI van en una fila y las listas lado a lado. **Given** el teléfono, **Then** van en una columna (DS §38).

---

### User Story 4 - La disposición se adapta a teléfono, tablet y desktop (Priority: P2)

Como usuario que alterna entre el teléfono del gabinete, una tablet y el computador de la recepción,
quiero que la app se acomode a cada pantalla según el DS: barra inferior en el teléfono, barra
lateral que se puede contraer en la tablet y barra lateral completa en el escritorio.

**Why this priority**: Completa la navegación desktop para los tamaños intermedios y define cómo se
ven los componentes en cada ancho, pero el valor principal ya lo entregan US1 y US2.

**Independent Test**: Redimensionar la ventana entre 375, 768, 1024 y 1440 px. En cada rango la
navegación y la grilla cambian según la tabla de FR-011, sin contenido cortado ni desplazamiento
horizontal.

**Acceptance Scenarios**:

1. **Given** una pantalla de menos de 768 px, **When** el usuario navega, **Then** ve la barra inferior del DS (§29: 80 px con área segura, íconos de 24 px, etiquetas de 11 px, activo en turquesa e inactivo en gris) y no ve la barra lateral.
2. **Given** una pantalla de 768 a 1199 px, **When** el usuario navega, **Then** ve una barra lateral contraída (solo íconos) que puede expandir para ver las etiquetas, y no ve la barra inferior.
3. **Given** la barra lateral contraída, **When** el usuario la expande o la vuelve a contraer, **Then** el contenido se reacomoda sin perder lo que estaba haciendo, y la preferencia se recuerda en ese dispositivo.
4. **Given** cualquier ancho entre 375 y 1920 px, **When** se muestra cualquier sección, **Then** no hay desplazamiento horizontal de la página ni controles cortados.
5. **Given** un modal o panel (por ejemplo, el de sincronización o el de opciones de un insumo), **When** se abre en desktop, **Then** aparece centrado con el ancho, el padding y el radio del DS (§36), y **When** se abre en el teléfono, **Then** sigue apareciendo desde abajo.

---

### User Story 5 - Inventario en tabla en pantallas grandes (Priority: P3)

Como administradora en el escritorio, quiero ver el inventario como una tabla con columnas, según el
DS (§22), para comparar insumos de un vistazo. En el teléfono quiero seguir viéndolo en tarjetas.

**Why this priority**: Aprovecha el desktop para revisar el inventario, pero las tarjetas actuales ya
funcionan en todos los tamaños. Es una mejora sobre US2, no un requisito para usarla.

**Independent Test**: En 1200 px o más, el inventario aparece en una tabla con filas de 64 px y las
columnas disponibles hoy. Las mismas acciones de cada tarjeta (consumir 1, opciones) están en cada
fila. En el teléfono siguen las tarjetas.

**Acceptance Scenarios**:

1. **Given** una pantalla de 1200 px o más, **When** el usuario abre Inventario, **Then** ve una tabla con las columnas del DS que hoy tienen datos (Producto, Categoría, Stock, Stock mínimo, Vencimiento, Estado, Acciones), con el estilo del DS (§22: filas de 64 px, encabezado de 12 px en gris, resaltado al pasar el cursor).
2. **Given** la tabla, **When** el usuario usa los filtros o la búsqueda, **Then** la tabla se filtra igual que las tarjetas.
3. **Given** una fila de la tabla, **When** el usuario usa sus acciones, **Then** puede hacer lo mismo que en la tarjeta (consumir 1, abrir el detalle, el menú de opciones), con los mismos permisos por rol.
4. **Given** una pantalla de menos de 1200 px, **When** el usuario abre Inventario, **Then** ve las tarjetas, con el estilo nuevo.

---

### Edge Cases

- **Contraste**: varios pares de colores del DS no alcanzan el contraste mínimo de lectura para texto normal (por ejemplo, texto blanco sobre el turquesa primario `#12B8AE`, 2,5:1). Ver FR-005.
- **Tamaño táctil**: el DS define botones y campos de 44 px de alto, menos que el mínimo de 48 px de la constitución. Ver FR-004.
- **Íconos sin equivalente**: las funciones actuales que no figuran en la tabla del DS §7 (por ejemplo, deshacer, copiar, cerrar, categoría) usan el ícono outline más cercano del mismo set.
- **Secciones del DS que no existen** (Inicio, Tratamientos, Consumo, Proveedores, Reportes): no aparecen en la navegación hasta que su spec las implemente. No se muestran ítems deshabilitados ni "próximamente".
- **Cambio de ancho en vivo** (girar la tablet, redimensionar la ventana): la disposición cambia sin recargar y sin perder un formulario a medio llenar ni un panel abierto.
- **Sin conexión**: la tipografía y los íconos están disponibles sin red desde el primer uso offline (Constitución I). No dependen de servicios externos al cargar.
- **Nombre muy largo de la clínica o del insumo**: se recorta con puntos suspensivos sin romper la barra lateral, la barra superior ni las filas de la tabla.
- **Preferencia de movimiento reducido**: las transiciones de la barra lateral y los modales se desactivan si el dispositivo lo pide.
- **Pantalla de inicio de sesión**: adopta el DS (logo, campos y botón), sin barra lateral ni inferior.

## Requirements *(mandatory)*

### Functional Requirements

**Identidad visual (US1)**

- **FR-001**: La app DEBE usar la paleta del DS (§2 y §40): primarios, Deep Teal, fondos, textos, bordes y estados (success, warning, error, info), y respetar la proporción de uso del color del DS (§3).
- **FR-002**: La app DEBE usar Manrope con los pesos 400, 500, 600, 700 y 800, y la escala tipográfica del DS (§5) para títulos, cuerpo, etiquetas y números destacados.
- **FR-003**: La app DEBE usar el set de íconos outline recomendado por el DS (§6–7), con los íconos asignados por función, los tamaños por plataforma (§8) y los colores de estado normal, activo y oscuro. Las funciones sin ícono asignado usan el equivalente más cercano del mismo set.
- **FR-004**: Todo objetivo interactivo DEBE medir al menos 48×48 px (Constitución III). Donde el DS indica 44 px (botones, campos), la altura será de 48 px y se mantienen el resto de sus medidas (radio, padding, tipografía).
- **FR-005**: Los textos DEBEN cumplir el contraste WCAG AA (4,5:1 para texto normal y 3:1 para texto grande) y los íconos informativos al menos 3:1 contra su fondo. Se mantienen los tonos del DS y, solo en los pares que no alcanzan el mínimo, se usa un tono más oscuro de la misma familia del DS (p. ej., el botón primario usa el tono "active" `#067F7A`, con texto blanco a 4,86:1). Los colores decorativos (fondos, bordes, rellenos sin texto) se usan tal cual.
- **FR-006**: Los botones (primario, secundario y outline), los campos, las tarjetas, los chips, los modales y los avisos DEBEN seguir los radios, bordes, sombras, padding y estados (hover, activo, foco, deshabilitado) del DS (§10–16, §36–37), con las excepciones de FR-004 y FR-005.
- **FR-007**: Los estados de stock DEBEN mostrarse con el ícono, el color y el badge del DS (§21): **suficiente** (sobre el mínimo o sin mínimo), **bajo** (en o bajo el mínimo, regla de la spec 004) y **crítico** (stock total 0). "Crítico" es solo visual: no agrega alertas ni cambia contadores, filtros ni sugeridos. Los estados de caducidad y "en revisión" de la spec 004 DEBEN mantenerse distinguibles entre sí con la paleta de estados del DS, nunca solo con texto (Constitución IV).
- **FR-008**: El logo DEBE seguir el DS (§1): ícono de diente outline geométrico propio, en turquesa, y el nombre en Deep Teal con Manrope 800, en el encabezado, la barra lateral, la pantalla de inicio de sesión y el ícono de la app instalada. El nombre visible DEBE escribirse "Dentdelion" en todos los puntos de contacto (pantalla de carga, inicio de sesión, encabezado, barra lateral, título de la pestaña y nombre de la app instalada), en reemplazo del "DENTDELION" de la spec 011. El nombre interno del proyecto sigue siendo "inDENTory" (spec 011 FR-003).
- **FR-009**: La adopción del DS NO DEBE cambiar los flujos, los textos de los controles, las acciones disponibles por rol ni los datos mostrados, salvo la sección Inicio (US3) y las disposiciones nuevas de US2, US4 y US5.

**Navegación y disposición (US2, US4)**

- **FR-010**: La navegación DEBE ofrecer Inicio, Inventario, Compras, Alertas y Ajustes (hoy "Más"), en ese orden, con la burbuja de alertas pendientes de la spec 010. Inicio es la sección que se abre al entrar a la app.
- **FR-011**: La disposición DEBE seguir los rangos del DS (§38):

  | Ancho | Navegación | Contenido |
  |---|---|---|
  | < 768 px | Barra inferior (DS §29) | Una columna |
  | 768–1199 px | Barra lateral contraída, expandible | Hasta 2 columnas donde haya bloques en paralelo |
  | ≥ 1200 px | Barra lateral de 240 px (DS §18–19) | Ancho completo; 32 px de margen y 24 px entre bloques (DS §17) |

- **FR-012**: En la barra lateral, el ítem activo DEBE usar el estilo del DS §19. Los ítems DEBEN medir al menos 48 px de alto (FR-004).
- **FR-013**: En tablet, la preferencia de barra lateral contraída o expandida DEBE recordarse en el dispositivo, y por defecto empieza contraída.
- **FR-014**: En la disposición con barra lateral, el nombre de la clínica, el indicador de sincronización (spec 012) y el avatar DEBEN mostrarse en una barra superior del área de contenido, con el mismo comportamiento que hoy.
- **FR-015**: Cambiar de ancho o de orientación DEBE reacomodar la disposición sin recargar, sin perder formularios a medio llenar, paneles abiertos ni la sección activa.
- **FR-016**: En la disposición con barra lateral, los paneles que hoy suben desde abajo DEBEN mostrarse como modales centrados con el ancho (480–600 px), el padding y el radio del DS (§36). En el teléfono siguen subiendo desde abajo.
- **FR-017**: Ninguna sección DEBE generar desplazamiento horizontal de la página en anchos de 375 a 1920 px.

**Inicio (US3)**

- **FR-022**: Inicio DEBE mostrar un saludo con el nombre del usuario y la fecha de hoy, y cuatro tarjetas KPI (DS §20): "Productos bajo mínimo", "Próximos a vencer", "Para comprar" y "Alertas".
- **FR-023**: Las tarjetas DEBEN calcularse con los datos locales del dispositivo y coincidir con las secciones existentes: bajo mínimo y por vencer con las secciones "Stock bajo" y "Próximos a caducar" de Alertas (mismas reglas de stock mínimo y niveles de aviso de caducidad), para comprar con lo pendiente en Compras (sugeridos e ítems manuales) y alertas con la burbuja de la spec 010, que es la única que aplica las preferencias de notificaciones del dispositivo.
- **FR-024**: Cada tarjeta DEBE llevar a su sección al tocarla: bajo mínimo, por vencer y alertas a Alertas; para comprar a Compras.
- **FR-025**: Inicio DEBE mostrar la lista "Alertas" (hasta 5, las más urgentes primero, con estado por color e ícono) y la lista "Próximos vencimientos" (hasta 5 lotes por fecha, con los días que faltan), cada una con un enlace a Alertas, y la tarjeta "¿Qué necesitas comprar?" con un botón a Compras cuando haya algo para comprar.
- **FR-026**: Inicio NO DEBE mostrar KPIs ni gráficos que necesiten datos que aún no existen (valor del inventario, gasto, consumo por categoría, materiales más consumidos): llegan con las specs 015–017.
- **FR-027**: Con datos vacíos, Inicio DEBE mostrar 0 en las tarjetas y un mensaje de "Todo en orden" en las listas.

**Inventario en desktop (US5)**

- **FR-018**: Con un ancho de 1200 px o más, Inventario DEBE mostrarse como tabla con las columnas del DS §22 que hoy tienen datos (Producto, Categoría, Stock, Stock mínimo, Vencimiento, Estado, Acciones), filas de 64 px y el estilo del DS. Las columnas Presentación y Costo unitario quedan para la spec 015.
- **FR-019**: Cada fila de la tabla DEBE ofrecer las mismas acciones que la tarjeta (consumir 1, abrir el detalle, menú de opciones), con los mismos permisos y filtros. Con menos de 1200 px se mantienen las tarjetas.

**Restricciones transversales**

- **FR-020**: La tipografía, los íconos y los estilos DEBEN funcionar sin conexión desde el primer uso (Constitución I). No pueden cargarse en tiempo real desde servicios externos.
- **FR-021**: Las animaciones y transiciones nuevas DEBEN desactivarse si el dispositivo pide movimiento reducido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La clienta aprueba las 5 secciones (Inicio y las 4 existentes) en teléfono (375 px), tablet (768 px y 1024 px) y desktop (1440 px), comparando capturas con la lámina del DS, sin observaciones de color, tipografía, íconos ni componentes pendientes.
- **SC-002**: El 100% de los objetivos interactivos de las 5 secciones mide al menos 48×48 px en los cuatro anchos.
- **SC-003**: El 100% de los textos y los íconos informativos cumple el contraste que fije FR-005.
- **SC-004**: En desktop, un usuario cambia entre las 5 secciones desde la barra lateral con un solo clic por cambio y sin desplazarse.
- **SC-005**: Las tareas habituales (consumir un insumo, registrar material, revisar alertas, marcar una compra, cambiar un ajuste) toman el mismo tiempo o menos que antes del cambio. Un consumo rápido sigue tardando menos de 10 segundos en el teléfono (DS §41.1).
- **SC-006**: Ningún ancho de 375 a 1920 px muestra desplazamiento horizontal ni controles cortados.
- **SC-007**: La app sigue mostrándose con su tipografía e íconos correctos con el dispositivo sin conexión desde el primer arranque.
- **SC-008**: Un usuario identifica en menos de 2 segundos, al abrir Inicio, cuántos insumos están bajo el mínimo, por vencer y para comprar (DS §44).

## Assumptions

- "Ajustes" es el nombre de la sección que hoy aparece como "Más" en la barra inferior. En el teléfono puede seguir llamándose "Más" si el espacio lo pide. El DS usa "Configuración" para la sección equivalente, pero se conserva el nombre actual para no cambiar textos de la app (FR-009).
- La barra superior de desktop no incluye todavía la búsqueda global ni la campana del DS: no existen hoy y quedan para specs posteriores. La búsqueda de Inventario sigue dentro de su sección.
- El botón flotante del DS (§30) y sus acciones (agregar producto, registrar entrada, registrar consumo, escanear) quedan fuera de alcance: hoy esas acciones están en Inventario y el escaneo sigue oculto (spec 011).
- Inicio se calcula solo con datos que ya existen y no agrega persistencia nueva. Las KPIs del DS que necesitan costos (valor de inventario, gasto del mes) y los gráficos (consumo por categoría, materiales más consumidos) se agregan en las specs 015–017.
- Inicio no agrega acciones nuevas: sus tarjetas y listas solo llevan a las secciones donde ya se resuelve cada tema (por ejemplo, el "Comprar" de la lámina lleva a Compras, no agrega el ítem por sí solo).
- Con 5 secciones, la barra inferior del teléfono muestra los 5 ítems; cada uno mantiene al menos 48 px (FR-004).
- No se agrega modo oscuro: el DS no lo define.
- Los colores de gráficos (§35) no aplican: la app no tiene gráficos hasta la spec 017.
- La verificación visual se hace con capturas en los 4 anchos de SC-001, comparadas con la lámina del DS.
- No hay cambios de datos, de sincronización ni de permisos: es un cambio de presentación y disposición.
