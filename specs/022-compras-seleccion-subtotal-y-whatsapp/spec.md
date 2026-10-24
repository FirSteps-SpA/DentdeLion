# Feature Specification: Compras · selección, subtotal y pedido por WhatsApp

**Feature Branch**: `[022-compras-seleccion-subtotal-y-whatsapp]`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "spec 022 según roadmap en 1STEPS/1stDocs, en rama dedicada"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 022 · `compras-seleccion-subtotal-y-whatsapp` (M),
a partir de dos pedidos de la clienta en `1stDocs/002-backlog/002-DentdeLion.md`: "Subtotal compras"
("Permitir que el dentista seleccione en el listado de compras lo que va a comprar y cuánto es el total
de esos productos") y "Exportar lista" ("Que la lista de compras se pueda compartir por WhatsApp pero no
como nota sino como mensaje de WhatsApp […] con un mensaje predeterminado al contacto de la casa dental
[…] y que después de ese mensaje se desglose la lista de materiales sin los precios"), y del Design
System (§33: "Compartir por WhatsApp"). Última spec de la tanda del release 2.5.0; va después de la 021,
que guarda el WhatsApp de cada proveedor.

## Contexto

Hoy Compras muestra dos grupos por lugar de trabajo: **Sugeridos por el sistema** (insumos con stock
bajo el mínimo o caducados, con lo que conviene pedir en unidades de compra, p. ej. "Pedir 2 cajas") y
**Agregados manualmente** (ítems escritos a mano, con cantidad opcional y, a veces, vinculados a un
insumo). "Compartir lista" arma un texto con **todos** los ítems y lo entrega al menú de compartir del
dispositivo o lo copia; la dentista lo pega como nota y lo reenvía a mano.

La clienta quiere elegir qué va a comprar, ver **cuánto suma** eso con los precios que ya pagó, y mandar
el pedido a la casa dental **como mensaje de WhatsApp**, con un saludo ya escrito y la lista **sin
precios**, para que la casa dental le responda con disponibilidad, vencimientos y precios.

Desde la 015 cada lote guarda el precio pagado por unidad de compra, y desde la 021 cada proveedor puede
tener un número de WhatsApp. La aplicación **no envía** el mensaje: abre WhatsApp con el chat y el texto
listos, y la persona toca "Enviar".

Deuda técnica que viaja con esta spec (del roadmap): cuando un dispositivo tiene ítems de compra de otra
persona que todavía no se subieron, la subida de **todos** los ítems de compra falla junta, y los ítems
propios tampoco llegan a los demás dispositivos. Se corrige aquí porque esta spec ya toca la lista de
compras.

**Fuera de alcance**: enviar el mensaje sin pasar por WhatsApp (API de WhatsApp Business, correo o SMS);
editar la cantidad sugerida desde la lista; registrar el pedido como "enviado" o guardar un historial de
pedidos; recibir la respuesta de la casa dental en la aplicación; comparar precios entre proveedores
(DS V3 #20); asociar un proveedor habitual a cada insumo (descartado en la 021); calcular impuestos o
descuentos.

## Clarifications

### Session 2026-10-23

- Q: ¿El saludo del mensaje de WhatsApp es fijo, igual para todos, o la clínica puede editarlo en Ajustes? → A: Editable por tenant en Ajustes (solo administración), con el saludo de la clienta como valor inicial; requiere guardarlo en el servidor (migración).
- Q: Si en el pedido hay ítems de distintas casas dentales, ¿un solo mensaje para el proveedor que se elige al enviar, o la app separa el pedido por proveedor? → A: Un solo mensaje con todo lo seleccionado, para el proveedor que se elige al enviar (con el predeterminado del lugar ya elegido); para pedir a otra casa dental se envía de nuevo cambiando la selección.
- Q: ¿La selección de ítems queda guardada en el dispositivo o se borra al cerrar la app? → A: Se guarda en el dispositivo hasta que el ítem sale de la lista; no se comparte con otros dispositivos ni personas.
- Q: ¿El subtotal usa los precios tal como se registraron, o la app debe mostrar el IVA aparte? → A: Tal como se registraron, rotulado "Subtotal estimado (precios de la última compra)"; sin cálculo de IVA.
- Q: Al abrir Compras por primera vez o cuando aparece un ítem nuevo, ¿el ítem aparece marcado o sin marcar? → A: Sin marcar; la dentista elige, y "Seleccionar todo" marca todo en un toque.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Seleccionar lo que voy a comprar y ver cuánto suma (Priority: P1)

Como dentista, quiero marcar en la lista de compras los ítems que voy a comprar y ver el subtotal de lo
marcado según lo que pagué la última vez, para decidir el pedido antes de hacerlo.

**Why this priority**: Es el primer pedido de la clienta y la base de lo demás: el mensaje de WhatsApp,
copiar y compartir se arman con lo seleccionado.

**Independent Test**: Con 3 insumos sugeridos con precio y 1 ítem manual sin precio, marcar los 3
sugeridos: el subtotal es la suma de cantidad × precio de cada uno. Marcar también el manual: el
subtotal no cambia y el resumen dice "1 ítem sin precio".

**Acceptance Scenarios**:

1. **Given** la lista de compras, **When** se abre, **Then** cada ítem (sugerido o manual) tiene una
   casilla para seleccionarlo, de al menos 48 px de área táctil, y hay una opción "Seleccionar todo".
2. **Given** ítems seleccionados, **When** se marca o desmarca uno, **Then** el resumen se actualiza al
   instante con la cantidad de ítems seleccionados y el subtotal estimado en pesos.
3. **Given** un ítem sugerido seleccionado, **When** se calcula el subtotal, **Then** aporta las
   unidades de compra sugeridas × el precio por unidad de compra de la **última compra con precio** de
   ese insumo (en cualquier lugar del tenant, el mismo que ya muestra la 015), y el ítem muestra ese
   monto.
4. **Given** un ítem sin precio (manual sin insumo vinculado, o insumo sin compras con precio), **When**
   se selecciona, **Then** el ítem dice "Sin precio", no suma, y el resumen lo cuenta: "3 ítems sin
   precio".
5. **Given** un ítem con precio pero sin cantidad (un sugerido solo por caducado, o un manual sin
   cantidad), **When** se selecciona, **Then** dice "Sin cantidad", no suma, y el resumen lo cuenta
   aparte.
6. **Given** "Seleccionar todo", **When** se toca, **Then** se marcan todos los ítems visibles; si ya
   estaban todos marcados, se desmarcan todos.
7. **Given** un precio cero (material gratis), **When** se selecciona, **Then** suma $0 y no cuenta
   como "sin precio".

---

### User Story 2 - Enviar el pedido por WhatsApp a la casa dental (Priority: P1)

Como dentista, quiero enviar lo seleccionado por WhatsApp al contacto de la casa dental, con un saludo
ya escrito y la lista sin precios, para pedir disponibilidad, vencimientos y precios sin escribir el
mensaje.

**Why this priority**: Es el segundo pedido de la clienta y el que más tiempo le ahorra cada vez que
compra.

**Independent Test**: Con un proveedor con WhatsApp y 2 ítems seleccionados, tocar "Enviar por
WhatsApp", elegir el proveedor: se abre WhatsApp en el chat de ese número con el saludo y los 2 ítems
con su cantidad, sin precios, listo para enviar.

**Acceptance Scenarios**:

1. **Given** al menos un ítem seleccionado, **When** se toca "Enviar por WhatsApp", **Then** se pide
   elegir el proveedor de una lista de proveedores activos, con el predeterminado del lugar ya elegido
   (021) y los que tienen WhatsApp indicados.
2. **Given** un proveedor con WhatsApp elegido, **When** se confirma, **Then** se abre WhatsApp (la
   aplicación en el teléfono, WhatsApp Web o de escritorio en el computador) en el chat de ese número,
   con el mensaje escrito y sin enviar.
3. **Given** el mensaje, **Then** empieza con el saludo de la clínica (de entrada, "Hola, ¿cómo están? Me
   gustaría saber si tienen los siguientes materiales, fechas de vencimiento y sus precios, por favor") y
   sigue con un renglón
   por ítem seleccionado: nombre y cantidad en unidades de compra ("Anestesia Articaína — 2 cajas"),
   **sin precios, sin subtotal y sin las marcas "Sugerido" o "Manual"**.
4. **Given** un proveedor sin WhatsApp, **When** se confirma, **Then** se abre WhatsApp con el mensaje
   escrito para elegir el contacto ahí, y la aplicación lo avisa antes ("Dental Sur no tiene WhatsApp:
   elige el contacto en WhatsApp").
5. **Given** ningún ítem seleccionado, **Then** "Enviar por WhatsApp" no se puede usar y se indica
   "Selecciona lo que vas a pedir".
6. **Given** el dispositivo sin conexión, **When** se toca "Enviar por WhatsApp", **Then** la aplicación
   igual abre WhatsApp con el mensaje (WhatsApp lo envía cuando vuelva la conexión) y no pierde la
   selección.

---

### User Story 3 - Copiar o compartir lo seleccionado (Priority: P2)

Como dentista, quiero seguir pudiendo copiar o compartir la lista por el menú del dispositivo, ahora
solo con lo que seleccioné, por si el pedido va por otro medio.

**Why this priority**: Mantiene lo que ya existe como alternativa; no es el pedido central.

**Independent Test**: Con 2 de 5 ítems seleccionados, tocar "Copiar": el portapapeles tiene el mismo
mensaje que iría por WhatsApp, con solo esos 2 ítems.

**Acceptance Scenarios**:

1. **Given** ítems seleccionados, **When** se toca "Compartir", **Then** se abre el menú de compartir
   del dispositivo con el mismo mensaje que el de WhatsApp; si el dispositivo no lo ofrece, se ofrece
   "Copiar", como hoy.
2. **Given** ítems seleccionados, **When** se toca "Copiar", **Then** el mensaje queda en el
   portapapeles y se confirma con "Lista copiada".
3. **Given** ningún ítem seleccionado, **Then** "Copiar" y "Compartir" no se pueden usar, igual que
   "Enviar por WhatsApp".

---

### User Story 4 - Los ítems de compra se sincronizan aunque haya ítems ajenos pendientes (Priority: P2)

Como persona que agrega o recibe ítems de compra, quiero que mis cambios lleguen a los otros
dispositivos aunque en el mío haya ítems de otra persona sin subir, para que la lista sea la misma en
todos.

**Why this priority**: Es la deuda técnica de la spec 012 asignada a esta spec; hoy un solo ítem
rechazado frena la subida de toda la lista.

**Independent Test**: En un dispositivo, dejar sin subir un ítem creado por otra persona que el servidor
rechaza y agregar uno propio: el propio llega al otro dispositivo en la siguiente sincronización.

**Acceptance Scenarios**:

1. **Given** un dispositivo con ítems de compra pendientes de subir, entre ellos uno que el servidor
   rechaza, **When** sincroniza, **Then** los demás ítems se suben igual y solo el rechazado queda
   pendiente.
2. **Given** un ítem rechazado, **Then** no se muestra un error a la persona por cada ciclo; queda
   registrado para diagnóstico, como los demás rechazos de sincronización.

---

### User Story 5 - Ajustar el saludo del pedido (Priority: P3)

Como administración, quiero cambiar el saludo con que empieza el pedido, para que suene como la clínica
habla con sus casas dentales.

**Why this priority**: El saludo de la clienta sirve desde el primer día; editarlo es un ajuste.

**Independent Test**: En Ajustes, cambiar el saludo y guardar: el siguiente "Copiar" en Compras, desde
otro dispositivo del mismo tenant tras sincronizar, empieza con el saludo nuevo.

**Acceptance Scenarios**:

1. **Given** administración en Ajustes, **When** abre el saludo del pedido, **Then** ve el saludo vigente
   (de entrada, el de la clienta) en un campo de texto de varias líneas y lo puede cambiar y guardar.
2. **Given** un saludo guardado, **When** cualquier miembro del tenant arma un pedido, **Then** el
   mensaje empieza con ese saludo, en todos los dispositivos del tenant.
3. **Given** el campo vacío o solo con espacios, **When** se guarda, **Then** vuelve al saludo de la
   clienta ("Restablecer" hace lo mismo sin borrar a mano).
4. **Given** `personal`, **Then** no ve ni cambia el saludo en Ajustes.
5. **Given** el dispositivo sin conexión, **When** administración guarda el saludo, **Then** se usa de
   inmediato en ese dispositivo y se sube en la siguiente sincronización.

---

### Edge Cases

- **Vista "Todos" los lugares**: la selección abarca ítems de varios lugares; el mensaje lista cada
  ítem una vez por lugar (el mismo insumo en dos lugares aparece dos veces, con el nombre del lugar
  entre paréntesis) y el subtotal los suma todos. El predeterminado que se preelige es el del lugar
  activo antes de pasar a "Todos" o, si no hay, ninguno.
- **Un ítem seleccionado sale de la lista** (se recibe, se elimina o deja de estar bajo el mínimo):
  deja de estar seleccionado y de sumar.
- **El precio de un insumo cambia** (llega una compra nueva o se corrige un precio): el subtotal se
  recalcula solo, sin perder la selección.
- **Ítem manual vinculado a un insumo**: usa el precio de ese insumo; su cantidad se entiende en
  unidades de compra del insumo. Si el insumo está dado de baja, el ítem queda "Sin precio".
- **Lista muy larga**: con más de 100 ítems seleccionados el enlace de WhatsApp puede quedar demasiado
  largo; en ese caso la aplicación lo avisa y ofrece "Copiar" en su lugar.
- **Nombres con caracteres especiales** (tildes, "ñ", "&", "#", saltos de línea en notas): el mensaje
  llega a WhatsApp tal cual se ve en la aplicación.
- **Proveedor desactivado** después de elegirlo como predeterminado: no se ofrece (021 ya lo quita del
  predeterminado).
- **Sin proveedores en el catálogo**: "Enviar por WhatsApp" abre WhatsApp sin número para elegir el
  contacto ahí, con el mismo aviso que un proveedor sin WhatsApp.
- **Personal y administración**: ambos usan la selección, el subtotal y el envío; Compras ya es para
  todos los miembros.
- **Dos administradores cambian el saludo** a la vez en dispositivos distintos: queda el último que
  llega al servidor, como el resto de la configuración del tenant.
- **Dispositivo sin WhatsApp instalado** (computador): el enlace abre WhatsApp Web en el navegador.

## Requirements *(mandatory)*

### Functional Requirements

**Selección y subtotal**

- **FR-001**: Cada ítem pendiente de la lista de compras (sugerido o manual) MUST tener una casilla de
  selección accesible por teclado y lector de pantalla, con su nombre en la etiqueta.
- **FR-002**: La lista MUST ofrecer "Seleccionar todo", que marca todos los ítems visibles o, si ya
  están todos marcados, los desmarca.
- **FR-003**: La selección MUST conservarse en el dispositivo mientras los ítems sigan en la lista,
  incluso al cambiar de pantalla o cerrar la aplicación; NO se sincroniza con otros dispositivos. La
  primera vez que se abre Compras ningún ítem está marcado, y un ítem nuevo en la lista aparece sin
  marcar.
- **FR-004**: Un resumen siempre visible en Compras MUST mostrar la cantidad de ítems seleccionados, el
  **subtotal** en pesos chilenos y, si hay, cuántos de los seleccionados no suman por no tener precio
  ("2 ítems sin precio") o cantidad ("1 ítem sin cantidad").
- **FR-005**: El monto de un ítem MUST ser su cantidad en unidades de compra × el precio por unidad de
  compra de la última compra con precio del insumo (la regla de la 015, para todo el tenant). Para un
  sugerido, la cantidad es la sugerida; para un manual, la que escribió la persona.
- **FR-006**: Un ítem sin precio (manual sin insumo vinculado o con su insumo dado de baja, o insumo sin
  compras con precio) MUST decir "Sin precio"; uno con precio pero sin cantidad MUST decir "Sin
  cantidad". Ninguno de los dos suma.
- **FR-007**: Un precio 0 registrado MUST contar como precio (suma $0).
- **FR-008**: El subtotal MUST usar el precio tal como se registró (sin agregar ni quitar IVA ni otros
  impuestos), rotularse "Subtotal estimado (precios de la última compra)" y redondearse al peso solo al
  mostrarlo.

**Mensaje del pedido**

- **FR-009**: El mensaje MUST empezar con el saludo del tenant (FR-021), seguido de un
  renglón por ítem seleccionado con su nombre y cantidad en unidades de compra (sin cantidad, solo el
  nombre).
- **FR-010**: El mensaje MUST NOT incluir precios, montos, subtotal, ni las marcas de origen "Sugerido"
  o "Manual".
- **FR-011**: En la vista "Todos", cada renglón MUST llevar el nombre de su lugar entre paréntesis.
- **FR-012**: "Enviar por WhatsApp", "Copiar" y "Compartir" MUST usar el mismo mensaje y solo los ítems
  seleccionados; sin selección, los tres MUST quedar deshabilitados con la indicación "Selecciona lo que
  vas a pedir".

**Envío por WhatsApp**

- **FR-013**: "Enviar por WhatsApp" MUST pedir el proveedor de una lista de proveedores activos del
  tenant, con el predeterminado del lugar activo ya elegido, e indicar cuáles no tienen WhatsApp.
- **FR-014**: Con un proveedor con WhatsApp, MUST abrir WhatsApp en el chat de ese número con el mensaje
  escrito; con uno sin WhatsApp o sin proveedores en el catálogo, MUST avisarlo y abrir WhatsApp con el
  mensaje para elegir el contacto ahí. La aplicación NUNCA envía el mensaje por sí misma.
- **FR-015**: Abrir WhatsApp MUST funcionar en Android, iOS y en el navegador de un computador (WhatsApp
  Web o la aplicación de escritorio).
- **FR-016**: Si el mensaje es demasiado largo para abrirlo en WhatsApp, la aplicación MUST avisarlo y
  ofrecer "Copiar".
- **FR-017**: Enviar MUST NOT cambiar la lista: los ítems siguen pendientes y seleccionados hasta que se
  reciban o se eliminen, como hoy.

**Copiar y compartir**

- **FR-018**: "Compartir" MUST abrir el menú de compartir del dispositivo con el mensaje; si el
  dispositivo no lo ofrece, MUST ofrecer "Copiar", como hoy.
- **FR-019**: "Copiar" MUST dejar el mensaje en el portapapeles y confirmarlo.

**Sincronización (deuda)**

- **FR-020**: La subida de ítems de compra MUST continuar con los demás ítems cuando el servidor rechaza
  uno; el rechazado queda pendiente y se registra para diagnóstico, sin mostrar un error por ciclo.

**Saludo del pedido**

- **FR-021**: Cada tenant MUST tener un saludo del pedido, que de entrada es "Hola, ¿cómo están? Me
  gustaría saber si tienen los siguientes materiales, fechas de vencimiento y sus precios, por favor".
- **FR-022**: Solo administración MUST poder cambiarlo, desde Ajustes, en un campo de varias líneas de
  hasta 500 caracteres; guardarlo vacío o usar "Restablecer" vuelve al saludo inicial.
- **FR-023**: El saludo MUST sincronizarse a todos los dispositivos del tenant, guardarse sin conexión y
  quedar aislado por tenant (ningún tenant lee ni cambia el de otro); `personal` puede leerlo pero no
  cambiarlo.

**General**

- **FR-024**: Todo lo anterior MUST funcionar sin conexión, salvo lo que depende de WhatsApp, y en
  teléfono, tablet y desktop, con los componentes del Design System.

### Key Entities *(include if feature involves data)*

- **Ítem de la lista de compras** (existente): sugerido (calculado del stock y los vencimientos) o
  manual (guardado). No cambia.
- **Selección** (nueva, solo en el dispositivo): qué ítems pendientes están marcados, por ítem y lugar.
  No se sincroniza.
- **Saludo del pedido** (nuevo, por tenant, sincronizado): texto con que empieza el mensaje; lo cambia
  solo administración.
- **Proveedor** (de la 021): se usa su nombre y su WhatsApp para elegir el destinatario.
- **Precio de la última compra** (de la 015): precio por unidad de compra del último lote con precio
  de cada insumo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con 3 ítems seleccionados con precio, el subtotal coincide al peso con la suma calculada a
  mano de cantidad × precio de la última compra, en el 100 % de los casos probados.
- **SC-002**: Desde la lista de compras, enviar el pedido al proveedor predeterminado toma **como
  máximo 3 toques** (Enviar por WhatsApp, confirmar el proveedor, Enviar en WhatsApp), sin escribir
  nada.
- **SC-003**: El mensaje que llega a WhatsApp tiene el saludo y exactamente los ítems seleccionados con
  su cantidad, y **0 precios**, verificado en Android y en un navegador de escritorio.
- **SC-004**: La selección sigue igual tras cerrar y volver a abrir la aplicación en el 100 % de los
  casos probados.
- **SC-005**: Con un ítem de compra rechazado por el servidor en el dispositivo, los demás ítems llegan
  a otro dispositivo en la siguiente sincronización.
- **SC-006**: La selección, el resumen y el envío se usan sin problemas en teléfono, tablet y desktop,
  verificado con capturas.
- **SC-007**: Un saludo cambiado en Ajustes aparece en el siguiente pedido de otro dispositivo del
  mismo tenant tras sincronizar, y las pruebas de aislamiento confirman 0 accesos al saludo de otro
  tenant.

## Assumptions

- **Saludo editable por tenant** (pregunta 1 del roadmap, confirmada en Clarifications): lo cambia
  administración en Ajustes; parte del saludo de la clienta. Además se puede retocar en WhatsApp antes
  de enviar.
- **Un mensaje para el proveedor que se elige al enviar** (pregunta 2 del roadmap, confirmada en
  Clarifications): la 021 no asocia un proveedor habitual a cada insumo, así que no hay de dónde
  agrupar. Para pedir a dos casas dentales, se envía dos veces cambiando la selección.
- **La selección se guarda en el dispositivo** (pregunta 3 del roadmap, confirmada en Clarifications):
  la dentista suele armar el pedido y enviarlo después; perder la selección al cerrar la aplicación la
  obligaría a marcar de nuevo. No se comparte entre dispositivos ni personas.
- **El precio va tal como se registró** (pregunta 4 del roadmap, confirmada en Clarifications): hoy se
  ingresa sin distinguir IVA; el subtotal es una referencia, no una cotización, y la casa dental
  responde con los precios reales.
- **Cantidad de los ítems manuales** en unidades de compra del insumo vinculado: es como se piden a la
  casa dental.
- **Con migración** (por el saludo editable): el saludo se guarda por tenant en el servidor, así que se
  despliega el servidor antes que el front, como en la 021. La selección vive solo en el dispositivo y el
  subtotal se calcula de datos que ya existen.
- **Botones**: "Enviar por WhatsApp" es la acción principal de Compras y "Copiar"/"Compartir" quedan
  como secundarias, como en el DS §33.
