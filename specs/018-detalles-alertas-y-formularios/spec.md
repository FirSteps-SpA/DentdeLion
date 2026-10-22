# Feature Specification: Detalles de alertas y formularios

**Feature Branch**: `[018-detalles-alertas-y-formularios]`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "nueva spec 018 detalles-alertas-y-formularios según el roadmap en 1STEPS/1stDocs en su rama propia"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 018 · `detalles-alertas-y-formularios` (S–M), a
partir de los pedidos de la clienta en `1stDocs/002-backlog/002-DentdeLion.md` (secciones "Detalles" y
"Corregir 'bug'"). Primera spec de la tanda del release 2.5.0.

## Contexto

La clienta pidió cuatro arreglos chicos y visibles del uso diario:

1. **Alertas de caducidad más legibles.** Hoy cada renglón dice "nombre — lote X, vence AAAA-MM-DD
   (nivel N días)": el número de lote ocupa lugar, la fecha está en formato técnico y "nivel 30 días"
   no dice cuánto falta de verdad. Quiere ver el **nombre del material**, la **fecha de vencimiento** y
   **cuánto le queda** ("vence en 12 días", "vence en 3 meses") o **cuánto hace que venció**
   ("caducado hace 5 días"). El lote solo cuando pide ver el detalle.
2. **"Sin stock" en vez de "Bajo mínimo" cuando el stock es 0.** Hoy la etiqueta dice "Bajo mínimo" en
   los dos casos; solo cambia el ícono.
3. **El interruptor de caducidad antes de la fecha de vencimiento** en el alta de material. Hoy está al
   final del formulario, después de los datos del lote y de la fecha, así que se completa la fecha antes
   de decidir si el material caduca.
4. **Bug de la rueda del mouse:** al pasar la rueda (o el gesto de desplazamiento del trackpad) sobre
   un campo numérico, el valor sube o baja sin querer. Pasa con el stock inicial y el mínimo del alta, y
   en todos los campos numéricos de la app (cantidades, mínimos en Ajustes, edición de insumo, precio,
   % profesional, conversión de unidad, consumo, tratamientos). Un stock inicial que cambia sin que la
   persona lo note es un error de inventario.

No hay cambios de datos ni de sincronización: todo es de presentación y de comportamiento de los
formularios. Por eso, si hace falta, puede publicarse sola como 2.4.1.

**Fuera de alcance**: rediseñar la vista de Alertas o sus secciones; cambiar los niveles de aviso o
cómo se calcula qué lote alerta; cambiar las tarjetas de Inventario (que siguen mostrando el lote más
próximo a vencer); quitar la escritura con teclado de los campos numéricos (ver Assumptions); los
demás pedidos de la tanda (Ajustes por secciones, paginación, proveedores, compras: specs 019–022).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cargar cantidades sin que la rueda las cambie (Priority: P1)

Como dentista que registra un material nuevo en el computador, quiero escribir el stock inicial o
usar los botones + y −, y seguir desplazándome por el formulario con la rueda del mouse sin que la
cantidad cambie, para no guardar un stock equivocado sin darme cuenta.

**Why this priority**: Es el único pedido que la clienta llamó "bug" y el único que puede dejar datos
de inventario incorrectos (un stock inicial o un mínimo alterados en silencio). Los demás son de
lectura.

**Independent Test**: En el alta de material, escribir 200 en "Stock inicial", dejar el puntero sobre
el campo y girar la rueda en ambos sentidos: el valor sigue en 200 y la página se desplaza. Repetir en
cada campo numérico de la app.

**Acceptance Scenarios**:

1. **Given** el alta de material con "Stock inicial" en 200 y el campo con el foco, **When** la persona
   gira la rueda del mouse con el puntero sobre el campo, **Then** el valor sigue en 200 y la página se
   desplaza como sobre cualquier otra parte del formulario.
2. **Given** cualquier campo numérico de la app (stock mínimo, cantidad a consumir, precio,
   % profesional, factor de conversión, cantidades de un tratamiento, mínimos en Ajustes), **When** se
   usa la rueda o el gesto de desplazamiento del trackpad sobre él, **Then** su valor no cambia.
3. **Given** un campo numérico con el foco, **When** la persona escribe un número o usa los botones
   + y −, **Then** el valor cambia como hasta ahora.
4. **Given** un teléfono o tablet, **When** la persona toca un campo numérico, **Then** sigue
   apareciendo el teclado numérico y los botones + y − funcionan igual que antes.

---

### User Story 2 - Leer de un vistazo cuánto le queda a cada material (Priority: P2)

Como dentista, quiero que cada alerta de caducidad me diga el nombre del material, la fecha en que
vence y cuánto le queda (o hace cuánto venció), sin el número de lote, para decidir rápido qué usar
primero o qué descartar.

**Why this priority**: Es la pantalla que más se mira de la tanda y hoy obliga a calcular a mano
("vence 2026-12-03, nivel 30 días"). No cambia datos, así que va después del bug.

**Independent Test**: Con lotes que vencen en 12 días, en 75 días, hoy y hace 5 días, abrir Alertas e
Inicio y comprobar el texto de cada renglón; tocar una alerta y ver el número de lote en el detalle.

**Acceptance Scenarios**:

1. **Given** un lote de "Lidocaína 2 %" que vence en 12 días, **When** se abre Alertas, **Then** el
   renglón muestra "Lidocaína 2 %", la fecha de vencimiento en formato de fecha legible (p. ej.
   "3 nov 2026") y "vence en 12 días", sin el número de lote.
2. **Given** un lote que vence en 75 días y está dentro de un nivel de aviso configurado, **When** se
   abre Alertas, **Then** el renglón dice "vence en 2 meses".
3. **Given** un lote que venció hace 5 días, **When** se abre Alertas, **Then** el renglón dice
   "caducado hace 5 días" y mantiene la etiqueta y el color de caducado.
4. **Given** un lote que vence hoy, **When** se abre Alertas, **Then** el renglón dice "vence hoy".
5. **Given** una alerta de caducidad, **When** la persona la toca, **Then** se abre el detalle del
   insumo, donde se ve cada lote con su número, fecha y stock.
6. **Given** dos lotes del mismo material que alertan, **When** se abre Alertas, **Then** se ven dos
   renglones con el mismo nombre y fechas distintas, y el detalle permite distinguirlos por lote.
7. **Given** el resumen de alertas en Inicio, **When** se muestra una alerta de caducidad, **Then**
   sigue el mismo formato (nombre, fecha, tiempo restante, sin lote).

---

### User Story 3 - Distinguir "Sin stock" de "Bajo mínimo" (Priority: P2)

Como dentista, quiero que una alerta de stock diga "Sin stock" cuando no queda nada, y "Bajo mínimo"
cuando queda algo pero menos que el mínimo, para saber qué tengo que comprar con urgencia.

**Why this priority**: Cambio chico y de alto valor de lectura; se puede entregar junto con la
historia 2.

**Independent Test**: Con un insumo en 0 y otro en 2 con mínimo 5, abrir Alertas e Inicio y comprobar
la etiqueta de cada uno.

**Acceptance Scenarios**:

1. **Given** un insumo con stock 0 y mínimo 5 en el lugar activo, **When** se abre Alertas, **Then** su
   etiqueta dice "Sin stock", con ícono y color de peligro.
2. **Given** un insumo con stock 2 y mínimo 5, **When** se abre Alertas, **Then** su etiqueta dice
   "Bajo mínimo", con ícono y color de advertencia.
3. **Given** el resumen de alertas en Inicio, **When** un insumo tiene stock 0, **Then** su etiqueta
   dice "Sin stock" (hoy dice "Stock crítico").
4. **Given** la vista "Todos" con un insumo en 0 en un lugar y en 2 en otro, **When** se abre Alertas,
   **Then** cada renglón muestra la etiqueta que corresponde a su lugar, con el chip del lugar.

---

### User Story 4 - Decidir si el material caduca antes de poner la fecha (Priority: P3)

Como dentista que da de alta un material, quiero el interruptor "¿Caduca?" justo antes de la fecha de
vencimiento, para decidir primero si el material caduca y solo entonces completar la fecha.

**Why this priority**: Mejora el orden del formulario, pero hoy se puede completar igual; es el de
menor impacto.

**Independent Test**: Abrir el alta de material y recorrer el formulario de arriba abajo (también con
Tab): el interruptor aparece inmediatamente antes del campo de fecha y, al apagarlo, la fecha
desaparece.

**Acceptance Scenarios**:

1. **Given** el alta de material, **When** la persona recorre el formulario, **Then** el interruptor
   "¿Caduca?" aparece inmediatamente antes del campo "Fecha de vencimiento", en el orden visual y en
   el orden de foco con teclado.
2. **Given** el interruptor encendido, **When** la persona lo apaga, **Then** el campo de fecha
   desaparece y el material se guarda como "No caduca", igual que hoy.
3. **Given** el interruptor apagado, **When** la persona lo enciende, **Then** el campo de fecha aparece
   inmediatamente debajo y es obligatorio, igual que hoy.

---

### Edge Cases

- **Desplazar la página con el puntero sobre un campo numérico**: la página debe desplazarse; la rueda
  no puede quedar "atrapada" en el campo sin hacer nada.
- **Campo numérico con el foco y teclas de flecha arriba/abajo**: siguen cambiando el valor (acción
  explícita de teclado, útil para accesibilidad); solo se bloquea la rueda.
- **Campos numéricos que se agreguen en el futuro**: deben heredar el mismo comportamiento sin que cada
  formulario tenga que acordarse (la aceptación lo verifica por componente).
- **Lote que vence mañana**: "vence en 1 día" (singular). **Caducado ayer**: "caducado hace 1 día".
- **Límite entre días y meses**: por debajo de 60 días se cuenta en días ("vence en 59 días"); desde 60
  días, en meses enteros ("vence en 2 meses"). Lo mismo para "caducado hace…".
- **Niveles de aviso amplios** (p. ej. 180 días): un lote a 170 días dice "vence en 5 meses".
- **Lote sin fecha de vencimiento**: no genera alerta de caducidad (sin cambios).
- **Stock negativo o con decimales** (unidades fraccionables): con stock menor o igual a 0 la etiqueta
  dice "Sin stock"; con 0,5 y mínimo 2, "Bajo mínimo".
- **Lotes en revisión**: esa sección sigue mostrando el número de lote, porque la revisión es de un lote
  concreto y la administradora necesita identificarlo para resolverla.
- **Alerta en "Todos"**: tocarla abre el detalle del insumo con los lotes del lugar de la alerta, para
  que el lote que alertó esté a la vista.
- **Sin conexión**: todo funciona igual (son cálculos y textos locales).

## Requirements *(mandatory)*

### Functional Requirements

**Campos numéricos (historia 1)**

- **FR-001**: Ningún campo numérico de la app DEBE cambiar su valor por la rueda del mouse ni por el
  gesto de desplazamiento del trackpad, tenga o no el foco.
- **FR-002**: Con el puntero sobre un campo numérico, la rueda DEBE desplazar la página o el contenedor
  como en el resto del formulario.
- **FR-003**: Los campos numéricos DEBEN seguir aceptando escritura con teclado (y mostrar el teclado
  numérico en móvil), los botones + y − donde existen, y las flechas del teclado.
- **FR-004**: El comportamiento de FR-001 DEBE aplicarse en todos los campos numéricos existentes: alta
  de material (stock inicial y mínimo), edición de insumo, consumo, precio de ingreso y de lote,
  conversión de unidad, mínimos y niveles en Ajustes, % profesional de lugares, tratamientos
  (materiales y precio) y recepción de compras.
- **FR-005**: Cada componente con campo numérico DEBE tener una prueba que demuestre que la rueda no
  cambia su valor.

**Alertas de caducidad (historia 2)**

- **FR-006**: Cada alerta de caducidad DEBE mostrar el nombre del material, la fecha de vencimiento en
  formato de fecha legible en español y el tiempo restante o transcurrido.
- **FR-007**: El tiempo DEBE expresarse así: "vence hoy"; "vence en N día(s)" por debajo de 60 días;
  "vence en N meses" (meses enteros) desde 60 días; "caducado hace N día(s)" por debajo de 60 días y
  "caducado hace N meses" desde 60 días. Singular y plural correctos.
- **FR-008**: Las alertas de caducidad NO DEBEN mostrar el número de lote en el listado, ni en Alertas
  ni en el resumen de Inicio.
- **FR-009**: Tocar una alerta de caducidad DEBE llevar al detalle del insumo, donde se ven sus lotes
  con número, fecha de vencimiento y stock.
- **FR-010**: Las alertas de caducidad DEBEN conservar su distinción visual por nivel (color, ícono y
  etiqueta) y el chip de lugar en la vista "Todos".

**Stock bajo (historia 3)**

- **FR-011**: Una alerta de stock de un insumo con stock menor o igual a 0 DEBE decir "Sin stock" con
  ícono y color de peligro; con stock mayor que 0 y menor que el mínimo DEBE decir "Bajo mínimo" con
  ícono y color de advertencia.
- **FR-012**: El resumen de alertas de Inicio DEBE usar las mismas etiquetas de FR-011 (reemplaza
  "Stock crítico").

**Alta de material (historia 4)**

- **FR-013**: En el alta de material, el interruptor "¿Caduca?" DEBE ubicarse inmediatamente antes del
  campo "Fecha de vencimiento", en el orden visual y en el de foco con teclado.
- **FR-014**: El interruptor DEBE conservar su comportamiento actual: apagado oculta la fecha y el
  material queda como "No caduca"; encendido muestra la fecha como obligatoria.

**Generales**

- **FR-015**: Los cambios NO DEBEN modificar datos guardados, cálculo de alertas, niveles de aviso ni
  sincronización.
- **FR-016**: Todos los controles tocados DEBEN mantener el área táctil mínima de 48×48 px
  (Constitución III), incluida la alerta como objetivo táctil para abrir el detalle.

### Key Entities

- **Alerta de caducidad**: material, lote (oculto en el listado), fecha de vencimiento, días restantes
  (negativos si venció), nivel de aviso y lugar. Sin cambios en cómo se calcula; cambia cómo se muestra.
- **Alerta de stock bajo**: material, stock actual, mínimo y lugar. Su etiqueta pasa a depender de si el
  stock es 0.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de los campos numéricos de la app, girar la rueda del mouse sobre el campo deja
  el valor sin cambios (verificado por prueba en cada componente).
- **SC-002**: Una persona puede decir cuánto le falta a cada material de Alertas para vencer sin hacer
  cálculos, leyendo un solo renglón.
- **SC-003**: Ningún renglón del listado de alertas de caducidad (Alertas e Inicio) muestra el número de
  lote; el lote se alcanza en 1 toque desde la alerta.
- **SC-004**: El 100 % de los insumos con stock 0 aparece como "Sin stock" y ninguno con stock mayor que
  0 aparece así.
- **SC-005**: En el alta de material, el interruptor de caducidad queda antes de la fecha de
  vencimiento en el orden de lectura y de foco.
- **SC-006**: La clienta confirma en su equipo de escritorio que puede completar el alta de material
  usando la rueda para desplazarse, sin que cambien las cantidades.

## Assumptions

- **Escritura con teclado se mantiene** (pregunta 1 del roadmap): la clienta propuso "solo + y −", pero
  escribir 200 con botones es impracticable. Se bloquea solo la rueda y se conservan escritura, teclado
  numérico y flechas. A confirmar en `/speckit-clarify`.
- **Umbral días/meses en 60 días** (pregunta 2 del roadmap), con meses enteros redondeados hacia abajo.
  A confirmar en `/speckit-clarify`.
- **El detalle es el del insumo en Inventario** (pregunta 3 del roadmap): ya muestra cada lote con su
  número, fecha y stock, así que no hace falta una hoja nueva. A confirmar en `/speckit-clarify`.
- La etiqueta del interruptor pasa a "¿Caduca?" (como la llama la clienta y como ya se llama en la
  edición de insumo); hoy en el alta dice "Sujeto a caducidad".
- El formato de fecha legible sigue el que la app ya usa en otras vistas en español (día, mes abreviado y
  año).
- El resumen de alertas de Inicio y la lista de próximos vencimientos se alinean con Alertas para que el
  mismo dato no se lea distinto en dos pantallas.
- Las tarjetas y la tabla de Inventario, la recepción de compras y el detalle del insumo no cambian su
  forma de mostrar lotes.
- Sin migración ni versión nueva de la base local: es solo de front.
