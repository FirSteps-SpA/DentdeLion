# Feature Specification: Paginación de listas

**Feature Branch**: `[020-paginacion-de-listas]`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "spec 020 paginacion-de-listas según roadmap en 1STEPS/1stDocs, trabajar en rama dedicada"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 020 · `paginacion-de-listas` (S–M), a partir del
pedido de la clienta en `1stDocs/002-backlog/002-DentdeLion.md` ("Paginación de insumos: evitar scrolls
demasiado largos, tanto en inventario como en ajustes"). Tercera spec de la tanda del release 2.5.0; va
después de la 019, que dejó cada lista de Ajustes en su propia sección.

## Contexto

Hoy Inventario muestra **todos los insumos uno debajo del otro**: en el teléfono y la tablet, una
tarjeta por insumo; en desktop, una fila por insumo en la tabla. Con 73 insumos (y creciendo) la página
es muy larga y, para llegar a los últimos o al detalle de un insumo, que se abre al final de la página,
debajo de toda la lista, hay que desplazarse mucho. Desde Alertas, en cambio, el detalle ya se abre en
una hoja encima de la pantalla.

En Ajustes, la 019 separó las listas en secciones y le puso al editor de stock mínimo un buscador y un
"Ver más" de a 25, pero lo hizo con una solución propia que la 020 debía unificar. **Categorías** e
**Insumos dados de baja** siguen mostrando la lista completa.

Todo el inventario ya está guardado en el dispositivo, así que mostrar por páginas no cambia qué datos
se descargan ni cómo se sincronizan: es solo una forma de presentarlos.

**Fuera de alcance**: cambiar qué filtros, búsquedas o columnas tiene cada lista; ordenar por columnas; paginar
otras pantallas (Alertas, Compras, Reportes, historial de movimientos del detalle de un insumo, equipo o
lugares de trabajo); agregar buscadores a Categorías o Insumos dados de baja; cambios en la
sincronización, el servidor o el esquema de datos.

## Clarifications

### Session 2026-10-23

- Q: ¿Cómo se avanza por las listas largas: "Ver más" que agrega debajo o páginas numeradas? → A: "Ver más" en las tarjetas (teléfono y tablet) y en las listas de Ajustes; páginas numeradas en la tabla de desktop.
- Q: Al salir de Inventario a otra pantalla y volver, ¿se recuerdan la página y los insumos cargados? → A: No: la lista empieza desde el comienzo y los filtros se reinician, como hoy; solo se conserva al abrir y cerrar el detalle o usar las acciones de un insumo.
- Q: ¿El detalle de un insumo de Inventario se abre al final de la página (como hoy) o en una hoja encima de la lista? → A: En una hoja encima de la lista, la misma que usa el detalle abierto desde Alertas, en todos los tamaños; al cerrarla, la lista queda donde estaba.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recorrer el inventario por partes en el teléfono (Priority: P1)

Como dentista que usa la app en el teléfono, quiero que Inventario muestre los insumos de a un grupo y
me deje cargar los siguientes cuando los necesito, para no tener que desplazarme por todo el inventario
cada vez que entro.

**Why this priority**: Es el pedido de la clienta y el lugar donde más se usa la app (consumir y revisar
stock desde el teléfono). Por sí sola ya resuelve el scroll largo en la pantalla principal.

**Independent Test**: Con 200 insumos de prueba, abrir Inventario en un teléfono: se ven los primeros 25
y un botón "Ver más" que indica cuántos quedan; tocarlo agrega los 25 siguientes debajo, sin perder los
que ya estaban a la vista.

**Acceptance Scenarios**:

1. **Given** un inventario con más insumos que el tamaño de página, **When** se abre Inventario en un
   teléfono o tablet, **Then** se muestran solo los primeros 25 insumos, por orden alfabético, y un botón
   "Ver más" con la cantidad que falta por mostrar.
2. **Given** la lista con "Ver más", **When** se toca, **Then** se agregan los 25 siguientes debajo de
   los ya visibles, la posición en pantalla no salta y el botón actualiza lo que queda; cuando no queda
   nada, el botón desaparece.
3. **Given** un inventario con 25 insumos o menos, **When** se abre Inventario, **Then** se ven todos y
   no aparece ningún control de paginación.
4. **Given** varios grupos ya cargados con "Ver más", **When** se usa "Consumir 1" o el menú de un
   insumo, **Then** la lista sigue mostrando los mismos grupos cargados y en la misma posición.
5. **Given** la lista con varios grupos cargados, **When** se toca un insumo, **Then** su detalle se abre
   en una hoja encima de la lista, sin desplazar la página; al cerrarla, la lista se ve con los mismos
   grupos cargados y en la misma posición en que estaba.

---

### User Story 2 - Que búsqueda, filtros y alertas sigan viendo todo el inventario (Priority: P1)

Como dentista, quiero que buscar, filtrar por categoría o estado y el resumen de alertas sigan
funcionando sobre **todo** el inventario, no solo sobre lo que se ve en pantalla, para no perderme un
insumo por estar en una página que no abrí.

**Why this priority**: Si la paginación ocultara insumos a la búsqueda o a las alertas, la app daría
información incompleta, que es peor que el scroll largo. Va junto con la historia 1.

**Independent Test**: Con 200 insumos, buscar uno que alfabéticamente esté entre los últimos: aparece
en la primera página de resultados. El resumen de alertas cuenta todos los insumos con stock bajo,
aunque estén más allá de la primera página.

**Acceptance Scenarios**:

1. **Given** la lista con varios grupos cargados o en una página que no es la primera, **When** se
   escribe en la búsqueda, se elige una categoría o un estado, o se toca un acceso del resumen de
   alertas, **Then** el filtro se aplica a todo el inventario y la lista vuelve al comienzo (primera
   página o primer grupo) de los resultados.
2. **Given** un filtro que deja más resultados que el tamaño de página, **When** se aplica, **Then** los
   resultados también se muestran por páginas, con la cantidad total de resultados a la vista.
3. **Given** cualquier página, **When** se mira el resumen de alertas, **Then** sus cifras son las de
   todo el inventario (del lugar activo o de "Todos"), igual que hoy.
4. **Given** un filtro sin resultados, **When** se aplica, **Then** se ve el mensaje actual "Ningún insumo
   coincide…" con "Limpiar filtros" y ningún control de paginación.
5. **Given** que se cambia de lugar de trabajo (o a "Todos"), **When** se actualiza la lista, **Then**
   vuelve al comienzo.

---

### User Story 3 - Ir por páginas en la tabla de desktop (Priority: P2)

Como administradora que revisa el inventario en el computador, quiero que la tabla muestre una página
de insumos a la vez, con controles para ir a la anterior, la siguiente o una página concreta, para
recorrer el inventario sin una tabla interminable.

**Why this priority**: En desktop la tabla ya es más compacta que las tarjetas, así que el problema es
menor que en el teléfono; pero con cientos de insumos la tabla también se vuelve larga.

**Independent Test**: Con 200 insumos en desktop: la tabla muestra 25 filas y los controles indican
"1–25 de 200" y 8 páginas; ir a la página 3 muestra los insumos 51 a 75 y deja a la vista el comienzo
de la tabla.

**Acceptance Scenarios**:

1. **Given** más insumos que el tamaño de página en desktop, **When** se abre Inventario, **Then** la
   tabla muestra la primera página y, debajo, controles con "anterior", "siguiente", los números de
   página y el rango visible ("1–25 de 200").
2. **Given** la tabla en una página cualquiera, **When** se elige otra página, **Then** se muestran sus
   insumos, el comienzo de la tabla queda a la vista y el rango se actualiza.
3. **Given** la primera o la última página, **When** se miran los controles, **Then** "anterior" o
   "siguiente" (según corresponda) aparecen deshabilitados.
4. **Given** muchas páginas, **When** se miran los controles, **Then** no se listan todos los números:
   se ven la primera, la última, las cercanas a la actual y "…" para el resto, sin desbordar el ancho.
5. **Given** la tabla en la página 3, **When** se abre y cierra el detalle de un insumo, **Then** se sigue
   en la página 3.
6. **Given** la ventana pasa de desktop a tablet o al revés (por ejemplo, al cambiar su ancho), **When**
   cambia la disposición, **Then** la lista sigue mostrando el insumo que estaba primero en pantalla o
   uno anterior, sin saltar al final.

---

### User Story 4 - Listas de Ajustes por partes, igual que Inventario (Priority: P3)

Como administradora, quiero que las listas de Ajustes (stock mínimo por insumo, categorías e insumos
dados de baja) se muestren por partes y de la misma forma que Inventario, para no recorrer listas largas
y no tener que aprender dos maneras de avanzar.

**Why this priority**: Estas listas se usan menos que Inventario y hoy son más cortas (salvo los
mínimos, que la 019 ya paginó); el valor principal es la consistencia y que no crezcan sin límite.

**Independent Test**: Con 40 categorías y 30 insumos dados de baja, abrir cada sección: se ven 25 y
"Ver más (quedan 15)" o "(quedan 5)"; el editor de mínimos se comporta igual que antes de esta spec.

**Acceptance Scenarios**:

1. **Given** más categorías o insumos dados de baja que el tamaño de página, **When** se abre su sección,
   **Then** se ven los primeros 25 (categorías en su orden actual; insumos dados de baja por orden
   alfabético), con "Ver más" y la cantidad que falta.
2. **Given** 25 o menos elementos, **When** se abre la sección, **Then** se ven todos, sin controles.
3. **Given** el editor de stock mínimo, **When** se busca o se avanza, **Then** se comporta como lo dejó
   la 019 (25 por grupo, vuelve al comienzo al cambiar la búsqueda) y su "Ver más" es igual al de las
   demás listas.
4. **Given** varios grupos cargados en una lista de Ajustes, **When** se renombra, borra o restaura un
   elemento, **Then** la lista mantiene los grupos cargados y la posición, y el contador de "quedan" se
   ajusta.
5. **Given** una sección de Ajustes con varios grupos cargados, **When** se vuelve al índice y se entra
   de nuevo, **Then** la lista empieza otra vez desde el comienzo.

---

### Edge Cases

- **La lista se achica mientras se mira** (un insumo se da de baja, deja de cumplir un filtro de estado
  tras consumirlo, o llega un cambio por sincronización): en desktop, si la página actual queda vacía,
  se muestra la última página que tenga insumos; con "Ver más", los grupos ya cargados se mantienen y
  simplemente se muestran los que quedan. Nunca se ve una página vacía con insumos disponibles.
- **La lista crece mientras se mira** (alta de un insumo o sincronización): la página o los grupos
  cargados no cambian; el total y lo que queda se actualizan.
- **Alta de un insumo nuevo desde Inventario:** al terminar, se avisa como hoy y la lista conserva su
  página; si el insumo nuevo queda fuera de lo visible, se encuentra con la búsqueda como cualquier
  otro.
- **Abrir un insumo ya existente desde el alta** ("posible duplicado"): se abre su detalle aunque el
  insumo no esté en la página visible.
- **Detalle abierto de un insumo que no está en la página visible** (por ejemplo, desde "posible
  duplicado" en el alta): la hoja del detalle se abre igual; al cerrarla se vuelve a la página en que
  se estaba.
- **Detalle abierto y el insumo se da de baja** (aquí o por sincronización): la hoja se cierra, como hoy
  deja de mostrarse el detalle.
- **Exactamente 25, 26 o 50 elementos:** con 25 no hay controles; con 26 se ve "Ver más (queda 1)" o 2
  páginas; con 50, 2 páginas completas. Singular y plural correctos ("queda 1", "quedan 3").
- **Muchísimos insumos** (por ejemplo, 1.000): la primera página aparece igual de rápido y los
  controles de página no desbordan el ancho.
- **Vista consolidada "Todos":** se pagina la lista de insumos del tenant, uno por fila o tarjeta, igual
  que hoy, con su desglose por lugar dentro de cada uno.
- **Teclado y lectores de pantalla:** los controles se pueden usar con teclado, la página actual se
  anuncia, y tras "Ver más" el foco queda en el primer elemento agregado (o en un lugar que permita
  seguir leyendo desde ahí), no al comienzo de la página.
- **Sin conexión:** la paginación funciona igual, porque todo se muestra con los datos del dispositivo.

## Requirements *(mandatory)*

### Functional Requirements

**Comportamiento común**

- **FR-001**: Las listas paginadas DEBEN mostrar como máximo **25 elementos por página o por grupo** y
  usar un mismo comportamiento y una misma apariencia en Inventario y en Ajustes.
- **FR-002**: Si una lista tiene 25 elementos o menos, NO DEBE mostrarse ningún control de paginación.
- **FR-003**: Paginar DEBE ser solo de presentación: NO DEBE cambiar qué datos hay en el dispositivo
  ni cómo se sincronizan.
- **FR-003a**: Cada lista paginada DEBE tener un orden estable y predecible, para que las páginas no
  cambien de contenido entre visitas: Inventario e Insumos dados de baja, **alfabético por nombre**
  (sin distinguir mayúsculas ni tildes); Categorías y stock mínimo por insumo, el orden que ya tienen.
- **FR-004**: Los controles DEBEN indicar cuántos elementos faltan por ver o qué rango se está viendo
  del total, con singular y plural correctos.
- **FR-005**: Los controles DEBEN tener áreas táctiles de al menos 48×48 px, poder usarse con teclado y
  anunciar el cambio a los lectores de pantalla.

**Inventario**

- **FR-006**: En teléfono y tablet (tarjetas), Inventario DEBE mostrar los primeros 25 resultados y un
  botón **"Ver más"** que agregue los 25 siguientes debajo de los ya visibles, sin mover lo que ya está
  a la vista.
- **FR-007**: En desktop (tabla), Inventario DEBE mostrar **páginas numeradas** de 25 filas, con
  controles de anterior, siguiente, números de página (abreviados con "…" cuando son muchos) y el rango
  visible ("26–50 de 200"). Al cambiar de página, el comienzo de la tabla DEBE quedar a la vista.
- **FR-008**: La búsqueda por texto, los filtros de categoría y estado, y el resumen de alertas DEBEN
  seguir operando sobre **todo** el inventario (del lugar activo o de "Todos"), no sobre la página
  visible.
- **FR-009**: Al cambiar la búsqueda, un filtro, un acceso del resumen de alertas o el lugar de trabajo,
  la lista DEBE volver al comienzo (primera página o primer grupo).
- **FR-010**: El detalle de un insumo de Inventario DEBE abrirse en una **hoja encima de la lista**
  (la misma que usa el detalle abierto desde Alertas, en todos los tamaños), con el mismo contenido y
  acciones que hoy, en vez de al final de la página. Abrir y cerrar el detalle, usar "Consumir 1"
  o el menú de acciones NO DEBE cambiar la página, los grupos cargados ni la posición de la lista.
- **FR-011**: Si la lista se achica y la página actual queda vacía, DEBE mostrarse la última página con
  resultados; si crece, la página actual se mantiene y los totales se actualizan.
- **FR-012**: Al cambiar entre la disposición de tarjetas y la de tabla, la lista DEBE conservar
  aproximadamente la posición: mostrar la página (o los grupos) que contienen el primer elemento que se
  estaba viendo.
- **FR-013**: Al salir de Inventario a otra vista y volver, o al recargar, la lista DEBE empezar desde
  el comienzo y los filtros DEBEN reiniciarse, como hoy; la página no se guarda fuera de la pantalla.

**Ajustes**

- **FR-014**: Las secciones **Categorías** e **Insumos dados de baja** DEBEN mostrar sus listas de a 25
  con **"Ver más"**, igual que Inventario en teléfono, en todos los tamaños de pantalla.
- **FR-015**: El editor de **stock mínimo por insumo** DEBE usar el mismo "Ver más" que las demás
  listas, sin cambiar su comportamiento actual (25 por grupo, búsqueda sobre todos los insumos activos,
  vuelve al comienzo al cambiar la búsqueda o el lugar).
- **FR-016**: Renombrar, borrar o restaurar un elemento de una lista de Ajustes NO DEBE cerrar los
  grupos ya cargados ni mover la posición; al salir de la sección y volver a entrar, la lista empieza
  desde el comienzo.

### Key Entities *(include if feature involves data)*

- **Estado de paginación de una lista**: cuántos elementos se ven (grupos cargados con "Ver más") o qué
  página está abierta (tabla). Vive solo mientras la pantalla está abierta; no se guarda ni se
  sincroniza.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con 200 insumos de prueba, Inventario muestra su primera página **en menos de 1 segundo**
  desde que se abre, en un teléfono de gama media, sin demora perceptible frente a un inventario de 25.
- **SC-002**: Al abrir Inventario en un teléfono de 360 × 640 con 200 insumos, el contenido total de la
  página (sin abrir nada) es **al menos 5 veces más corto** que mostrando todos los insumos.
- **SC-003**: En el 100 % de los casos probados, cerrar el detalle de un insumo deja la lista en la misma
  página (o con los mismos grupos cargados) y la misma posición.
- **SC-004**: En el 100 % de los casos probados, un insumo que existe y coincide con la búsqueda o los
  filtros aparece en los resultados, sin importar en qué página estaba antes de buscar, y el resumen de
  alertas da las mismas cifras que antes de esta spec.
- **SC-005**: Las cuatro listas (Inventario, stock mínimo por insumo, Categorías e Insumos dados de baja)
  se recorren con el mismo control y los mismos textos, verificado con capturas en móvil, tablet y
  desktop.
- **SC-006**: La sincronización no cambia: los datos descargados y subidos son los mismos con y sin esta
  spec.

## Assumptions

- **"Ver más" en tarjetas y páginas numeradas en la tabla** (pregunta 1 del roadmap, confirmada en
  Clarifications): es la recomendación del roadmap. "Ver más" es natural al desplazarse con el
  dedo y no obliga a apuntar a números chicos; en la tabla de desktop, las páginas numeradas permiten
  saltar y mantienen la tabla de un alto estable. Las listas de Ajustes usan "Ver más" en todos los
  tamaños porque son listas de tarjetas, no tablas.
- **Tamaño de página 25, sin selector** (pregunta 2 del roadmap): coincide con el editor de mínimos de
  la 019. No se ofrece elegir el tamaño, para no sumar un control más.
- **Qué se recuerda** (pregunta 2 del roadmap, confirmada en Clarifications): la página y los grupos cargados se recuerdan al abrir y
  cerrar el detalle de un insumo y al usar sus acciones, que es lo que pide la aceptación del roadmap.
  No se recuerdan al salir de Inventario a otra vista ni al recargar, igual que hoy los filtros.
- **Disposición de Inventario:** hoy la tabla se usa solo en desktop (≥ 1200 px); tablet usa tarjetas.
  El roadmap dice "tabla (tablet y desktop)", pero esta spec no cambia qué disposición usa cada tamaño:
  tablet sigue con tarjetas y, por lo tanto, con "Ver más".
- **Orden** (ajustado en el plan): Inventario e Insumos dados de baja hoy se muestran en el orden
  interno de la base local (por identificador), que para la persona es aleatorio; paginar así haría que
  "la página 2" no signifique nada. Pasan a orden alfabético por nombre, como el editor de mínimos.
  Categorías conserva su orden actual. Los filtros y la búsqueda no cambian.
- **Sin cambios de servidor, esquema ni sincronización:** se despliega solo el front.
- **Otras listas largas** (Alertas, Compras, historial de movimientos, equipo, lugares) quedan fuera;
  se pueden sumar después al mismo componente si la clienta lo pide.
