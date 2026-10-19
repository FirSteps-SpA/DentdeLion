# Feature Specification: Unidades y Costo Unitario

**Feature Branch**: `[015-unidades-y-costo-unitario]`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "spec 015 unidades-y-costo-unitario del roadmap de 1STEPS/1stDocs, en rama dedicada a partir de develop actualizada"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 015 · `unidades-y-costo-unitario` (M) y Design
System v1.0 §22 ("Tabla de inventario": columnas Presentación y Costo unitario), §24 ("Formulario
nuevo producto": Presentación, Contenido, Unidad, Precio de compra) y §25 ("Unidades").

## Contexto

Hoy cada insumo tiene **una sola unidad** (caja, frasco, pieza, cartucho, mL o g), y en esa unidad se
registran los ingresos, los consumos, el stock y el mínimo. No hay precios.

En la práctica los insumos se **compran** en una presentación (una caja de 50 cartuchos de
anestesia) y se **consumen** de a uno (un cartucho por paciente). Con una sola unidad, la clínica
tiene que elegir entre contar cajas (y no poder descontar un cartucho) o contar cartuchos (y
convertir a mano cada caja que llega).

Esta spec separa la **unidad de compra** de la **unidad de consumo**, define cuántas unidades de
consumo trae cada presentación (**contenido**) y registra el **precio de compra** al ingresar
stock, para obtener el **costo unitario** de cada insumo (precio de la presentación ÷ contenido).

- **Ejemplo (DS §25)**: Anestesia Articaína 4% se compra por **Caja** de **50** **Cartuchos** y se
  consume por **Cartucho**. Si la caja costó $32.500, el costo unitario es $650 por cartucho. Al
  recibir 2 cajas, el stock sube en 100 cartuchos; cada consumo descuenta 1 cartucho.
- El costo unitario es la base de las specs siguientes: costo de materiales por tratamiento (016) y
  reportes de gasto y valor de inventario (017).

**Fuera de alcance**: tratamientos y costo por tratamiento (016); KPIs de valor de inventario,
gasto mensual y gráficos (017); proveedores como entidad con sus propios precios; impuestos,
descuentos, facturas o conciliación contable; conversión automática entre unidades de distinta
magnitud de un mismo insumo (p. ej. comprar en L y consumir en mL se expresa como contenido en mL,
ver Assumptions); monedas distintas al peso chileno.

## Clarifications

### Session 2026-10-19

- Q: ¿Se puede cambiar la unidad de consumo de un insumo con stock e historial? → A: Sí. La administración puede cambiarla; la app convierte el stock y el mínimo con el factor indicado y deja un registro auditable de la conversión en el historial del insumo.
- Q: ¿Qué regla de costo unitario se usa cuando hay lotes con precios distintos? → A: El precio del último ingreso con precio.
- Q: ¿Quién ve e ingresa precios y costos? → A: Todo el equipo del tenant los ve, los ingresa y los corrige; cada cambio queda auditado.
- Q: ¿Quién define la presentación al dar de alta un insumo, si hoy cualquier usuario puede darlo de alta? → A: Quien da de alta el insumo (cualquier rol) define su presentación, igual que hoy elige la unidad; después, solo administración la modifica (análisis 2026-10-19, U1).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Definir la presentación de compra de un insumo (Priority: P1)

Como persona del equipo que da de alta un insumo, o como administradora que lo edita, quiero indicar en qué unidad se compra
(Caja), cuántas unidades trae (50) y en qué unidad se consume (Cartucho), para que la app haga la
conversión por mí.

**Why this priority**: Sin la presentación no hay conversión ni costo unitario; todo lo demás
depende de este dato.

**Independent Test**: Dar de alta "Articaína 4%" con compra por Caja de 50 y consumo por Cartucho;
el insumo muestra la presentación "Caja × 50 cartuchos" y su stock, mínimo y consumos se expresan
en cartuchos.

**Acceptance Scenarios**:

1. **Given** el formulario de alta de insumo, **When** la administradora elige unidad de compra
   "Caja", contenido 50 y unidad de consumo "Cartucho", **Then** el insumo queda guardado con esa
   presentación y se muestra como "Caja × 50 cartuchos".
2. **Given** un insumo que se compra y se consume en la misma unidad (p. ej. un Kit), **When** la
   administradora no indica una unidad de compra distinta, **Then** la presentación queda como
   unidad de compra = unidad de consumo con contenido 1, sin pasos extra en el formulario.
3. **Given** un insumo existente, **When** la administradora cambia la unidad de compra o el
   contenido (p. ej. el proveedor ahora vende cajas de 100), **Then** el cambio aplica a los
   ingresos futuros, no altera el stock actual y queda registrado en el historial de cambios del
   insumo.
4. **Given** un insumo con stock contado en cajas (p. ej. 3 cajas de guantes de 100), **When** la
   administradora cambia su unidad de consumo a "Unidad" con contenido 100, **Then** el stock pasa a
   300 unidades, el mínimo se convierte con el mismo factor y la conversión queda registrada en el
   historial del insumo con autora, fecha y factor (no es un movimiento de inventario).
5. **Given** el selector de unidades, **When** se despliega, **Then** ofrece el catálogo del DS
   §25: Caja, Frasco, Botella, Jeringa, Cartucho, Paquete, Kit, Unidad, Rollo, mL, L, g, mg, m, cm.
6. **Given** un usuario sin rol de administración, **When** abre un insumo, **Then** ve su
   presentación pero no puede modificarla (igual que el resto del catálogo hoy).
7. **Given** un usuario sin rol de administración, **When** da de alta un insumo nuevo, **Then**
   puede definir su presentación (unidad de compra, contenido y unidad de consumo), igual que hoy
   elige su unidad.

---

### User Story 2 - Ingresar stock en la unidad de compra (Priority: P1)

Como persona del equipo que recibe un pedido, quiero registrar "2 cajas" y que la app sume 100
cartuchos al stock, sin hacer la cuenta a mano.

**Why this priority**: Es el flujo diario donde hoy se cometen errores de conversión; es lo que la
clínica percibe primero.

**Independent Test**: Con Articaína definida como Caja × 50, registrar un ingreso de 2 cajas (desde
el alta con stock inicial y desde la recepción de la lista de compras) y comprobar que el stock sube en
100 cartuchos y que el movimiento muestra ambas expresiones.

**Acceptance Scenarios**:

1. **Given** un insumo Caja × 50 cartuchos, **When** se registra un ingreso de 2 en unidad de
   compra, **Then** el stock del lote y del lugar activo aumenta en 100 cartuchos y la pantalla
   confirma "2 cajas = 100 cartuchos" antes de guardar.
2. **Given** el mismo formulario, **When** la persona prefiere ingresar en unidad de consumo (p. ej.
   30 cartuchos sueltos), **Then** puede cambiar la unidad del ingreso y el stock aumenta en 30.
3. **Given** un ítem de la lista de compras vinculado a un insumo, **When** se marca como recibido,
   **Then** la cantidad se pide en unidad de compra (con opción de unidad de consumo) y se convierte
   igual que en el alta con stock inicial.
4. **Given** un insumo cuya unidad de consumo no admite decimales, **When** la conversión daría un
   resultado no entero (p. ej. 0,5 caja de 25), **Then** se rechaza con un mensaje claro.
5. **Given** que no hay conexión, **When** se registra un ingreso en unidad de compra, **Then** la
   conversión y el registro funcionan igual y se sincronizan después (Constitución I).

---

### User Story 3 - Registrar el precio de compra y ver el costo unitario (Priority: P2)

Como administradora, quiero anotar cuánto pagué por la presentación al ingresar un lote, y ver el
costo unitario de cada insumo en el inventario, para saber cuánto me cuesta cada cartucho que uso.

**Why this priority**: Es el objetivo de negocio de la spec y la base de 016–017, pero el inventario
sigue siendo útil sin precios; por eso va después de la conversión.

**Independent Test**: Registrar un ingreso de 2 cajas a $32.500 cada una; el lote queda con costo
unitario $650 por cartucho y la tabla de inventario muestra ese costo en la columna "Costo
unitario".

**Acceptance Scenarios**:

1. **Given** el formulario de ingreso (alta con stock inicial o recepción de compras), **When** se indica
   el precio por unidad de compra, **Then** se muestra el total ("2 × $32.500 = $65.000") y el costo
   unitario resultante ("$650 por cartucho") antes de guardar.
2. **Given** el mismo formulario, **When** la persona prefiere ingresar el total pagado, **Then**
   puede hacerlo y el precio por unidad de compra se calcula a partir de la cantidad.
3. **Given** un ingreso sin precio, **When** se guarda, **Then** se acepta (el precio es opcional) y
   el lote queda "sin precio", sin bloquear el flujo.
4. **Given** insumos con lotes con precio, **When** se abre la tabla de inventario o el detalle del
   insumo, **Then** se ve el costo unitario del insumo según la regla de FR-012, en pesos chilenos
   con separador de miles y sin decimales.
5. **Given** un insumo sin ningún lote con precio, **When** se muestra su costo unitario, **Then**
   aparece "Sin precio" en lugar de $0.
6. **Given** un insumo con un lote a $32.500 la caja y luego otro a $35.000, **When** se muestra su
   costo unitario, **Then** se usa el último ingreso con precio ($700 por cartucho), aunque queden
   cartuchos del lote anterior.

---

### User Story 4 - Ver el stock en ambas unidades (Priority: P3)

Como persona del equipo, al revisar el inventario o la lista de compras quiero ver el stock en
unidades de consumo y su equivalente en presentaciones ("120 cartuchos ≈ 2 cajas y 20"), para
decidir cuánto pedir.

**Why this priority**: Mejora la lectura y el pedido, pero no cambia los datos.

**Independent Test**: Con 120 cartuchos de un insumo Caja × 50, el detalle y la tabla muestran
"120 cartuchos" y el equivalente "2 cajas + 20"; la lista de compras sugiere cantidades en cajas.

**Acceptance Scenarios**:

1. **Given** un insumo con unidad de compra distinta a la de consumo, **When** se muestra su stock,
   **Then** se ve en unidad de consumo con el equivalente en unidad de compra.
2. **Given** un insumo bajo mínimo en la lista de compras sugeridos, **When** se muestra la
   sugerencia, **Then** la cantidad a pedir se expresa en unidades de compra, redondeada hacia
   arriba a presentaciones completas.

---

### User Story 5 - Corregir el precio de un lote (Priority: P3)

Como persona del equipo, quiero agregar o corregir el precio de un lote ya ingresado (porque llegó
la factura después o me equivoqué), sin rehacer el ingreso.

**Why this priority**: El precio es opcional al ingresar; sin esta corrección, los lotes quedarían
"sin precio" para siempre.

**Independent Test**: Editar el precio de un lote sin precio; el costo unitario del insumo se
actualiza y el cambio queda en el historial con autor, fecha, valor anterior y nuevo.

**Acceptance Scenarios**:

1. **Given** un lote sin precio o con precio erróneo, **When** una persona del equipo edita su precio,
   **Then** el costo unitario del lote y del insumo se recalculan y queda registro auditable del
   cambio.
2. **Given** dos personas que corrigen el precio del mismo lote sin conexión, **When** ambas
   sincronizan, **Then** el conflicto se resuelve de forma determinista y ambos valores quedan en el
   historial (Constitución I).

---

### Edge Cases

- **Insumos y movimientos existentes**: hoy cada insumo tiene una sola unidad. Tras la migración,
  esa unidad pasa a ser su unidad de consumo y también su unidad de compra, con contenido 1, de modo
  que ningún stock, mínimo ni movimiento existente cambia de valor y la clínica actual no nota
  diferencias hasta que defina presentaciones.
- **Insumo que hoy se cuenta en la unidad de compra** (p. ej. guantes contados en cajas) y que la
  clínica quiere pasar a consumir por unidad: la administración cambia la unidad de consumo y la app
  convierte el stock de cada lote y el mínimo multiplicando por el contenido (FR-007a). Los
  movimientos anteriores no se reescriben: el historial los muestra en la unidad en que se
  registraron.
- **Conversión que no da entero**: si la nueva unidad de consumo no admite decimales, el contenido
  debe ser entero, así que la conversión siempre da un resultado entero. Si se pasa a una unidad
  mayor (p. ej. de cartuchos a cajas) y el stock no es múltiplo del contenido, el cambio se rechaza
  con un mensaje claro.
- **Conversión concurrente**: si otra persona registra consumos sin conexión en la unidad anterior
  mientras se convierte, esos consumos se convierten con el mismo factor al sincronizar, de forma
  determinista y sin perder ninguno.
- **Unidad "pieza" actual**: no está en el catálogo del DS; se migra a "Unidad" sin cambiar
  cantidades.
- **Contenido inválido**: contenido 0, negativo o vacío se rechaza; contenido decimal solo se admite
  cuando la unidad de consumo admite decimales (p. ej. Jeringa × 2,5 mL sí; Caja × 2,5 cartuchos no).
- **Lotes con precios distintos**: el costo unitario del insumo es el del último ingreso con precio
  (FR-012); cada lote conserva el suyo. "Último" se determina por la fecha del ingreso, no por el
  orden de sincronización.
- **Último ingreso sin precio**: no reemplaza al anterior; se usa el último ingreso que sí tenga
  precio.
- **Traslado entre lugares** (spec 014): el lote trasladado conserva su precio y su costo unitario en
  el lugar de destino.
- **Cambio de presentación con stock**: cambiar de Caja × 50 a Caja × 100 no modifica el stock en
  cartuchos ni el costo de lotes ya ingresados; solo afecta a los ingresos nuevos.
- **Precio 0**: se acepta como valor explícito (muestra gratis), distinto de "sin precio".
- **Montos grandes y redondeo**: el costo unitario puede tener decimales ($32.990 / 50 = $659,8); se
  guarda sin redondear y se muestra redondeado al peso.
- **Insumo dado de baja**: conserva su presentación y precios para el historial; no aparece en
  sugerencias de compra.
- **Ajustes y consumos**: siempre se registran en unidad de consumo; la unidad de compra solo se usa
  al ingresar stock y al sugerir compras.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo de unidades y presentación**

- **FR-001**: El sistema DEBE ofrecer un catálogo fijo de unidades: Caja, Frasco, Botella, Jeringa,
  Cartucho, Paquete, Kit, Unidad, Rollo, mL, L, g, mg, m, cm (DS §25).
- **FR-002**: El sistema DEBE admitir cantidades decimales solo en las unidades de magnitud continua
  (mL, L, g, mg, m, cm) y exigir enteros en las demás.
- **FR-003**: Cada insumo DEBE tener una **unidad de consumo**, una **unidad de compra** y un
  **contenido** (cantidad de unidades de consumo que trae una unidad de compra), mayor que cero.
- **FR-004**: Si la unidad de compra es igual a la de consumo, el contenido DEBE ser 1 y el
  formulario NO DEBE pedirlo.
- **FR-005**: El sistema DEBE mostrar la presentación del insumo en forma legible ("Caja × 50
  cartuchos") en la tabla de inventario (columna "Presentación", DS §22) y en el detalle.
- **FR-006**: Quien da de alta un insumo (cualquier rol) DEBE poder definir su presentación. Después
  del alta, solo los usuarios con rol de administración DEBEN poder modificar la unidad de compra y
  el contenido; cada cambio DEBE quedar en el historial de cambios del insumo con autor, fecha, valor
  anterior y nuevo.
- **FR-007**: Un cambio de unidad de compra o de contenido NO DEBE alterar el stock, los mínimos ni
  los movimientos ya registrados.
- **FR-007a**: Los usuarios con rol de administración DEBEN poder cambiar la unidad de consumo de un
  insumo con stock e historial. El sistema DEBE convertir el stock de cada lote y el stock mínimo con
  el factor indicado, registrar la conversión en el historial de cambios del insumo (autor, fecha,
  unidad anterior, unidad nueva y factor; no como movimiento de inventario) y mostrar el historial previo en la unidad en que se registró. Los consumos registrados
  sin conexión en la unidad anterior DEBEN convertirse con el mismo factor al sincronizar.

**Stock y conversión**

- **FR-008**: El stock, el stock mínimo, los consumos, los ajustes y los traslados DEBEN expresarse y
  guardarse en la **unidad de consumo**.
- **FR-009**: Al registrar un ingreso (alta con stock inicial o recepción desde la lista de compras), el
  usuario DEBE poder indicar la cantidad en unidad de compra (por defecto) o en unidad de consumo; el
  sistema DEBE convertirla a unidades de consumo (cantidad × contenido) y mostrar la equivalencia
  antes de guardar.
- **FR-010**: El lote creado por el ingreso DEBE conservar la cantidad y la unidad en que se ingresó
  (y el contenido vigente) además del valor convertido que registra el movimiento de ingreso, para que el historial muestre "2 cajas (100 cartuchos)" aunque luego
  cambie la presentación.
- **FR-011**: Los datos existentes DEBEN migrarse de modo que la unidad actual de cada insumo sea su
  unidad de consumo y de compra con contenido 1 ("pieza" pasa a "Unidad"), sin cambiar ninguna
  cantidad de stock, mínimo ni movimiento.

**Precio y costo unitario**

- **FR-012**: El costo unitario de un insumo DEBE ser el costo por unidad de consumo de su **último
  ingreso con precio** (por fecha de ingreso), en cualquier lugar del tenant; los ingresos sin precio
  no lo reemplazan.
- **FR-013**: Al registrar un ingreso, el usuario DEBE poder indicar opcionalmente el precio por
  unidad de compra o el total pagado; el sistema DEBE calcular el otro valor y el costo por unidad de
  consumo (precio por unidad de compra ÷ contenido) y mostrarlos antes de guardar.
- **FR-014**: El precio DEBE ser opcional; un ingreso sin precio NO DEBE bloquearse ni demorar el
  flujo, y el lote DEBE distinguir "sin precio" de "precio 0".
- **FR-015**: Todo usuario del tenant DEBE poder agregar o corregir el precio de un lote ya
  ingresado; cada cambio DEBE ser auditable (autor, fecha, valor anterior y nuevo) y los
  cambios concurrentes sin conexión DEBEN resolverse de forma determinista sin perder valores.
- **FR-016**: Todos los usuarios del tenant DEBEN poder ver precios y costos e ingresar precios;
  no hay restricción por rol para precios.
- **FR-017**: El costo unitario DEBE mostrarse en la tabla de inventario (columna "Costo unitario",
  DS §22) y en el detalle del insumo, en pesos chilenos con separador de miles y redondeado al peso;
  los valores DEBEN guardarse sin redondear.
- **FR-018**: Un lote trasladado a otro lugar del mismo tenant DEBE conservar su precio y costo
  unitario.
- **FR-019**: Los precios y costos DEBEN estar aislados por tenant, igual que el resto de los datos
  (spec 014).

**Compras y visualización**

- **FR-020**: La lista de compras DEBE expresar las cantidades sugeridas de insumos bajo mínimo en
  unidades de compra, redondeando hacia arriba a presentaciones completas, y mostrar su equivalente
  en unidades de consumo.
- **FR-021**: Donde se muestre el stock de un insumo con unidad de compra distinta, el sistema DEBE
  mostrar también su equivalente en unidades de compra ("120 cartuchos ≈ 2 cajas + 20").

**Offline y trazabilidad**

- **FR-022**: La definición de presentaciones, la conversión de ingresos, el registro de precios y el
  cálculo del costo unitario DEBEN funcionar sin conexión y sincronizarse después, conservando la
  autoría de cada acción (Constitución I y VI).
- **FR-023**: Los controles nuevos (selector de unidad, cambio entre unidad de compra y de consumo,
  campos de precio) DEBEN respetar el área táctil mínima de 48 × 48 px (Constitución III).

### Key Entities *(include if feature involves data)*

- **Unidad**: elemento del catálogo fijo del DS §25. Atributos: nombre singular y plural, y si admite
  decimales.
- **Insumo** (existente, se amplía): agrega unidad de compra y contenido; su unidad actual pasa a ser
  la unidad de consumo. El costo unitario del insumo es un valor derivado, no se ingresa a mano.
- **Lote** (existente, se amplía): conserva cómo se ingresó (cantidad y unidad ingresadas,
  contenido y unidad de consumo vigentes) y el precio por unidad de compra (opcional), de donde se
  deriva su costo por unidad de consumo. Cada lote tiene un solo ingreso.
- **Conversión de unidad de consumo**: registro auditable del cambio de unidad de consumo de un
  insumo (unidad anterior, unidad nueva, factor, autor, fecha).
- **Movimiento** (existente, se amplía): registra la cantidad en unidad de consumo y la unidad en que
  está expresada, para convertirla si la unidad de consumo cambia después.
- **Cambio de precio de lote**: registro auditable de cada corrección de precio (lote, valor
  anterior, valor nuevo, autor, fecha), análogo al historial de cambios de insumo.
- **Ítem de compra** (existente): su cantidad sugerida se expresa en unidades de compra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tras la migración, el 100 % de los insumos, lotes y movimientos existentes conservan
  exactamente el mismo stock, mínimo y cantidades que antes (verificado sobre una restauración del
  respaldo de producción).
- **SC-002**: Registrar un ingreso de N cajas toma la misma cantidad de pasos que hoy, y la persona
  nunca necesita calcular a mano la conversión a unidades de consumo.
- **SC-003**: En el 100 % de los ingresos con precio, el costo unitario mostrado coincide con precio
  por unidad de compra ÷ contenido, redondeado al peso.
- **SC-004**: La administradora puede definir la presentación de un insumo existente en menos de
  1 minuto.
- **SC-005**: Todos los flujos de la spec (presentación, ingreso con conversión, precio y costo)
  funcionan sin conexión y sus datos llegan al servidor al volver la red, sin pérdidas ni duplicados.
- **SC-006**: Ningún usuario de otro tenant puede ver ni inferir precios o costos de un tenant ajeno.
- **SC-007**: La clienta actual confirma que el costo unitario mostrado para al menos 5 insumos de su
  inventario coincide con sus facturas.

## Assumptions

- **Compuerta del roadmap**: confirmada con la clienta actual el 2026-10-19; se decide implementar
  esta spec. Tamaño revisado a **M–L** por la conversión de unidad de consumo (Clarifications Q1).
- La "unidad de contenido" del DS §25 ("Cartuchos") es la forma plural de la unidad de consumo
  ("Cartucho"); el contenido siempre se expresa en la unidad de consumo. Un frasco de 1 L consumido
  por mL se define como Frasco × 1000 mL.
- El catálogo de unidades es fijo y común a todos los tenants; agregar unidades es un cambio de
  producto, no una configuración del cliente.
- Los precios se ingresan en pesos chilenos tal como se pagaron (con IVA incluido si la factura lo
  incluye); no se separan impuestos ni descuentos.
- Las sugerencias de compra y la recepción de la lista de compras (spec 009) siguen funcionando como
  hoy; solo cambia la unidad en que se expresan y se ingresan las cantidades.
- El costo unitario se calcula localmente con los datos del dispositivo, igual que las alertas
  (Constitución IV), sin depender del servidor.
- El valor total del inventario, el gasto mensual y los gráficos de costos quedan para la spec 017;
  esta spec solo entrega el costo unitario por lote e insumo.
