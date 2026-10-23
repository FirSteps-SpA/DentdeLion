# Feature Specification: Ajustes por secciones

**Feature Branch**: `[019-ajustes-por-secciones]`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "nueva spec 019 ajustes-por-secciones según el roadmap en 1STEPS/1stDocs en su rama propia"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 019 · `ajustes-por-secciones` (M), a partir del
pedido de la clienta en `1stDocs/002-backlog/002-DentdeLion.md` (sección "AJUSTES"). Segunda spec de la
tanda del release 2.5.0; va antes de la 020 (paginación) y la 021 (proveedores) porque fija la
estructura de Ajustes en la que viven sus listas.

## Contexto

Hoy Ajustes es **una sola página larga con todo abierto**: perfil, notificaciones, configuración de
alertas (con el stock mínimo de los 73 insumos uno debajo del otro), lugares de trabajo, equipo e
invitaciones, categorías e insumos dados de baja. Para cambiar una sola cosa hay que desplazarse por
todo lo demás, y en móvil la página es muy larga.

La clienta pidió que Ajustes muestre **tarjetas que enlazan a pestañas separadas**, con esta
organización:

1. **Perfil y equipo:** datos del perfil y cerrar sesión; equipo e invitaciones.
2. **Lugares de trabajo** (incluye el % profesional).
3. **Notificaciones y avisos:** notificaciones on/off, niveles de aviso de caducidad, aviso de cambios
   sin subir y stock mínimo por insumo.
4. **Categorías.**
5. **Proveedores** (llega con la spec 021; esta spec no la crea).
6. **Insumos dados de baja.**

Además, el editor de **stock mínimo por insumo** tiene dos problemas que conviene resolver al moverlo:

- Con 73 insumos (y creciendo) no se puede encontrar uno sin recorrer toda la lista: hace falta un
  **buscador** y la lista no debe mostrarse entera de una vez.
- Cambia siempre el **mínimo del catálogo**, que solo rige en los lugares que no tienen mínimo propio.
  La edición de un insumo, en cambio, con varios lugares muestra además el **mínimo del lugar activo**.
  En un lugar con mínimo propio, el cambio hecho en Ajustes no se nota en sus alertas, y la persona no
  tiene cómo saberlo desde Ajustes.

Deuda técnica que viaja con esta spec: los mínimos por lugar se descargan del servidor de una sola vez,
sin paginar. Con varios lugares y cientos de insumos pueden superar el máximo de filas que entrega el
servidor por consulta, y los que queden fuera no llegarían al dispositivo. El editor de mínimos los lee
todos, así que tienen que llegar completos.

**Fuera de alcance**: la sección Proveedores y su contenido (spec 021); la paginación de categorías e
insumos dados de baja y el componente de paginación compartido con Inventario (spec 020; esta spec solo
evita la lista completa en el editor de mínimos); cambiar qué se puede configurar en cada sección o sus
reglas (niveles de aviso, invitaciones, % profesional, etc.); cambiar quién puede ver o editar cada
cosa; los accesos de la barra lateral de desktop y de la barra inferior de móvil.

## Clarifications

### Session 2026-10-22

- Q: Si hay una sección abierta y se recarga la página, ¿se ve la misma sección o el índice? → A: Al recargar se conserva la sección abierta y el "atrás" vuelve al índice; al entrar a Ajustes desde el menú se abre siempre el índice.
- Q: Con varios lugares, ¿el editor de stock mínimo de Ajustes edita el mínimo del lugar activo o el general del catálogo? → A: El del lugar activo, indicando si es propio o el general; en "Todos" muestra el de cada lugar en solo lectura; con un solo lugar edita el general del catálogo.
- Q: En tablet y desktop, ¿Ajustes navega igual que en el teléfono o con índice a la izquierda y sección a la derecha? → A: Igual que en el teléfono en todos los tamaños: índice en grilla de 2–3 columnas y luego la sección a ancho completo con "Volver".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir Ajustes en un índice y entrar solo a la sección que necesito (Priority: P1)

Como administradora de la clínica, quiero que Ajustes abra en un índice de tarjetas (una por sección,
con un resumen de lo que hay adentro) y que cada tarjeta abra su sección por separado, para llegar
directo a lo que quiero cambiar sin recorrer toda la configuración.

**Why this priority**: Es el pedido de la clienta y la estructura sobre la que se apoyan el resto de
esta spec y las specs 020 y 021. Sin el índice, las demás historias no tienen dónde vivir.

**Independent Test**: Entrar a Ajustes como administradora: se ve el índice con las cinco tarjetas
(sin Proveedores), cada una con ícono, título y resumen. Tocar "Categorías": se ve solo la sección de
categorías con un botón "Volver"; al volver se está otra vez en el índice.

**Acceptance Scenarios**:

1. **Given** una administradora en cualquier pantalla, **When** abre Ajustes, **Then** ve el índice de
   tarjetas y ninguna sección abierta.
2. **Given** el índice, **When** se mira cada tarjeta, **Then** muestra un ícono, el título de la
   sección y un resumen de una línea con datos reales (por ejemplo "3 lugares", "12 categorías",
   "Sin insumos dados de baja", "4 personas · 1 invitación pendiente").
3. **Given** el índice, **When** la administradora toca una tarjeta, **Then** se abre esa sección sola,
   con su título y un botón "Volver" visible sin desplazarse.
4. **Given** una sección abierta, **When** toca "Volver" (o usa el gesto o botón "atrás" del
   dispositivo o del navegador), **Then** regresa al índice en la misma posición de desplazamiento.
5. **Given** una sección abierta con un cambio ya guardado (por ejemplo, una categoría renombrada),
   **When** vuelve al índice y entra a otra sección, **Then** el cambio sigue aplicado y el resumen de la
   tarjeta lo refleja.
6. **Given** un teléfono, **When** abre Ajustes desde "Más", **Then** los accesos a Compras y Reportes
   siguen arriba del índice, como hoy.
7. **Given** la sección "Perfil y equipo" abierta, **When** se mira la pantalla, **Then** "Cerrar sesión"
   sigue disponible dentro de la sección.

---

### User Story 2 - Ver solo las secciones que me corresponden según mi rol (Priority: P1)

Como integrante del personal (no administración), quiero que Ajustes me muestre solo lo que puedo usar
—mi perfil y mis notificaciones—, sin tarjetas de configuraciones que no me corresponden.

**Why this priority**: Es una regla de permisos que ya existe y no puede perderse con la nueva
estructura: mostrar a `personal` secciones de administración sería una regresión.

**Independent Test**: Entrar a Ajustes con una cuenta de personal: el índice muestra solo "Perfil" y
"Notificaciones"; dentro no aparecen equipo, niveles de aviso, aviso de cambios sin subir ni mínimos.

**Acceptance Scenarios**:

1. **Given** una persona con rol personal, **When** abre Ajustes, **Then** el índice muestra solo dos
   tarjetas: perfil y notificaciones.
2. **Given** personal dentro de la sección de perfil, **When** se mira la pantalla, **Then** ve sus datos
   y "Cerrar sesión", pero no el equipo ni las invitaciones.
3. **Given** personal dentro de la sección de notificaciones, **When** se mira la pantalla, **Then** ve el
   interruptor de notificaciones, pero no los niveles de aviso, el aviso de cambios sin subir ni el stock
   mínimo por insumo.
4. **Given** personal, **When** intenta llegar a una sección de administración por un camino indirecto
   (por ejemplo, un enlace o el historial del navegador que apunte a ella), **Then** ve el índice en vez
   de la sección.
5. **Given** una administradora, **When** abre Ajustes, **Then** ve las cinco tarjetas y, dentro de cada
   una, todo lo que hoy ve en la página larga.

---

### User Story 3 - Encontrar y cambiar el mínimo de un insumo en el lugar donde trabajo (Priority: P2)

Como administradora, quiero buscar un insumo por nombre en el editor de stock mínimo y cambiar su
mínimo **para el lugar de trabajo activo**, igual que cuando edito el insumo, para que el cambio se note
en las alertas de ese lugar y no tenga que recorrer 73 insumos.

**Why this priority**: Resuelve un problema real (el cambio hecho en Ajustes no se nota en lugares con
mínimo propio) y la incomodidad de la lista completa, pero la estructura por secciones aporta valor
aunque el editor siga igual.

**Independent Test**: Con dos lugares, en el lugar A abrir "Notificaciones y avisos", buscar "guantes",
cambiar su mínimo de 10 a 20. La alerta de stock bajo del lugar A usa 20; el lugar B sigue con su
mínimo; la edición del insumo en el lugar A muestra 20.

**Acceptance Scenarios**:

1. **Given** el editor de stock mínimo, **When** la administradora escribe parte del nombre de un
   insumo, **Then** la lista muestra solo los insumos activos cuyo nombre coincide (sin distinguir
   mayúsculas ni tildes) y dice cuántos coinciden.
2. **Given** el editor sin búsqueda y más insumos de los que caben en una página, **When** se abre,
   **Then** muestra una primera página de insumos ordenados por nombre y permite avanzar al resto, sin
   mostrar la lista completa de una vez.
3. **Given** un lugar activo, **When** se mira un insumo en el editor, **Then** se ve el mínimo que rige
   en ese lugar y se indica si es propio del lugar o el general del catálogo.
4. **Given** un lugar activo, **When** la administradora cambia el mínimo de un insumo, **Then** el cambio
   queda como mínimo de ese lugar: las alertas de ese lugar lo usan, los demás lugares no cambian y la
   edición del insumo en ese lugar muestra el mismo valor.
5. **Given** un insumo con mínimo propio del lugar, **When** la administradora borra el valor, **Then** el
   insumo vuelve a usar el mínimo general del catálogo en ese lugar y el editor lo indica.
6. **Given** la vista consolidada "Todos" los lugares, **When** abre el editor, **Then** ve el mínimo que
   rige en cada lugar para cada insumo, sin poder editarlo, con un aviso de que para editar debe elegir
   un lugar.
7. **Given** una clínica con un solo lugar, **When** abre el editor, **Then** edita el mínimo general del
   catálogo (como la edición del insumo con un solo lugar) y no menciona lugares ni "propio/general".
8. **Given** un cambio de mínimo hecho sin conexión, **When** vuelve la conexión, **Then** se sube como
   cualquier otro cambio y llega a los demás dispositivos.

---

### User Story 4 - Que lleguen todos los mínimos por lugar a cada dispositivo (Priority: P3)

Como administradora con varios lugares de trabajo, quiero que todos los mínimos por lugar que guardé
lleguen a cada dispositivo, por muchos que sean, para que las alertas de stock bajo y el editor de
mínimos muestren lo mismo en todos los equipos.

**Why this priority**: Es deuda técnica que hoy no se nota (los mínimos guardados están lejos del
límite), pero el editor de esta spec depende de tenerlos completos y el volumen crece con cada lugar e
insumo.

**Independent Test**: Con datos de prueba que superan el máximo de filas que el servidor entrega por
consulta, un dispositivo nuevo inicia sesión y sincroniza: tiene todos los mínimos por lugar, y las
alertas de stock bajo coinciden con las de otro dispositivo.

**Acceptance Scenarios**:

1. **Given** más mínimos por lugar en el servidor de los que entrega una sola consulta, **When** un
   dispositivo sincroniza, **Then** recibe todos, sin que falte ninguno.
2. **Given** un mínimo cambiado en el dispositivo y todavía sin subir, **When** se descargan los del
   servidor, **Then** el cambio local no se pisa (mismo criterio que hoy).
3. **Given** una descarga que se interrumpe a mitad por falta de red, **When** vuelve la conexión, **Then**
   la siguiente sincronización completa los que faltaban sin duplicar ni perder ninguno.

---

### Edge Cases

- **Recarga de la página con una sección abierta:** la app vuelve a la misma sección (no al índice ni a
  otra pantalla), siempre que el rol de la persona permita verla.
- **Cambio de rol mientras una sección de administración está abierta** (la administradora pasa a
  personal en otro dispositivo y se sincroniza): la sección se cierra y se muestra el índice que
  corresponde al nuevo rol.
- **Datos todavía cargando o sin conexión:** el índice se muestra igual con los datos locales; si un
  resumen no puede calcularse aún, la tarjeta muestra solo el título, sin cifras inventadas.
- **Resumen en cero:** las tarjetas usan textos claros ("Sin categorías", "Sin insumos dados de baja")
  en vez de "0 …"; singular y plural correctos ("1 lugar", "3 lugares").
- **Campo con un cambio a medio escribir** (por ejemplo, el nombre de una categoría en edición sin
  confirmar) y la persona toca "Volver": se comporta igual que hoy al salir de Ajustes; los cambios ya
  guardados no se pierden.
- **Búsqueda sin coincidencias** en el editor de mínimos: mensaje "Ningún insumo coincide con …" y
  opción de limpiar la búsqueda.
- **Insumos dados de baja:** no aparecen en el editor de mínimos; si se restauran, vuelven a aparecer con
  el mínimo que tenían.
- **Lugar activo desactivado** mientras el editor está abierto: el editor pasa al lugar que la app elija
  como activo, igual que en el resto de la app.
- **Valor de mínimo inválido** (negativo, o decimal en un insumo que se cuenta en unidades enteras): se
  rechaza con el mismo mensaje que en la edición del insumo y no se guarda.
- **Desktop con la ventana muy ancha:** el índice y las secciones mantienen un ancho de lectura cómodo,
  sin tarjetas estiradas de borde a borde.

## Requirements *(mandatory)*

### Functional Requirements

**Índice y navegación**

- **FR-001**: Ajustes DEBE abrir en un **índice de tarjetas**, una por sección visible para la persona,
  en este orden: Perfil y equipo, Lugares de trabajo, Notificaciones y avisos, Categorías, Insumos dados
  de baja. El índice DEBE admitir que la spec 021 agregue "Proveedores" entre Categorías e Insumos dados
  de baja sin reordenar las demás.
- **FR-002**: Cada tarjeta DEBE mostrar un ícono, el título de la sección y un resumen de una línea
  calculado con los datos locales del dispositivo:
  - Perfil y equipo: nombre de la persona; para administración, además, cantidad de integrantes y de
    invitaciones pendientes.
  - Lugares de trabajo: cantidad de lugares activos.
  - Notificaciones y avisos: estado de las notificaciones (activadas o desactivadas); para
    administración, además, los niveles de aviso de caducidad.
  - Categorías: cantidad de categorías.
  - Insumos dados de baja: cantidad de insumos dados de baja.
- **FR-003**: Toda la tarjeta DEBE ser el área táctil (mínimo 48×48 px) y DEBE poder activarse con el
  teclado.
- **FR-004**: Al tocar una tarjeta, DEBE mostrarse solo esa sección, con su título y un botón "Volver"
  arriba, visible sin desplazarse.
- **FR-005**: "Volver" y la acción "atrás" del dispositivo o del navegador DEBEN regresar de una sección
  al índice; desde el índice, "atrás" DEBE comportarse como hoy en el resto de la app.
- **FR-006**: La sección abierta DEBE conservarse al recargar la página. Al salir de Ajustes hacia otra
  vista de la app y volver a entrar desde la navegación, Ajustes DEBE abrir en el índice.
- **FR-007**: El contenido de cada sección DEBE ser el que hoy muestra la página larga para esa parte,
  con el mismo comportamiento, validaciones y mensajes:
  - Perfil y equipo: perfil con "Cerrar sesión"; equipo e invitaciones (solo administración).
  - Lugares de trabajo: lugares y % profesional.
  - Notificaciones y avisos: interruptor de notificaciones; niveles de aviso de caducidad, aviso de
    cambios sin subir y stock mínimo por insumo (estos tres, solo administración).
  - Categorías e Insumos dados de baja: tal como hoy.
- **FR-008**: Los cambios guardados dentro de una sección DEBEN seguir aplicados al volver al índice o
  entrar a otra sección, y el resumen de la tarjeta DEBE reflejarlos sin recargar.
- **FR-009**: En móvil, los accesos a Compras y Reportes que hoy están arriba de Ajustes (en "Más")
  DEBEN mantenerse arriba del índice y no repetirse dentro de las secciones.
- **FR-010**: En tablet y desktop, Ajustes DEBE usar la misma navegación que en móvil (índice →
  sección → Volver), con las tarjetas del índice en una grilla de 2 columnas en tablet y 3 en desktop, y un
  ancho máximo de lectura; no hay vista maestro-detalle.

**Permisos**

- **FR-011**: Para el rol personal, el índice DEBE mostrar solo dos tarjetas: "Perfil" (sin equipo) y
  "Notificaciones" (solo el interruptor), con títulos y resúmenes que no mencionen lo que no ve.
- **FR-012**: Las secciones y partes solo para administración DEBEN quedar **ocultas** para personal
  (no solo deshabilitadas), mismo criterio que hoy.
- **FR-013**: Si personal llega a una sección de administración por cualquier camino (enlace, historial,
  recarga tras un cambio de rol), la app DEBE mostrar el índice en su lugar. Si el rol cambia con una
  sección abierta, DEBE aplicarse la misma regla en cuanto el cambio llega al dispositivo.

**Stock mínimo por insumo**

- **FR-014**: El editor de stock mínimo DEBE ofrecer un **buscador por nombre** que filtre mientras se
  escribe, sin distinguir mayúsculas ni tildes, e indique cuántos insumos coinciden.
- **FR-015**: El editor NO DEBE mostrar todos los insumos de una vez: DEBE mostrar una primera página
  (25 insumos, ordenados por nombre) y permitir llegar al resto. Al cambiar la búsqueda, DEBE volver al
  comienzo.
- **FR-016**: El editor DEBE listar solo insumos activos (no dados de baja).
- **FR-017**: Con varios lugares y uno activo, el editor DEBE mostrar y editar el **mínimo del lugar
  activo**, con el mismo efecto que el campo "mínimo en este lugar" de la edición del insumo: el valor
  guardado rige las alertas de stock bajo de ese lugar y no cambia los demás lugares. Con un solo lugar,
  DEBE editar el mínimo general del catálogo, como la edición del insumo.
- **FR-018**: Con varios lugares, para cada insumo el editor DEBE indicar si el mínimo que se ve es **propio del lugar** o
  el **general del catálogo** (porque el lugar no tiene uno propio). Borrar el valor de un mínimo propio
  DEBE devolver el insumo al mínimo general en ese lugar.
- **FR-019**: En la vista consolidada "Todos" los lugares, el editor DEBE mostrar el mínimo que rige en
  cada lugar para cada insumo, en modo solo lectura, con un aviso de que para editar hay que elegir un
  lugar.
- **FR-020**: El editor DEBE aplicar las mismas validaciones y mensajes que la edición del insumo
  (valor no negativo; entero si la unidad lo exige) y guardar cada cambio en el dispositivo de inmediato,
  sin esperar conexión, para que se suba en la siguiente sincronización.
- **FR-021**: Con varios lugares, el mínimo general del catálogo NO DEBE editarse desde este editor;
  sigue definiéndose en el alta y la edición del insumo, como hoy.

**Sincronización de mínimos por lugar**

- **FR-022**: La descarga de mínimos por lugar desde el servidor DEBE traer **todos** los registros
  aunque superen el máximo de filas que el servidor entrega por consulta, por tramos, como ya se hace
  con otras tablas grandes.
- **FR-023**: La descarga por tramos DEBE conservar el criterio actual: un cambio local todavía sin subir
  no se pisa con el valor del servidor, y una descarga interrumpida se completa en la siguiente
  sincronización sin duplicar ni perder registros.

### Key Entities *(include if feature involves data)*

- **Sección de Ajustes**: agrupación de configuraciones que se abre desde una tarjeta del índice. Tiene
  título, ícono, resumen, contenido y el rol mínimo para verla (o partes visibles solo para
  administración). No se guarda como dato; solo se recuerda cuál está abierta para restaurarla al
  recargar.
- **Mínimo del catálogo**: stock mínimo general de un insumo; rige en los lugares sin mínimo propio. Ya
  existe; desde Ajustes solo se edita cuando hay un solo lugar.
- **Mínimo del lugar**: stock mínimo de un insumo en un lugar de trabajo concreto; cuando existe, rige
  sobre el del catálogo en ese lugar. Ya existe; esta spec lo hace editable desde Ajustes y garantiza
  que se descargue completo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Desde que se abre Ajustes, una administradora llega a cualquier configuración con **un
  solo toque** sobre el índice y sin desplazarse por secciones que no busca.
- **SC-002**: Al abrir Ajustes, el contenido inicial ocupa como máximo **una pantalla** en un teléfono de
  360 × 640 (índice más los accesos de Compras y Reportes), frente a las varias pantallas de la página
  actual.
- **SC-003**: Encontrar y cambiar el mínimo de un insumo cualquiera entre 73 toma **menos de 15
  segundos** escribiendo parte de su nombre, frente a recorrer la lista completa.
- **SC-004**: En el 100 % de los casos probados, un mínimo cambiado desde Ajustes en un lugar se ve
  igual en la edición del insumo de ese lugar y en sus alertas de stock bajo, y no cambia en los demás
  lugares.
- **SC-005**: Una cuenta de personal ve exactamente **dos** tarjetas y ninguna configuración de
  administración, en todas las formas de llegar a Ajustes probadas.
- **SC-006**: Con datos de prueba que superan el máximo de filas por consulta del servidor, un
  dispositivo nuevo recibe el **100 %** de los mínimos por lugar en su primera sincronización completa.
- **SC-007**: Ninguna configuración existente se pierde con el cambio: cada control de la página actual
  se encuentra en alguna sección, verificado con capturas en móvil, tablet y desktop para administración
  y personal.

## Assumptions

- **Estado de la sección abierta** (pregunta 1 del roadmap, confirmada en Clarifications): se conserva
  al recargar y se usa el "atrás" del dispositivo para volver al índice; al entrar a Ajustes desde la
  navegación se abre siempre el índice. Es lo que espera una persona que recarga por error o usa el
  gesto atrás en Android.
- **Mínimo por lugar activo** (pregunta 2 del roadmap, confirmada en Clarifications): con varios lugares,
  el editor de Ajustes edita el mínimo del lugar activo, igual que la edición del insumo, y en "Todos"
  muestra el de cada lugar sin editar; con un solo lugar edita el del catálogo, también como la edición
  del insumo. El mínimo del catálogo queda como valor general que se define en el alta y la edición del
  insumo.
- **Desktop con la misma navegación que móvil** (pregunta 3 del roadmap, confirmada en
  Clarifications): índice → sección → Volver en todos los tamaños, con el índice en grilla. Un
  maestro-detalle (índice a la izquierda) suma una segunda forma de navegar y choca con la barra lateral
  que ya tiene la app en desktop.
- **Tamaño de página del editor de mínimos:** 25 insumos, el mismo que propone el roadmap para la
  spec 020. Si la 020 define un componente de paginación común, el editor de mínimos lo adopta allí;
  esta spec no fija si es "Ver más" o páginas numeradas.
- **Personal y "Perfil y equipo":** personal no ve equipo ni invitaciones, así que su tarjeta se llama
  "Perfil"; del mismo modo, su tarjeta de notificaciones se llama "Notificaciones" porque no ve los
  avisos. Coincide con la aceptación del roadmap ("`personal` solo ve Perfil y Notificaciones").
- **Sin cambios de esquema ni migración:** los mínimos por lugar ya existen en el servidor y en el
  dispositivo; solo cambia cuál se edita desde Ajustes y cómo se descargan. Se despliega solo el front.
- **Proveedores:** la tarjeta no aparece en esta spec; la agrega la 021 en la posición prevista.
- **Los mínimos del catálogo ya guardados** no se migran a mínimos por lugar: siguen rigiendo en los
  lugares sin mínimo propio, como hoy.
