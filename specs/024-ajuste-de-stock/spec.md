# Feature Specification: Descarte de vencidos al reponer y ajuste de stock por lote

**Feature Branch**: `[024-ajuste-de-stock]`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "024 — Descarte de vencidos al reponer y ajuste de cantidad por lote. Problema
reportado: tengo 4 cajas de un insumo vencido. Desde Compras lo selecciono para reponerlo, anoto precio,
lote, etc. y guardo. El insumo sigue apareciendo en la lista de compras como pendiente (vencido), y en la
lista de insumos ahora sale que tengo 5 cajas, vencidas. […] Al menos como admin, al editar un insumo
debería poder cambiar la cantidad o eliminarlo."

**Origen**: reporte de la clienta tras el release 2.6.0 (un error de comportamiento y un pedido).

## Contexto

Hoy el inventario no tiene forma de sacar stock salvo consumiéndolo o trasladándolo. Cuando un lote
vence, sus unidades siguen contando como stock para siempre. Reponer un insumo vencido desde Compras
solo agrega un lote nuevo: si había 4 cajas vencidas y llega 1 caja nueva, el insumo pasa a tener 5
cajas y sigue en estado **Caducado**, porque basta un lote vencido con stock para que el insumo
aparezca así. Por la misma razón sigue en la lista de Compras como pendiente. Lo que la clienta espera
es que la caja nueva *reemplace* a las vencidas: 1 caja, en buen estado, y fuera de Compras.

Además, cuando el stock anotado no coincide con lo que hay en el estante (un conteo mal hecho, una caja
rota, un ingreso duplicado), administración no tiene cómo corregirlo. Puede editar los datos del insumo
pero no su cantidad. También tiene que salir del formulario de edición para eliminar el insumo, porque
esa acción solo está en el menú de acciones.

Toda la cantidad de un lote sale de su historial de movimientos. Por eso cada descarte o corrección
queda como un movimiento nuevo de **ajuste** con quién lo hizo, cuándo y en qué lugar, y nunca
reescribe el historial.

**Fuera de alcance**: motivos de descarte elegibles (vencido, roto, perdido…); un reporte de mermas o
del costo de lo descartado; descartar vencidos de forma automática sin que nadie lo pida; descarte
parcial de un lote vencido desde Compras; corregir la cantidad desde la vista de detalle o desde el
menú de acciones; eliminar lotes; cambiar el número de lote, el proveedor o la fecha de vencimiento de
un lote ya ingresado.

## Clarifications

### Session 2026-11-05

- Q: Al recibir una compra de un insumo con lotes vencidos, ¿qué pasa con el stock vencido? → A: El formulario de recepción muestra una casilla "Descartar N <unidad> vencidas", marcada por defecto; al guardar, esos lotes quedan en 0. Si se desmarca, quedan como hoy.
- Q: Para cambiar la cantidad al editar (administración), ¿a qué nivel? → A: Por lote: en Editar se ve cada lote con su cantidad y se corrige cada uno; cada cambio queda como ajuste.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reponer un insumo vencido y que las cajas nuevas reemplacen a las vencidas (Priority: P1)

Como persona del equipo que recibe una compra, quiero que al reponer un insumo vencido se descarte el
stock vencido en el mismo paso, para que el inventario muestre lo que de verdad hay en el estante y el
insumo salga de la lista de Compras.

**Why this priority**: Es el error reportado. Hoy deja el inventario inflado con stock que no se puede
usar y mantiene una alerta que la clienta ya atendió.

**Independent Test**: Con un insumo de 4 cajas en un lote vencido, recibirlo desde Compras con 1 caja
nueva dejando la casilla marcada. El insumo queda con 1 caja, sin estado Caducado, y desaparece de
Compras. Repetir con la casilla desmarcada: queda con 5 cajas y Caducado, como hoy.

**Acceptance Scenarios**:

1. **Given** un insumo con lotes vencidos con stock en el lugar donde se recibe, **When** se abre el
   formulario de recepción, **Then** aparece una casilla "Descartar stock vencido (4 cajas)" (la
   cantidad total vencida en ese lugar, en la misma unidad en que se muestra en el detalle del
   insumo), marcada por defecto.
2. **Given** la casilla marcada, **When** se guarda la recepción, **Then** en un solo paso se crea el
   lote nuevo y cada lote vencido con stock en ese lugar queda en 0. Si algo falla, no se guarda nada.
3. **Given** la recepción guardada con descarte, **When** se vuelve a Inventario y a Compras, **Then**
   el insumo muestra solo el stock nuevo, ya no figura como Caducado y ya no aparece en Compras como
   sugerido por vencimiento (sí puede seguir por stock bajo si el stock nuevo no llega al mínimo).
4. **Given** la casilla desmarcada, **When** se guarda, **Then** los lotes vencidos quedan intactos,
   como hoy.
5. **Given** un insumo sin lotes vencidos con stock en ese lugar, o que no caduca, **When** se abre la
   recepción, **Then** no aparece la casilla.
6. **Given** el dispositivo sin conexión, **When** se recibe con descarte, **Then** todo se guarda igual
   y se sube en la siguiente sincronización.
7. **Given** un descarte hecho, **When** se mira el historial del lote vencido, **Then** se ve un ajuste
   por la cantidad descartada, con quién lo hizo y cuándo.

---

### User Story 2 - Corregir la cantidad de cada lote al editar un insumo (Priority: P2)

Como administradora, quiero ver los lotes del insumo con su cantidad al editarlo y poder corregirla,
para que el stock coincida con lo que conté en el estante.

**Why this priority**: Es el pedido explícito y la única forma de arreglar errores de conteo o de
ingreso. También cubre descartar un lote vencido sin pasar por Compras.

**Independent Test**: Como administradora, editar un insumo con dos lotes (3 y 5 unidades), cambiar el
segundo a 2 y guardar. El stock total pasa de 8 a 5, el historial del lote muestra un ajuste de −3 a su
nombre, y otro dispositivo del tenant ve el mismo stock tras sincronizar.

**Acceptance Scenarios**:

1. **Given** administración edita un insumo, **When** se abre el formulario, **Then** se ve una sección
   **Stock por lote** con cada lote que tiene o tuvo stock en el lugar activo: número de lote,
   vencimiento (marcado si está vencido) y cantidad actual, editable.
2. **Given** se cambia la cantidad de uno o más lotes, **When** se guarda, **Then** cada lote cambiado
   queda con la cantidad escrita y se registra un ajuste por la diferencia (positiva o negativa) en ese
   lugar, junto con el resto de cambios del formulario.
3. **Given** un lote vencido, **When** administración lo pone en 0, **Then** deja de contar como stock
   y, si no queda otro lote vencido con stock, el insumo deja de mostrarse como Caducado.
4. **Given** una cantidad negativa, o con decimales en un insumo que no los permite, **When** se
   intenta guardar, **Then** se muestra un error en ese lote y no se guarda nada.
5. **Given** el personal (no administración), **When** edita o ve un insumo, **Then** no ve ni puede
   usar la corrección de cantidades.
6. **Given** la vista "Todos los lugares" con varios lugares, **When** administración edita, **Then**
   cada lote aparece por cada lugar donde tiene stock, indicando el lugar, y la corrección se registra
   en ese lugar.
7. **Given** no se cambió ninguna cantidad, **When** se guarda, **Then** no se crea ningún ajuste.

---

### User Story 3 - Eliminar un insumo desde el formulario de edición (Priority: P3)

Como administradora, quiero poder eliminar el insumo desde su formulario de edición, para no tener que
salir y buscar la acción en otro menú.

**Why this priority**: La acción ya existe en el menú de acciones; esto solo la hace más fácil de
encontrar.

**Independent Test**: Como administradora, abrir Editar de un insumo, tocar **Eliminar insumo**,
confirmar. El insumo desaparece del inventario igual que al eliminarlo desde el menú de acciones.

**Acceptance Scenarios**:

1. **Given** administración edita un insumo, **When** baja al final del formulario, **Then** ve un botón
   **Eliminar insumo** con estilo de acción peligrosa, separado de Guardar.
2. **Given** se toca Eliminar insumo, **When** aparece la misma confirmación que en el menú de acciones
   y se confirma, **Then** el insumo queda dado de baja (mismo resultado, mismo historial) y se cierra
   el formulario. Los cambios sin guardar del formulario se descartan.
3. **Given** se cancela la confirmación, **When** se vuelve al formulario, **Then** sigue abierto con
   los cambios que tenía.
4. **Given** el personal, **When** edita o ve un insumo, **Then** no ve el botón.

---

### Edge Cases

- **Otro dispositivo consume del lote vencido mientras se descarta sin conexión**: ambos movimientos se
  conservan al sincronizar. El lote puede quedar con cantidad negativa y descontar del total. Se marca
  **En revisión** en Alertas, como cualquier sobregiro, sin alerta de vencido, y administración lo
  corrige con la User Story 2.
- **La recepción se hace desde "Todos los lugares"**: se descartan solo los vencidos del lugar elegido en
  "¿En qué lugar?". Los vencidos de otros lugares no se tocan.
- **El lote que se recibe ya viene vencido** (la confirmación existente lo permite): no se descarta en
  la misma recepción. Solo cuentan los lotes vencidos que ya estaban.
- **Insumo dado de baja**: no aparece en Compras ni se puede editar, así que no se puede descartar ni
  ajustar.
- **Corrección de cantidad y otro cambio al mismo tiempo** (por ejemplo, el nombre): se guardan juntos;
  si falla la validación de cualquiera, no se guarda nada.
- **Otro dispositivo registra un consumo del mismo lote mientras administración corrige su cantidad**:
  el ajuste es por la diferencia que se vio al guardar, así que tras sincronizar el lote refleja ambos.
  La cantidad puede quedar distinta de la escrita, pero el historial muestra por qué.
- **Reportes de consumo y gasto**: los descartes y correcciones no cuentan como consumo ni como gasto,
  ni se confunden con la anulación de un consumo.

## Requirements *(mandatory)*

### Functional Requirements

**Descarte al reponer (US1)**

- **FR-001**: Al recibir un ítem de Compras para un insumo que caduca y tiene lotes vencidos con stock
  en el lugar de la recepción, el formulario DEBE mostrar una casilla "Descartar stock vencido (N
  <unidad>)", marcada por defecto, con N = stock vencido total en ese lugar.
- **FR-002**: Con la casilla marcada, guardar la recepción DEBE dejar en 0 cada lote vencido con stock
  en ese lugar, registrando por cada uno un ajuste negativo por su stock, en la misma operación que el
  lote nuevo: o se guarda todo o no se guarda nada.
- **FR-003**: Con la casilla desmarcada, o sin lotes vencidos, la recepción DEBE comportarse
  exactamente como hoy.
- **FR-004**: La casilla DEBE estar disponible para cualquier miembro que pueda recibir en Compras, no
  solo para administración.

**Corrección de stock por lote (US2)**

- **FR-005**: El formulario de edición de un insumo DEBE mostrar a administración, y solo a ella, una
  sección **Stock por lote** con los lotes del insumo visibles en el lugar activo (o, en "Todos", un
  renglón por cada lote y lugar con stock), con número de lote, vencimiento, estado vencido y cantidad
  editable.
- **FR-006**: Al guardar, cada cantidad cambiada DEBE registrarse como un ajuste por la diferencia
  entre la cantidad escrita y el stock actual del lote en ese lugar. Las cantidades sin cambios no
  generan ajuste.
- **FR-007**: Las cantidades DEBEN validarse: no negativas, y enteras si el insumo no permite
  decimales. Con un error, no se guarda ninguna parte del formulario.
- **FR-008**: Los ajustes y los demás cambios del formulario DEBEN guardarse juntos o no guardarse.

**Eliminar desde Editar (US3)**

- **FR-009**: El formulario de edición DEBE ofrecer a administración un botón **Eliminar insumo** que
  usa la misma confirmación y el mismo efecto de baja que la acción Eliminar del menú de acciones.

**Comunes**

- **FR-010**: Todo descarte o corrección DEBE quedar como un movimiento de ajuste nuevo con su autor,
  fecha y lugar, visible en el historial del lote. El historial existente nunca se modifica.
- **FR-011**: Los ajustes de esta spec DEBEN distinguirse de las anulaciones de consumo y no contar
  como consumo ni como gasto en Reportes.
- **FR-012**: Todo DEBE funcionar sin conexión y sincronizarse en segundo plano, como el resto de los
  movimientos.
- **FR-013**: Stock, estado (Caducado, Próximo a caducar, Bajo stock), alertas y sugeridos de Compras
  DEBEN reflejar los ajustes de inmediato en el dispositivo donde se hicieron y, tras sincronizar, en
  todos los del tenant.
- **FR-014**: Los controles nuevos DEBEN cumplir el área táctil mínima de 48×48 px.

### Key Entities

- **Movimiento de ajuste**: entrada del historial de un lote que suma o resta stock en un lugar,
  con autor y fecha. En esta spec es independiente: no anula otro movimiento, a diferencia de las
  anulaciones de consumo.
- **Lote**: sin cambios. Su cantidad sigue saliendo de su historial; un lote "en 0" conserva su
  número, proveedor, vencimiento e historial.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el caso reportado (4 cajas vencidas, se recibe 1 caja), con la casilla por defecto el
  insumo queda con 1 caja, sin estado Caducado y fuera de Compras, sin pasos adicionales a los de hoy.
- **SC-002**: Administración puede corregir la cantidad de un lote en menos de 30 segundos desde que
  abre Editar.
- **SC-003**: El 100 % de los descartes y correcciones aparece en el historial del lote con su autor, y
  el stock coincide en todos los dispositivos del tenant tras sincronizar.
- **SC-004**: Los totales de consumo y gasto de Reportes no cambian por ningún descarte o corrección.
- **SC-005**: Eliminar un insumo desde Editar da el mismo resultado que desde el menú de acciones.

## Assumptions

- El servidor ya acepta movimientos de ajuste que no anulan a otro, así que no hacen falta cambios de
  base de datos. Que solo administración corrija cantidades se controla en la app, igual que la edición
  del catálogo.
- "Vencido" usa la misma regla que el estado Caducado de hoy: fecha de vencimiento anterior a hoy.
- La cantidad de la casilla y de "Stock por lote" se muestra y se escribe en la unidad de consumo del
  insumo, la misma del "Stock total" del detalle, con su equivalente en presentaciones cuando aplica.
- La etiqueta evita concordar género con la unidad ("Descartar stock vencido (4 cajas)") porque las
  unidades son libres.
- Un lote en 0 sigue apareciendo en "Stock por lote" mientras sea visible en el lugar, para poder
  corregirlo si se descartó por error.
- Se reutilizan la confirmación de baja existente y el flujo de recepción de Compras (spec 009/015/021).
