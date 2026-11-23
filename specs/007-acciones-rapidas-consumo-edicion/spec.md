# Feature Specification: Acciones Rápidas — Consumo Directo (Shortcut) y Edición/Eliminación

**Feature Branch**: `007-acciones-rapidas-consumo-edicion`

**Created**: 2026-09-23

**Status**: Draft

> **Spec 025 (2026-11-23)**: FR-001 a FR-003 y FR-007 ("Consumir 1" de un toque) quedaron
> reemplazados por "Consumir", que abre la hoja de consumo con cantidad 1
> (`specs/025-consumir-sin-atajo/`). El aviso, la vibración y "Deshacer" (FR-005, FR-006, FR-008,
> FR-009) se mantienen para ese consumo. "Consumir otra cantidad" ya no está en el menú.

**Input**: User description: "Continuar el roadmap con la siguiente spec (007): Implementación de acciones directas desde la lista principal para consumir la unidad/insumo completo con un solo toque (swipe o botón dedicado) para el caso de uso más frecuente, además de modales/pantallas para editar datos del producto y eliminación (soft delete o baja)."

## Clarifications

### Session 2026-09-23

- Q: Cuando un insumo tiene lotes caducados con stock, ¿el botón "Consumir 1" debe saltarlos? → A: Sí, siempre salta los lotes caducados; si solo queda stock caducado, el botón se deshabilita con "Solo stock caducado" y el consumo de un lote caducado solo es posible explícitamente vía "Consumir otra cantidad".
- Q: ¿Cuánto tiempo debe quedar visible el aviso de "Deshacer" después de un "Consumir 1"? → A: 8 segundos.
- Q: Si dos administradores editan el mismo insumo en dispositivos distintos (uno sin conexión), ¿qué cambio prevalece al sincronizar? → A: Resolución campo por campo: en cada campo gana la edición más reciente y los valores sobrescritos quedan registrados en el historial.
- Q: Además del botón "Consumir 1", ¿las tarjetas deben permitir consumir deslizando el dedo (swipe)? → A: No en esta spec; solo el botón "Consumir 1" (el swipe podrá evaluarse en el futuro).
- Q: ¿Se puede dar de baja un insumo que todavía tiene stock disponible? → A: Sí, con advertencia en la confirmación que muestra la cantidad restante; no se genera ningún ajuste automático de stock.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consumir una unidad con un solo toque desde el listado (Priority: P1)

Como personal clínico, durante la atención quiero consumir una unidad completa de un insumo directamente desde su tarjeta en el listado de Inventario, con un solo toque, para registrar el caso de uso más frecuente sin abrir formularios ni elegir lote.

**Why this priority**: Es el caso de uso más frecuente del día a día en el gabinete y el motivo principal del modelo "Listado Operativo + Acciones Rápidas". Tras la spec 006 ya no existe una pantalla dedicada de Consumir, así que sin esta acción el consumo queda sin un camino ágil.

**Independent Test**: Con un insumo con stock en uno o más lotes vigentes, puede probarse tocando "Consumir 1" en su tarjeta y verificando que el stock mostrado disminuye en una unidad, que se descontó del lote vigente con vencimiento más próximo y que aparece un aviso de confirmación.

**Acceptance Scenarios**:

1. **Given** un insumo tiene stock disponible en al menos un lote vigente, **When** el usuario toca "Consumir 1" en su tarjeta, **Then** el sistema registra de inmediato el consumo de 1 unidad de la unidad de medida del insumo, atribuido al usuario autenticado, y el stock mostrado en la tarjeta se actualiza al instante.
2. **Given** un insumo tiene varios lotes vigentes con distintas fechas de vencimiento, **When** el usuario toca "Consumir 1", **Then** la unidad se descuenta del lote vigente con la fecha de vencimiento más próxima (FEFO), dejando los lotes sin fecha de vencimiento para el final.
3. **Given** el consumo rápido se registró, **When** se completa la acción, **Then** el dispositivo emite una vibración leve (si lo soporta) y se muestra un aviso temporal que indica el insumo consumido e incluye la opción "Deshacer".
4. **Given** el insumo tiene stock 0, **When** el usuario ve su tarjeta, **Then** la acción "Consumir 1" aparece deshabilitada con una indicación de "Sin stock" y no puede activarse.
5. **Given** el dispositivo está sin conexión, **When** el usuario toca "Consumir 1", **Then** el consumo se registra igual de inmediato y se sincroniza en segundo plano cuando vuelva la conexión.

---

### User Story 2 - Deshacer un consumo rápido accidental (Priority: P1)

Como personal clínico, si toqué "Consumir 1" por error (o en el insumo equivocado) quiero deshacerlo desde el aviso temporal, para que el stock vuelva a su valor anterior sin tener que hacer un ajuste manual.

**Why this priority**: Una acción de un solo toque, usada con guantes, necesariamente genera toques accidentales; sin un deshacer inmediato, la acción rápida degradaría la trazabilidad en lugar de mejorarla. Es inseparable de la User Story 1 para que esta sea segura de usar.

**Independent Test**: Puede probarse tocando "Consumir 1", luego "Deshacer" en el aviso, y verificando que el stock del lote vuelve al valor anterior y que el historial conserva tanto el consumo como su reversión.

**Acceptance Scenarios**:

1. **Given** el aviso temporal de un consumo rápido está visible, **When** el usuario toca "Deshacer", **Then** el stock del lote afectado vuelve a su valor previo y el aviso confirma que el consumo fue revertido.
2. **Given** se revierte un consumo rápido, **When** se consulta el historial de movimientos del lote, **Then** el consumo original y su reversión quedan ambos registrados, atribuidos al usuario, sin borrar el registro original.
3. **Given** el usuario tocó "Consumir 1" varias veces seguidas sobre el mismo insumo, **When** toca "Deshacer", **Then** se revierte solo el último consumo rápido, y cada consumo previo puede deshacerse mientras su propio aviso siga disponible.
4. **Given** pasaron los 8 segundos de visibilidad del aviso sin tocar "Deshacer", **When** el aviso desaparece, **Then** el consumo queda definitivo y cualquier corrección posterior requiere los flujos normales de ajuste.

---

### User Story 3 - Editar los datos de un insumo desde el listado (Priority: P2)

Como administrador, quiero abrir un menú de opciones en la tarjeta de un insumo y editar sus datos de producto (nombre comercial, categoría, unidad de medida, stock mínimo, código de fabricante, si caduca), para corregir errores de carga o actualizar el catálogo sin tener que darlo de alta de nuevo.

**Why this priority**: Corrige errores del catálogo que hoy no tienen camino de solución, pero ocurre con mucha menor frecuencia que el consumo y no bloquea el uso diario.

**Independent Test**: Puede probarse abriendo el menú de opciones de una tarjeta, eligiendo "Editar", cambiando el nombre y el stock mínimo, guardando, y verificando que la tarjeta, la búsqueda y el estado de alerta reflejan los nuevos valores.

**Acceptance Scenarios**:

1. **Given** el usuario tiene rol administrador, **When** abre el menú de opciones de una tarjeta (botón "⋮" o toque largo), **Then** ve las opciones "Ver detalle", "Consumir otra cantidad", "Editar" y "Eliminar".
2. **Given** el usuario tiene rol personal regular, **When** abre el menú de opciones de una tarjeta, **Then** ve solo "Ver detalle" y "Consumir otra cantidad"; las opciones de editar y eliminar no se muestran.
3. **Given** el administrador eligió "Editar", **When** se abre el formulario de edición, **Then** aparece precargado con los datos actuales del insumo.
4. **Given** el administrador cambia el stock mínimo de un insumo por encima de su stock actual y guarda, **When** vuelve al listado, **Then** la tarjeta pasa a mostrar el estado "Bajo Stock" y los conteos del resumen superior se actualizan.
5. **Given** el administrador deja vacío el nombre comercial o usa un nombre que ya tiene otro insumo activo, **When** intenta guardar, **Then** el sistema rechaza el guardado con un mensaje claro junto al campo afectado y no modifica el insumo.
6. **Given** el administrador abrió la edición y toca "Cancelar", **When** vuelve al listado, **Then** el insumo no tiene cambios y se conservan la búsqueda y los filtros que estaban activos.

---

### User Story 4 - Dar de baja (eliminar) un insumo del catálogo (Priority: P2)

Como administrador, quiero eliminar un insumo que la clínica ya no usa o que se creó por error, para que deje de aparecer en el listado, la búsqueda y las alertas, sin perder el historial de movimientos asociado.

**Why this priority**: Mantiene el listado operativo limpio y las alertas relevantes, pero es una acción poco frecuente y no bloquea el consumo diario.

**Independent Test**: Puede probarse eliminando un insumo desde su menú de opciones, confirmando, y verificando que ya no aparece en el listado ni en los conteos de alertas, mientras su historial de movimientos sigue existiendo.

**Acceptance Scenarios**:

1. **Given** el administrador eligió "Eliminar" en el menú de un insumo, **When** se muestra la confirmación, **Then** el diálogo nombra el insumo, explica que dejará de aparecer en el inventario y exige una confirmación explícita antes de proceder.
2. **Given** el insumo todavía tiene stock disponible, **When** se muestra la confirmación de eliminación, **Then** el diálogo advierte cuántas unidades quedan en stock antes de permitir confirmar.
3. **Given** el administrador confirma la eliminación, **When** vuelve al listado, **Then** el insumo ya no aparece en el listado, la búsqueda, los filtros, el resumen superior ni la vista de Alertas.
4. **Given** un insumo fue eliminado, **When** se revisa el historial de movimientos de la clínica, **Then** todos sus movimientos previos (ingresos, consumos, ajustes) siguen existiendo con su atribución de usuario original.
5. **Given** el administrador toca "Cancelar" en la confirmación, **When** se cierra el diálogo, **Then** el insumo sigue activo sin cambios.

---

### Edge Cases

- ¿Qué pasa si el único stock disponible de un insumo está en lotes ya caducados? El consumo rápido NO descuenta de lotes caducados: la acción "Consumir 1" se muestra deshabilitada con la indicación "Solo stock caducado"; el usuario puede usar "Consumir otra cantidad" para elegir explícitamente un lote caducado si lo necesita.
- ¿Qué pasa si un insumo tiene lotes vigentes y lotes caducados? El consumo rápido descuenta del lote vigente con vencimiento más próximo, saltando los caducados.
- ¿Qué pasa si el insumo admite cantidades decimales y el lote vigente más próximo tiene menos de 1 unidad disponible? El consumo rápido toma el siguiente lote vigente que cubra la unidad completa; si ningún lote vigente cubre 1 unidad, la acción se deshabilita y el usuario debe usar "Consumir otra cantidad".
- ¿Qué pasa si el usuario hace más de 3 consumos rápidos seguidos? Se muestran como máximo 3 avisos a la vez; al aparecer un cuarto, el más antiguo se retira antes de sus 8 segundos y su consumo queda definitivo.
- ¿Qué pasa si el usuario toca "Consumir 1" repetidamente muy rápido? Cada toque registra un consumo independiente; el stock mostrado nunca queda por debajo de 0 y la acción se deshabilita al agotarse el stock vigente.
- ¿Qué pasa si otro usuario consumió del mismo lote sin conexión y al sincronizar el stock queda sobregirado? Se aplica la regla ya definida en la spec 002: ninguna transacción se pierde ni se revierte, el lote queda marcado para revisión manual.
- ¿Qué pasa si se intenta "Deshacer" después de que el usuario cambió de sección o abrió otro insumo? El aviso de deshacer sigue disponible durante su tiempo de visibilidad aunque el usuario navegue dentro de la app; si el aviso ya desapareció, no hay deshacer.
- ¿Qué pasa si se cambia la marca "caduca" de un insumo que ya tiene lotes? Los lotes y movimientos existentes no se modifican; el cambio solo afecta cómo se registran los lotes futuros y cómo se ordena el consumo FEFO según la regla de la spec 002 (lotes sin fecha al final).
- ¿Qué pasa si se cambia la unidad de medida de un insumo que ya tiene movimientos? Las cantidades históricas se conservan tal como fueron registradas; el formulario advierte que el cambio no convierte las cantidades existentes.
- ¿Qué pasa si se elimina un insumo mientras está abierto su detalle? El detalle se cierra y se vuelve al listado, que ya no lo muestra.
- ¿Qué pasa si dos administradores editan el mismo insumo en dispositivos distintos y al menos uno estaba sin conexión? Al sincronizar, cada campo toma el valor de la edición más reciente; los cambios a campos distintos se conservan ambos, y cada valor sobrescrito queda registrado en el historial del insumo (quién, cuándo, valor anterior).
- ¿Qué pasa si un administrador da de baja un insumo mientras otro lo edita sin conexión? La baja prevalece: al sincronizar, las ediciones de datos se aplican y registran, pero el insumo sigue dado de baja.
- ¿Qué pasa si un administrador edita o da de baja un insumo sin conexión y, antes de sincronizar, pierde el rol de administrador? Al sincronizar, el servidor rechaza esos cambios por falta de permisos: quedan marcados como rechazados en el historial local (no se borran), dejan de aplicarse, el insumo vuelve a los valores compartidos por todos los dispositivos, y el usuario ve un aviso "Tu cambio en «<insumo>» no se guardó: ya no tienes permisos de administrador." Además su rol local se actualiza, por lo que dejan de mostrarse "Editar" y "Eliminar". Un fallo de red u otro error no marca nada como rechazado: se reintenta en el siguiente ciclo.
- ¿Qué pasa si se edita o elimina un insumo sin conexión? La edición o baja se aplica localmente de inmediato y se sincroniza en segundo plano; el insumo desaparece o cambia al instante en ese dispositivo.
- ¿Qué pasa si se da de baja un insumo y luego se intenta crear otro con el mismo nombre? La unicidad de nombre solo aplica entre insumos activos; un insumo dado de baja no bloquea el nombre.

## Requirements *(mandatory)*

### Functional Requirements

**Consumo rápido**

- **FR-001**: Cada tarjeta del listado de Inventario DEBE ofrecer una acción dedicada y visible "Consumir 1" que registre el consumo de exactamente 1 unidad de la unidad de medida del insumo con un solo toque, sin formularios ni pasos de confirmación intermedios.
- **FR-002**: El consumo rápido DEBE descontar del lote vigente (no caducado) con la fecha de vencimiento más próxima que tenga al menos 1 unidad disponible, siguiendo el orden FEFO ya definido (lotes sin fecha de vencimiento al final). Nunca DEBE descontar de un lote caducado.
- **FR-003**: La acción "Consumir 1" DEBE mostrarse deshabilitada, con una indicación textual del motivo ("Sin stock" o "Solo stock caducado"), cuando ningún lote vigente del insumo tiene al menos 1 unidad disponible.
- **FR-004**: Cada consumo rápido DEBE registrarse como un movimiento de consumo normal, atribuido al usuario autenticado, con el lote afectado y la fecha/hora, indistinguible en trazabilidad de un consumo registrado por el flujo completo.
- **FR-005**: Tras un consumo rápido, el sistema DEBE actualizar de inmediato el stock de la tarjeta, su estado de salud y los conteos del resumen superior, sin esperar confirmación de sincronización.
- **FR-006**: Tras un consumo rápido, el sistema DEBE emitir una vibración leve cuando el dispositivo lo soporte (sin fallar si no lo soporta) y mostrar un aviso temporal, visible durante 8 segundos, con el nombre del insumo y la opción "Deshacer".
- **FR-007**: El consumo rápido DEBE activarse únicamente mediante el botón "Consumir 1"; esta spec NO incluye gestos de deslizamiento (swipe) sobre la tarjeta para consumir.

**Deshacer**

- **FR-008**: Al tocar "Deshacer" en el aviso de un consumo rápido, el sistema DEBE revertir ese consumo específico restaurando el stock del lote afectado, registrando la reversión como un movimiento propio atribuido al usuario, sin borrar ni modificar el movimiento de consumo original.
- **FR-009**: Cada consumo rápido DEBE poder deshacerse de forma independiente solo mientras su aviso siga visible; una vez que el aviso desaparece, el consumo queda definitivo. Se muestran como máximo 3 avisos simultáneos; un aviso retirado por este límite deja su consumo definitivo.

**Menú de opciones**

- **FR-010**: Cada tarjeta DEBE ofrecer un menú de opciones accesible mediante un botón visible ("⋮") y, adicionalmente, mediante toque largo sobre la tarjeta.
- **FR-011**: El menú DEBE incluir para todos los usuarios "Ver detalle" (abre el detalle de solo lectura de la spec 006) y "Consumir otra cantidad" (abre el flujo de consumo completo ya existente, con el insumo preseleccionado, permitiendo elegir cantidad y lote).
- **FR-012**: El menú DEBE incluir "Editar" y "Eliminar" solo para usuarios con rol administrador; para personal regular esas opciones no DEBEN mostrarse, y el sistema DEBE rechazar cualquier intento de editar o eliminar realizado por un usuario sin rol administrador.

**Edición**

- **FR-013**: El sistema DEBE permitir al administrador editar los datos de producto de un insumo: nombre comercial, categoría, unidad de medida, stock mínimo, código de fabricante y si caduca. Si el insumo admite cantidades decimales se determina automáticamente a partir de la unidad de medida (igual que en el alta) y se muestra como información, no como un control editable. El formulario DEBE abrirse precargado con los valores actuales.
- **FR-014**: El sistema DEBE validar que el nombre comercial no esté vacío y no coincida (sin distinguir mayúsculas/minúsculas) con el de otro insumo activo, y que el stock mínimo, si se indica, sea un número mayor o igual a 0 (entero cuando la unidad de medida no admite decimales; vacío = sin alerta de stock mínimo); los errores DEBEN mostrarse junto al campo afectado sin perder lo ya escrito.
- **FR-015**: La edición NO DEBE modificar el stock, los lotes ni los movimientos existentes del insumo; las correcciones de stock quedan fuera de esta acción.
- **FR-016**: Al guardar una edición, el listado, la búsqueda, los filtros, el estado de salud de la tarjeta y los conteos de alertas DEBEN reflejar los nuevos valores de inmediato.
- **FR-017**: Cancelar la edición DEBE descartar todos los cambios y volver al listado conservando la búsqueda y los filtros activos.

**Eliminación (baja)**

- **FR-018**: Eliminar un insumo DEBE ser una baja lógica: el insumo se marca como dado de baja, con la fecha y el usuario que realizó la baja, conservando intactos sus lotes y todo su historial de movimientos.
- **FR-019**: Antes de dar de baja, el sistema DEBE mostrar un diálogo de confirmación que nombre el insumo, indique que dejará de aparecer en el inventario y, si aún tiene stock disponible, advierta la cantidad restante; la baja solo procede tras una confirmación explícita. Tener stock disponible NO impide la baja, y la baja NO genera ningún movimiento de ajuste: el stock restante queda tal cual en el historial.
- **FR-020**: Un insumo dado de baja NO DEBE aparecer en el listado, la búsqueda, los filtros por categoría o estado, el resumen superior, la vista de Alertas ni en los selectores de los flujos de ingreso y consumo.

**Transversales**

- **FR-021**: El consumo rápido, el deshacer, la edición y la baja DEBEN funcionar completamente sin conexión, aplicándose primero en el almacenamiento local y sincronizándose en segundo plano sin bloquear al usuario.
- **FR-021a**: Cuando ediciones concurrentes del mismo insumo realizadas en distintos dispositivos se sincronizan, el sistema DEBE resolverlas campo por campo de forma determinista: en cada campo prevalece la edición con fecha/hora más reciente, las ediciones a campos distintos se combinan, y todo valor sobrescrito DEBE quedar registrado en el historial de cambios del insumo con su autor, fecha/hora y valor anterior. Una baja lógica prevalece sobre ediciones concurrentes de datos.
- **FR-021b**: Cuando el servidor rechace un cambio de catálogo (edición o baja) por falta de permisos del autor, el sistema DEBE marcarlo como rechazado en el historial local sin borrarlo, dejar de aplicarlo al insumo (que converge a los valores compartidos por los demás dispositivos), avisar al usuario una vez por insumo afectado, y actualizar el rol local del usuario desde el servidor. Solo un rechazo por permisos produce este efecto; cualquier otro error de sincronización se reintenta sin marcar el cambio.
- **FR-022**: Todos los controles nuevos (botón "Consumir 1", botón "⋮", opciones del menú, botón "Deshacer" del aviso, controles del formulario de edición y botones del diálogo de confirmación) DEBEN cumplir un área táctil mínima de 48x48px.
- **FR-023**: Ninguna de las acciones de esta spec DEBE activar la cámara automáticamente; en el formulario de edición, el escaneo del código de fabricante solo se habilita mediante una acción explícita del usuario.

### Key Entities

- **Insumo**: Material del catálogo (existente). Esta spec lo hace editable por un administrador y agrega un estado de baja lógica: si está activo o dado de baja, junto con cuándo y quién realizó la baja.
- **Cambio de Insumo**: Registro histórico de cada modificación de datos de un insumo (campo, valor anterior, valor nuevo, autor, fecha/hora), incluidos los valores sobrescritos al resolver ediciones concurrentes y, si corresponde, la marca de que el servidor lo rechazó por falta de permisos.
- **Lote**: Unidad de stock de un insumo con fecha de vencimiento propia (existente, sin cambios). Se usa para decidir de dónde descuenta el consumo rápido.
- **Movimiento**: Registro de solo-apéndice de ingresos, consumos y ajustes (existente). El consumo rápido genera un movimiento de consumo normal; el deshacer genera un movimiento de reversión vinculado al consumo que revierte, sin alterar el original.
- **Aviso de consumo rápido**: Elemento transitorio de interfaz (no persistido) que referencia el movimiento de consumo recién creado y permite revertirlo mientras está visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede registrar el consumo de una unidad de un insumo visible en el listado con 1 solo toque, en menos de 2 segundos desde que localiza la tarjeta.
- **SC-002**: El 100% de los consumos rápidos quedan atribuidos al usuario que los realizó y al lote del que se descontaron, con o sin conexión.
- **SC-003**: El 100% de los consumos rápidos accidentales pueden revertirse con 1 toque mientras su aviso está visible, dejando el stock exactamente igual al valor previo.
- **SC-004**: Ningún consumo rápido descuenta de un lote caducado (0 casos en pruebas con inventarios que mezclan lotes vigentes y caducados).
- **SC-005**: Un administrador puede corregir un dato de un insumo (p. ej. nombre o stock mínimo) desde el listado en menos de 30 segundos.
- **SC-006**: Tras dar de baja un insumo, este deja de aparecer en el 100% de las vistas operativas (listado, búsqueda, resumen, Alertas, flujos de ingreso/consumo), mientras el 100% de sus movimientos históricos siguen consultables.
- **SC-007**: En su primer uso, el 90% del personal identifica sin ayuda cómo consumir una unidad y cómo deshacerlo.

## Assumptions

- **Qué es "1 unidad"**: el consumo rápido descuenta 1 unidad de la unidad de medida ya configurada en el insumo (p. ej. 1 caja, 1 cartucho, 1 pieza). Consumos de otra cantidad o de un lote específico se hacen desde "Consumir otra cantidad", que reutiliza el flujo de consumo completo de la spec 002.
- **Permisos**: según la clarificación de la spec 003, editar y dar de baja insumos es gestión de catálogo y queda restringido al rol administrador; el consumo rápido y el deshacer están disponibles para todos los usuarios autenticados.
- **Lotes caducados**: el consumo rápido los salta por seguridad clínica; consumir material caducado sigue siendo posible, pero solo de forma explícita mediante el flujo completo.
- **Deshacer**: la reversión se registra como un movimiento compensatorio (no se borra el consumo original), coherente con el historial de solo-apéndice y con el Principio IV de trazabilidad. La ventana de deshacer es la duración del aviso (8 segundos).
- **Baja lógica, sin restauración en esta spec**: el insumo dado de baja no se borra físicamente. La consulta y restauración de insumos dados de baja queda fuera de alcance y podría incorporarse en la spec 010 (Ajustes y Configuración Global).
- **Swipe fuera de alcance**: el gesto de deslizar para consumir mencionado en el roadmap no se incluye; podrá evaluarse en una spec futura si el botón resulta insuficiente.
- **"Agregar a Compras"**: la opción del menú prevista en el roadmap se incorpora en la spec 009 (Lista de Compras); esta spec no la incluye.
- **Alta de nuevos materiales**: el botón "+ Material" y el formulario de alta unificado corresponden a la spec 008; el formulario de edición de esta spec edita insumos existentes y podrá compartir estructura con aquel, pero no lo sustituye.
- **Correcciones de stock**: la edición no ajusta stock; los ajustes de inventario siguen el flujo de ajuste existente y no se rediseñan aquí.
- **Catálogo de categorías**: el selector de categoría en la edición usa las categorías ya existentes en el catálogo; crear categorías nuevas desde este formulario queda para la spec 008.
- **Permisos en el servidor (excepción conocida)**: el backend solo impide a no-administradores registrar cambios de catálogo (el historial de cambios); la tabla de insumos en sí sigue sin restricción por rol, deuda heredada de la spec 002. Los campos con cambios registrados se corrigen automáticamente desde el historial; cerrar la tabla de insumos por rol queda para la spec 010 y debe declararse en el PR.
- **Base**: se reutiliza el listado, las tarjetas, el detalle y los filtros introducidos en la spec 006, así como la lógica FEFO, de stock y de alertas de las specs 002 y 004, sin redefinirlas.
