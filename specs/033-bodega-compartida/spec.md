# Feature Specification: Lugares que comparten bodega

**Feature Branch**: `[033-bodega-compartida]`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Idea I de `notes.txt` — insumos compartidos: poder compartir materiales
entre lugares de trabajo, de modo que se puedan consumir desde ambos (no transferir). Caso elegido:
lugares que comparten bodega."

**Origen**: lista de ideas de DentdeLion posterior al release 2.11.0. De las tres lecturas posibles
(bodega compartida, consumir desde otro lugar mediante traslado automático, ocultar insumos por
lugar), se eligió la primera.

## Contexto

Desde la spec 014, el catálogo de insumos es común a todo el tenant, pero cada lugar de trabajo tiene
su propio stock, lotes, alertas, mínimos y lista de compras (014 FR-006). Esto sirve cuando los lugares
están en sitios distintos. No sirve cuando dos lugares sacan del mismo estante, por ejemplo dos boxes
de la misma consulta o una consulta y su sala de procedimientos. En ese caso hoy hay que elegir un
lugar "dueño" del stock y trasladar cada vez que el otro consume, o llevar el stock dos veces y que no
cuadre ninguno.

Esta spec introduce la **bodega compartida**: un grupo de lugares del mismo tenant que usan un único
stock. Cualquier lugar del grupo puede registrar ingresos, consumos y recepciones contra ese stock, y
cada movimiento sigue registrando en qué lugar ocurrió. Así, los reportes por lugar y el historial no
pierden información.

- **Ejemplo**: "Box 1" y "Box 2" comparten bodega. Hay 3 jeringas de ácido fosfórico. Se consume 1 ml
  en Box 1 y 2 ml en Box 2. Ambos lugares ven 6 ml restantes, el historial dice dónde se consumió cada
  uno y el reporte de consumo de Box 2 muestra sus 2 ml.
- Un lugar que no comparte bodega funciona exactamente como hoy. Es lo que pasa por defecto, y ningún
  tenant actual nota cambios hasta que configure una bodega compartida.

**Fuera de alcance**: consumir desde el stock de un lugar que **no** comparte bodega (traslado
automático al consumir); ocultar insumos del catálogo en ciertos lugares; restringir el acceso de
usuarios por lugar; bodegas entre tenants distintos; varias bodegas para un mismo lugar.

## Clarifications

### Session 2026-11-24

- Q: ¿Qué caso de "insumos compartidos" se resuelve? → A: Lugares que comparten bodega (un solo stock
  consumible desde varios lugares).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar dos lugares para que compartan bodega (Priority: P1)

Como administradora con dos boxes que sacan del mismo estante, quiero indicar que comparten bodega,
para llevar un solo stock en lugar de dos.

**Why this priority**: Sin esta configuración no existe la funcionalidad. Es también el momento de
mayor riesgo, porque junta el stock que hoy está separado.

**Independent Test**: Con Box 1 (2 jeringas del lote A) y Box 2 (1 jeringa del lote B), en Ajustes →
Lugares indicar que Box 2 comparte bodega con Box 1. Tras confirmar, los dos lugares muestran 3
jeringas (lotes A y B) y ningún movimiento anterior cambió.

**Acceptance Scenarios**:

1. **Given** una administradora en Ajustes → Lugares con dos o más lugares activos, **When** abre un
   lugar, **Then** ve la opción "Compartir bodega con…" y una lista de los otros lugares activos.
2. **Given** se elige un lugar, **When** se muestra la confirmación, **Then** se ve un resumen de lo que
   va a pasar: "El stock de Box 1 y Box 2 se sumará: 14 insumos con stock en ambos lugares pasarán a
   un solo total", y la lista de mínimos distintos que hay que unificar (ver FR-006).
3. **Given** se confirma, **When** se vuelve al inventario de cualquiera de los dos lugares, **Then**
   ambos muestran el mismo stock, que es la suma de lo que tenía cada uno, con todos sus lotes.
4. **Given** un lugar que ya está en una bodega compartida, **When** se agrega un tercer lugar, **Then**
   los tres comparten el mismo stock.
5. **Given** el personal (no administración), **When** entra a Ajustes → Lugares, **Then** no puede
   cambiar con quién comparte bodega un lugar.
6. **Given** el selector de lugar y la lista de Ajustes → Lugares, **When** un lugar comparte bodega,
   **Then** se indica con quién (por ejemplo "Box 2 · bodega con Box 1").

---

### User Story 2 - Consumir y reponer desde cualquier lugar de la bodega (Priority: P1)

Como persona del equipo que atiende en Box 2, quiero consumir y recibir insumos del stock compartido
sin trasladar nada, para que el stock siempre refleje el estante real.

**Why this priority**: Es el uso diario y la razón de la funcionalidad.

**Independent Test**: Con Box 1 y Box 2 compartiendo bodega y 9 ml de ácido fosfórico, consumir 2 ml
desde Box 2 y luego recibir 1 jeringa desde Compras en Box 1. Ambos lugares muestran 10 ml. El
historial muestra el consumo en Box 2 y el ingreso en Box 1.

**Acceptance Scenarios**:

1. **Given** dos lugares con bodega compartida, **When** se consume desde cualquiera, **Then** se
   descuenta del stock común y el movimiento queda registrado en el lugar desde donde se consumió.
2. **Given** dos lugares con bodega compartida, **When** se registra un ingreso, una recepción de
   compra o un ajuste de stock desde cualquiera, **Then** suma o resta del stock común y queda
   registrado en ese lugar.
3. **Given** una bodega compartida, **When** se miran Alertas (bajo stock, por caducar, caducado) y la
   lista de Compras desde cualquiera de sus lugares, **Then** se ven las mismas alertas y los mismos
   sugeridos, una sola vez, calculados sobre el stock común.
4. **Given** un ítem agregado a Compras desde Box 1, **When** se abre Compras en Box 2, **Then** el ítem
   aparece y se puede recibir desde ahí.
5. **Given** la vista "Todos los lugares", **When** se mira el inventario, **Then** el stock de una
   bodega compartida se cuenta una sola vez (no duplicado por cada lugar) y se rotula con los nombres
   de los lugares que la comparten.
6. **Given** los reportes de consumo, gasto y costo por tratamiento, **When** se filtran por un lugar
   de una bodega compartida, **Then** muestran solo lo que se consumió o compró en ese lugar.
7. **Given** el formulario de traslado en un lugar con bodega compartida, **When** se elige el destino,
   **Then** no aparecen los lugares de la misma bodega (no tiene sentido trasladar dentro de la misma
   bodega), pero sí los demás.

---

### User Story 3 - Dejar de compartir bodega (Priority: P2)

Como administradora, quiero separar un lugar de una bodega compartida (por ejemplo, porque el box se
cambió de piso), y decidir con qué stock se queda.

**Why this priority**: Se usa poco, pero sin esto la configuración sería irreversible.

**Independent Test**: Con Box 1 y Box 2 compartiendo 10 ml, separar Box 2. Por defecto Box 1 conserva
los 10 ml y Box 2 queda en 0. Después se trasladan 3 ml de Box 1 a Box 2 con el traslado de siempre.

**Acceptance Scenarios**:

1. **Given** un lugar en una bodega compartida, **When** la administradora elige "Dejar de compartir
   bodega", **Then** ve una confirmación que explica cómo queda el stock (ver FR-009) antes de aplicar.
2. **Given** se confirma, **When** se mira el inventario de cada lugar, **Then** el lugar separado
   queda con su propio stock según FR-009 y el resto de la bodega conserva el stock común.
3. **Given** se separó un lugar, **When** se mira el historial, **Then** los movimientos anteriores
   siguen intactos con su lugar original, y el reparto del stock queda registrado como movimientos con
   autor y fecha.
4. **Given** una bodega de dos lugares, **When** se separa uno, **Then** ninguno de los dos queda
   compartiendo bodega.
5. **Given** se desactiva un lugar que comparte bodega, **When** se confirma, **Then** primero se
   aplica la separación (US3) y el stock común queda en los lugares activos.

---

### Edge Cases

- **Consumos sin conexión en dos lugares de la misma bodega**: dos dispositivos consumen el último
  stock al mismo tiempo. Al sincronizar se conservan ambos movimientos y, si el stock queda negativo,
  se marca **En revisión**, como cualquier sobregiro (spec 024). El cálculo se hace sobre el stock
  común, no por lugar.
- **Un dispositivo sin conexión registra movimientos mientras se configura la bodega en otro**: los
  movimientos conservan su lugar. Al sincronizar, el stock se recalcula con la configuración vigente y
  nada se pierde ni se duplica.
- **Juntar lugares con mínimos distintos para el mismo insumo**: la confirmación los lista y pide
  elegir uno (por defecto, el mayor) antes de juntar.
- **Juntar lugares con ítems de Compras del mismo insumo en ambos**: quedan los dos ítems en la lista
  común, con el lugar donde se agregó cada uno, para que el equipo decida si sobra uno. No se fusionan
  automáticamente.
- **Juntar lugares donde uno tiene stock negativo (sobregiro sin resolver)**: se permite. El saldo
  negativo se suma al común y sigue En revisión.
- **Traslado pendiente de sincronizar entre dos lugares que después pasan a compartir bodega**: se
  aplica igual. Como el origen y el destino ahora comparten stock, el total no cambia.
- **"Todos los lugares" con una bodega compartida y otro lugar independiente**: se ven dos grupos de
  stock, la bodega (con sus lugares) y el lugar independiente, cada uno con sus alertas.
- **Tenant con un solo lugar**: la opción no aparece.

## Requirements *(mandatory)*

### Functional Requirements

**Configuración (US1, US3)**

- **FR-001**: Cada lugar activo DEBE pertenecer a exactamente una bodega. Por defecto, cada lugar
  tiene la suya, lo que equivale al comportamiento actual.
- **FR-002**: Una administradora DEBE poder hacer que un lugar comparta bodega con otro lugar activo
  del mismo tenant. Si alguno ya estaba en una bodega compartida, el resultado es una sola bodega con
  todos.
- **FR-003**: Juntar lugares NO DEBE modificar ni borrar movimientos anteriores. El stock común es la
  suma de los movimientos de todos los lugares de la bodega.
- **FR-004**: La confirmación de juntar DEBE mostrar cuántos insumos quedan con stock sumado y qué
  mínimos hay que unificar.
- **FR-005**: Solo administración DEBE poder cambiar la configuración de bodegas, y el servidor DEBE
  hacerlo cumplir sin depender de la app (Constitución VI).
- **FR-006**: El stock mínimo DEBE ser uno por bodega e insumo. Al juntar lugares con mínimos
  distintos, la administradora elige cuál queda (por defecto, el mayor).
- **FR-007**: Una administradora DEBE poder separar un lugar de su bodega compartida.
- **FR-008**: Separar NO DEBE modificar movimientos anteriores, y el reparto de stock que resulte DEBE
  quedar registrado como movimientos nuevos con autor, fecha y lugar.
- **FR-009**: Al separar un lugar, el stock común DEBE quedar entero en los lugares que siguen en la
  bodega y el lugar separado DEBE empezar en 0, salvo que la administradora indique cantidades para
  llevarse en el mismo paso (registradas como traslados). [NEEDS CLARIFICATION: ¿Basta con "el lugar
  separado empieza en 0 y se traslada después", o hace falta repartir lote por lote en la misma
  pantalla de separación?]
- **FR-010**: Desactivar un lugar que comparte bodega DEBE separarlo primero según FR-007 a FR-009.

**Operación diaria (US2)**

- **FR-011**: Ingresos, consumos, ajustes, recepciones de compras y anulaciones registrados en
  cualquier lugar de una bodega DEBEN afectar el stock común y quedar registrados en el lugar donde se
  hicieron (014 FR-010 se mantiene).
- **FR-012**: El stock, los lotes, las alertas, los estados de insumo y los sugeridos de Compras DEBEN
  calcularse por bodega y verse iguales desde cualquiera de sus lugares.
- **FR-013**: La lista de Compras DEBE ser común a la bodega: un ítem agregado en un lugar se ve y se
  puede recibir en los demás, indicando el lugar donde se agregó.
- **FR-014**: En "Todos los lugares", el stock y las alertas de una bodega compartida DEBEN contarse
  una vez y rotularse con sus lugares.
- **FR-015**: Los reportes de consumo, gasto, costo por tratamiento e indicadores de Inicio DEBEN
  seguir pudiendo filtrarse por lugar según el lugar de cada movimiento. El valor del inventario por
  lugar DEBE mostrarse por bodega. [NEEDS CLARIFICATION: en el reporte "valor del inventario", ¿se
  muestra la bodega como una sola fila o se reparte entre sus lugares?]
- **FR-016**: Los traslados DEBEN ofrecer como destino solo lugares de otra bodega, y validar el stock
  contra el stock común de la bodega de origen (014 FR-024).
- **FR-017**: El servidor DEBE validar consumos y traslados contra el stock común de la bodega, no
  contra el del lugar.

**Comunes**

- **FR-018**: Todo DEBE funcionar sin conexión (Constitución I). Los cambios de configuración de bodega
  se aplican en el dispositivo al sincronizar, y el stock se recalcula de forma determinista con la
  configuración vigente.
- **FR-019**: Los tenants que no configuren bodegas compartidas NO DEBEN notar ningún cambio de
  comportamiento ni de rendimiento.
- **FR-020**: Los controles nuevos DEBEN cumplir el área táctil mínima de 48×48 px.

### Key Entities

- **Bodega**: grupo de uno o más lugares activos de un tenant que comparten un único stock. Tiene los
  lugares que la forman y, por insumo, un stock mínimo. No tiene nombre propio: se muestra con los
  nombres de sus lugares.
- **Lugar de trabajo**: sin cambios, salvo que pertenece a una bodega.
- **Movimiento**: sin cambios. Sigue registrando el lugar donde ocurrió, y el stock de una bodega es
  la suma de los movimientos de sus lugares.
- **Mínimo por bodega**: reemplaza al mínimo por lugar (014 FR-007). Para un lugar con bodega propia
  es exactamente lo mismo que hoy.
- **Ítem de compra**: sin cambios. Conserva el lugar donde se agregó y se muestra en todos los lugares
  de su bodega.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras juntar dos lugares, el stock común de cada insumo es exactamente la suma de los
  stocks previos, sin diferencias en el 100 % de los insumos.
- **SC-002**: Un consumo en un lugar de la bodega se refleja en el stock que ve el otro lugar en el
  mismo dispositivo al instante y en otro dispositivo tras la siguiente sincronización.
- **SC-003**: Con bodega compartida no hace falta registrar traslados entre sus lugares. Medido con la
  clienta: 0 traslados internos en el primer mes.
- **SC-004**: Los totales por lugar de los reportes de consumo y gasto no cambian al juntar o separar
  lugares.
- **SC-005**: Los tenants sin bodega compartida no ven diferencias en ninguna pantalla ni en los
  tiempos de carga.

## Assumptions

- La configuración afecta a todos los usuarios del tenant, porque hoy todos acceden a todos los lugares
  (014 FR-015). Si en el futuro se restringe el acceso por lugar, ver un lugar de una bodega implica ver
  el stock común.
- Separar un lugar es poco frecuente, así que se acepta que requiera traslados manuales para repartir
  el stock (sujeto a la aclaración de FR-009).
- Los niveles de aviso de caducidad y el umbral de pendientes siguen siendo uno por tenant (014
  FR-012).
- Los mínimos por lugar que existan al juntar se convierten en el mínimo de la bodega según la elección
  de FR-006. Los lugares que no comparten bodega conservan su mínimo tal cual.
- Requiere cambios de base de datos y de sincronización (pertenencia de lugar a bodega, mínimos por
  bodega y validación de stock en el servidor). Se detallan en el plan.
