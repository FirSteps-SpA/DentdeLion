# Feature Specification: Tratamientos y Costo por Tratamiento

**Feature Branch**: `[016-tratamientos-y-costo-por-tratamiento]`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "spec 016 tratamientos-y-costo-por-tratamiento del roadmap"

**Origen**: `1stDocs/005-roadmap/002-DentdeLion.md` § 016 · `tratamientos-y-costo-por-tratamiento`
(L) y Design System v1.0 §26 ("Tratamientos"), §27 ("Costo por tratamiento"), §28
("Multi-clínica": porcentaje profesional por clínica) y §29 ("App móvil": "Tratamientos" en la
navegación).

## Contexto

Con la spec 015 cada insumo tiene un **costo unitario** (último ingreso con precio). Esta spec
permite definir **tratamientos** (p. ej. "Restauración clase II") con su precio y los materiales
que usa, y calcular cuánto cuestan esos materiales y cuánto gana la profesional.

Fórmulas del DS §27:

```text
Costo de materiales  = Σ (cantidad utilizada × costo unitario del material)
Comisión profesional = precio del tratamiento × porcentaje profesional
Ganancia estimada    = comisión profesional − costo de materiales
```

- **Ejemplo (DS §26)**: Restauración clase II, precio $45.000, con 1 cartucho de anestesia ($650),
  2 g de resina ($1.200/g) y otros materiales: costo de materiales $3.480. Con 40 % profesional, la
  comisión es $18.000 y la ganancia estimada $14.520.
- Además, **registrar un tratamiento realizado** descuenta sus materiales del inventario del lugar
  de trabajo, en un solo paso, en vez de consumir cada material por separado.
- La interfaz dice siempre **"Ganancia estimada"**, nunca "utilidad": no es un resultado contable
  (DS §27).

**Fuera de alcance**: datos de pacientes (no se registra a quién se le hizo el tratamiento),
agenda, cobros, boletas o facturación; reportes y gráficos de producción y ganancia (spec 017);
comisiones distintas por profesional dentro de un mismo lugar; tratamientos compuestos o planes de
tratamiento; el botón flotante del DS §30.

## Clarifications

### Session 2026-10-19

- Q: ¿El precio de un tratamiento es uno solo, uno por lugar, o uno general con excepciones? → A: Uno por lugar de trabajo: cada clínica cobra distinto y el precio se define en cada lugar.
- Q: ¿De dónde sale el porcentaje profesional? → A: Solo del lugar de trabajo: un porcentaje por lugar para todos los tratamientos (DS §28).
- Q: ¿Quién ve la comisión y la ganancia estimada? → A: Todo el equipo del tenant, como los costos de la spec 015.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Definir un tratamiento con sus materiales (Priority: P1)

Como administradora, quiero crear un tratamiento con su nombre, su precio en cada lugar donde atiendo
y los materiales que usa (con la cantidad de cada uno), para tener su receta estándar.

**Why this priority**: Sin tratamientos definidos no hay costo ni registro; es la base de todo lo
demás.

**Independent Test**: Crear "Restauración clase II" con 1 cartucho de anestesia y 2 g de resina, a
$45.000 en "Clínica Providencia" y $50.000 en "Box Las Condes"; aparece en la lista de Tratamientos
con sus materiales y el precio del lugar activo.

**Acceptance Scenarios**:

1. **Given** la sección Tratamientos, **When** la administradora crea un tratamiento con nombre,
   el precio de cada lugar donde se ofrece y al menos un material con su cantidad, **Then** queda
   guardado y aparece en la lista con el precio del lugar activo.
2. **Given** un tratamiento sin precio en el lugar activo, **When** se muestra, **Then** dice
   "Sin precio en este lugar": sus materiales y su costo se ven, y se puede registrar como
   realizado, pero no hay comisión ni ganancia estimada hasta que se defina el precio.
3. **Given** el formulario, **When** elige un material, **Then** la cantidad se ingresa en la
   unidad de consumo del insumo (cartuchos, g, mL…) y respeta si esa unidad admite decimales.
4. **Given** un tratamiento existente, **When** la administradora cambia su precio o sus
   materiales, **Then** el cambio aplica a los tratamientos que se registren después y no altera
   los ya registrados.
5. **Given** un tratamiento que ya no se ofrece, **When** la administradora lo desactiva, **Then**
   deja de aparecer para registrar, pero sus registros pasados se conservan.
6. **Given** un usuario sin rol de administración, **When** abre Tratamientos, **Then** ve los
   tratamientos pero no puede crearlos ni editarlos.
7. **Given** dos tratamientos con el mismo nombre (sin distinguir mayúsculas ni espacios),
   **When** se intenta guardar el segundo, **Then** se rechaza con un mensaje claro.

---

### User Story 2 - Ver el costo de materiales y la ganancia estimada (Priority: P1)

Como administradora, quiero ver cuánto cuestan los materiales de cada tratamiento y la ganancia
estimada en el lugar donde atiendo, para saber qué tratamientos me convienen.

**Why this priority**: Es el objetivo de negocio de la spec (DS §26–27).

**Independent Test**: Con los costos unitarios de la 015, la Restauración clase II muestra costo de
materiales $3.480, comisión $18.000 y "Ganancia estimada" $14.520 en un lugar con 40 %.

**Acceptance Scenarios**:

1. **Given** un tratamiento con materiales con costo unitario, **When** se abre su detalle,
   **Then** se ve el costo de cada material (cantidad × costo unitario), el costo total de
   materiales, la comisión profesional y la ganancia estimada, con las fórmulas del DS §27.
2. **Given** un material sin precio, **When** se calcula el costo, **Then** ese material se marca
   "Sin precio", el total se muestra como incompleto ("desde $X") y la ganancia estimada advierte
   que falta información.
3. **Given** el porcentaje profesional definido para el lugar de trabajo activo, **When** se ve el
   tratamiento, **Then** la comisión y la ganancia usan el precio del tratamiento en ese lugar y el
   porcentaje de ese lugar (el mismo para todos los tratamientos del lugar).
4. **Given** la lista de tratamientos, **When** se muestra, **Then** cada uno indica su precio, su
   costo de materiales y su ganancia estimada en el lugar activo; en "Todos", la ganancia por
   lugar.
5. **Given** cualquier pantalla de esta spec, **When** se muestra la ganancia, **Then** se rotula
   "Ganancia estimada" y nunca "utilidad".
6. **Given** que el costo unitario de un material cambia (una compra nueva con otro precio),
   **When** se vuelve a abrir el tratamiento, **Then** el costo y la ganancia estimada se
   recalculan con el costo vigente.

---

### User Story 3 - Registrar un tratamiento realizado (Priority: P1)

Como persona del equipo, al terminar un tratamiento quiero registrarlo con un toque y que se
descuenten sus materiales del inventario del lugar, en vez de consumir cada material por separado.

**Why this priority**: Es el uso diario que mantiene el inventario al día y alimenta los reportes
(017).

**Independent Test**: Registrar una Restauración clase II en el lugar activo: se descuentan 1
cartucho y 2 g de resina por FEFO y el registro queda con su precio, costo y ganancia del momento.

**Acceptance Scenarios**:

1. **Given** un tratamiento activo, **When** la persona elige "Registrar realizado", **Then** ve
   los materiales con sus cantidades estándar, puede ajustarlas (p. ej. usó 3 g en vez de 2) o
   quitar alguno, y al confirmar se descuentan del inventario del lugar activo.
2. **Given** los materiales a descontar, **When** se confirma, **Then** cada uno se descuenta del
   lote que vence primero (FEFO), como el consumo de la spec 002, y si un material no alcanza en un
   lote se completa con el siguiente.
3. **Given** que un material no tiene stock suficiente en el lugar, **When** se intenta confirmar,
   **Then** se avisa qué material falta y cuánto hay, y la persona puede ajustar esa cantidad
   (incluso a 0) o cancelar; nunca se descuenta más de lo disponible.
4. **Given** el registro confirmado, **When** se guarda, **Then** conserva la fecha, quién lo
   registró, el lugar, el precio, el porcentaje profesional, las cantidades usadas y el costo de
   cada material **de ese momento**, y su costo total y ganancia estimada no cambian aunque
   después cambien precios o costos.
5. **Given** que no hay conexión, **When** se registra un tratamiento, **Then** el registro y sus
   consumos se guardan y se sincronizan después, sin perder ni duplicar ninguno (Constitución I).
6. **Given** un tratamiento registrado por error, **When** se elige "Deshacer" (en el aviso
   posterior o en el historial), **Then** se revierten sus consumos y el registro queda anulado,
   con autor y fecha de la anulación.
7. **Given** la vista "Todos", **When** se registra un tratamiento, **Then** primero se pide el
   lugar, como en el consumo (spec 014).

---

### User Story 4 - Definir el porcentaje profesional del lugar de trabajo (Priority: P2)

Como administradora, quiero indicar qué porcentaje del precio corresponde a la profesional en cada
lugar donde atiendo (el resto es de la clínica), porque cada clínica paga distinto (DS §28).

**Why this priority**: Sin porcentaje la ganancia estimada no se puede calcular, pero el costo de
materiales y el registro funcionan igual.

**Independent Test**: En Ajustes → Lugares, "Clínica Providencia" con 40 % profesional y "Box Las
Condes" con 50 %: la ganancia del mismo tratamiento cambia al cambiar de lugar.

**Acceptance Scenarios**:

1. **Given** Ajustes → Lugares de trabajo, **When** la administradora edita un lugar, **Then**
   puede fijar su porcentaje profesional (0–100 %) y ve el porcentaje de la clínica como el resto.
2. **Given** un lugar sin porcentaje definido, **When** se muestra la ganancia estimada, **Then**
   aparece "Define el % profesional del lugar" en vez de un número.
3. **Given** un cambio de porcentaje, **When** se guarda, **Then** aplica a los tratamientos que se
   registren después y no cambia los ya registrados.

---

### User Story 5 - Historial de tratamientos realizados (Priority: P3)

Como administradora, quiero ver los tratamientos registrados en el lugar (fecha, tratamiento,
quién lo registró, costo de materiales y ganancia estimada), para revisar el día o el mes.

**Why this priority**: Útil para revisar y corregir, pero los totales y gráficos llegan con la 017.

**Independent Test**: Tras registrar tres tratamientos, el historial del lugar los lista del más
reciente al más antiguo, con un total del período elegido.

**Acceptance Scenarios**:

1. **Given** tratamientos registrados, **When** se abre el historial, **Then** se listan del más
   reciente al más antiguo con fecha, tratamiento, autor, costo de materiales y ganancia estimada;
   los anulados se muestran tachados y no suman.
2. **Given** el historial, **When** se elige un período (hoy, esta semana, este mes), **Then** se
   ve la cantidad de tratamientos, la suma de precios, de costos de materiales y de ganancia
   estimada de ese período en el lugar activo (o por lugar en "Todos").

---

### Edge Cases

- **Material dado de baja** (spec 007) que sigue en un tratamiento: el tratamiento lo muestra
  marcado "Dado de baja", no lo descuenta al registrar y avisa a administración que lo reemplace.
- **Material con stock solo en lotes caducados**: no cuenta como disponible; se avisa "Solo hay
  stock caducado" y se ajusta como un faltante.
- **Material sin stock en ningún lote del lugar**: se puede registrar el tratamiento ajustando ese
  material a 0; el registro guarda que se usó 0.
- **Material cuya unidad de consumo se convierte** (spec 015): la cantidad del tratamiento se
  convierte con el mismo factor, para que "2 cajas" siga siendo la misma cantidad física.
- **Tratamiento sin materiales**: se permite (p. ej. una consulta); su costo de materiales es $0.
- **Tratamiento registrado sin precio en el lugar**: se descuentan los materiales y el registro
  guarda su costo, pero sin precio, comisión ni ganancia; en el historial aparece "Sin precio" y no
  suma a los totales de precio ni de ganancia.
- **Lugar nuevo** (spec 014): sus tratamientos aparecen sin precio hasta que administración lo
  defina.
- **Precio 0** (tratamiento sin cobro, p. ej. control): se permite; la ganancia estimada puede ser
  negativa y se muestra en rojo con el signo.
- **Ganancia negativa**: el costo de materiales supera la comisión; se muestra con el signo y en
  color de error, sin bloquear nada.
- **Registros simultáneos sin red** en dos dispositivos del mismo lugar: ambos se guardan y
  descuentan; si un lote queda negativo, se marca para revisión como cualquier sobreconsumo
  (spec 002).
- **Edición concurrente de un tratamiento** por dos administradoras sin red: se resuelve de forma
  determinista y queda el historial de ambos cambios, como en el catálogo de insumos (spec 007).
- **Nombre duplicado creado sin red** por dos administradoras a la vez: la unicidad se valida en el
  dispositivo y no se puede garantizar entre dispositivos desconectados; al sincronizar se ven
  ambos tratamientos y administración desactiva uno (mismo criterio que el catálogo de insumos).
- **Porcentaje profesional fuera de rango**: menos de 0 o más de 100 se rechaza.

## Requirements *(mandatory)*

### Functional Requirements

**Catálogo de tratamientos**

- **FR-001**: El sistema DEBE permitir a administración crear, editar y desactivar tratamientos con
  nombre (único en el tenant), un precio en pesos (≥ 0) por lugar de trabajo y una lista de
  materiales, cada uno con un
  insumo del catálogo y una cantidad (> 0) en su unidad de consumo.
- **FR-002**: El catálogo de tratamientos DEBE ser compartido por todos los lugares de trabajo del
  tenant, como el catálogo de insumos (spec 014); el **precio se define por lugar de trabajo**
  (Clarifications Q1). Un tratamiento sin precio en un lugar se puede ver y registrar en ese lugar,
  pero no tiene comisión ni ganancia estimada.
- **FR-003**: Cada cambio de un tratamiento DEBE quedar en un historial con autor, fecha, valor
  anterior y nuevo, y las ediciones concurrentes sin conexión DEBEN resolverse de forma
  determinista.
- **FR-004**: Todo usuario del tenant DEBE poder ver los tratamientos, sus costos y su ganancia
  estimada; solo administración DEBE poder crearlos, editarlos o desactivarlos.
- **FR-005**: La navegación DEBE incluir la sección **Tratamientos** (DS §29) en móvil, tablet y
  desktop. En la barra inferior móvil (5 ítems) quedan Inicio, Inventario, Tratamientos, Alertas y
  Más; **Compras** se accede desde "Más" y desde Inicio. En tablet y desktop la sidebar muestra
  todas las secciones.

**Costo y ganancia estimada**

- **FR-006**: El costo de materiales de un tratamiento DEBE ser Σ (cantidad × costo unitario
  vigente del material), con el costo unitario de la spec 015 (último ingreso con precio).
- **FR-007**: La comisión profesional DEBE ser precio × porcentaje profesional, y la ganancia
  estimada, comisión − costo de materiales (DS §27).
- **FR-008**: Si algún material no tiene precio, el sistema DEBE mostrar el costo como incompleto,
  identificar el material y advertir que la ganancia estimada no lo incluye.
- **FR-009**: El porcentaje profesional DEBE ser el del lugar de trabajo, el mismo para todos los
  tratamientos de ese lugar (Clarifications Q2, DS §28).
- **FR-010**: Toda ganancia DEBE rotularse "Ganancia estimada", con una nota que aclare que no es
  utilidad contable (DS §27).
- **FR-011**: Los montos DEBEN mostrarse en pesos chilenos redondeados al peso; los cálculos se
  hacen sin redondear.

**Porcentaje profesional por lugar**

- **FR-012**: Administración DEBE poder fijar en cada lugar de trabajo un porcentaje profesional
  entre 0 y 100 (el de la clínica es el resto); el cambio queda en el historial y aplica solo hacia
  adelante.

**Registro de tratamientos realizados**

- **FR-013**: Todo usuario del tenant DEBE poder registrar un tratamiento realizado en un lugar,
  con las cantidades estándar como propuesta, editables (incluso a 0) antes de confirmar.
- **FR-014**: Al confirmar, el sistema DEBE descontar cada material del inventario del lugar por
  FEFO, repartiéndolo entre lotes si hace falta, en una sola operación: o se registran el
  tratamiento y todos sus consumos, o nada.
- **FR-015**: El sistema NO DEBE descontar más de lo disponible en el lugar; si falta stock, DEBE
  indicar el material y la cantidad disponible y pedir que se ajuste. **Disponible** excluye los
  lotes caducados: un tratamiento nunca descuenta material vencido (Constitución IV, mismo criterio
  que "Consumir 1").
- **FR-016**: Cada registro DEBE guardar un snapshot: fecha, autor, lugar, tratamiento, precio,
  porcentaje profesional, cada material con la cantidad usada y su costo unitario de ese momento,
  costo total y ganancia estimada. Cambios posteriores de precios o costos NO DEBEN alterarlo.
- **FR-017**: Un registro DEBE poder anularse ("Deshacer"): sus consumos se revierten con ajustes
  vinculados (como el deshacer de la spec 007) y el registro queda anulado con autor y fecha, sin
  borrarse.
- **FR-018**: Los consumos generados por un tratamiento DEBEN quedar vinculados al registro en el
  historial de cada lote ("Restauración clase II · 1 cartucho").

**Historial**

- **FR-019**: El sistema DEBE listar los tratamientos registrados del lugar activo (o de todos, con
  su lugar) del más reciente al más antiguo, con totales por período (hoy, semana, mes) que excluyan
  los anulados.

**Offline, permisos y aislamiento**

- **FR-020**: Definir tratamientos, registrar, anular y ver costos DEBEN funcionar sin conexión y
  sincronizarse después, conservando la autoría (Constitución I y VI).
- **FR-021**: Los tratamientos, registros y porcentajes DEBEN estar aislados por tenant (spec 014).
- **FR-022**: Todo el equipo del tenant DEBE poder ver precios de tratamientos, costos, comisiones
  y ganancias estimadas, sin restricción por rol (Clarifications Q3, coherente con la spec 015).
- **FR-023**: Los controles nuevos DEBEN tener un área táctil de al menos 48 × 48 px (Constitución
  III), y registrar un tratamiento NO DEBE activar la cámara (Constitución V).

### Key Entities *(include if feature involves data)*

- **Tratamiento**: nombre, estado (activo/desactivado), lista de materiales. Compartido por el
  tenant. Editado con historial de cambios.
- **Precio del tratamiento en un lugar**: tratamiento, lugar de trabajo y precio en pesos (≥ 0).
  Sin precio definido = sin precio en ese lugar.
- **Material de tratamiento**: insumo y cantidad estándar en la unidad de consumo del insumo
  (con la unidad registrada, para convertirla si el insumo cambia de unidad).
- **Porcentaje profesional del lugar**: atributo nuevo del lugar de trabajo (spec 014), 0–100.
- **Tratamiento realizado**: registro con fecha, autor, lugar, tratamiento, snapshot de precio,
  porcentaje, materiales usados con su costo unitario, costo total y ganancia estimada; estado
  vigente o anulado (con autor y fecha de la anulación).
- **Consumo de tratamiento**: los movimientos de consumo (y sus ajustes al anular) vinculados al
  tratamiento realizado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar un tratamiento realizado con sus cantidades estándar toma 3 toques o
  menos desde la lista de Tratamientos, frente a un consumo por cada material hoy.
- **SC-002**: En el 100 % de los tratamientos con todos sus materiales con precio, el costo de
  materiales, la comisión y la ganancia estimada coinciden con las fórmulas del DS §27 (verificable
  con el ejemplo del DS).
- **SC-003**: El 100 % de los registros conservan su costo y ganancia del momento aunque después
  cambien precios, costos o porcentajes.
- **SC-004**: Ningún registro deja un lote con stock negativo por sí solo, ni descuenta materiales
  de otro lugar.
- **SC-005**: Registrar y anular tratamientos funciona sin conexión y llega al servidor al volver
  la red, sin pérdidas ni duplicados.
- **SC-006**: Ningún usuario de otro tenant ve tratamientos, registros ni porcentajes ajenos.
- **SC-007**: La clienta define al menos 5 tratamientos reales y confirma que la ganancia estimada
  le resulta creíble para su práctica.

## Assumptions

- La fórmula del DS §27 asume que la profesional paga los materiales con su comisión; se usa tal
  cual. Otros esquemas de reparto (la clínica paga materiales, arriendo fijo del box) quedan fuera.
- No se registran datos de pacientes: el registro identifica el tratamiento, el lugar, la fecha y
  quién lo registró, no a quién se le hizo. Esto evita datos clínicos sensibles.
- Un solo porcentaje profesional por lugar aplica a todas las personas del tenant en ese lugar
  (comisiones por profesional quedan fuera).
- El costo unitario es el vigente de la spec 015 (último ingreso con precio, en todo el tenant).
- Los totales del historial son simples (conteo y sumas por período); KPIs, comparaciones y
  gráficos son de la spec 017.
- **Barra inferior móvil** (FR-005): mover Compras a "Más" es una decisión de diseño tomada para que
  quepan 5 ítems legibles en 375 px, conservando Alertas por su rol clínico. Queda pendiente de
  validar con la clienta; la alternativa es dejar Compras y llevar Alertas al encabezado con su
  badge.
- Se reutilizan el consumo FEFO, el aviso con "Deshacer" y la marca de lotes en revisión ante
  sobreconsumo de las specs 002, 007 y 014.
