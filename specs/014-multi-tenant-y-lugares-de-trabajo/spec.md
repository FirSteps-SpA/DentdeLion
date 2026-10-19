# Feature Specification: Multi-tenant y Lugares de Trabajo

**Feature Branch**: `[014-multi-tenant-y-lugares-de-trabajo]`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "014 multi-tenant-y-lugares-de-trabajo según roadmap"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 014 · `multi-tenant-y-lugares-de-trabajo` (L),
decisión de tenancy del 2026-10-18 y Design System v1.0 §28 ("Multi-clínica").

## Contexto

Hoy DentdeLion atiende a **una sola clínica**: todos los usuarios autenticados ven todo el inventario,
y la configuración (nombre de la clínica, niveles de aviso, umbral de pendientes) es única.

Esta spec convierte la app en un servicio para **varios clientes** (tenants) que comparten la misma
instalación sin ver nunca los datos de otro, y permite que cada cliente gestione **varios lugares de
trabajo**, cada uno con su propio inventario.

- **Tenant (cliente)**: quien contrata DentdeLion, ya sea una dentista independiente o una clínica.
  Los datos de cada tenant están aislados por completo.
- **Lugar de trabajo**: box, consulta o clínica donde atiende el tenant. Cada lugar tiene su propio
  stock, lotes, movimientos, alertas y lista de compras.
- **Ejemplo**: una dentista independiente que atiende en "Clínica Providencia" y "Box Las Condes" ve
  un selector "Providencia ▼ / Las Condes / Todos", con un inventario separado en cada lugar. Si
  "Clínica Providencia" también contrata DentdeLion, es **otro tenant**: sus datos y los de la
  dentista no se mezclan, aunque el lugar físico sea el mismo.

La clienta actual pasa a ser "tenant 1" con un único "lugar 1" y no debe notar ningún cambio.

**Fuera de alcance**: porcentaje profesional, costos, tratamientos y reportes por lugar (DS §28),
que van en las specs 015–017; facturación o planes de suscripción; registro de clientes por
autoservicio; acceso de usuarios restringido por lugar (el modelo queda preparado, ver aclaración 1).

## Clarifications

### Session 2026-10-18

- Q: ¿Todos los usuarios de un tenant ven todos sus lugares, o el acceso se asigna por lugar? → A: En esta spec, todos los usuarios del tenant ven todos sus lugares; el modelo de datos queda preparado para asignar acceso por lugar más adelante sin rehacer los datos.
- Q: ¿Se pueden trasladar insumos entre lugares del mismo tenant? → A: Sí, con un movimiento de traslado que descuenta en el lugar de origen y suma en el de destino, por lote, como una sola operación trazable.
- Q: ¿Cómo se da de alta un cliente nuevo? → A: First Steps crea el tenant, su primer lugar y su administradora de forma manual (procedimiento documentado); la administradora invita a las personas de su equipo con un enlace personal (que envía por correo, WhatsApp o copia), y quedan en su tenant.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aislamiento total entre clientes (Priority: P1)

Como cliente de DentdeLion, quiero la certeza de que ningún otro cliente puede ver, modificar ni
siquiera saber que existen mis insumos, movimientos, compras, categorías, configuración o usuarios,
aunque usemos la misma app.

**Why this priority**: Es la condición para atender a un segundo cliente. Una fuga de datos entre
clientes es inaceptable: son datos de operación clínica.

**Independent Test**: Con dos tenants de prueba, iniciar sesión con un usuario de cada uno: ninguno
ve, cuenta ni puede modificar nada del otro, ni desde la app ni pidiendo los datos al servidor
directamente.

**Acceptance Scenarios**:

1. **Given** dos tenants A y B con inventario propio, **When** un usuario de A abre cualquier sección, **Then** solo ve los datos de A.
2. **Given** un usuario de A, **When** intenta leer o escribir datos de B por cualquier vía (incluso fuera de la app), **Then** el servidor lo rechaza.
3. **Given** un usuario de A que registra un consumo sin conexión, **When** se sincroniza, **Then** el movimiento queda en A y no es visible para B.
4. **Given** el mismo lugar físico usado por dos tenants (p. ej. "Clínica Providencia"), **When** cada uno registra inventario, **Then** sus datos siguen totalmente separados.
5. **Given** la clienta actual, **When** se publica esta spec, **Then** sigue viendo exactamente su inventario, historial, alertas, compras y configuración, sin pasos nuevos.

---

### User Story 2 - Varios lugares de trabajo con inventario propio (Priority: P1)

Como dentista que atiende en dos lugares, quiero elegir en qué lugar estoy trabajando y ver el
inventario, las alertas y la lista de compras de ese lugar, para no mezclar el stock de un box con
el de otro.

**Why this priority**: Es la necesidad de negocio que motivó la decisión del 2026-10-18 y la que
hace útil la app para profesionales que atienden en más de un lugar.

**Independent Test**: Con un tenant de dos lugares, registrar un ingreso en el lugar 1: el stock,
las alertas y los sugeridos del lugar 2 no cambian. Al cambiar el selector al lugar 2, se ve su
propio inventario.

**Acceptance Scenarios**:

1. **Given** un tenant con dos o más lugares, **When** el usuario entra a la app, **Then** ve un selector de lugar en la barra superior o lateral (DS §28) con el lugar activo y las demás opciones.
2. **Given** el lugar activo, **When** el usuario registra ingresos o consumos, **Then** solo afectan el stock y los lotes de ese lugar.
3. **Given** dos lugares, **When** el usuario cambia de lugar, **Then** Inicio, Inventario, Alertas y Compras muestran los datos del lugar elegido, sin recargar.
4. **Given** un lugar, **When** un insumo cae bajo su stock mínimo en ese lugar, **Then** la alerta y el sugerido de compra aparecen en ese lugar y no en los demás.
5. **Given** un tenant con un solo lugar, **When** el usuario usa la app, **Then** no ve el selector ni ningún paso adicional (como la clienta actual).
6. **Given** que el usuario cerró la app con un lugar activo, **When** la vuelve a abrir en el mismo dispositivo, **Then** sigue en ese lugar.

---

### User Story 3 - Vista "Todos" consolidada (Priority: P2)

Como dentista con varios lugares, quiero una opción "Todos" en el selector para ver el inventario y
las alertas de todos mis lugares juntos, indicando a qué lugar pertenece cada cosa, para saber de
un vistazo dónde falta algo.

**Why this priority**: Aporta la visión general del DS §28 ("Todas las clínicas"), pero el trabajo
diario se hace en un lugar concreto (US2).

**Independent Test**: Con dos lugares, elegir "Todos": Inicio y Alertas suman los dos lugares y cada
ítem indica su lugar. Las acciones que modifican stock piden elegir un lugar.

**Acceptance Scenarios**:

1. **Given** "Todos", **When** el usuario mira Inicio, **Then** los KPIs suman todos los lugares del tenant.
2. **Given** "Todos", **When** el usuario mira Inventario y Alertas, **Then** cada fila o alerta muestra a qué lugar pertenece y el stock se ve por lugar.
3. **Given** "Todos", **When** el usuario intenta registrar un ingreso o un consumo, **Then** la app le pide elegir primero el lugar (no se registra stock "en todos").

---

### User Story 4 - Gestionar lugares de trabajo (Priority: P2)

Como administradora del tenant, quiero crear, renombrar y desactivar lugares de trabajo desde
Ajustes, para reflejar dónde atiendo sin depender de soporte.

**Why this priority**: Sin esto, cada lugar nuevo requiere intervención técnica. Pero el arranque
puede hacerse con los lugares cargados por First Steps.

**Independent Test**: Como administradora, crear "Box Las Condes": aparece en el selector con
inventario vacío. Renombrarlo cambia su nombre en todos lados. Desactivarlo lo saca del selector sin
borrar su historial.

**Acceptance Scenarios**:

1. **Given** una administradora, **When** crea un lugar con un nombre, **Then** aparece en el selector con inventario vacío.
2. **Given** un lugar, **When** la administradora lo renombra, **Then** el nombre nuevo se ve en el selector y en las vistas.
3. **Given** un lugar con historial, **When** la administradora lo desactiva, **Then** deja de aparecer en el selector, pero sus movimientos y lotes se conservan y se puede reactivar.
4. **Given** un usuario sin rol de administrador, **When** abre Ajustes, **Then** no ve la gestión de lugares.
5. **Given** el último lugar activo, **When** la administradora intenta desactivarlo, **Then** la app lo impide (siempre queda al menos uno).

---

### User Story 5 - Invitar al equipo (Priority: P3)

Como administradora de mi tenant, quiero invitar con un enlace a las personas de mi equipo (con rol
administrador o personal) para que entren a mi inventario sin pedírselo a First Steps.

**Why this priority**: Hoy cada usuario lo crea First Steps a mano. Con varios clientes eso no
escala, pero el alta del tenant y de su primera administradora sigue siendo manual (aclaración 3).

**Independent Test**: La administradora del tenant A invita a un correo con rol personal; esa
persona acepta, define su contraseña y, al entrar, ve los lugares e inventario de A y nada de otros
tenants.

**Acceptance Scenarios**:

1. **Given** una administradora, **When** invita a un correo y elige el rol, **Then** la app le entrega un enlace de invitación que puede enviar por correo, WhatsApp o copiar, y esa persona lo usa para unirse al tenant.
2. **Given** una invitación vigente, **When** la persona la acepta y define su contraseña, **Then** queda como usuaria del tenant con el rol indicado y ve todos sus lugares (aclaración 1).
3. **Given** una invitación pendiente, **When** la administradora la revoca, **Then** el enlace deja de funcionar.
4. **Given** una invitación de más de 7 días, **When** se usa el enlace, **Then** la app indica que venció y que se pida una nueva.
5. **Given** un correo que ya es usuario de otro tenant, **When** se lo invita, **Then** la app indica que ese correo ya pertenece a otro cliente (un usuario pertenece a un solo tenant).
6. **Given** una usuaria del tenant, **When** la administradora la desactiva, **Then** esa persona ya no puede entrar ni sincronizar, y su historial (autoría de movimientos) se conserva.
7. **Given** un usuario con rol personal, **When** abre Ajustes, **Then** no ve la gestión del equipo.

---

### User Story 6 - Trasladar insumos entre lugares (Priority: P3)

Como dentista que lleva insumos de un lugar a otro, quiero registrar un traslado que descuente del
lote en el lugar de origen y lo sume en el de destino en una sola operación, para que el stock de
ambos lugares sea correcto y se pueda seguir el lote (Constitución IV).

**Why this priority**: Evita registrar a mano un consumo y un ingreso que no quedan conectados, pero
solo aplica a tenants con más de un lugar.

**Independent Test**: Con 10 unidades de un lote en el lugar 1, trasladar 4 al lugar 2: el lugar 1
queda con 6, el lugar 2 con 4 del mismo lote (mismo número y caducidad), y el historial de ambos
muestra el traslado vinculado.

**Acceptance Scenarios**:

1. **Given** stock de un lote en el lugar activo, **When** el usuario elige "Trasladar", el destino y la cantidad, **Then** el origen baja y el destino sube en esa cantidad, con el mismo lote, número y fecha de caducidad.
2. **Given** una cantidad mayor al stock del lote en el origen, **When** se intenta trasladar, **Then** la app lo rechaza con un mensaje, igual que un sobreconsumo.
3. **Given** un traslado, **When** se mira el historial del lote en cualquiera de los dos lugares, **Then** se ve como traslado, con origen, destino, cantidad, quién y cuándo.
4. **Given** un traslado registrado sin conexión, **When** se sincroniza, **Then** las dos partes llegan juntas: nunca queda descontado en el origen sin sumarse en el destino.
5. **Given** un tenant con un solo lugar, **When** el usuario abre las acciones de un insumo, **Then** no ve "Trasladar".
6. **Given** un traslado registrado por error, **When** el usuario lo deshace (como un consumo, spec 007), **Then** ambos lugares vuelven a su stock anterior.

---

### Edge Cases

- **Pendientes offline de otro lugar**: un consumo registrado sin conexión en el lugar 1 sigue perteneciendo al lugar 1 aunque el usuario cambie al lugar 2 antes de sincronizar.
- **Dispositivo compartido entre tenants**: si en un dispositivo inicia sesión un usuario de otro tenant, no puede ver los datos locales del tenant anterior. Los pendientes del usuario anterior se conservan para cuando esa persona vuelva a entrar (spec 012).
- **Lugar desactivado con stock**: desactivar un lugar con stock disponible exige confirmación y advierte que su stock deja de verse en el selector.
- **Usuario desactivado con pendientes**: si una persona registró consumos sin conexión y la desactivan antes de sincronizar, los registrados antes de la desactivación llegan al servidor (no se pierde stock clínico). Lo registrado después se rechaza y la app muestra cuántos registros quedaron sin subir.
- **Usuario sin lugares**: un usuario que no tiene acceso a ningún lugar ve un mensaje para contactar a su administradora, no una app vacía.
- **Nombre duplicado**: dos lugares del mismo tenant no pueden llamarse igual (sin distinguir mayúsculas). Dos tenants sí pueden tener lugares con el mismo nombre.
- **Traslado de un lote caducado o en revisión**: se permite trasladarlo (el stock existe físicamente), pero mantiene su estado y sus alertas en el destino.
- **Traslado hacia un lugar desactivado**: no se ofrece como destino.
- **Migración**: los datos actuales pasan al tenant 1 / lugar 1 sin pérdida ni duplicados, y los dispositivos con pendientes offline anteriores a la actualización los suben al lugar 1.

## Requirements *(mandatory)*

### Functional Requirements

**Tenants y aislamiento (US1)**

- **FR-001**: El sistema DEBE asociar cada usuario a exactamente un tenant, y cada dato de negocio (insumos, categorías, lotes, movimientos, compras, configuración) a un tenant.
- **FR-002**: El servidor DEBE impedir que un usuario lea o modifique datos de un tenant al que no pertenece, sin depender de la app (Constitución VI).
- **FR-003**: El alta de un tenant, su primer lugar y su primera administradora DEBE hacerla First Steps mediante un procedimiento documentado y repetible. No hay registro por autoservicio en esta spec.
- **FR-004**: Los datos guardados en un dispositivo DEBEN quedar acotados al tenant del usuario con sesión; un usuario de otro tenant no puede verlos en ese dispositivo.

**Lugares de trabajo (US2, US4)**

- **FR-005**: Cada tenant DEBE tener al menos un lugar de trabajo activo, con nombre único dentro del tenant.
- **FR-006**: El catálogo de insumos y las categorías DEBEN ser compartidos por todos los lugares del tenant; el stock, los lotes, los movimientos, las alertas y la lista de compras DEBEN ser propios de cada lugar.
- **FR-007**: El stock mínimo DEBE poder definirse por lugar (el mismo insumo puede tener mínimos distintos en cada lugar). Si un lugar no lo define, se usa el del catálogo.
- **FR-008**: La app DEBE mostrar un selector de lugar en la barra superior (desktop y tablet) y en el encabezado (móvil) cuando el usuario tiene acceso a más de un lugar, y ocultarlo cuando tiene uno solo.
- **FR-009**: El lugar activo DEBE recordarse por dispositivo y aplicarse a Inicio, Inventario, Alertas y Compras sin recargar.
- **FR-010**: Toda operación que modifica stock (ingreso, consumo, ajuste, recepción de compras) DEBE quedar registrada en el lugar activo en el momento de hacerla, aunque se sincronice después.
- **FR-011**: Una administradora DEBE poder crear, renombrar, desactivar y reactivar lugares desde Ajustes. Desactivar conserva el historial y no se permite con el último lugar activo.
- **FR-012**: La configuración de la clínica DEBE pasar a ser: nombre del tenant y nombre de cada lugar. Los niveles de aviso de caducidad y el umbral de pendientes (spec 012) siguen siendo uno por tenant.

**Vista "Todos" (US3)**

- **FR-013**: Con más de un lugar, el selector DEBE ofrecer "Todos", que muestra los datos de todos los lugares accesibles del usuario sumados, indicando el lugar de cada fila, alerta o lote.
- **FR-014**: En "Todos", las acciones que modifican stock DEBEN pedir elegir un lugar antes de continuar.

**Equipo y acceso (US5)**

- **FR-015**: Todos los usuarios activos de un tenant DEBEN acceder a todos sus lugares activos. El modelo de membresía DEBE permitir, en una spec futura, restringir el acceso por lugar sin migrar datos.
- **FR-019**: Una administradora DEBE poder invitar a una persona con rol administrador o personal mediante un enlace personal que la app le permite enviar por correo, WhatsApp o copiar; la invitación vence a los 7 días y se puede revocar.
- **FR-020**: Al aceptar la invitación, la persona define su contraseña y queda en el tenant que la invitó con el rol indicado. Un correo ya registrado en otro tenant no puede aceptarse.
- **FR-021**: Una administradora DEBE poder desactivar y reactivar usuarios de su tenant y cambiar su rol. Un usuario desactivado no puede entrar ni sincronizar datos nuevos, y su autoría en el historial se conserva. Los movimientos que registró sin conexión **antes** de ser desactivado se siguen subiendo; los posteriores se rechazan y la app indica cuántos quedaron sin subir. Siempre queda al menos una administradora activa.

**Traslados (US6)**

- **FR-022**: El sistema DEBE permitir trasladar una cantidad de un lote del lugar activo a otro lugar activo del mismo tenant, como una sola operación con autor y fecha.
- **FR-023**: El traslado DEBE descontar en el origen y sumar en el destino el mismo lote (número, proveedor y caducidad), y aplicarse de forma completa o no aplicarse, también al sincronizar desde un dispositivo sin conexión.
- **FR-024**: El traslado DEBE validarse contra el stock del lote en el origen (sin sobreconsumo), poder deshacerse como un consumo, y verse en el historial de ambos lugares.

**Migración y sincronización**

- **FR-016**: Al publicar, los datos actuales DEBEN migrar al tenant 1 / lugar 1 sin pérdida, y los usuarios actuales quedar en el tenant 1 con su rol actual.
- **FR-017**: La sincronización offline DEBE respetar tenant y lugar: un dispositivo solo descarga datos de su tenant y de los lugares a los que el usuario tiene acceso.
- **FR-018**: Los dispositivos con datos pendientes de la versión anterior DEBEN subirlos correctamente al lugar 1 tras actualizar.

## Key Entities *(include if feature involves data)*

- **Tenant**: cliente que contrata DentdeLion (dentista independiente o clínica). Nombre y estado. Agrupa usuarios, catálogo, configuración y lugares.
- **Lugar de trabajo**: box, consulta o clínica de un tenant. Nombre (único en el tenant) y estado activo/desactivado. Tiene stock, lotes, movimientos, alertas y compras propias.
- **Membresía**: relación usuario ↔ tenant, con su rol (administrador o personal) y su estado (activa o desactivada). Preparada para indicar, más adelante, los lugares a los que accede.
- **Invitación**: correo, rol, tenant, quién invitó, vencimiento y estado (pendiente, aceptada, revocada, vencida).
- **Traslado**: operación que vincula una salida del lote en el lugar de origen y una entrada del mismo lote en el de destino, con cantidad, autor y fecha.
- **Insumo (catálogo)**: compartido por los lugares del tenant. El stock mínimo puede variar por lugar.
- **Lote, Movimiento, Ítem de compra**: pertenecen a un lugar (y, por él, a un tenant).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En las pruebas de aislamiento con dos tenants, 0 lecturas o escrituras cruzadas tienen éxito, por la app o directamente contra el servidor.
- **SC-002**: Tras publicar, la clienta actual conserva el 100% de sus insumos, lotes, movimientos, compras y configuración, y no necesita ningún paso nuevo para seguir trabajando.
- **SC-003**: Con dos lugares, un ingreso o consumo en uno no cambia el stock, las alertas ni los sugeridos del otro en el 100% de los casos.
- **SC-004**: Cambiar de lugar actualiza todas las secciones en menos de 1 segundo, sin recargar.
- **SC-005**: Un consumo registrado sin conexión en un lugar llega a ese lugar al sincronizar en el 100% de los casos, aunque el usuario haya cambiado de lugar entretanto.
- **SC-006**: Una administradora crea un lugar nuevo y empieza a registrar inventario en él en menos de 2 minutos.
- **SC-007**: Una persona invitada pasa del enlace de invitación a ver el inventario del tenant en menos de 3 minutos.
- **SC-008**: En el 100% de los traslados (con o sin conexión), la suma del stock del lote en origen y destino es la misma antes y después.

## Assumptions

- El catálogo de insumos y las categorías son compartidos por los lugares del tenant (pregunta 3 del roadmap): es lo más simple y evita duplicar insumos. El stock y lo que depende de él va por lugar.
- "Todos" es una vista de lectura (pregunta 4 del roadmap): para modificar stock hay que estar en un lugar concreto.
- El dispositivo sincroniza todos los lugares a los que el usuario tiene acceso (pregunta 5 del roadmap), para poder cambiar de lugar sin conexión. Los volúmenes por tenant son chicos (cientos de movimientos).
- Un usuario pertenece a un solo tenant. Un profesional que trabaje para dos clientes distintos usa dos cuentas.
- La invitación no depende de un servidor de correo: la app genera el enlace y la administradora lo envía por el medio que prefiera (research R5).
- El alta manual de un tenant la hace First Steps con un procedimiento documentado (crear tenant, primer lugar y administradora, y enviarle su invitación).
- Los niveles de aviso de caducidad y el umbral de pendientes son uno por tenant; el nombre visible en el chip de la barra superior pasa a ser el del lugar activo.
- El proveedor sigue siendo un dato del lote (texto); la gestión de proveedores por lugar del DS §28 queda para una spec posterior.
- La verificación incluye: pruebas de aislamiento con dos tenants y con dos lugares del mismo tenant; la migración probada sobre una restauración del respaldo de producción; y la migración de los datos locales del dispositivo probada en un navegador real (como la v8 del release 2.1.0).
