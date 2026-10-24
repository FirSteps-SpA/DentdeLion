# Feature Specification: Proveedores

**Feature Branch**: `[021-proveedores]`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "spec 021-proveedores según roadmap en 1STEPS/1stDocs, en rama dedicada"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 021 · `proveedores` (M–L), a partir del pedido de
la clienta en `1stDocs/002-backlog/002-DentdeLion.md` ("Administrar proveedores similar a categorías:
que sea un select al momento de registrar, y opción de agregar uno nuevo al conjunto de proveedores.
Además, poder dejar uno predeterminado para que esté seleccionado por defecto, con opción de
cambiarlo") y del Design System (§24, §28; V1 #8). Cuarta spec de la tanda del release 2.5.0; va
después de la 019, que dejó lugar en Ajustes para la sección Proveedores, y antes de la 022, que usa el
contacto del proveedor para enviar el pedido por WhatsApp.

## Contexto

Hoy el proveedor es un **texto libre obligatorio** en cada lote: se escribe a mano en el alta de
material (cuando hay stock inicial) y al recibir una compra. No hay una lista de proveedores, así que el
mismo proveedor queda escrito de varias formas ("Dental Sur", "dental sur", "DentalSur ") y cada
registro obliga a escribirlo de nuevo, aunque casi siempre sea el mismo.

La clienta quiere manejar los proveedores como las categorías: elegirlos de una lista, poder agregar
uno nuevo en el momento de registrar y tener uno **predeterminado** que aparezca ya elegido. La 022
necesita además el teléfono de WhatsApp de la casa dental para enviarle el pedido.

Es la única spec de la tanda que cambia datos guardados: los lotes existentes deben quedar asociados a
un proveedor de la lista sin perder lo que ya estaba escrito, y los dispositivos que todavía tengan la
versión anterior (2.4.0) seguirán registrando el proveedor como texto durante un tiempo.

Deuda técnica que viaja con esta spec (del roadmap): la configuración global de la clínica que la 014
reemplazó por la configuración por lugar de trabajo sigue guardada en el servidor y en el dispositivo
sin usarse. Se elimina aquí, porque esta spec ya trae un cambio de esquema y una versión nueva de la
base local.

**Fuera de alcance**: asociar un proveedor habitual a cada insumo; agrupar la lista de compras por
proveedor o enviar pedidos (spec 022); comparar precios entre proveedores (DS V3 #20); mostrar el
proveedor en Reportes o filtrar el inventario por proveedor; cambiar el proveedor de un lote ya
registrado; importar proveedores desde un archivo.

## Clarifications

### Session 2026-10-23

- Q: ¿La lista de proveedores es una sola para toda la clínica (tenant), con un predeterminado distinto por lugar de trabajo, o cada lugar tiene su propia lista? → A: Una sola lista por clínica (tenant), compartida por todos sus lugares; cada lugar de trabajo puede tener su propio predeterminado.
- Q: ¿El proveedor sigue siendo obligatorio en cada lote nuevo, o se puede guardar un lote sin proveedor? → A: Obligatorio, como hoy, en el alta de material y en la recepción de compras; con el predeterminado ya elegido no hay que escribirlo.
- Q: ¿Cada insumo debe tener un "proveedor habitual", o el proveedor solo se guarda en cada lote? → A: Solo en cada lote; no hay proveedor habitual por insumo. La 022 pide el proveedor al enviar el pedido.
- Q: ¿Quién puede agregar un proveedor nuevo desde el registro? → A: Cualquier miembro, incluido el personal; solo administración renombra, desactiva, elimina o cambia el predeterminado, desde Ajustes.
- Q: ¿El detalle de un insumo debe mostrar el proveedor de cada lote? → A: Sí, en cada lote del detalle del insumo, con el nombre actual del proveedor (p. ej. "Lote A123 · Dental Sur — vence 3 nov 2026"); no en los selectores de lote de consumo o traslado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir el proveedor de una lista al registrar (Priority: P1)

Como dentista o personal que registra un material nuevo o recibe una compra, quiero elegir el
proveedor de una lista con buscador, y que el predeterminado ya venga elegido, para no escribirlo cada
vez ni escribirlo distinto.

**Why this priority**: Es el pedido central de la clienta y el uso más frecuente: cada lote nuevo pide
un proveedor. Por sí sola ya ahorra escribir y evita duplicados.

**Independent Test**: Con tres proveedores, uno marcado como predeterminado del lugar activo, registrar
un material con stock inicial: el campo Proveedor ya muestra el predeterminado y el registro se guarda
sin tocarlo. Repetir eligiendo otro de la lista con el buscador.

**Acceptance Scenarios**:

1. **Given** un catálogo con proveedores y uno predeterminado para el lugar activo, **When** se abre el
   alta de material con stock inicial o la recepción de un ítem de compras, **Then** el campo Proveedor
   aparece con el predeterminado ya elegido.
2. **Given** el campo Proveedor, **When** se abre, **Then** se ve la lista de proveedores activos por
   orden alfabético con un buscador que filtra mientras se escribe (sin distinguir mayúsculas ni
   tildes), y se puede elegir otro.
3. **Given** que el lugar activo no tiene predeterminado, **When** se abre el formulario, **Then** el
   campo aparece vacío y el registro pide elegir un proveedor antes de guardar, con el mismo aviso de
   error que hoy.
4. **Given** un lote guardado con un proveedor elegido, **When** se sincroniza, **Then** el lote queda
   asociado a ese proveedor en todos los dispositivos del tenant.
5. **Given** el dispositivo sin conexión, **When** se registra un lote eligiendo un proveedor de la
   lista, **Then** se guarda igual y se sube en la siguiente sincronización.

---

### User Story 2 - Agregar un proveedor nuevo sin salir del registro (Priority: P1)

Como dentista o personal, cuando el proveedor de lo que estoy registrando no está en la lista, quiero
agregarlo desde el mismo campo y que quede elegido, para no interrumpir el registro ni ir a Ajustes.

**Why this priority**: Sin esto, la lista obliga a salir del formulario y perder lo escrito cada vez
que llega un proveedor nuevo; sería peor que el texto libre de hoy. Va junto con la historia 1.

**Independent Test**: En el alta, escribir en el buscador un nombre que no existe y tocar "Agregar
proveedor «…»": queda elegido, el registro se guarda y el proveedor aparece en la lista para los
siguientes registros y en Ajustes.

**Acceptance Scenarios**:

1. **Given** un texto en el buscador que no coincide con ningún proveedor, **When** se mira la lista,
   **Then** aparece la opción "Agregar proveedor «texto»".
2. **Given** esa opción, **When** se toca, **Then** el proveedor se crea con ese nombre, queda elegido
   en el campo y el resto del formulario conserva lo ya escrito.
3. **Given** un texto que coincide con un proveedor existente salvo por mayúsculas, tildes o espacios
   ("dental sur " frente a "Dental Sur"), **When** se intenta agregar, **Then** no se crea un duplicado:
   se elige el existente.
4. **Given** un texto que coincide con un proveedor **desactivado**, **When** se intenta agregar,
   **Then** se ofrece reactivarlo en vez de crear otro con el mismo nombre (solo administración puede
   reactivarlo; el personal ve el aviso de que ese proveedor está desactivado).
5. **Given** que el proveedor nuevo se agrega sin conexión, **When** vuelve la conexión, **Then** se sube
   antes que el lote que lo usa y el lote queda asociado a él.

---

### User Story 3 - Administrar proveedores en Ajustes (Priority: P2)

Como administradora, quiero una sección **Proveedores** en Ajustes donde crear, renombrar, completar el
contacto, marcar el predeterminado de cada lugar de trabajo y desactivar proveedores, para mantener la
lista ordenada y lista para enviar pedidos.

**Why this priority**: Ordena el catálogo y fija el predeterminado, que es lo que vuelve rápido el
registro. Sin ella la historia 1 funciona, pero sin predeterminado y sin forma de corregir nombres.

**Independent Test**: Como administradora, abrir Ajustes → Proveedores: crear "Casa Dental Norte" con
WhatsApp y contacto, marcarlo predeterminado del lugar activo, renombrar otro y desactivar uno sin uso.
Como personal, Ajustes no muestra la sección.

**Acceptance Scenarios**:

1. **Given** el índice de Ajustes como administración, **When** se mira, **Then** aparece la tarjeta
   **Proveedores** entre Categorías e Insumos dados de baja, con un resumen de una línea (p. ej. "6
   proveedores").
2. **Given** la sección Proveedores, **When** se abre, **Then** se ve la lista de proveedores activos por
   orden alfabético, cada uno con su nombre, su teléfono de WhatsApp y su contacto si los tiene, y una
   marca en el predeterminado del lugar activo; con más de 25 se usa el mismo "Ver más" que el resto de
   Ajustes.
3. **Given** la sección, **When** se crea o edita un proveedor, **Then** se pide un nombre (obligatorio,
   único en el tenant sin distinguir mayúsculas, tildes ni espacios), un teléfono de WhatsApp opcional y
   un nombre de contacto opcional; un teléfono mal escrito muestra un aviso y no se guarda.
4. **Given** un proveedor renombrado, **When** se abre el detalle de un insumo con lotes de ese
   proveedor, **Then** cada uno de esos lotes muestra el nombre nuevo.
5. **Given** un proveedor activo, **When** se marca como predeterminado del lugar activo, **Then** deja de
   serlo el anterior de ese lugar, y los demás lugares conservan el suyo; también se puede quitar el
   predeterminado.
6. **Given** un proveedor, **When** se desactiva, **Then** deja de aparecer en el selector del registro,
   deja de ser predeterminado en los lugares donde lo era, y sus lotes conservan el proveedor; se puede
   ver en una lista de desactivados y reactivar.
7. **Given** un proveedor sin lotes, **When** se elige eliminarlo, **Then** se elimina; **Given** uno con
   lotes, **Then** no se ofrece eliminarlo, solo desactivarlo.
8. **Given** una persona con rol `personal`, **When** abre Ajustes o llega a la sección por la URL,
   **Then** no ve la sección Proveedores, igual que las demás secciones de administración.

---

### User Story 4 - Los lotes ya registrados quedan con su proveedor (Priority: P1)

Como clínica que ya usa la app, quiero que al actualizar, cada lote que ya tenía un proveedor escrito
quede asociado a un proveedor de la lista, con las variantes de un mismo nombre unidas, para no perder
historia ni empezar la lista de cero.

**Why this priority**: Es la condición para publicar: si la actualización dejara lotes sin proveedor o
con duplicados, la lista nacería desordenada y la 022 no sabría a quién escribir.

**Independent Test**: Sobre una restauración del respaldo de producción, aplicar la actualización:
todos los lotes quedan con un proveedor; los textos que solo difieren en mayúsculas o espacios quedan
en un único proveedor; los nombres que la clienta decidió fusionar quedan en uno.

**Acceptance Scenarios**:

1. **Given** lotes con proveedores escritos como texto, **When** se aplica la actualización, **Then** se
   crea un proveedor por cada nombre distinto (sin distinguir mayúsculas, tildes ni espacios sobrantes)
   y cada lote queda asociado al suyo.
2. **Given** la lista de nombres distintos revisada antes con la clienta, **When** ella decide que dos
   nombres son el mismo proveedor ("Dental Sur" y "Dentalsur Ltda."), **Then** esos lotes quedan en un
   solo proveedor con el nombre que ella elija.
3. **Given** dos tenants con un proveedor del mismo nombre, **When** se aplica la actualización, **Then**
   cada tenant tiene el suyo y ninguno ve los proveedores ni los datos de contacto del otro.
4. **Given** el texto original de cada lote, **When** termina la actualización, **Then** se conserva
   durante al menos un release, de modo que los dispositivos con la versión anterior lo siguen viendo.

---

### User Story 5 - Convivir con dispositivos que aún no se actualizan (Priority: P2)

Como clínica con varios dispositivos, quiero que un teléfono que todavía tiene la versión anterior
pueda seguir registrando lotes sin errores y que esos lotes queden con su proveedor de la lista, para no
tener que actualizar todos los equipos a la vez.

**Why this priority**: La app funciona sin conexión y se actualiza sola al abrirse; durante unos días
puede haber dispositivos con la 2.4.0. Si sus registros fallaran o quedaran sin proveedor, se perderían
datos.

**Independent Test**: Con la actualización aplicada en el servidor, registrar un lote desde la versión
anterior escribiendo un proveedor conocido con otras mayúsculas y otro desconocido: el primero queda
asociado al existente y el segundo crea un proveedor nuevo; ambos se ven bien en la versión nueva.

**Acceptance Scenarios**:

1. **Given** un lote que llega sin proveedor de la lista y solo con el texto, **When** se guarda en el
   servidor, **Then** queda asociado al proveedor del tenant cuyo nombre coincide (sin distinguir
   mayúsculas, tildes ni espacios), o a uno nuevo con ese nombre si no hay coincidencia.
2. **Given** un lote registrado en la versión nueva, **When** lo ve un dispositivo con la versión
   anterior, **Then** ve el nombre del proveedor como texto, como hoy.
3. **Given** el texto que coincide con un proveedor desactivado, **When** llega un lote así, **Then** el
   lote queda asociado a ese proveedor sin reactivarlo.

---

### Edge Cases

- **Catálogo vacío** (tenant nuevo): el selector muestra solo el buscador y "Agregar proveedor"; nada
  viene elegido.
- **El predeterminado se desactiva o se elimina mientras un formulario está abierto** (aquí o por
  sincronización): el formulario conserva la elección hasta guardar; el lote se guarda con ese
  proveedor.
- **Vista "Todos" (sin lugar activo)**: el alta de material ya pide elegir un lugar; el predeterminado
  que se preselecciona es el del lugar elegido, y cambia si se cambia el lugar en el formulario.
- **Dos personas agregan el mismo proveedor sin conexión en dos dispositivos**: al sincronizar quedan
  unidos en uno solo (por nombre normalizado) y los lotes de ambos quedan en ese proveedor.
- **Dos personas renombran el mismo proveedor a la vez**: gana el último cambio sincronizado, como en
  categorías.
- **Renombrar a un nombre que ya existe** en otro proveedor: se rechaza con un aviso; fusionar
  proveedores queda fuera de alcance de la app (se hace en la actualización inicial con la clienta).
- **Nombre con solo espacios** o vacío: no se acepta, ni en Ajustes ni en "Agregar proveedor".
- **Nombres largos**: se ven completos en el selector y en la lista (en varias líneas si hace falta), sin
  desbordar el ancho del teléfono.
- **Teléfono de WhatsApp**: se acepta con o sin "+", espacios o guiones, y se guarda en formato
  internacional; si no trae código de país, se asume el de Chile (+56).
- **Lotes antiguos con proveedor vacío o solo espacios** (si los hubiera): quedan asociados a un
  proveedor "Sin proveedor", que la clienta puede renombrar o mantener desactivado.
- **Personal sin acceso a Ajustes**: igual puede agregar proveedores desde el registro; no puede
  renombrar, desactivar ni cambiar el predeterminado.
- **Teclado y lectores de pantalla**: el selector se abre, filtra y elige con teclado; la opción elegida
  y "Agregar proveedor" se anuncian.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo de proveedores**

- **FR-001**: Cada tenant DEBE tener su propio catálogo de proveedores, compartido por todos sus lugares
  de trabajo. Un proveedor tiene **nombre** (obligatorio), **teléfono de WhatsApp** (opcional),
  **nombre de contacto** (opcional) y un estado **activo/desactivado**.
- **FR-002**: El nombre DEBE ser único dentro del tenant sin distinguir mayúsculas, tildes ni espacios
  sobrantes; NO DEBE aceptarse vacío.
- **FR-003**: Cada lugar de trabajo PUEDE tener **un proveedor predeterminado**, elegido entre los
  activos; como máximo uno por lugar.
- **FR-004**: Un tenant NO DEBE poder ver, crear ni modificar proveedores (ni sus datos de contacto) de
  otro tenant; DEBE verificarse con las pruebas de aislamiento entre tenants.

**Registro de lotes**

- **FR-005**: En el alta de material (con stock inicial) y en la recepción de compras, el campo
  Proveedor DEBE ser un **selector con buscador** sobre los proveedores activos, por orden alfabético,
  que filtra sin distinguir mayúsculas ni tildes.
- **FR-006**: El selector DEBE venir con el **predeterminado del lugar** del registro ya elegido, y
  permitir cambiarlo; sin predeterminado, viene vacío.
- **FR-007**: El proveedor DEBE seguir siendo **obligatorio** en cada lote nuevo, con el mismo aviso de
  error que hoy si falta.
- **FR-008**: Desde el selector, **cualquier miembro** del tenant DEBE poder **agregar un proveedor
  nuevo** con el texto buscado; queda elegido y el formulario conserva lo ya escrito. Si el nombre
  coincide con uno existente (FR-002), DEBE elegirse el existente en vez de crear otro; si coincide con
  uno desactivado, DEBE avisarse, y solo administración puede reactivarlo desde ahí.
- **FR-009**: Cada lote nuevo DEBE quedar asociado a un proveedor del catálogo. Registrar, elegir y
  agregar proveedores DEBE funcionar sin conexión y sincronizarse después, sin que un lote llegue al
  servidor antes que el proveedor que usa.

**Ajustes → Proveedores**

- **FR-010**: Ajustes DEBE tener una sección **Proveedores**, solo para administración, entre Categorías
  e Insumos dados de baja, con su tarjeta y resumen de una línea en el índice.
- **FR-011**: La sección DEBE permitir crear, editar (nombre, WhatsApp, contacto), marcar o quitar el
  predeterminado del lugar activo, desactivar y reactivar proveedores, y eliminar los que no tienen
  lotes. Un proveedor con lotes NO DEBE poder eliminarse.
- **FR-012**: La lista de la sección DEBE mostrar los activos por orden alfabético, con "Ver más" de a
  25 como el resto de Ajustes (spec 020), y dar acceso a los desactivados.
- **FR-013**: Al desactivar un proveedor, DEBE dejar de ofrecerse en el selector y dejar de ser
  predeterminado donde lo era; sus lotes conservan el proveedor.
- **FR-014**: El detalle de un insumo DEBE mostrar, en cada lote, el **nombre actual** de su proveedor
  (p. ej. "Lote A123 · Dental Sur — vence 3 nov 2026"); al renombrar un proveedor, sus lotes ya
  registrados DEBEN mostrar el nombre nuevo. Los selectores de lote al consumir o trasladar no cambian.
- **FR-015**: El teléfono de WhatsApp, si se ingresa, DEBE validarse y guardarse en formato
  internacional (código de país + número, sin símbolos), asumiendo +56 si no trae código.
- **FR-016**: Las personas con rol `personal` NO DEBEN ver la sección ni poder renombrar, desactivar,
  eliminar o cambiar el predeterminado, tampoco llegando por la URL.

**Datos existentes y compatibilidad**

- **FR-017**: Antes de actualizar, DEBE obtenerse la lista de nombres de proveedor distintos ya
  registrados por tenant, para que la clienta decida cuáles fusionar y con qué nombre.
- **FR-018**: La actualización DEBE crear un proveedor por cada nombre distinto (normalizado según
  FR-002, más las fusiones decididas en FR-017) y asociar **cada** lote existente a su proveedor, sin
  perder ninguno. DEBE ensayarse sobre una restauración del respaldo de producción antes de aplicarse.
- **FR-019**: El nombre del proveedor como texto DEBE seguir guardándose en cada lote durante al menos
  un release, para que los dispositivos con la versión anterior lo sigan mostrando y registrando.
- **FR-020**: Un lote que llega con el texto del proveedor pero sin proveedor del catálogo (versión
  anterior) DEBE guardarse sin error y quedar asociado al proveedor que coincide por nombre, o a uno
  nuevo si no hay coincidencia.
- **FR-021**: Los proveedores DEBEN descargarse al dispositivo con la misma sincronización por partes que
  el resto de los catálogos, de modo que un dispositivo nuevo reciba el catálogo completo.

**Deuda técnica**

- **FR-022**: La configuración global de la clínica, reemplazada en la spec 014 por la configuración por
  lugar de trabajo, DEBE eliminarse del servidor y del dispositivo, sin cambiar ningún comportamiento
  visible.

### Key Entities *(include if feature involves data)*

- **Proveedor**: casa dental o distribuidor del que la clínica compra. Pertenece a un tenant. Nombre
  (único en el tenant, normalizado), teléfono de WhatsApp opcional, nombre de contacto opcional, activo
  o desactivado, quién lo creó y cuándo.
- **Predeterminado por lugar**: para cada lugar de trabajo, cuál proveedor viene elegido al registrar
  (o ninguno).
- **Lote** (existente): pasa a referirse a un Proveedor; conserva temporalmente el nombre como texto por
  compatibilidad.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un predeterminado configurado, registrar un material con stock inicial o recibir una
  compra **no requiere escribir ni tocar el campo Proveedor** en el 100 % de los casos probados.
- **SC-002**: Elegir un proveedor distinto del predeterminado toma **como máximo 3 toques** (abrir,
  escribir unas letras, elegir) con un catálogo de 50 proveedores.
- **SC-003**: Tras la actualización sobre el respaldo de producción, el **100 %** de los lotes existentes
  tiene un proveedor del catálogo, la cantidad de lotes es la misma que antes y el detalle de cada
  insumo muestra el proveedor de cada lote.
- **SC-004**: Ningún par de proveedores de un mismo tenant tiene nombres que solo difieren en
  mayúsculas, tildes o espacios, después de la actualización y después de un mes de uso.
- **SC-005**: Las pruebas de aislamiento confirman que un tenant no puede leer ni modificar proveedores
  de otro (0 accesos indebidos).
- **SC-006**: Un lote registrado desde la versión anterior después de la actualización se guarda sin
  error y aparece con su proveedor en la versión nueva, en el 100 % de los casos probados.
- **SC-007**: La sección Proveedores y el selector se usan sin problemas en teléfono, tablet y desktop,
  verificado con capturas, y `personal` no ve la sección en ningún tamaño.

## Assumptions

- **Catálogo por tenant y predeterminado por lugar** (pregunta 1 del roadmap, confirmada en
  Clarifications): las casas dentales suelen atender a todos los lugares de una misma clínica, así que un solo
  catálogo evita repetir proveedores; el predeterminado varía por lugar, como sugiere el DS §28.
- **El proveedor sigue siendo obligatorio** (pregunta 2 del roadmap, confirmada en Clarifications): es
  el comportamiento actual y, con el predeterminado, ya no cuesta escribirlo.
- **Quién administra** (pregunta 3 del roadmap, confirmada en Clarifications): administración maneja la sección de Ajustes, igual que
  categorías; cualquier miembro puede agregar un proveedor desde el registro, porque el pedido de la
  clienta lo pone "al momento de registrar" y el personal también registra.
- **Sin proveedor habitual por insumo** (pregunta 4 del roadmap, confirmada en Clarifications): queda
  fuera; la 022 pedirá el
  proveedor al compartir la lista. Se puede agregar después sin cambiar lo de esta spec.
- **Nombre "Sin proveedor"** para lotes antiguos con el texto vacío, si los hubiera (hoy el campo es
  obligatorio, así que no se esperan).
- **Código de país +56 por defecto** para el teléfono: la clienta y sus proveedores están en Chile.
- **Cambiar el proveedor de un lote ya registrado** queda fuera: hoy tampoco se puede editar el texto.
- **Publicación**: antes de publicar, se confirma que los dispositivos de la clienta cargaron la versión
  nueva o, al menos, que la tolerancia de FR-020 está probada; la columna de texto se retira en un
  release posterior.
- **Paginación de Ajustes** reutiliza el "Ver más" de la spec 020; el selector no pagina, porque filtra
  con el buscador.
