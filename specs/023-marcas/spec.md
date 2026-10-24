# Feature Specification: Marcas

**Feature Branch**: `[023-marcas]`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "spec 023 marcas según roadmap en 1STEPS/1stDocs, en rama dedicada"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 023 · `marcas` (M), a partir del pedido de la
clienta en `1stDocs/002-backlog/002-DentdeLion.md` ("Campo adicional 'Marca' opcional para los insumos.
Similar a proveedor: poder agregar una marca nueva o seleccionar una ya registrada en un select.
Requiere otra pestaña en Ajustes (Marcas)"). Primera spec de la tanda del release 2.6.0; reutiliza el
selector con "Agregar" de la 021 (proveedores), las secciones de Ajustes de la 019 y el "Ver más" de la
020.

## Contexto

Hoy un insumo no tiene marca. Lo más cercano es el código de fabricante, un texto libre que no sirve
para distinguir "Composite Z350" de 3M de otro composite parecido, ni para decirle a la casa dental qué
marca se pide. La clienta quiere poder anotar la marca de cada material, eligiéndola de una lista o
agregando una nueva en el mismo momento, como ya hace con los proveedores, y ordenar esa lista desde
una pestaña propia en Ajustes.

A diferencia del proveedor, que va en cada **lote** (spec 021), la marca describe al **producto**: el
mismo material puede comprarse a varias casas dentales, pero siempre es de una marca. Por eso la marca
se guarda en el insumo y es **opcional**: los insumos existentes quedan sin marca y nada obliga a
completarla.

La app funciona sin conexión y se actualiza sola al abrirse: durante unos días puede haber dispositivos
con la versión 2.5.0, que no conoce la marca. Editar un insumo desde uno de esos dispositivos no debe
borrarle la marca que le puso otro.

**Fuera de alcance**: marca por lote o varias marcas por insumo; filtro dedicado por marca en
Inventario (la búsqueda sí encuentra por marca); mostrar o agrupar por marca en Reportes; datos extra
de la marca (logo, sitio web, país, fabricante); asociar marcas a proveedores; marca predeterminada;
importar marcas desde un archivo; completar la marca de los insumos existentes de forma automática.

## Clarifications

### Session 2026-10-24

- Q: ¿La marca se guarda en el insumo (un material = una marca) o en cada lote (el mismo material de marcas distintas con un solo stock)? → A: Por insumo: una marca opcional por material, elegida en el alta o la edición; los lotes y la recepción de compras no piden marca.
- Q: En un insumo que ya existe, ¿quién puede cambiarle o quitarle la marca? → A: Solo administración (es catálogo, queda en el historial); cualquier miembro elige o agrega una marca al dar de alta un material.
- Q: En Inventario, ¿alcanza con que la búsqueda encuentre por marca, o hace falta un filtro dedicado por marca? → A: Solo búsqueda; sin filtro dedicado por marca.
- Q: En el mensaje de WhatsApp del pedido, ¿cada ítem debe incluir la marca del insumo? → A: Sí, "Nombre · Marca" en los ítems con marca, siempre (sin opción para apagarlo); los demás salen como hoy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir la marca de un insumo de una lista (Priority: P1)

Como administradora que registra o edita un material, quiero elegir su marca de una lista con
buscador, o dejarlo "Sin marca", para identificar bien el producto sin escribir la marca cada vez ni
escribirla distinto.

**Why this priority**: Es el pedido central de la clienta. Por sí sola ya deja anotada la marca de cada
material y evita variantes del mismo nombre.

**Independent Test**: Con tres marcas en el catálogo, dar de alta un material eligiendo "3M" con el
buscador; editar otro insumo y ponerle otra marca; editar un tercero y dejarlo en "Sin marca". Los tres
quedan como se eligió y se ven así en otro dispositivo del tenant.

**Acceptance Scenarios**:

1. **Given** el alta de material, **When** se abre el formulario, **Then** hay un campo **Marca** que
   viene en "Sin marca" (sin marca predeterminada) y no es obligatorio para guardar.
2. **Given** el campo Marca, **When** se abre, **Then** se ve la opción "Sin marca" y la lista de marcas
   activas por orden alfabético, con un buscador que filtra mientras se escribe (sin distinguir
   mayúsculas ni tildes).
3. **Given** un insumo existente, **When** administración lo edita, **Then** el campo Marca muestra su
   marca actual (o "Sin marca") y se puede cambiar o quitar; **When** lo edita el personal, **Then** la
   marca se ve pero no se puede cambiar, como el resto del catálogo.
4. **Given** un insumo guardado con una marca, **When** se sincroniza, **Then** queda con esa marca en
   todos los dispositivos del tenant.
5. **Given** el dispositivo sin conexión, **When** se registra o edita un insumo eligiendo una marca,
   **Then** se guarda igual y se sube en la siguiente sincronización.

---

### User Story 2 - Agregar una marca nueva sin salir del formulario (Priority: P1)

Como persona que registra un material, cuando su marca no está en la lista, quiero agregarla desde el
mismo campo y que quede elegida, para no perder lo escrito ni ir a Ajustes.

**Why this priority**: Sin esto, cada marca nueva obligaría a salir del formulario; sería peor que no
tener el campo. Va junto con la historia 1.

**Independent Test**: En el alta, escribir en el buscador una marca que no existe y tocar "Agregar
marca «…»": queda elegida, el material se guarda con ella y la marca aparece en el selector de los
siguientes registros y en Ajustes → Marcas.

**Acceptance Scenarios**:

1. **Given** un texto en el buscador que no coincide con ninguna marca, **When** se mira la lista,
   **Then** aparece la opción "Agregar marca «texto»".
2. **Given** esa opción, **When** se toca, **Then** la marca se crea con ese nombre, queda elegida en el
   campo y el resto del formulario conserva lo ya escrito.
3. **Given** un texto que coincide con una marca existente salvo por mayúsculas, tildes o espacios ("3m "
   frente a "3M"), **When** se intenta agregar, **Then** no se crea un duplicado: se elige la existente.
4. **Given** un texto que coincide con una marca **desactivada**, **When** se intenta agregar, **Then**
   se avisa que esa marca está desactivada; administración puede reactivarla desde ahí y el personal ve
   el aviso.
5. **Given** que la marca nueva se agrega sin conexión, **When** vuelve la conexión, **Then** se sube
   antes que el insumo que la usa y el insumo queda con ella.

---

### User Story 3 - Ver la marca donde se reconoce el material (Priority: P2)

Como persona que busca, consume o pide un material, quiero ver su marca junto al nombre y encontrarlo
buscando por marca, para no confundir productos parecidos y pedirle a la casa dental el correcto.

**Why this priority**: Es lo que hace útil la marca guardada en el día a día; sin esto solo se vería al
editar el insumo.

**Independent Test**: Con "Composite Z350" de marca 3M: el detalle del insumo muestra "3M"; en
Inventario y en la lista de compras se ve "Composite Z350 · 3M"; buscar "3m" en Inventario lo
encuentra; el mensaje de WhatsApp del pedido lo nombra "Composite Z350 · 3M".

**Acceptance Scenarios**:

1. **Given** un insumo con marca, **When** se abre su detalle, **Then** se ve la marca; **Given** uno
   sin marca, **Then** no se muestra nada en su lugar (ni "Sin marca").
2. **Given** un insumo con marca, **When** aparece en Inventario o en la lista de compras, **Then** la
   marca se ve junto al nombre, en un tono secundario, sin desbordar el ancho del teléfono.
3. **Given** el buscador de Inventario, **When** se escribe el nombre de una marca (sin distinguir
   mayúsculas ni tildes), **Then** aparecen los insumos de esa marca junto con los que coinciden por
   nombre.
4. **Given** un pedido por WhatsApp (spec 022) con ítems de insumos con marca, **When** se arma el
   mensaje, **Then** cada uno de esos ítems sale como "Nombre · Marca"; los ítems sin marca salen como
   hoy.
5. **Given** una marca renombrada, **When** se mira cualquiera de esos lugares, **Then** se ve el nombre
   nuevo.

---

### User Story 4 - Administrar marcas en Ajustes (Priority: P2)

Como administradora, quiero una sección **Marcas** en Ajustes donde crear, renombrar, desactivar y
eliminar marcas, para mantener la lista ordenada.

**Why this priority**: Permite corregir nombres y limpiar marcas que ya no se usan. Sin ella las
historias 1 a 3 funcionan, pero sin forma de ordenar la lista.

**Independent Test**: Como administradora, abrir Ajustes → Marcas: crear "GC", renombrar "3m" a "3M",
desactivar una marca y eliminar otra sin insumos. Como personal, Ajustes no muestra la sección.

**Acceptance Scenarios**:

1. **Given** el índice de Ajustes como administración, **When** se mira, **Then** aparece la tarjeta
   **Marcas** junto a Categorías y Proveedores, con un resumen de una línea (p. ej. "12 marcas").
2. **Given** la sección Marcas, **When** se abre, **Then** se ve la lista de marcas activas por orden
   alfabético, cada una con la cantidad de insumos que la usan; con más de 25 se usa el mismo "Ver más"
   que el resto de Ajustes.
3. **Given** la sección, **When** se crea o renombra una marca, **Then** se pide un nombre (obligatorio,
   único en el tenant sin distinguir mayúsculas, tildes ni espacios); un nombre repetido o vacío muestra
   un aviso y no se guarda.
4. **Given** una marca, **When** se desactiva, **Then** deja de ofrecerse en el selector y los insumos
   que la tienen la conservan y la siguen mostrando; se puede ver en una lista de desactivadas y
   reactivar.
5. **Given** una marca sin insumos, **When** se elige eliminarla, **Then** se elimina; **Given** una con
   insumos (incluidos los dados de baja), **Then** no se ofrece eliminarla, solo desactivarla.
6. **Given** una persona con rol `personal`, **When** abre Ajustes o llega a la sección por la URL,
   **Then** no ve la sección Marcas, igual que las demás secciones de administración.

---

### User Story 5 - Convivir con dispositivos que aún no se actualizan (Priority: P2)

Como clínica con varios dispositivos, quiero que un teléfono que todavía tiene la versión anterior
pueda seguir editando insumos sin borrarles la marca, para no tener que actualizar todos los equipos a
la vez.

**Why this priority**: Es la condición para publicar sin perder datos: un dispositivo con la 2.5.0 en
caché no sabe que existe la marca.

**Independent Test**: Con la actualización aplicada en el servidor, ponerle marca a un insumo desde la
versión nueva; editar su stock mínimo desde la versión anterior y sincronizar: el insumo conserva la
marca y el stock mínimo nuevo.

**Acceptance Scenarios**:

1. **Given** un insumo con marca, **When** un dispositivo con la versión anterior lo edita y sincroniza,
   **Then** el insumo conserva su marca y recibe los demás cambios.
2. **Given** un insumo creado desde la versión anterior, **When** llega al servidor, **Then** se guarda
   sin error y sin marca.
3. **Given** un insumo con marca, **When** lo ve un dispositivo con la versión anterior, **Then** lo ve
   como hoy, sin errores.

---

### Edge Cases

- **Catálogo vacío** (tenant nuevo o recién actualizado): el selector muestra "Sin marca", el buscador y
  "Agregar marca"; nada más.
- **La marca elegida se desactiva o se elimina mientras un formulario está abierto** (aquí o por
  sincronización): el formulario conserva la elección hasta guardar; si se eliminó, el insumo se guarda
  sin marca y se avisa.
- **Insumo con una marca desactivada**: al editarlo, el selector muestra su marca actual (marcada como
  desactivada) para no quitarla sin querer, pero no la ofrece a otros insumos.
- **Dos personas agregan la misma marca sin conexión en dos dispositivos**: al sincronizar quedan unidas
  en una sola (por nombre normalizado) y los insumos de ambas quedan con esa marca.
- **Dos personas renombran la misma marca a la vez**: gana el último cambio sincronizado, como en
  categorías y proveedores.
- **Renombrar a un nombre que ya existe** en otra marca: se rechaza con un aviso; fusionar marcas queda
  fuera de alcance.
- **Nombre con solo espacios** o vacío: no se acepta, ni en Ajustes ni en "Agregar marca".
- **Nombres largos** de insumo o marca: en Inventario y en compras la marca se acorta o pasa a la
  línea siguiente sin desbordar; en el detalle y en el selector se ve completa.
- **Personal sin acceso a Ajustes**: puede agregar marcas desde el selector del alta; no puede cambiar
  la marca de un insumo ya registrado (es catálogo) ni administrar la lista.
- **Historial del insumo**: un cambio de marca hecho por administración queda en el historial de cambios
  del insumo, con la marca anterior y la nueva.
- **Teclado y lectores de pantalla**: el selector se abre, filtra y elige con teclado; la opción elegida,
  "Sin marca" y "Agregar marca" se anuncian.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo de marcas**

- **FR-001**: Cada tenant DEBE tener su propio catálogo de marcas, compartido por todos sus lugares de
  trabajo. Una marca tiene **nombre** (obligatorio) y un estado **activa/desactivada**.
- **FR-002**: El nombre DEBE ser único dentro del tenant sin distinguir mayúsculas, tildes ni espacios
  sobrantes, con la misma regla de normalización que los proveedores; NO DEBE aceptarse vacío.
- **FR-003**: Un tenant NO DEBE poder ver, crear ni modificar marcas de otro tenant; DEBE verificarse con
  las pruebas de aislamiento entre tenants.

**Marca del insumo**

- **FR-004**: Cada insumo PUEDE tener **una marca** del catálogo de su tenant, o ninguna. Los insumos
  existentes DEBEN quedar sin marca tras la actualización, sin perder ningún otro dato. La marca NO se
  guarda en los lotes: registrar un lote o recibir una compra NO DEBE pedir marca.
- **FR-005**: En el alta y en la edición del insumo, el campo Marca DEBE ser un **selector con buscador**
  sobre las marcas activas, por orden alfabético, que filtra sin distinguir mayúsculas ni tildes, con la
  opción **"Sin marca"**. NO DEBE haber marca predeterminada: el alta viene en "Sin marca".
- **FR-006**: El campo Marca NO DEBE ser obligatorio en ningún formulario.
- **FR-007**: Desde el selector, **cualquier miembro** del tenant DEBE poder **agregar una marca nueva**
  con el texto buscado; queda elegida y el formulario conserva lo ya escrito. Si el nombre coincide con
  una existente (FR-002), DEBE elegirse la existente; si coincide con una desactivada, DEBE avisarse, y
  solo administración puede reactivarla desde ahí.
- **FR-008**: La marca es parte del **catálogo** del insumo: cualquier miembro puede elegirla al dar de
  alta un material, pero solo administración DEBE poder cambiarla o quitarla en un insumo existente; un
  cambio hecho sin permiso NO DEBE aplicarse en el servidor.
- **FR-009**: Cada cambio de marca de un insumo existente DEBE quedar en el historial de cambios del
  insumo, como los demás campos del catálogo.
- **FR-010**: Registrar, elegir y agregar marcas DEBE funcionar sin conexión y sincronizarse después, sin
  que un insumo llegue al servidor antes que la marca que usa.

**Dónde se ve la marca**

- **FR-011**: El detalle del insumo DEBE mostrar el **nombre actual** de su marca, si tiene.
- **FR-012**: Inventario y la lista de compras DEBEN mostrar la marca junto al nombre del insumo, en un
  tono secundario, sin desbordar el ancho del teléfono; un insumo sin marca se ve como hoy.
- **FR-013**: La búsqueda de Inventario DEBE encontrar insumos también por el nombre de su marca, sin
  distinguir mayúsculas ni tildes.
- **FR-014**: En el pedido por WhatsApp (spec 022), cada ítem de un insumo con marca DEBE salir como
  "Nombre · Marca"; los demás, como hoy.

**Ajustes → Marcas**

- **FR-015**: Ajustes DEBE tener una sección **Marcas**, solo para administración, junto a Categorías y
  Proveedores, con su tarjeta y resumen de una línea en el índice.
- **FR-016**: La sección DEBE permitir crear, renombrar, desactivar y reactivar marcas, y eliminar las
  que no tienen insumos (contando los dados de baja). Una marca con insumos NO DEBE poder eliminarse.
- **FR-017**: La lista de la sección DEBE mostrar las activas por orden alfabético con la cantidad de
  insumos de cada una, con "Ver más" de a 25 como el resto de Ajustes (spec 020), y dar acceso a las
  desactivadas.
- **FR-018**: Al desactivar una marca, DEBE dejar de ofrecerse en el selector; los insumos que la tienen
  la conservan y la siguen mostrando.
- **FR-019**: Las personas con rol `personal` NO DEBEN ver la sección ni poder renombrar, desactivar,
  reactivar o eliminar marcas, tampoco llegando por la URL.

**Compatibilidad y sincronización**

- **FR-020**: Un insumo editado desde un dispositivo con la versión anterior DEBE conservar su marca en
  el servidor; un insumo creado desde esa versión DEBE guardarse sin error y sin marca.
- **FR-021**: Las marcas DEBEN descargarse al dispositivo con la misma sincronización por partes que el
  resto de los catálogos, de modo que un dispositivo nuevo reciba el catálogo completo.
- **FR-022**: La actualización del servidor DEBE publicarse antes que la de la aplicación, y la
  aplicación nueva DEBE funcionar contra el servidor ya actualizado desde el primer arranque.

### Key Entities *(include if feature involves data)*

- **Marca**: fabricante o línea comercial de un material ("3M", "GC", "Ivoclar"). Pertenece a un
  tenant. Nombre (único en el tenant, normalizado), activa o desactivada, quién la creó y cuándo.
- **Insumo** (existente): pasa a referirse, de forma opcional, a una Marca; la marca forma parte de su
  catálogo y de su historial de cambios.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dar de alta un material sin marca toma **los mismos pasos que hoy** (el campo nuevo no
  se toca), en el 100 % de los casos probados.
- **SC-002**: Elegir una marca existente toma **como máximo 3 toques** (abrir, escribir unas letras,
  elegir) con un catálogo de 50 marcas; agregar una nueva, como máximo 3 toques más el nombre.
- **SC-003**: Tras la actualización, el **100 %** de los insumos existentes sigue con todos sus datos y
  sin marca, y la cantidad de insumos es la misma que antes.
- **SC-004**: Ningún par de marcas de un mismo tenant tiene nombres que solo difieren en mayúsculas,
  tildes o espacios, después de un mes de uso.
- **SC-005**: Las pruebas de aislamiento confirman que un tenant no puede leer ni modificar marcas de
  otro (0 accesos indebidos), y que `personal` no puede cambiar la marca de un insumo existente.
- **SC-006**: Editar un insumo con marca desde la versión anterior conserva la marca en el **100 %** de
  los casos probados.
- **SC-007**: Buscar por el nombre de una marca en Inventario muestra **todos** los insumos de esa
  marca.
- **SC-008**: El selector, la marca en las listas y la sección Marcas se usan sin problemas en teléfono,
  tablet y desktop, verificado con capturas, y `personal` no ve la sección en ningún tamaño.

## Assumptions

Las cuatro preguntas que el roadmap deja para `/speckit-clarify` se confirmaron con su recomendación
(ver Clarifications):

- **Marca por insumo, no por lote** (pregunta 1, confirmada en Clarifications): el material es un producto de una marca; si cambia de
  marca, es otro insumo. La marca por lote solo haría falta si la clienta quisiera un solo stock para el
  "mismo" material de marcas distintas.
- **Quién la asigna** (pregunta 2, confirmada en Clarifications): como proveedores, cualquier miembro agrega una marca desde el
  selector; solo administración la cambia en un insumo existente (es catálogo, igual que el nombre o la
  categoría) y administra la lista en Ajustes.
- **Búsqueda por marca, sin filtro dedicado** (pregunta 3, confirmada en Clarifications): la búsqueda de Inventario encuentra por
  marca; un filtro por marca se agrega solo si la clienta lo pide.
- **La marca sale en el mensaje de WhatsApp** (pregunta 4, confirmada en Clarifications), como "Composite Z350 · 3M", porque ayuda a
  la casa dental a mandar el producto correcto. El saludo editable de la 022 no cambia.
- **Sin marca predeterminada**: a diferencia de los proveedores, la marca depende del producto.
- **Sin datos de contacto** en la marca: solo nombre y estado; el contacto vive en el proveedor.
- **Sin migración de datos**: no se intenta deducir la marca del nombre ni del código de fabricante; la
  clienta la completa a medida que edita sus insumos.
- **Paginación de Ajustes** reutiliza el "Ver más" de la spec 020; el selector no pagina, porque filtra
  con el buscador.
- **Publicación**: se despliega el servidor antes que el front (FR-022), y se prueba la convivencia con
  la 2.5.0 (FR-020) como en la spec 021.
